// Simulates a sleeping Render instance: requests hang, then a placeholder HTML page, then the real server.
import test from 'node:test'
import assert from 'node:assert/strict'

const t0 = Date.now()
const el = () => Date.now() - t0
globalThis.window = { addEventListener() {} }
globalThis.document = { addEventListener() {} }
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
globalThis.fetch = async (url, { signal } = {}) => {
  if (el() < 6000) { // hung: only resolves when the client's own timeout aborts it
    return new Promise((_, rej) => signal.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))
  }
  if (el() < 9000) return new Response('<html>Service waking up</html>', { status: 200 }) // host placeholder
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}

const wake = await import('../src/wake.js')

test('cold start: popup appears, placeholder is not mistaken for ready, then ready', async () => {
  const seen = []
  wake.subscribeWake(() => { const s = wake.getWake().status; if (seen.at(-1) !== s) seen.push(s) })
  const ready = wake.whenReady()
  await new Promise((r) => setTimeout(r, 4200))
  assert.equal(wake.getWake().status, 'waking', 'popup state after 3.5 s')
  assert.equal(await ready, true)
  assert.deepEqual(seen, ['checking', 'waking', 'ready'])
  assert.equal(wake.getWake().justWoke, true)
  assert.ok(el() >= 9000, 'did not report ready from the placeholder page')
})

test('warm server: no popup state at all', async () => {
  wake.markStale()
  const seen = []
  wake.subscribeWake(() => { const s = wake.getWake().status; if (seen.at(-1) !== s) seen.push(s) })
  await wake.whenReady()
  assert.ok(!seen.includes('waking'))
  assert.equal(wake.getWake().justWoke, false)
})
