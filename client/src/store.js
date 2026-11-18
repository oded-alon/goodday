// In-memory mirror of the local database + the single place entries change.
// Writes go to IndexedDB first; the network is never on this path.
import * as db from './db.js'

let entries = new Map()
let snapshot = { list: [], loaded: false }
const listeners = new Set()
let onLocalChange = () => {}

function emit() {
  snapshot = { list: [...entries.values()].filter((e) => !e.deleted), loaded: true }
  listeners.forEach((f) => f())
}

export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn))
export const getSnapshot = () => snapshot
export const setChangeHandler = (fn) => { onLocalChange = fn }

export async function load() {
  for (const e of await db.allEntries()) entries.set(e.id, e)
  emit()
}

const uid = () => crypto.randomUUID().replace(/-/g, '')

export async function addEntry({ text, type, date }) {
  const now = Date.now()
  const e = {
    id: uid(), text: text.trim(), type,
    hebYear: date.year, hebMonth: date.month, hebDay: date.day,
    createdAt: now, updatedAt: now, deleted: false, dirty: true,
  }
  if (!e.text) return
  entries.set(e.id, e)
  emit()
  await db.putEntries([e])
  onLocalChange()
}

export async function removeEntry(id) {
  const cur = entries.get(id)
  if (!cur) return
  // A tombstone, not a hard delete, so the deletion reaches other devices
  const e = { ...cur, deleted: true, text: '', updatedAt: Date.now(), dirty: true }
  entries.set(id, e)
  emit()
  await db.putEntries([e])
  onLocalChange()
}

export const dirtyEntries = () => [...entries.values()].filter((e) => e.dirty)

/** The server has taken these; clear the flag unless the entry changed again meanwhile. */
export async function markClean(sent, acceptedIds) {
  const ok = new Set(acceptedIds)
  const changed = []
  for (const s of sent) {
    const cur = entries.get(s.id)
    if (cur && ok.has(s.id) && cur.updatedAt === s.updatedAt) {
      const next = { ...cur, dirty: false }
      entries.set(s.id, next)
      changed.push(next)
    }
  }
  if (changed.length) await db.putEntries(changed)
}

export async function applyRemote(list) {
  const changed = []
  for (const r of list) {
    const cur = entries.get(r.id)
    if (cur && cur.dirty && cur.updatedAt > r.updatedAt) continue // local edit is newer
    const { serverTs, ...rest } = r // eslint-disable-line no-unused-vars
    const next = { ...rest, dirty: false }
    entries.set(r.id, next)
    changed.push(next)
  }
  if (changed.length) {
    await db.putEntries(changed)
    emit()
  }
}

export async function wipe() {
  entries = new Map()
  await db.clearEntries()
  emit()
}
