const crypto = require('crypto')
const express = require('express')
const jwt = require('jsonwebtoken')
const { getDb } = require('../services/firestore')
const { tick, COLLECTION } = require('../services/reminders')
const { CITIES } = require('../../client/src/core/cities.js')

const router = express.Router()
const docFor = (endpoint) => getDb().collection(COLLECTION).doc(crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 40))
const cityIds = new Set(CITIES.map((c) => c.id))

const slot = (v) => ({
  enabled: v?.enabled === true,
  minute: Number.isInteger(v?.minute) && v.minute >= 0 && v.minute < 1440 ? v.minute : 0,
})

/** Optional sign-in: lets the evening reminder skip when the user already wrote (needs synced entries). */
function optionalUid(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '')
  if (!m || !process.env.JWT_SECRET) return ''
  try { return jwt.verify(m[1], process.env.JWT_SECRET).uid } catch { return '' }
}

router.get('/key', (req, res) => {
  if (!process.env.VAPID_PUBLIC) return res.status(503).json({ error: 'push_not_configured' })
  res.json({ key: process.env.VAPID_PUBLIC })
})

// Create or update this device's subscription and reminder preferences
router.put('/', async (req, res, next) => {
  try {
    const sub = req.body?.subscription
    const p = req.body?.prefs || {}
    const endpoint = sub?.endpoint
    if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 1000 ||
        typeof sub?.keys?.p256dh !== 'string' || typeof sub?.keys?.auth !== 'string') {
      return res.status(400).json({ error: 'bad_subscription' })
    }
    if (!cityIds.has(p.cityId)) return res.status(400).json({ error: 'bad_city' })
    await docFor(endpoint).set({
      endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      uid: optionalUid(req),
      lang: p.lang === 'en' ? 'en' : 'he', cityId: p.cityId, useSunset: p.useSunset !== false,
      familyEnabled: p.familyEnabled === true,
      evening: slot(p.evening), morning: slot(p.morning),
      updatedAt: Date.now(),
    }, { merge: true }) // merge keeps lastSent so changing a setting cannot cause a duplicate today
    res.json({ ok: true })
  } catch (e) { next(e) }
})

router.delete('/', async (req, res, next) => {
  try {
    const endpoint = req.body?.endpoint
    if (typeof endpoint === 'string') await docFor(endpoint).delete()
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// Called every few minutes by an external cron; also keeps the free instance awake.
router.get('/tick', async (req, res, next) => {
  const want = process.env.CRON_SECRET || ''
  const got = String(req.query.key || '')
  const ok = want.length >= 16 && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))
  if (!ok) return res.status(401).json({ error: 'unauthorized' })
  try { res.json(await tick()) } catch (e) { next(e) }
})

module.exports = router
