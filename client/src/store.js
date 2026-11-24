// In-memory mirror of the local database + the single place entries and family members change.
// Writes go to IndexedDB first; the network is never on this path.
import * as db from './db.js'
import { getSettings, updateSettings } from './settings.js'

export const MAX_NAME = 20
export const PALETTE_SIZE = 8

let entries = new Map()
let profiles = new Map()
let snapshot = { entries: [], profiles: [], loaded: false }
const listeners = new Set()
let onLocalChange = () => {}

const byCreated = (a, b) => a.createdAt - b.createdAt

function emit() {
  snapshot = {
    entries: [...entries.values()].filter((e) => !e.deleted),
    profiles: [...profiles.values()].filter((p) => !p.deleted).sort(byCreated),
    loaded: true,
  }
  listeners.forEach((f) => f())
}

export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn))
export const getSnapshot = () => snapshot
export const setChangeHandler = (fn) => { onLocalChange = fn }

export async function load() {
  for (const e of await db.allEntries()) entries.set(e.id, e)
  for (const p of await db.allProfiles()) profiles.set(p.id, p)
  emit()
}

const uid = () => crypto.randomUUID().replace(/-/g, '')

async function saveEntries(list) {
  list.forEach((e) => entries.set(e.id, e))
  emit()
  await db.putEntries(list)
  onLocalChange()
}
async function saveProfiles(list) {
  list.forEach((p) => profiles.set(p.id, p))
  emit()
  await db.putProfiles(list)
  onLocalChange()
}

/** `profileId` is the writer, picked per entry; it is required while the family game is on. */
export async function addEntry({ text, type, date, afterNightfall = false, shared = false, profileId = '' }) {
  const clean = text.trim()
  if (!clean) return null
  if (getSettings().familyEnabled && !profileId) return null
  const now = Date.now()
  const s = getSettings()
  const e = {
    id: uid(), text: clean, type,
    hebYear: date.year, hebMonth: date.month, hebDay: date.day,
    afterNightfall, profileId, shared: s.familyEnabled && shared,
    createdAt: now, updatedAt: now, deleted: false, dirty: true,
  }
  await saveEntries([e])
  return e
}

export async function removeEntry(id) {
  const cur = entries.get(id)
  if (!cur) return
  // A tombstone, not a hard delete, so the deletion reaches other devices
  await saveEntries([{ ...cur, deleted: true, text: '', updatedAt: Date.now(), dirty: true }])
}

// ---- family members ---------------------------------------------------------------------------
/** The first member also switches the game on and takes over entries written before it existed. */
export async function addMember(name) {
  const clean = name.trim().slice(0, MAX_NAME)
  if (!clean) return
  const existing = snapshot.profiles.length
  const now = Date.now()
  const p = { id: uid(), name: clean, colorIndex: existing % PALETTE_SIZE, createdAt: now, updatedAt: now, deleted: false, dirty: true }
  if (existing === 0) {
    const orphans = snapshot.entries.filter((e) => !e.profileId).map((e) => ({ ...e, profileId: p.id, updatedAt: now, dirty: true }))
    if (orphans.length) await saveEntries(orphans)
    updateSettings({ familyEnabled: true })
  }
  await saveProfiles([p])
}

/** Removes the member and everything they wrote. The game switches itself off when nobody is left. */
export async function removeMember(id) {
  const cur = profiles.get(id)
  if (!cur) return
  const now = Date.now()
  const theirs = snapshot.entries.filter((e) => e.profileId === id).map((e) => ({ ...e, deleted: true, text: '', updatedAt: now, dirty: true }))
  if (theirs.length) await saveEntries(theirs)
  await saveProfiles([{ ...cur, deleted: true, name: '', updatedAt: now, dirty: true }])
  const remaining = snapshot.profiles
  if (!remaining.length) updateSettings({ familyEnabled: false, viewerId: '' })
  else if (getSettings().viewerId === id) updateSettings({ viewerId: '' })
}

