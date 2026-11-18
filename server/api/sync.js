const express = require('express')
const { getDb } = require('../services/firestore')
const { requireAuth } = require('../middlewares/auth')
const { cleanEntry, cleanProfile } = require('../services/validate')

const router = express.Router()
const MAX_PUSH = 400 // entries + profiles per request, under Firestore's 500-write batch limit
const PAGE = 1000

/**
 * One round-trip syncs both directions, for entries and family members (profiles):
 *  - body.changes / body.profiles: items created/edited/deleted on the device
 *  - response.changes / response.profiles: items that changed on the server after body.since
 * Last write wins by updatedAt. Deletes are tombstones so they sync too. serverTs (set here, never
 * by the client) is the pull cursor.
 */
async function merge(db, col, incoming, serverNow) {
  const accepted = new Set()
  const stale = new Set() // the server copy is newer or equal: the client will receive it in the pull
  if (!incoming.length) return { accepted, stale }
  const refs = incoming.map((e) => col.doc(e.id))
  const existing = await db.getAll(...refs)
  const batch = db.batch()
  incoming.forEach((e, i) => {
    const cur = existing[i].exists ? existing[i].data() : null
    if (cur && cur.updatedAt >= e.updatedAt) { stale.add(e.id); return }
    batch.set(refs[i], { ...e, serverTs: serverNow })
    accepted.add(e.id)
  })
  await batch.commit()
  return { accepted, stale }
}

const list = (v, clean, max) => (Array.isArray(v) ? v : []).slice(0, max).map(clean).filter(Boolean)

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const db = getDb()
    const user = db.collection('goodday_users').doc(req.user.uid)
    const entriesCol = user.collection('entries')
    const profilesCol = user.collection('profiles')
    const profiles = list(req.body?.profiles, cleanProfile, MAX_PUSH)
    const entries = list(req.body?.changes, cleanEntry, MAX_PUSH - profiles.length)
    const since = Number.isSafeInteger(req.body?.since) ? req.body.since : 0
    const serverNow = Date.now()

    const p = await merge(db, profilesCol, profiles, serverNow)
    const e = await merge(db, entriesCol, entries, serverNow)

    const pull = (col) => col.where('serverTs', '>', since).orderBy('serverTs').limit(PAGE).get()
    const [eSnap, pSnap] = await Promise.all([pull(entriesCol), pull(profilesCol)])
    const strip = (d) => d.data()
    const eDocs = eSnap.docs.map(strip)
    const pDocs = pSnap.docs.map(strip)
    const more = eSnap.size === PAGE || pSnap.size === PAGE
    // When a page was full the cursor must stop at the smaller of the two page ends
    const ends = [eSnap.size === PAGE && eDocs.at(-1).serverTs, pSnap.size === PAGE && pDocs.at(-1).serverTs].filter(Boolean)
    // 5 s of overlap so a concurrent request from another device can't slip between two cursors;
    // re-pulling an item is harmless (clients apply by updatedAt).
    const cursor = more ? Math.min(...ends) : Math.max(since, serverNow - 5000)
    res.json({
      changes: eDocs.filter((d) => !e.accepted.has(d.id) && d.serverTs <= (more ? cursor : Infinity)),
      profiles: pDocs.filter((d) => !p.accepted.has(d.id) && d.serverTs <= (more ? cursor : Infinity)),
      cursor, more,
      accepted: [...e.accepted, ...e.stale],
      acceptedProfiles: [...p.accepted, ...p.stale],
    })
  } catch (err) { next(err) }
})

module.exports = router
