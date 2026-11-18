// Stale-while-revalidate for the app shell and assets. The key point for a sleeping free Render
// instance: the page and its JS/CSS come from cache immediately, instead of waiting 30-60 s for the
// server. /api requests are never touched here (the app handles them itself).
const CACHE = 'goodday-shell-v1'
const PRECACHE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // Every page URL is the same single-page app, so navigations share one cache entry
  const key = req.mode === 'navigate' ? '/' : req
  event.respondWith(
    caches.match(key).then((cached) => {
      const network = fetch(req)
        .then(async (res) => {
          if (!res.ok) return res
          const copy = res.clone()
          // Never cache a host placeholder (e.g. Render's "waking up" page) as the app shell
          if (req.mode === 'navigate' && !(await copy.clone().text()).includes('id="root"')) return res
          const c = await caches.open(CACHE)
          await c.put(key, copy)
          return res
        })
        .catch(() => null)
      if (cached) {
        event.waitUntil(network) // refresh in the background for next time
        return cached
      }
      return network.then((res) => res || Response.error())
    }),
  )
})
