import { createHmac, timingSafeEqual } from "crypto"

// Verificación HMAC entrante para el endpoint interno de validación de
// sesión (chat-service -> monolito, P2-T11 Phase A). Puerto directo de
// mini-services/chat-service/internal-publish-auth.js (mismo material
// canónico, misma ventana, misma comparación constant-time) — nunca
// comparte instancia de replay-cache ni secreto con el bridge de publish
// existente (REALTIME_INTERNAL_PUBLISH_SECRET): ver P2-T11-STAGE2
// §SECRET_POLICY para el análisis de expansión de privilegio que descarta
// reusar ese secreto.

export const SESSION_CHECK_AUTH_MAX_AGE_SECONDS = 60
export const SESSION_CHECK_AUTH_CLOCK_SKEW_SECONDS = 30
export const SESSION_CHECK_AUTH_REPLAY_TTL_MS =
  (SESSION_CHECK_AUTH_MAX_AGE_SECONDS + SESSION_CHECK_AUTH_CLOCK_SKEW_SECONDS) * 1000
export const SESSION_CHECK_REQUEST_ID_MAX_LENGTH = 128
export const SESSION_CHECK_SECRET_MIN_LENGTH = 32
const SESSION_CHECK_REPLAY_MAX_ENTRIES = 10_000
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/

export type SessionCheckAuthResult =
  | { ok: true; timestamp: string; requestId: string }
  | { ok: false; code: "AUTH_UNAVAILABLE" | "AUTH_INVALID" | "AUTH_REPLAY" }

export function getSessionCheckSecret(): string | null {
  const secret = process.env.REALTIME_SESSION_CHECK_SECRET?.trim()
  if (!secret || secret.length < SESSION_CHECK_SECRET_MIN_LENGTH) return null
  return secret
}

function getHeader(headers: Headers, name: string): string {
  const value = headers.get(name)
  return typeof value === "string" ? value : ""
}

interface ReplayCache {
  claim(requestId: string, now?: number, ttlMs?: number): boolean
  size(): number
}

export function createReplayCache(maxEntries = SESSION_CHECK_REPLAY_MAX_ENTRIES): ReplayCache {
  const entries = new Map<string, number>()

  function cleanup(now: number): void {
    for (const [requestId, expiresAt] of entries) {
      if (expiresAt <= now) entries.delete(requestId)
    }
  }

  return {
    claim(requestId, now = Date.now(), ttlMs = SESSION_CHECK_AUTH_REPLAY_TTL_MS) {
      cleanup(now)
      const existing = entries.get(requestId)
      if (existing && existing > now) return false
      if (entries.size >= maxEntries) return false
      entries.set(requestId, now + ttlMs)
      return true
    },
    size() {
      cleanup(Date.now())
      return entries.size
    },
  }
}

function canonicalMaterial(timestamp: string, requestId: string, rawBody: string): Buffer {
  const prefix = Buffer.from(timestamp + "." + requestId + ".", "utf8")
  const body = Buffer.from(rawBody, "utf8")
  return Buffer.concat([prefix, body])
}

export function calculateSignature(secret: string, timestamp: string, requestId: string, rawBody: string): string {
  return createHmac("sha256", secret).update(canonicalMaterial(timestamp, requestId, rawBody)).digest("hex")
}

function parseTimestamp(timestamp: string, now: number): boolean {
  if (!/^[0-9]{13}$/.test(timestamp)) return false
  const parsed = Number(timestamp)
  if (!Number.isSafeInteger(parsed)) return false
  const lowerBound = now - SESSION_CHECK_AUTH_MAX_AGE_SECONDS * 1000
  const upperBound = now + SESSION_CHECK_AUTH_CLOCK_SKEW_SECONDS * 1000
  return parsed >= lowerBound && parsed <= upperBound
}

export function createInternalSessionCheckAuth(options: { replayCache?: ReplayCache; now?: () => number } = {}) {
  const replayCache = options.replayCache || createReplayCache()
  const now = options.now || (() => Date.now())

  return {
    verify(headers: Headers, rawBody: string): SessionCheckAuthResult {
      const secret = getSessionCheckSecret()
      if (!secret) return { ok: false, code: "AUTH_UNAVAILABLE" }

      const timestamp = getHeader(headers, "x-deligo-timestamp")
      const requestId = getHeader(headers, "x-deligo-request-id")
      const signature = getHeader(headers, "x-deligo-signature").toLowerCase()
      const currentTime = now()

      if (!parseTimestamp(timestamp, currentTime)) return { ok: false, code: "AUTH_INVALID" }
      if (!requestId || requestId.length > SESSION_CHECK_REQUEST_ID_MAX_LENGTH || !REQUEST_ID_PATTERN.test(requestId)) {
        return { ok: false, code: "AUTH_INVALID" }
      }
      if (!SIGNATURE_PATTERN.test(signature)) return { ok: false, code: "AUTH_INVALID" }

      const expected = calculateSignature(secret, timestamp, requestId, rawBody)
      const expectedBuffer = Buffer.from(expected, "hex")
      const receivedBuffer = Buffer.from(signature, "hex")
      if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
        return { ok: false, code: "AUTH_INVALID" }
      }

      if (!replayCache.claim(requestId, currentTime)) return { ok: false, code: "AUTH_REPLAY" }

      return { ok: true, timestamp, requestId }
    },
  }
}
