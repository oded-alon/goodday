const TYPES = new Set(['me', 'world'])
const ID = /^[A-Za-z0-9_-]{8,64}$/

function str(v, max) {
  return typeof v === 'string' ? v.slice(0, max) : ''
}
const ints = (raw, out, keys) => keys.every((k) => Number.isSafeInteger(raw[k]) && ((out[k] = raw[k]), true))

/** Returns a clean entry or null when the input is unusable. */
function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = str(raw.id, 64)
  if (!ID.test(id)) return null
  const deleted = raw.deleted === true
  const text = str(raw.text, 10_000).trim()
  if (!deleted && !text) return null
  if (!TYPES.has(raw.type)) return null
  const profileId = str(raw.profileId, 64)
  if (profileId && !ID.test(profileId)) return null
  const out = {
    id, text: deleted ? '' : text, type: raw.type, deleted,
    afterNightfall: raw.afterNightfall === true, shared: raw.shared === true, profileId,
  }
  if (!ints(raw, out, ['hebYear', 'hebMonth', 'hebDay', 'createdAt', 'updatedAt'])) return null
  if (out.hebYear < 3761 || out.hebYear > 9999 || out.hebMonth < 1 || out.hebMonth > 13 || out.hebDay < 1 || out.hebDay > 30) return null
  return out
}

/** A family member (profile). */
function cleanProfile(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = str(raw.id, 64)
  if (!ID.test(id)) return null
  const deleted = raw.deleted === true
  const name = str(raw.name, 20).trim()
  if (!deleted && !name) return null
  const out = { id, name, deleted }
  if (!ints(raw, out, ['colorIndex', 'createdAt', 'updatedAt'])) return null
  if (out.colorIndex < 0 || out.colorIndex > 1000) return null
  return out
}

function validEmail(e) {
  return typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

module.exports = { cleanEntry, cleanProfile, validEmail }
