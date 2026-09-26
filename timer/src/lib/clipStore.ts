/**
 * Le clip incise restano su questo dispositivo (IndexedDB) e suonano subito,
 * senza ripubblicare l'app: si registra sul tablet della sala e da quel momento
 * parla con la voce giusta. Per darle a tutti si esportano e si mettono in
 * `public/voce/`.
 */
const DB = 'ods-timer-voce'
const STORE = 'clip'

function open(nome = DB): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null)
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(nome, 1)
    } catch {
      return resolve(null)
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, nome = DB): Promise<T | null> {
  return open(nome).then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null)
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

export const putClip = (key: string, blob: Blob) => run('readwrite', (s) => s.put(blob, key))
export const getClip = (key: string) => run<Blob>('readonly', (s) => s.get(key) as IDBRequest<Blob>)
export const deleteClip = (key: string) => run('readwrite', (s) => s.delete(key))
export const listClips = () => run<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => (k ?? []) as string[])

/**
 * Un altro archivio di clip, con lo stesso formato. Serve alla prova di ODS
 * Corsi: senza server, le clip che la segreteria incide per i tablet stanno
 * in un archivio loro, separato da quelle incise dal timer su questo dispositivo.
 */
export function archivioClip(nome: string) {
  return {
    put: (key: string, blob: Blob) => run('readwrite', (s) => s.put(blob, key), nome),
    get: (key: string) => run<Blob>('readonly', (s) => s.get(key) as IDBRequest<Blob>, nome),
    delete: (key: string) => run('readwrite', (s) => s.delete(key), nome),
    list: () => run<IDBValidKey[]>('readonly', (s) => s.getAllKeys(), nome).then((k) => (k ?? []) as string[]),
  }
}
