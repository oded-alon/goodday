import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './install.js'

createRoot(document.getElementById('root')).render(<App />)

// The service worker serves the app shell from cache, so the UI opens instantly (and offline)
// even while the free Render backend is still asleep.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
