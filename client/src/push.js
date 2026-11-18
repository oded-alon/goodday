// Daily reminders on the web = Web Push. The server (woken by an external cron) decides when to send;
// the device only subscribes and tells the server its preferences. Nothing is sent on Shabbat or Yom Tov.
import { api } from './api.js'
import { getAuth } from './sync.js'
import { getSettings } from './settings.js'
import { whenReady } from './wake.js'

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const permission = () => (pushSupported() ? Notification.permission : 'unsupported')

const b64ToBytes = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) || navigator.serviceWorker.ready
}

async function getSubscription(create) {
  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub && create) {
    await whenReady() // needs the server for its public key
    const { key } = await api('/api/push/key')
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) })
  }
  return sub
}

const prefs = () => {
  const s = getSettings()
  return {
    lang: s.lang, cityId: s.cityId, useSunset: s.useSunset, familyEnabled: s.familyEnabled,
    evening: s.evening, morning: s.morning,
  }
}

/** Sends the current preferences to the server. Subscribes first if a reminder is on (asks permission). */
export async function syncReminders() {
  if (!pushSupported()) return 'unsupported'
  const s = getSettings()
  const wanted = s.evening.enabled || s.morning.enabled
  if (!wanted && !(await getSubscription(false))) return 'off'
  if (wanted && Notification.permission !== 'granted') {
    if ((await Notification.requestPermission()) !== 'granted') return 'denied'
  }
  const sub = await getSubscription(wanted)
  if (!sub) return 'off'
  await whenReady()
  await api('/api/push', { method: 'PUT', token: getAuth()?.token, body: { subscription: sub.toJSON(), prefs: prefs() } })
  return 'on'
}

/** Removes this device's subscription (when both reminders are off). */
export async function dropSubscription() {
  if (!pushSupported()) return
  const sub = await getSubscription(false)
  if (!sub) return
  try { await api('/api/push', { method: 'DELETE', body: { endpoint: sub.endpoint } }) } catch { /* server asleep: it prunes dead endpoints itself */ }
  await sub.unsubscribe()
}
