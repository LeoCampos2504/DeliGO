// ============================================
// DeliGO - Centralized Rate Limiting Utility
// ============================================
// In-memory rate limiter with auto-cleanup
// Based on the original Flask rate_limit.py

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

// Pre-configured rate limits matching the original Flask app
export const RATE_LIMITS = {
  login: { maxRequests: 5, windowMs: 5 * 60 * 1000 },          // 5 per 5 min
  register: { maxRequests: 3, windowMs: 60 * 60 * 1000 },       // 3 per hour
  chat: { maxRequests: 30, windowMs: 60 * 1000 },               // 30 per min
  review: { maxRequests: 3, windowMs: 5 * 60 * 1000 },          // 3 per 5 min
  reviewModerationBusiness: { maxRequests: 5, windowMs: 24 * 60 * 60 * 1000 }, // 5 per negocio/day
  reviewModerationReview: { maxRequests: 1, windowMs: 24 * 60 * 60 * 1000 }, // 1 per negocio+reseña/day
  reviewModerationBusinessInformation: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10 per negocio/hour
  reviewModerationEvidenceUpload: { maxRequests: 20, windowMs: 60 * 60 * 1000 }, // 20 per negocio/hour
  order: { maxRequests: 5, windowMs: 5 * 60 * 1000 },           // 5 per 5 min
  push: { maxRequests: 10, windowMs: 60 * 1000 },               // 10 per min
  password: { maxRequests: 3, windowMs: 15 * 60 * 1000 },       // 3 per 15 min
  upload: { maxRequests: 20, windowMs: 60 * 1000 },              // 20 per min
  operativoInvite: { maxRequests: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 min
  operativoJoin: { maxRequests: 5, windowMs: 5 * 60 * 1000 },     // 5 per 5 min
  mozoPushTest: { maxRequests: 3, windowMs: 10 * 60 * 1000 },      // 3 per 10 min
  // P0-C.1: comprobación pública de geocerca de mesa. Generoso a propósito —
  // varias personas de una misma mesa pueden comprobar casi al mismo tiempo,
  // y un reintento tras "inaccurate"/"timeout" no debe agotarse enseguida.
  mesaGeofence: { maxRequests: 20, windowMs: 5 * 60 * 1000 },      // 20 per 5 min
  // 23-B: lectura pública de la cuenta de mesa por el cliente, pensada para
  // polling periódico (no un intento único como mesaGeofence) y para varios
  // dispositivos de la misma mesa que puedan compartir la misma IP (wifi del
  // local) — generoso a propósito, nunca debe cortar un polling normal.
  mesaCuentaPublica: { maxRequests: 180, windowMs: 5 * 60 * 1000 }, // 180 per 5 min
  // 23-B-CORRECCIÓN-1: límite grueso por IP SOLA (sin slug/mesa en la
  // clave), evaluado antes que `mesaCuentaPublica` — acota el total de
  // combinaciones de slug/mesa que un mismo IP puede probar por ventana,
  // independientemente de que cada combinación individual todavía tenga
  // cupo en su propia clave (`ip:slug:mesa`). 600/5min ~ 2 req/s sostenidos:
  // muy por encima de cualquier polling legítimo de varios dispositivos
  // reales en una misma mesa, pero acota la explotación de cardinalidad.
  mesaCuentaPublicaIp: { maxRequests: 600, windowMs: 5 * 60 * 1000 }, // 600 per 5 min
  // 24-A: OAuth Superadmin — bucket propio, separado de "login" (clave
  // compartida legacy) y de "operativoJoin" (Google operativo), para que un
  // abuso en cualquiera de los otros dos no afecte ni se vea afectado por
  // intentos sobre la cuenta de mayor privilegio de la plataforma.
  superadminOAuthStart: { maxRequests: 10, windowMs: 5 * 60 * 1000 },   // 10 per 5 min
  superadminOAuthCallback: { maxRequests: 10, windowMs: 5 * 60 * 1000 }, // 10 per 5 min
  superadminReviewModerationAction: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 per superadmin/min
  general: { maxRequests: 60, windowMs: 60 * 1000 },             // 60 per min (default)
} as const

export type RateLimitType = keyof typeof RATE_LIMITS

// Global rate limit store: Map<type, Map<key, entry>>
const stores = new Map<string, Map<string, RateLimitEntry>>()

// Auto-cleanup: remove entries older than 1 hour, every 10 minutes
const CLEANUP_INTERVAL = 10 * 60 * 1000
const MAX_ENTRY_AGE = 60 * 60 * 1000

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [, store] of stores) {
      for (const [key, entry] of store) {
        if (now - entry.resetAt > MAX_ENTRY_AGE) {
          store.delete(key)
        }
      }
    }
  }, CLEANUP_INTERVAL)

  // Don't prevent Node.js from exiting
  if (cleanupTimer.unref) {
    cleanupTimer.unref()
  }
}

// Start cleanup on module load
startCleanup()

/**
 * Check rate limit for a given type and key.
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  type: RateLimitType,
  key: string
): { allowed: boolean; remaining: number; resetAt: number; retryAfterMs?: number } {
  const config = RATE_LIMITS[type]
  const now = Date.now()

  if (!stores.has(type)) {
    stores.set(type, new Map())
  }
  const store = stores.get(type)!

  const entry = store.get(key)

  // No entry or expired window — create new
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt }
  }

  // Within window — check count
  if (entry.count >= config.maxRequests) {
    const retryAfterMs = entry.resetAt - now
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfterMs }
  }

  entry.count++
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

/**
 * Create a rate limit key combining IP and optional user ID
 */
export function createRateLimitKey(ip: string, userId?: string): string {
  return userId ? `${ip}:${userId}` : ip
}

/**
 * Rate limit response helper — returns 429 with standard headers
 */
export function rateLimitResponse(result: { retryAfterMs?: number }, message?: string) {
  const headers: Record<string, string> = {}
  if (result.retryAfterMs) {
    headers["Retry-After"] = String(Math.ceil(result.retryAfterMs / 1000))
  }

  return Response.json(
    {
      error: message || "Demasiados intentos. Intentá de nuevo más tarde.",
    },
    { status: 429, headers }
  )
}
