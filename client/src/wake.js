// Tracks whether the backend is awake. A free Render instance sleeps after ~15 min idle and
// takes 30-60 s to boot, during which requests hang or return a Render placeholder page.
// Nothing in the app blocks on this: it only drives the "longer wait" dialog and decides when
// syncing can happen. Everything the user does is written to local storage first.
import { api } from './api.js'

const POPUP_AFTER_MS = 3500 // a normal (warm) server answers well before this
const GIVE_UP_MS = 120_000 // after this, say so and keep retrying quietly
const STALE_AFTER_MS = 4 * 60_000 // re-check when returning to the tab after this long

// idle | checking | waking | unreachable | ready | offline
let state = { status: 'idle', startedAt: 0, readyAt: 0, dismissed: false, justWoke: false }
const listeners = new Set()
let running = false
let readyWaiters = []

function set(patch) {
  state = { ...state, ...patch }
  listeners.forEach((f) => f())
}

export const getWake = () => state
export function subscribeWake(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const dismissWake = () => set({ dismissed: true })
export const clearJustWoke = () => set({ justWoke: false })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function ping() {
  // Must be our JSON, not the HTML placeholder Render serves while booting.
  const data = await api('/api/health', { timeout: 10_000, cache: 'no-store' })
  if (data?.ok !== true) throw new Error('not ready')
}

/** Start (or join) a wake-up check. Safe to call any time. */
export async function checkServer() {
  if (running) return
  running = true
  const startedAt = Date.now()
  set({ status: 'checking', startedAt, dismissed: false, justWoke: false })
  const popupTimer = setTimeout(() => {
    if (state.status === 'checking') set({ status: 'waking' })
  }, POPUP_AFTER_MS)

  try {
    for (;;) {
      if (navigator.onLine === false) {
        set({ status: 'offline' })
        return
      }
      try {
        await ping()
        const waited = Date.now() - startedAt
        set({ status: 'ready', readyAt: Date.now(), justWoke: waited > POPUP_AFTER_MS })
        readyWaiters.forEach((r) => r(true))
        readyWaiters = []
        return
      } catch {
        /* keep trying */
      }
      const waited = Date.now() - startedAt
      if (waited > GIVE_UP_MS && state.status !== 'unreachable') set({ status: 'unreachable' })
      await sleep(waited > GIVE_UP_MS ? 15_000 : 2_000)
    }
  } finally {
    clearTimeout(popupTimer)
    running = false
  }
}

/** Resolves true once the server answers; used before login/register/sync. */
export function whenReady() {
  if (state.status === 'ready') return Promise.resolve(true)
  const p = new Promise((resolve) => readyWaiters.push(resolve))
  checkServer()
  return p
}

/** A request failed in a way that suggests the server went back to sleep. */
export function markStale() {
  if (state.status === 'ready') {
    set({ status: 'idle' })
    checkServer()
  }
}

let started = false
export function initWake() {
  if (started) return
  started = true
  checkServer()
  window.addEventListener('online', () => checkServer())
  window.addEventListener('offline', () => set({ status: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (state.status === 'ready' && Date.now() - state.readyAt > STALE_AFTER_MS) {
      set({ status: 'idle' })
      checkServer()
    } else if (state.status === 'offline' || state.status === 'idle') {
      checkServer()
    }
  })
}
