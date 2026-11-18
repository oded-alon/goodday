import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { initWake } from './wake.js'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)
initWake()

// The service worker serves the app shell from cache, so the UI opens instantly (and offline)
// even while the free Render backend is still asleep.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
