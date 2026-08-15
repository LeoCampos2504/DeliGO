const {
  createInternalPublishAuth,
  getInternalPublishSecret,
} = require("./internal-publish-auth")
const { parseAndValidateEnvelope } = require("./internal-publish-schema")

const INTERNAL_PUBLISH_PATH = "/internal/realtime/publish"
const INTERNAL_BODY_LIMIT_BYTES = 32 * 1024
const INTERNAL_RATE_LIMIT_MAX = 600
const INTERNAL_RATE_LIMIT_WINDOW_MS = 60 * 1000
const INTERNAL_EVENT_DEDUPE_TTL_MS = 120 * 1000

const EVENT_MAPPING = {
  "chat.message.created": "new-message",
  "chat.messages.read": "messages-read",
  "tracking.location.updated": "repartidor-location",
}

function sendJson(res, statusCode, body) {
  const serialized = JSON.stringify(body)
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(serialized)
}

function createBoundedRateLimiter(maxEvents = INTERNAL_RATE_LIMIT_MAX, windowMs = INTERNAL_RATE_LIMIT_WINDOW_MS) {
  const timestamps = []

  return {
    allow(now = Date.now()) {
      while (timestamps.length && timestamps[0] <= now - windowMs) timestamps.shift()
      if (timestamps.length >= maxEvents) return false
      timestamps.push(now)
      return true
    },
    size() {
      return timestamps.length
    },
  }
}

function createEventDedupeCache(ttlMs = INTERNAL_EVENT_DEDUPE_TTL_MS) {
  const entries = new Map()

  function cleanup(now) {
    for (const [key, expiresAt] of entries) {
      if (expiresAt <= now) entries.delete(key)
    }
  }

  return {
    claim(key, now = Date.now()) {
      cleanup(now)
      const existing = entries.get(key)
      if (existing && existing > now) return false
      entries.set(key, now + ttlMs)
      return true
    },
    release(key) {
      entries.delete(key)
    },
    size() {
      cleanup(Date.now())
      return entries.size
    },
  }
}

function readRawBody(req, maxBytes = INTERNAL_BODY_LIMIT_BYTES) {
  const contentLength = Number.parseInt(req.headers["content-length"] || "", 10)
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    req.resume()
    const error = new Error("BODY_TOO_LARGE")
    error.code = "BODY_TOO_LARGE"
    return Promise.reject(error)
  }

  return new Promise((resolve, reject) => {
    const chunks = []
    let totalBytes = 0
    let settled = false

    function rejectOnce(error) {
      if (settled) return
      settled = true
      req.resume()
      reject(error)
    }

    req.on("data", (chunk) => {
      if (settled) return
      totalBytes += chunk.length
      if (totalBytes > maxBytes) {
        const error = new Error("BODY_TOO_LARGE")
        error.code = "BODY_TOO_LARGE"
        rejectOnce(error)
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks))
    })
    req.on("error", (error) => rejectOnce(error))
  })
}

function statusForAuth(code) {
  if (code === "AUTH_UNAVAILABLE") return 503
  if (code === "AUTH_REPLAY") return 401
  return 401
}

function createInternalPublishHandler(options) {
  const io = options.io
  const auth = options.auth || createInternalPublishAuth()
  const rateLimiter = options.rateLimiter || createBoundedRateLimiter()
  const eventDedupe = options.eventDedupe || createEventDedupeCache()
  const maxBodyBytes = options.maxBodyBytes || INTERNAL_BODY_LIMIT_BYTES
  const now = options.now || (() => Date.now())

  if (!io || typeof io.to !== "function") throw new Error("INTERNAL_IO_REQUIRED")

  return async function handleInternalPublish(req, res) {
    const startedAt = now()

    if (!getInternalPublishSecret()) {
      sendJson(res, 503, { ok: false, error: "Internal publish unavailable" })
      return
    }

    const contentType = String(req.headers["content-type"] || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase()
    if (contentType !== "application/json") {
      sendJson(res, 415, { ok: false, error: "Unsupported media type" })
      return
    }

    let rawBody
    try {
      rawBody = await readRawBody(req, maxBodyBytes)
    } catch (error) {
      if (error?.code === "BODY_TOO_LARGE") {
        sendJson(res, 413, { ok: false, error: "Payload too large" })
        return
      }
      sendJson(res, 400, { ok: false, error: "Invalid request body" })
      return
    }

    const authResult = auth.verify(req.headers, rawBody)
    if (!authResult.ok) {
      console.warn("[Chat] internal_publish_rejected category=" + authResult.code)
      sendJson(res, statusForAuth(authResult.code), { ok: false, error: "Unauthorized" })
      return
    }

    if (!rateLimiter.allow(now())) {
      console.warn("[Chat] internal_publish_rejected category=rate_limited")
      sendJson(res, 429, { ok: false, error: "Rate limited" })
      return
    }

    let envelope
    try {
      envelope = parseAndValidateEnvelope(rawBody)
    } catch (error) {
      const code = typeof error?.code === "string" ? error.code : "SCHEMA_INVALID"
      console.warn("[Chat] internal_publish_rejected category=" + code)
      sendJson(res, 400, { ok: false, error: "Invalid publish envelope" })
      return
    }

    const dedupeKey = envelope.type + ":" + envelope.eventId
    if (!eventDedupe.claim(dedupeKey, now())) {
      sendJson(res, 200, {
        ok: true,
        deduplicated: true,
        eventId: envelope.eventId,
        type: envelope.type,
      })
      return
    }

    const socketEvent = EVENT_MAPPING[envelope.type]
    const room = "pedido:" + envelope.resourceId
    try {
      io.to(room).emit(socketEvent, envelope.payload)
    } catch {
      eventDedupe.release(dedupeKey)
      console.warn("[Chat] internal_publish_rejected category=emit_failure")
      sendJson(res, 503, { ok: false, error: "Publish unavailable" })
      return
    }

    const latencyMs = Math.max(0, now() - startedAt)
    console.log(
      "[Chat] internal_publish result=published type=" +
        envelope.type +
        " eventId=" +
        envelope.eventId +
        " latencyMs=" +
        latencyMs
    )
    sendJson(res, 200, {
      ok: true,
      published: true,
      eventId: envelope.eventId,
      type: envelope.type,
    })
  }
}

module.exports = {
  EVENT_MAPPING,
  INTERNAL_BODY_LIMIT_BYTES,
  INTERNAL_EVENT_DEDUPE_TTL_MS,
  INTERNAL_PUBLISH_PATH,
  INTERNAL_RATE_LIMIT_MAX,
  createBoundedRateLimiter,
  createEventDedupeCache,
  createInternalPublishHandler,
  readRawBody,
}
