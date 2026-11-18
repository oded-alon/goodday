// Background sync. Only ever runs when signed in AND the server is awake, never blocks the UI,
// and any failure just leaves entries flagged "dirty" for the next attempt.
import { api } from './api.js'
import * as db from './db.js'
import * as store from './store.js'
import { getWake, markStale, whenReady } from './wake.js'

const AUTH_KEY = 'goodday.auth'

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) } catch { return null }
}
const setAuth = (a) => {
  try { a ? localStorage.setItem(AUTH_KEY, JSON.stringify(a)) : localStorage.removeItem(AUTH_KEY) } catch { /* ignore */ }
  emitAuth()
}

// ---- sync status (for the header badge) ----
let sync = { status: 'local', at: 0 } // local | waiting | syncing | synced | error
const listeners = new Set()
const emitAuth = () => listeners.forEach((f) => f())
const setSync = (p) => { sync = { ...sync, ...p }; emitAuth() }
export const getSync = () => sync
export const subscribeSync = (fn) => (listeners.add(fn), () => listeners.delete(fn))
let authSnapshot = getAuth()
export function getAuthSnapshot() {
  const now = getAuth()
  if (JSON.stringify(now) !== JSON.stringify(authSnapshot)) authSnapshot = now
  return authSnapshot
}

let running = false
let again = false
let timer = null

export function scheduleSync(delay = 1500) {
  clearTimeout(timer)
  timer = setTimeout(syncNow, delay)
}

export async function syncNow() {
  const auth = getAuth()
  if (!auth) return setSync({ status: 'local' })
  if (getWake().status !== 'ready') return setSync({ status: 'waiting' })
  if (running) { again = true; return }
  running = true
  setSync({ status: 'syncing' })
  try {
    do {
      again = false
      let more = true
      while (more) {
        const sent = store.dirtyEntries().slice(0, 400)
        const since = (await db.getMeta('cursor:' + auth.email)) || 0
        const changes = sent.map(({ dirty, ...e }) => e) // eslint-disable-line no-unused-vars
        const r = await api('/api/sync', { method: 'POST', token: auth.token, body: { changes, since }, timeout: 60_000 })
        await store.markClean(sent, r.accepted)
        await store.applyRemote(r.changes)
        await db.setMeta('cursor:' + auth.email, r.cursor)
        more = r.more || (sent.length === 400 && store.dirtyEntries().length > 0)
      }
    } while (again)
    setSync({ status: 'synced', at: Date.now() })
  } catch (e) {
    if (e.status === 401) {
      setAuth(null) // token expired: keep local data, ask to sign in again
      setSync({ status: 'local' })
    } else {
      setSync({ status: 'error' })
      if (e.network) markStale() // probably went back to sleep
    }
  } finally {
    running = false
  }
}

export async function authenticate(mode, email, password) {
  // Waits (showing the "longer wait" dialog) until the server is awake, then asks once.
  await whenReady()
  const r = await api('/api/auth/' + mode, { method: 'POST', body: { email, password }, timeout: 30_000 })
  const prev = getAuth()
  if (prev && prev.email !== r.user.email) await store.wipe()
  setAuth({ token: r.token, email: r.user.email })
  await syncNow()
}

export async function signOut() {
  await syncNow().catch(() => {})
  setAuth(null)
  await store.wipe() // the next person on this device must not see these entries
  await db.clearMeta()
  setSync({ status: 'local' })
}
