import test from 'node:test'
import assert from 'node:assert/strict'
import { CITIES, searchCities, cityById, inIsrael } from '../src/core/cities.js'
import { restEnd, isRestTime } from '../src/core/rest.js'

const jlm = cityById('jerusalem')

test('city ids are unique and every Israeli city shares the Israel zone', () => {
  assert.equal(new Set(CITIES.map((c) => c.id)).size, CITIES.length)
  assert.ok(CITIES.filter(inIsrael).length >= 55)
  for (const c of CITIES) assert.ok(Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180)
})
test('search finds by Hebrew or English, ignoring case, spaces, quotes and niqqud', () => {
  assert.ok(searchCities('ירו').some((c) => c.id === 'jerusalem'))
  assert.ok(searchCities('MODI').some((c) => c.id === 'modiin'))
  assert.ok(searchCities("ra'an").some((c) => c.id === 'raanana'))
  assert.ok(searchCities('raanana').some((c) => c.id === 'raanana'))
  assert.ok(searchCities('קריית').length >= 8)
  assert.equal(searchCities('zzzz').length, 0)
  assert.equal(searchCities('  ').length, CITIES.length)
})
test('restEnd: Shabbat ends after nightfall, null on a plain day', () => {
  const end = restEnd(jlm, new Date('2026-11-21T10:00:00Z'))
  assert.ok(end > new Date('2026-11-21T14:30:00Z') && end < new Date('2026-11-21T16:30:00Z'))
  assert.equal(isRestTime(jlm, end), false)
  assert.equal(restEnd(jlm, new Date('2026-11-18T10:00:00Z')), null)
  // Rosh Hashana 5787 (Sat-Sun-Mon in the diaspora) runs several days: the end is after the last one
  const ny = cityById('new-york')
  const e = restEnd(ny, new Date('2026-09-12T15:00:00Z'))
  assert.ok(e > new Date('2026-09-13T22:00:00Z'))
})
