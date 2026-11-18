import { useEffect, useState, useSyncExternalStore } from 'react'
import { clearJustWoke, dismissWake, getWake, subscribeWake } from './wake.js'

const EXPECTED_MS = 50_000 // typical free-tier cold start; only drives the progress bar

export default function WakeDialog({ t }) {
  const wake = useSyncExternalStore(subscribeWake, getWake)
  const [now, setNow] = useState(Date.now())
  const [toast, setToast] = useState(false)
  const open = (wake.status === 'waking' || wake.status === 'unreachable') && !wake.dismissed

  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [open])

  // After a slow start, confirm once that the server is back
  useEffect(() => {
    if (wake.status === 'ready' && wake.justWoke) {
      setToast(true)
      clearJustWoke()
      const id = setTimeout(() => setToast(false), 4000)
      return () => clearTimeout(id)
    }
  }, [wake.status, wake.justWoke])

  const elapsed = Math.max(0, Math.round((now - wake.startedAt) / 1000))
  const pct = Math.min(95, Math.round(((now - wake.startedAt) / EXPECTED_MS) * 100))

  return (
    <>
      {open && (
        <div className="overlay" role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="wake-title">
            <h2 id="wake-title">{t.wakeTitle}</h2>
            <p>{wake.status === 'unreachable' ? t.wakeUnreachable : t.wakeBody}</p>
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={wake.status === 'unreachable' ? undefined : pct}
            >
              <div className={wake.status === 'unreachable' ? 'bar indeterminate' : 'bar'} style={{ width: pct + '%' }} />
            </div>
            <p className="muted small">{t.wakeElapsed(elapsed)}</p>
            <button className="primary" onClick={dismissWake} autoFocus>{t.wakeContinue}</button>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{t.wokeToast}</div>}
    </>
  )
}
