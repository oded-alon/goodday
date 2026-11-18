// Same origin by default (the Express server also serves the built client).
// Set VITE_API_URL if the client is hosted separately, e.g. a static host that never sleeps.
const BASE = import.meta.env?.VITE_API_URL || ''

export async function api(path, { method = 'GET', body, token, timeout = 45_000, cache } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(BASE + path, {
      method,
      cache,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    })
    let data = null
    try { data = await res.json() } catch { /* non-JSON body */ }
    if (!res.ok) {
      const err = new Error(data?.error || 'http_' + res.status)
      err.status = res.status
      throw err
    }
    return data
  } catch (e) {
    if (e.status === undefined) e.network = true // offline, timeout or aborted
    throw e
  } finally {
    clearTimeout(timer)
  }
}
