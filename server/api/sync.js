const express = require('express')
const { getDb } = require('../services/firestore')
const { requireAuth } = require('../middlewares/auth')
const { cleanEntry } = require('../services/validate')

const router = express.Router()
const MAX_PUSH = 400 // keeps one request under Firestore's 500-write batch limit
const PAGE = 1000

/**
 * One round-trip syncs both directions:
 *  - body.changes: entries created/edited/deleted on the device
 *  - response.changes: entries that changed on the server after body.since
 * Last write wins by updatedAt. Deletes are tombstones so they sync too.
 * serverTs (set here, never by the client) is the pull cursor.
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const db = getDb()
    const col = db.collection('goodday_users').doc(req.user.uid).collection('entries')
    const incoming = (Array.isArray(req.body?.changes) ? req.body.changes : [])
      .slice(0, MAX_PUSH).map(cleanEntry).filter(Boolean)
    const since = Number.isSafeInteger(req.body?.since) ? req.body.since : 0
    const serverNow = Date.now()

    // Read what the server has first, so the pull below can skip our own writes.
    const accepted = new Set()
    const stale = new Set() // sent by the client but the server copy is newer
    if (incoming.length) {
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
    }

    const snap = await col.where('serverTs', '>', since).orderBy('serverTs').limit(PAGE).get()
    const pulled = snap.docs.map((d) => d.data())
    const changes = pulled.filter((d) => !accepted.has(d.id))
    const more = snap.size === PAGE
    // 5 s of overlap so a concurrent request from another device can't slip between two cursors;
    // re-pulling an entry is harmless (clients apply by updatedAt).
    const cursor = more ? pulled[pulled.length - 1].serverTs : Math.max(since, serverNow - 5000)
    res.json({ changes, cursor, more, accepted: [...accepted, ...stale] })
  } catch (e) { next(e) }
})

module.exports = router
