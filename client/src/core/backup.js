// Backup file, compatible with the Android app's "yomtov" format v1 (export on one, import on the other).
// A backup is untrusted input: parse validates every field and drops what it cannot understand.
import { daysInMonth, isLeapYear } from './hebrew.js'

export const APP = 'yomtov'
export const VERSION = 1
export const MAX_ENTRIES = 200_000
export const MAX_PROFILES = 50
export const MAX_TEXT = 10_000
export const MAX_NAME = 20

export class BackupError extends Error {
  constructor(kind) { super(kind); this.kind = kind } // not_backup | newer | too_large
}

/** Entries/profiles as the app holds them -> Android-format JSON (profile ids become numbers). */
export function writeBackup({ entries, profiles, settings }) {
  const num = new Map(profiles.map((p, i) => [p.id, i + 1]))
  return JSON.stringify({
    app: APP,
    formatVersion: VERSION,
    exportedAt: new Date().toISOString(),
    settings: { cityId: settings.cityId, useSunset: settings.useSunset, familyEnabled: settings.familyEnabled },
    profiles: profiles.map((p) => ({ id: num.get(p.id), name: p.name, colorIndex: p.colorIndex, createdAt: p.createdAt })),
    entries: entries.map((e) => ({
      text: e.text, type: e.type === 'world' ? 'WORLD' : 'ME', createdAt: e.createdAt,
      hebYear: e.hebYear, hebMonth: e.hebMonth, hebDay: e.hebDay,
      afterNightfall: !!e.afterNightfall, profileId: num.get(e.profileId) || 0, sharedWithFamily: !!e.shared,
    })),
  }, null, 2)
}

const validDate = (y, m, d) =>
  Number.isInteger(y) && y >= 3761 && y <= 9999 && Number.isInteger(m) && m >= 1 && m <= 13 &&
  (m !== 13 || isLeapYear(y)) && Number.isInteger(d) && d >= 1 && d <= daysInMonth(y, m)

export function parseBackup(json) {
  let root
  try { root = JSON.parse(json) } catch { throw new BackupError('not_backup') }
  if (!root || root.app !== APP) throw new BackupError('not_backup')
  const v = Number.isInteger(root.formatVersion) ? root.formatVersion : -1
  if (v < 1) throw new BackupError('not_backup')
  if (v > VERSION) throw new BackupError('newer')
  const rawProfiles = Array.isArray(root.profiles) ? root.profiles : []
  const rawEntries = Array.isArray(root.entries) ? root.entries : []
  if (rawProfiles.length > MAX_PROFILES || rawEntries.length > MAX_ENTRIES) throw new BackupError('too_large')

  const profiles = []
  let skippedProfiles = 0
  for (const p of rawProfiles) {
    const name = typeof p?.name === 'string' ? p.name.trim().slice(0, MAX_NAME) : ''
    if (!name || !Number.isInteger(p.id) || p.id <= 0) { skippedProfiles++; continue }
    profiles.push({ id: p.id, name, colorIndex: Number.isInteger(p.colorIndex) ? p.colorIndex : 0, createdAt: Number.isFinite(p.createdAt) ? p.createdAt : 0 })
  }
  const known = new Set(profiles.map((p) => p.id))

  const entries = []
  let skippedEntries = 0
  for (const e of rawEntries) {
    const text = typeof e?.text === 'string' ? e.text.trim().slice(0, MAX_TEXT) : ''
    if (!text || (e.type !== 'ME' && e.type !== 'WORLD') || !validDate(e.hebYear, e.hebMonth, e.hebDay) ||
        !Number.isFinite(e.createdAt) || e.createdAt < 0) { skippedEntries++; continue }
    entries.push({
      text, type: e.type === 'WORLD' ? 'world' : 'me', createdAt: Math.trunc(e.createdAt),
      hebYear: e.hebYear, hebMonth: e.hebMonth, hebDay: e.hebDay,
      afterNightfall: e.afterNightfall === true,
      profileId: known.has(e.profileId) ? e.profileId : 0, // 0 = nobody in particular
      shared: e.sharedWithFamily === true,
    })
  }
  return { profiles, entries, skippedEntries, skippedProfiles, settings: root.settings || {} }
}