// ---- backup import: merge, never wipes ---------------------------------------------------------------
const sig = (e) => `${e.type}|${e.createdAt}|${e.hebYear}-${e.hebMonth}-${e.hebDay}|${e.text}`

export async function importBackup(parsed) {
  const now = Date.now()
  const idMap = new Map() // backup profile id -> local id
  const newProfiles = []
  for (const bp of parsed.profiles) {
    // A member with the same name already here is the same person
    const same = snapshot.profiles.find((p) => p.name.toLowerCase() === bp.name.toLowerCase())
    if (same) { idMap.set(bp.id, same.id); continue }
    const p = { id: uid(), name: bp.name, colorIndex: bp.colorIndex % PALETTE_SIZE, createdAt: bp.createdAt || now, updatedAt: now, deleted: false, dirty: true }
    idMap.set(bp.id, p.id)
    newProfiles.push(p)
  }
  const have = new Set([...entries.values()].filter((e) => !e.deleted).map(sig))
  const added = []
  let dupes = 0
  for (const be of parsed.entries) {
    const e = {
      id: uid(), text: be.text, type: be.type, hebYear: be.hebYear, hebMonth: be.hebMonth, hebDay: be.hebDay,
      afterNightfall: be.afterNightfall, profileId: idMap.get(be.profileId) || '', shared: be.shared,
      createdAt: be.createdAt, updatedAt: now, deleted: false, dirty: true,
    }
    if (have.has(sig(e))) { dupes++; continue }
    have.add(sig(e))
    added.push(e)
  }
  if (newProfiles.length) await saveProfiles(newProfiles)
  if (added.length) await saveEntries(added)
  if (newProfiles.length) updateSettings({ familyEnabled: true })
  return { added: added.length, dupes, members: newProfiles.length, skipped: parsed.skippedEntries }
}

// ---- sync support -------------------------------------------------------------------------------------
export const dirtyEntries = () => [...entries.values()].filter((e) => e.dirty)
export const dirtyProfiles = () => [...profiles.values()].filter((p) => p.dirty)
export const hasDirty = () => dirtyEntries().length > 0 || dirtyProfiles().length > 0

async function clean(map, sent, acceptedIds, persist) {
  const ok = new Set(acceptedIds)
  const changed = []
  for (const s of sent) {
    const cur = map.get(s.id)
    // Clear the flag unless the item changed again while the request was in flight
    if (cur && ok.has(s.id) && cur.updatedAt === s.updatedAt) {
      const next = { ...cur, dirty: false }
      map.set(s.id, next)
      changed.push(next)
    }
  }
  if (changed.length) await persist(changed)
}
export const markClean = (sentEntries, sentProfiles, acc) =>
  Promise.all([
    clean(entries, sentEntries, acc.accepted, db.putEntries),
    clean(profiles, sentProfiles, acc.acceptedProfiles, db.putProfiles),
  ])

async function applyList(map, list, persist) {
  const changed = []
  for (const r of list) {
    const cur = map.get(r.id)
    if (cur && cur.dirty && cur.updatedAt > r.updatedAt) continue // local edit is newer
    const { serverTs, ...rest } = r // eslint-disable-line no-unused-vars
    const next = { ...rest, dirty: false }
    map.set(r.id, next)
    changed.push(next)
  }
  if (changed.length) await persist(changed)
  return changed.length > 0
}
export async function applyRemote(entryList, profileList) {
  const a = await applyList(profiles, profileList || [], db.putProfiles)
  const b = await applyList(entries, entryList || [], db.putEntries)
  if (a || b) emit()
  // Signed in on a new device: members arrived, so switch the family game on
  if (snapshot.profiles.length && !getSettings().familyEnabled) updateSettings({ familyEnabled: true })
}

export async function wipe() {
  entries = new Map()
  profiles = new Map()
  await db.clearEntries()
  await db.clearProfiles()
  emit()
}
