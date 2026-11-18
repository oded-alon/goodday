const test = require('node:test')
const assert = require('node:assert/strict')
const { cleanEntry, validEmail } = require('../services/validate')

const base = { id: 'abcdef123456', text: ' hi ', type: 'me', hebYear: 5787, hebMonth: 9, hebDay: 8, createdAt: 1, updatedAt: 2 }

test('cleanEntry trims and keeps valid entries', () => {
  assert.equal(cleanEntry(base).text, 'hi')
})
test('cleanEntry rejects bad ids, types, dates and empty text', () => {
  assert.equal(cleanEntry({ ...base, id: '../x' }), null)
  assert.equal(cleanEntry({ ...base, type: 'x' }), null)
  assert.equal(cleanEntry({ ...base, hebMonth: 14 }), null)
  assert.equal(cleanEntry({ ...base, text: '   ' }), null)
  assert.equal(cleanEntry({ ...base, updatedAt: '2' }), null)
})
test('tombstones may have empty text', () => {
  assert.equal(cleanEntry({ ...base, text: '', deleted: true }).deleted, true)
})
test('validEmail', () => {
  assert.ok(validEmail('a@b.co'))
  assert.ok(!validEmail('nope'))
})
