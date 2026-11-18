// Daily reminders via Web Push. A free Render instance sleeps, so something external (a free cron
// service) calls /api/cron/tick every few minutes; that call both wakes the server and sends whatever is due.
// HARD RULE: never notify on Shabbat or Yom Tov (isRestTime, with generous margins) - checked per send.
const webpush = require('web-push')
const { getDb } = require('./firestore')
// The date/rest/prompt logic is shared with the client (plain ES modules, loaded via require(esm)).
const { resolveDate, zonedParts, civilKey } = require('../../client/src/core/hebrew.js')
const { cityById } = require('../../client/src/core/cities.js')
const { isRestTime } = require('../../client/src/core/rest.js')
const { pickPrompt } = require('../../client/src/core/prompts.js')

const COLLECTION = 'goodday_push'
const WINDOW_MIN = 10 // a reminder is due for this long after its time (covers a missed or late cron call)
const TTL_SECONDS = 600 // drop an undelivered push instead of showing it late (e.g. into Shabbat)

let send = (...args) => webpush.sendNotification(...args)
/** For tests: replace the real sender. */
const setSender = (fn) => { send = fn }

let configured = false
function configure() {
  if (configured) return true
  const { VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
  return true
}

/** Evening reminders are skipped when the user (or, in the family game, everyone) already wrote today. */
async function eveningStatus(s, hebrew) {
  if (!s.uid) return { skip: false }
  const user = getDb().collection('goodday_users').doc(s.uid)
  const snap = await user.collection('entries')
    .where('hebYear', '==', hebrew.year).where('hebMonth', '==', hebrew.month).where('hebDay', '==', hebrew.day).get()
  const entries = snap.docs.map((d) => d.data()).filter((e) => !e.deleted)
  if (s.familyEnabled) {
    const members = (await user.collection('profiles').get()).docs.map((d) => d.data()).filter((p) => !p.deleted)
    if (members.length) {
      const writers = new Set(entries.map((e) => e.profileId))
      if (members.every((m) => writers.has(m.id))) return { skip: true }
      return { skip: false, family: true }
    }
  }
  return { skip: entries.length > 0 }
}

async function tick(now = new Date()) {
  const result = { checked: 0, sent: 0, skippedRest: 0, removed: 0, errors: 0 }
  if (!configure()) return { ...result, error: 'vapid_not_configured' }
  const db = getDb()
  const docs = (await db.collection(COLLECTION).get()).docs
  for (const doc of docs) {
    const s = doc.data()
    result.checked++
    const city = cityById(s.cityId)
    const local = zonedParts(now, city.zone)
    const minuteNow = local.hh * 60 + local.mm
    const today = civilKey(local)
    for (const kind of ['morning', 'evening']) {
      const cfg = s[kind]
      if (!cfg?.enabled) continue
      if (((minuteNow - cfg.minute) % 1440 + 1440) % 1440 >= WINDOW_MIN) continue
      if (s.lastSent?.[kind] === today) continue
      if (isRestTime(city, now)) { result.skippedRest++; continue }
      const lang = s.lang === 'en' ? 'en' : 'he'
      let body = pickPrompt(kind, lang, local)
      if (kind === 'evening') {
        const st = await eveningStatus(s, resolveDate(now, city, s.useSunset !== false).hebrew)
        if (st.skip) continue
        if (st.family) body = pickPrompt('family', lang, local)
      }
      try {
        await send(
          { endpoint: s.endpoint, keys: s.keys },
          JSON.stringify({ title: lang === 'he' ? 'יום טוב' : 'Good Day', body, tag: 'goodday-' + kind }),
          { TTL: TTL_SECONDS, urgency: 'low' },
        )
        await doc.ref.set({ lastSent: { ...(s.lastSent || {}), [kind]: today } }, { merge: true })
        result.sent++
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) { await doc.ref.delete(); result.removed++; break }
        result.errors++
        console.error('push failed', e.statusCode || e.message)
      }
    }
  }
  return result
}

module.exports = { tick, COLLECTION, configure, setSender }
