// Manual check against a running server (node server.js) and the real Firestore; deletes its test user.
//   node test/sync.manual.js [baseUrl]
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const assert = require('node:assert/strict')
const { getDb } = require('../services/firestore')
const B = process.argv[2] || 'http://localhost:3040'
const post = (p, body, token) => fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }))

;(async () => {
  const email = `zz-sync-${Date.now()}@example.com`
  const reg = await post('/api/auth/register', { email, password: 'correct-horse-1' })
  assert.equal(reg.status, 200)
  const token = reg.body.token
  const now = Date.now()
  const prof = { id: 'profile00000001', name: 'דנה', colorIndex: 2, createdAt: now, updatedAt: now, deleted: false }
  const entry = { id: 'entry000000001', text: 'ארוחת שישי', type: 'me', hebYear: 5787, hebMonth: 9, hebDay: 9, createdAt: now, updatedAt: now, deleted: false, afterNightfall: true, profileId: prof.id, shared: true }

  let r = await post('/api/sync', { since: 0, changes: [entry], profiles: [prof] }, token)
  assert.deepEqual(r.body.accepted, [entry.id]); assert.deepEqual(r.body.acceptedProfiles, [prof.id])

  // Another device pulls everything, with the new fields intact
  r = await post('/api/sync', { since: 0, changes: [], profiles: [] }, token)
  assert.equal(r.body.profiles[0].name, 'דנה')
  assert.equal(r.body.changes[0].shared, true); assert.equal(r.body.changes[0].profileId, prof.id); assert.equal(r.body.changes[0].afterNightfall, true)

  // Deleting a member + their entry travels as tombstones
  r = await post('/api/sync', { since: 0, changes: [{ ...entry, deleted: true, text: '', updatedAt: now + 5 }], profiles: [{ ...prof, deleted: true, name: '', updatedAt: now + 5 }] }, token)
  assert.equal(r.body.accepted.length, 1)
  r = await post('/api/sync', { since: 0, changes: [], profiles: [] }, token)
  assert.equal(r.body.profiles[0].deleted, true); assert.equal(r.body.changes[0].deleted, true)

  // An older edit must not overwrite the newer server copy
  r = await post('/api/sync', { since: 0, changes: [{ ...entry, text: 'old', updatedAt: now + 1 }], profiles: [] }, token)
  const after = await post('/api/sync', { since: 0, changes: [], profiles: [] }, token)
  assert.equal(after.body.changes[0].deleted, true)

  // Garbage is dropped, not stored
  r = await post('/api/sync', { since: 0, changes: [{ id: '../x', text: 'bad' }, { ...entry, id: 'entry000000002', profileId: '../etc' }], profiles: [{ id: 'p', name: 'x' }] }, token)
  assert.deepEqual(r.body.accepted, [])
  assert.equal((await post('/api/sync', { since: 0 })).status, 401, 'sync needs a token')

  // cron endpoint: closed without the secret
  assert.equal((await fetch(B + '/api/push/tick')).status, 401)
  assert.equal((await fetch(B + '/api/push/tick?key=wrong')).status, 401)
  const ok = await fetch(B + '/api/push/tick?key=' + process.env.CRON_SECRET)
  assert.equal(ok.status, 200)
  assert.equal((await fetch(B + '/api/push/key').then((x) => x.json())).key, process.env.VAPID_PUBLIC)

  const db = getDb()
  const crypto = require('crypto')
  await db.recursiveDelete(db.collection('goodday_users').doc(crypto.createHash('sha256').update(email).digest('hex').slice(0, 40)))
  console.log('sync + cron endpoint checks passed')
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
