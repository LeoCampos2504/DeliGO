// DeliGO - Simple in-memory lock for concurrency protection
// Prevents race conditions like double orders, double status updates

const locks = new Map<string, { expires: number }>()

const LOCK_DURATION_MS = 10_000 // 10 seconds

/**
 * Acquire a lock for a given key. Returns true if the lock was acquired.
 * If the lock is already held, returns false.
 */
export function acquireLock(key: string): boolean {
  const now = Date.now()
  const existing = locks.get(key)
  
  // If lock exists and hasn't expired, it's still held
  if (existing && existing.expires > now) {
    return false
  }
  
  // Acquire the lock
  locks.set(key, { expires: now + LOCK_DURATION_MS })
  return true
}

/**
 * Release a lock for a given key.
 */
export function releaseLock(key: string): void {
  locks.delete(key)
}

/**
 * Execute a function with a lock. If the lock cannot be acquired,
 * returns a 409 Conflict response.
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T | { error: string; status: number }> {
  if (!acquireLock(key)) {
    return { error: "Operación en progreso. Intentá de nuevo en un momento.", status: 409 }
  }
  
  try {
    return await fn()
  } finally {
    releaseLock(key)
  }
}

/**
 * Clean up expired locks periodically
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of locks) {
    if (value.expires <= now) {
      locks.delete(key)
    }
  }
}, 60_000) // Clean up every minute
