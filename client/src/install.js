import { useEffect, useState } from 'react'

// Chrome fires `beforeinstallprompt` once, early: capture it at import time (main.jsx imports this
// before rendering) so the Settings button can use it whenever the user gets there.
let deferred = null
const listeners = new Set()
const emit = () => listeners.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit() })
  window.addEventListener('appinstalled', () => { deferred = null; emit() })
}

const standalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)

const isIos = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** 'installed' | 'prompt' (one tap install) | 'ios' (manual steps) | 'none' (nothing to offer) */
export function installState() {
  if (standalone()) return 'installed'
  if (deferred) return 'prompt'
  if (isIos()) return 'ios'
  return 'none'
}

export async function promptInstall() {
  if (!deferred) return 'unavailable'
  const e = deferred
  deferred = null // the event can only be used once
  emit()
  e.prompt()
  const { outcome } = await e.userChoice
  return outcome // 'accepted' | 'dismissed'
}

export function useInstallState() {
  const [state, setState] = useState(installState)
  useEffect(() => {
    const f = () => setState(installState())
    listeners.add(f)
    f()
    return () => listeners.delete(f)
  }, [])
  return state
}
