const TYPES = new Set(['me', 'world'])

function str(v, max) {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/** Returns a clean entry or null when the input is unusable. */
function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = str(raw.id, 64)
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return null
  const deleted = raw.deleted === true
  const text = str(raw.text, 5000).trim()
  if (!deleted && !text) return null
  if (!TYPES.has(raw.type)) return null
  const out = { id, text: deleted ? '' : text, type: raw.type, deleted }
  for (const k of ['hebYear', 'hebMonth', 'hebDay', 'createdAt', 'updatedAt']) {
    if (!Number.isSafeInteger(raw[k])) return null
    out[k] = raw[k]
  }
  if (out.hebMonth < 1 || out.hebMonth > 13 || out.hebDay < 1 || out.hebDay > 30) return null
  return out
}

function validEmail(e) {
  return typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

module.exports = { cleanEntry, validEmail }
