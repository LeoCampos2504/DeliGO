// ============================================
// DeliGO - Share Target: lectura de comprobantes compartidos (Bugfix-4C)
// ============================================
// Contraparte de lectura del pequeño helper de IndexedDB duplicado dentro de
// public/sw.js (el service worker no puede importar este archivo TS
// directamente). Ambos usan la MISMA base/almacén/keyPath a propósito, ya
// que IndexedDB es por origen: lo que escribe el SW lo puede leer esta
// página sin ningún viaje al servidor.
//
// El archivo compartido nunca toca el backend hasta que el usuario elige un
// chat y confirma el envío — acá solo se lee/borra localmente.

const DB_NAME = "deligo-share-target"
const STORE_NAME = "pending-shares"

export interface PendingShare {
  token: string
  blob: Blob
  name: string
  type: string
  size: number
  role: "cliente" | "negocio" | "operaciones"
  createdAt: number
  expiresAt: number
  title: string
  text: string
  sharedUrl: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "token" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Borra el registro (si existe) sin lanzar si ya no está. */
export async function deletePendingShare(token: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).delete(token)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Lee un comprobante compartido pendiente por token. Si venció (TTL de 15
 * minutos, fijado por el service worker al guardarlo), lo borra y devuelve
 * `null` — mismo resultado que si nunca hubiera existido.
 */
export async function getPendingShare(token: string): Promise<PendingShare | null> {
  if (typeof indexedDB === "undefined") return null

  const db = await openDb()
  const record = await new Promise<PendingShare | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly")
      const req = tx.objectStore(STORE_NAME).get(token)
      req.onsuccess = () => resolve((req.result as PendingShare | undefined) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

  if (!record) return null
  if (record.expiresAt < Date.now()) {
    await deletePendingShare(token)
    return null
  }
  return record
}
