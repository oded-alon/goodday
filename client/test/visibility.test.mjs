import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleEntries } from '../src/core/visibility.js'

const entries = [
  { id: 'a-priv', profileId: 'a', shared: false },
  { id: 'a-shared', profileId: 'a', shared: true },
  { id: 'b-priv', profileId: 'b', shared: false },
  { id: 'orphan', profileId: '', shared: false },
]
const ids = (l) => l.map((e) => e.id)

test('game off: everything is visible', () => {
  assert.deepEqual(ids(visibleEntries(entries, false, '')), ids(entries))
})
test('no viewer: shared entries only, whoever wrote them', () => {
  assert.deepEqual(ids(visibleEntries(entries, true, '')), ['a-shared'])
})
test('viewing as a member adds only that member\'s private entries', () => {
  assert.deepEqual(ids(visibleEntries(entries, true, 'a')), ['a-priv', 'a-shared'])
  assert.deepEqual(ids(visibleEntries(entries, true, 'b')), ['a-shared', 'b-priv'])
})
