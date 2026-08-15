const { createHmac, timingSafeEqual } = require("crypto")

const INTERNAL_AUTH_MAX_AGE_SECONDS = 60
const INTERNAL_AUTH_CLOCK_SKEW_SECONDS = 30
const INTERNAL_AUTH_REPLAY_TTL_MS =
  (INTERNAL_AUTH_MAX_AGE_SECONDS + INTERNAL_AUTH_CLOCK_SKEW_SECONDS) * 1000
const INTERNAL_REQUEST_ID_MAX_LENGTH = 128
const INTERNAL_SECRET_MIN_LENGTH = 32
const INTERNAL_AUTH_REPLAY_MAX_ENTRIES = 10_000
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/

function getInternalPublishSecret() {
  const secret = process.env.REALTIME_INTERNAL_PUBLISH_SECRET?.trim()
  if (!secret || secret.length < INTERNAL_SECRET_MIN_LENGTH) return null
  return secret
}

function getHeader(headers, name) {
  if (!headers) return ""
  const value = headers[name.toLowerCase()] ?? headers[name]
  if (Array.isArray(value)) return value[0] || ""
  return typeof value === "string" ? value : ""
}

function createReplayCache(options = {}) {
  const entries = new Map()
  const maxEntries =
    Number.isSafeInteger(options.maxEntries) && options.maxEntries > 0
      ? options.maxEntries
      : INTERNAL_AUTH_REPLAY_MAX_ENTRIES

  function cleanup(now) {
    for (const [requestId, expiresAt] of entries) {
      if (expiresAt <= now) entries.delete(requestId)
    }
  }

  return {
    claim(requestId, now = Date.now(), ttlMs = INTERNAL_AUTH_REPLAY_TTL_MS) {
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
    maxEntries,
  }
}

function canonicalMaterial(timestamp, requestId, rawBody) {
  const prefix = Buffer.from(timestamp + "." + requestId + ".", "utf8")
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8")
  return Buffer.concat([prefix, body])
}

function calculateSignature(secret, timestamp, requestId, rawBody) {
  return createHmac("sha256", secret)
    .update(canonicalMaterial(timestamp, requestId, rawBody))
    .digest("hex")
}

function parseTimestamp(timestamp, now) {
  if (!/^[0-9]{13}$/.test(timestamp)) return false
  const parsed = Number(timestamp)
  if (!Number.isSafeInteger(parsed)) return false
  const lowerBound = now - INTERNAL_AUTH_MAX_AGE_SECONDS * 1000
  const upperBound = now + INTERNAL_AUTH_CLOCK_SKEW_SECONDS * 1000
  return parsed >= lowerBound && parsed <= upperBound
}

function createInternalPublishAuth(options = {}) {
  const replayCache = options.replayCache || createReplayCache()
  const now = options.now || (() => Date.now())

  return {
    verify(headers, rawBody) {
      const secret = getInternalPublishSecret()
      if (!secret) return { ok: false, code: "AUTH_UNAVAILABLE" }

      const timestamp = getHeader(headers, "x-deligo-timestamp")
      const requestId = getHeader(headers, "x-deligo-request-id")
      const signature = getHeader(headers, "x-deligo-signature").toLowerCase()
      const currentTime = now()

      if (!parseTimestamp(timestamp, currentTime)) {
        return { ok: false, code: "AUTH_INVALID" }
      }
      if (
        !requestId ||
        requestId.length > INTERNAL_REQUEST_ID_MAX_LENGTH ||
        !REQUEST_ID_PATTERN.test(requestId)
      ) {
        return { ok: false, code: "AUTH_INVALID" }
      }
      if (!SIGNATURE_PATTERN.test(signature)) {
        return { ok: false, code: "AUTH_INVALID" }
      }

      const expected = calculateSignature(secret, timestamp, requestId, rawBody)
      const expectedBuffer = Buffer.from(expected, "hex")
      const receivedBuffer = Buffer.from(signature, "hex")
      if (
        expectedBuffer.length !== receivedBuffer.length ||
        !timingSafeEqual(expectedBuffer, receivedBuffer)
      ) {
        return { ok: false, code: "AUTH_INVALID" }
      }

      if (!replayCache.claim(requestId, currentTime)) {
        return { ok: false, code: "AUTH_REPLAY" }
      }

      return { ok: true, timestamp, requestId }
    },
  }
}

module.exports = {
  INTERNAL_AUTH_MAX_AGE_SECONDS,
  INTERNAL_AUTH_CLOCK_SKEW_SECONDS,
  INTERNAL_AUTH_REPLAY_MAX_ENTRIES,
  INTERNAL_AUTH_REPLAY_TTL_MS,
  INTERNAL_REQUEST_ID_MAX_LENGTH,
  calculateSignature,
  canonicalMaterial,
  createInternalPublishAuth,
  createReplayCache,
  getInternalPublishSecret,
}
