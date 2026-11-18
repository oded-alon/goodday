// Tiny IndexedDB wrapper. If IndexedDB is unavailable (private mode, blocked by a
// security app...) it falls back to memory so the app still works for the session.
const mem = { entries: new Map(), profiles: new Map(), meta: new Map() }
let dbPromise = null
let broken = false

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in globalThis)) return reject(new Error('no indexedDB'))
      const req = indexedDB.open('goodday', 2)
      req.onupgradeneeded = () => {
        const db = req.result
        for (const name of ['entries', 'profiles']) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
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

const all = (store) => run(store, 'readonly', (s) => s.getAll(), () => [...mem[store].values()]).then((r) => r || [])
const put = (store, list) =>
  run(store, 'readwrite', (s) => { list.forEach((e) => s.put(e)) }, () => { list.forEach((e) => mem[store].set(e.id, e)) })
const clear = (store) => run(store, 'readwrite', (s) => s.clear(), () => mem[store].clear())

export const allEntries = () => all('entries')
export const putEntries = (list) => put('entries', list)
export const clearEntries = () => clear('entries')
export const allProfiles = () => all('profiles')
export const putProfiles = (list) => put('profiles', list)
export const clearProfiles = () => clear('profiles')

export const getMeta = (key) => run('meta', 'readonly', (s) => s.get(key), () => mem.meta.get(key))
export const setMeta = (key, value) => run('meta', 'readwrite', (s) => s.put(value, key), () => mem.meta.set(key, value))
export const clearMeta = () => clear('meta')
