// Tiny IndexedDB wrapper. If IndexedDB is unavailable (private mode, blocked by a
// security app...) it falls back to memory so the app still works for the session.
const mem = { entries: new Map(), meta: new Map() }
let dbPromise = null
let broken = false

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) return reject(new Error('no indexedDB'))
      const req = indexedDB.open('goodday', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('entries', { keyPath: 'id' })
        req.result.createObjectStore('meta')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      req.onblocked = () => reject(new Error('blocked'))
    })
  }
  return dbPromise
}

async function run(store, mode, fn, fallback) {
  if (broken) return fallback()
  try {
    const db = await open()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode)
      const req = fn(tx.objectStore(store))
      tx.oncomplete = () => resolve(req?.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } catch {
    broken = true
    return fallback()
  }
}

export const isPersistent = () => !broken

export const allEntries = () =>
  run('entries', 'readonly', (s) => s.getAll(), () => [...mem.entries.values()]).then((r) => r || [])

export const putEntries = (list) =>
  run('entries', 'readwrite', (s) => { list.forEach((e) => s.put(e)) }, () => { list.forEach((e) => mem.entries.set(e.id, e)) })

export const clearEntries = () =>
  run('entries', 'readwrite', (s) => s.clear(), () => mem.entries.clear())

export const getMeta = (key) =>
  run('meta', 'readonly', (s) => s.get(key), () => mem.meta.get(key))

export const setMeta = (key, value) =>
  run('meta', 'readwrite', (s) => s.put(value, key), () => mem.meta.set(key, value))

export const clearMeta = () =>
  run('meta', 'readwrite', (s) => s.clear(), () => mem.meta.clear())
