// Manual check (touches the real Firestore with one temporary doc, then deletes it):
//   node test/reminders.manual.js
// Verifies the daily reminder job: sends once when due, never twice a day, never on Shabbat/Yom Tov.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const assert = require('node:assert/strict')
const sent = []
const { tick, COLLECTION, setSender } = require('../services/reminders')
setSender(async (sub, payload, opts) => { sent.push({ sub, payload: JSON.parse(payload), opts }) })
const { getDb } = require('../services/firestore')

;(async () => {
  const ref = getDb().collection(COLLECTION).doc('zz-reminder-test')
  const base = {
    endpoint: 'https://example.invalid/push/zz', keys: { p256dh: 'x', auth: 'y' }, uid: '',
    lang: 'he', cityId: 'jerusalem', useSunset: true, familyEnabled: false,
    evening: { enabled: true, minute: 21 * 60 }, morning: { enabled: false, minute: 8 * 60 },
  }
  try {
    const mine = (r) => r.sent
    await ref.set(base)
    // Wednesday 21:00 in Jerusalem (19:00Z): due
    let r = await tick(new Date('2026-11-18T19:02:00Z'))
    assert.equal(r.sent, 1, 'sent on a normal evening'); assert.equal(sent.at(-1).opts.TTL, 600)
    assert.match(sent.at(-1).payload.body, /\S/)
    // Same evening again (the cron calls every few minutes): not twice
    r = await tick(new Date('2026-11-18T19:07:00Z'))
    assert.equal(r.sent, 0, 'not sent twice in a day')
    // Not due outside the window
    await ref.set(base)
    r = await tick(new Date('2026-11-18T17:00:00Z'))
    assert.equal(r.sent, 0, 'not sent when not due')
    // Friday night 21:00 (Shabbat has begun): HARD RULE, silent
    await ref.set(base)
    r = await tick(new Date('2026-11-20T19:02:00Z'))
    assert.equal(r.sent, 0, 'never on Shabbat'); assert.equal(r.skippedRest, 1)
    // Rosh Hashana morning
    await ref.set({ ...base, evening: { enabled: false, minute: 0 }, morning: { enabled: true, minute: 8 * 60 } })
    r = await tick(new Date('2026-09-12T05:02:00Z')) // 08:02 Jerusalem
    assert.equal(r.sent, 0, 'never on Yom Tov'); assert.equal(r.skippedRest, 1)
    // The same morning prompt on a plain weekday does go out
    await ref.set({ ...base, evening: { enabled: false, minute: 0 }, morning: { enabled: true, minute: 8 * 60 } })
    r = await tick(new Date('2026-11-18T06:02:00Z'))
    assert.equal(r.sent, 1, 'morning prompt on a weekday')
    console.log('reminder checks passed; sends:', sent.length)
  } finally {
    await ref.delete()
  }
  process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
