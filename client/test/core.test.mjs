import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDate, dayId, fromDayId, inYear, anniversaryTargets, shiftMonth, fullLabel } from '../src/core/hebrew.js'
import { cityById } from '../src/core/cities.js'
import { isRestTime, isRestDay } from '../src/core/rest.js'
import * as S from '../src/core/scoring.js'
import { writeBackup, parseBackup, BackupError } from '../src/core/backup.js'

const jlm = cityById('jerusalem')

test('scoring: points per day, no spamming', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 9].map(S.pointsForDay), [0, 3, 4, 6, 6, 6])
})
test('scoring: week starts on Sunday', () => {
  const sun = dayId({ year: 5787, month: 9, day: 8 }) // Wed 18 Nov 2026
  const ws = S.weekStart(sun)
  assert.equal(new Date(ws * 86400000).getUTCDay(), 0)
  assert.equal(sun - ws, 3)
})
test('scoring: full house, streak and team points', () => {
  const d = 20000
  const entries = [{ memberId: 'a', day: d }, { memberId: 'b', day: d }, { memberId: 'a', day: d + 1 }, { memberId: 'a', day: d + 1 }]
  assert.deepEqual([...S.fullHouseDays(entries, ['a', 'b'])], [d])
  const w = S.weekSummary(entries, ['a', 'b'], d)
  assert.equal(w.teamPoints, 3 + 3 + 4 + 5 + 0) // a: 3+4, b: 3, +1 full house
  assert.equal(S.streak(new Set([d, d + 1]), d + 2), 2) // today still open
  assert.equal(S.streak(new Set([d]), d + 2), 0)
})
test('hebrew day flips at sunset in the city zone', () => {
  const day = resolveDate(new Date('2026-11-18T10:00:00Z'), jlm)
  const eve = resolveDate(new Date('2026-11-18T20:00:00Z'), jlm) // 22:00 Jerusalem
  assert.equal(eve.afterNightfall, true)
  assert.equal(eve.hebrew.day, day.hebrew.day + 1)
  assert.equal(resolveDate(new Date('2026-11-18T20:00:00Z'), jlm, false).afterNightfall, false)
})
test('rest time: Shabbat and Yom Tov, with the generous margins', () => {
  assert.equal(isRestTime(jlm, new Date('2026-11-20T10:00:00Z')), false) // Friday morning
  assert.equal(isRestTime(jlm, new Date('2026-11-20T14:30:00Z')), true) // Friday ~16:30, before 16:3x sunset
  assert.equal(isRestTime(jlm, new Date('2026-11-21T10:00:00Z')), true) // Shabbat
  assert.equal(isRestTime(jlm, new Date("2026-11-21T15:30:00Z")), true) // still inside: Shabbat window ends 72 min after sunset (~15:49Z)
  assert.equal(isRestTime(jlm, new Date("2026-11-21T16:30:00Z")), false)
  assert.equal(isRestTime(jlm, new Date('2026-09-12T09:00:00Z')), true) // Rosh Hashana
  assert.equal(isRestDay({ y: 2027, m: 4, d: 23 }, true), false)
  assert.equal(isRestDay({ y: 2027, m: 4, d: 23 }, false), true) // 2nd day, diaspora only
})
test('anniversaries and Adar edge cases', () => {
  const t = { year: 5787, month: 12, day: 30 } // Adar I 30, leap year
  assert.equal(anniversaryTargets(t).length, 10)
  assert.deepEqual(inYear({ year: 5786, month: 12, day: 15 }, 5787), { year: 5787, month: 13, day: 15 })
  assert.deepEqual(inYear({ year: 5787, month: 13, day: 15 }, 5786), { year: 5786, month: 12, day: 15 })
  assert.equal(inYear({ year: 5787, month: 9, day: 30 }, 5786).day, 30)
  assert.deepEqual(shiftMonth({ year: 5787, month: 6 }, 1), { year: 5788, month: 7 })
  assert.equal(fromDayId(dayId({ year: 5787, month: 9, day: 8 })).day, 8)
})
test('backup round trip and hostile input', () => {
  const profiles = [{ id: 'p1', name: 'Dana', colorIndex: 2, createdAt: 5 }]
  const entries = [{ text: 'hi', type: 'world', createdAt: 9, hebYear: 5787, hebMonth: 9, hebDay: 8, afterNightfall: true, profileId: 'p1', shared: true }]
  const back = parseBackup(writeBackup({ entries, profiles, settings: { cityId: 'haifa', useSunset: true, familyEnabled: true } }))
  assert.equal(back.entries[0].type, 'world')
  assert.equal(back.entries[0].shared, true)
  assert.equal(back.profiles[0].name, 'Dana')
  assert.throws(() => parseBackup('{"app":"x"}'), BackupError)
  assert.throws(() => parseBackup('{"app":"yomtov","formatVersion":9}'), (e) => e.kind === 'newer')
  const bad = JSON.stringify({ app: 'yomtov', formatVersion: 1, entries: [{ text: 'x', type: 'ME', createdAt: 1, hebYear: 5787, hebMonth: 13, hebDay: 1 }, { text: '', type: 'ME' }] })
  assert.equal(parseBackup(bad).skippedEntries, 1) // Adar II 5787 is valid (leap year); the empty entry is not
})
