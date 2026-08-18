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
// Separate, much shorter TTL cache used only for cross-path Tracking
// correlation (Internal Publish Bridge vs the legacy location-update socket
// relay) — see trackingCorrelationKey(). Deliberately NOT the same instance
// or TTL as eventDedupe above: eventDedupe protects the Internal Publish
// Bridge's own retries (needs a long TTL, exact server-generated eventId);
// this cache suppresses a stale-PWA client's redundant relay of the SAME
// GPS sample the bridge already delivered (needs a short TTL well under the
// ~5s GPS tick cadence, so a legitimate next tick — even with an unchanged
// coordinate for a stationary repartidor — is never falsely suppressed).
// This is bounded best-effort duplicate suppression, not exact dedupe: a
// legacy emit that arrives after the TTL (slow network, backgrounded tab,
// clock skew) can still reach recipients — see Tracking Focal Design
// Correction #2 for the full analysis of why that residual is acceptable.
const TRACKING_CORRELATION_DEDUPE_TTL_MS = 2000

// Pure, single-definition formula shared by both cross-path producers
// (Internal Publish handler below, and the legacy location-update handler
// in index.js) so the key can never drift between the two call sites.
// Deliberately built ONLY from pedidoId+lat+lng — never any timestamp
// (client or server) — since client/server clocks are independent and not
// guaranteed to agree (see Tracking Focal Design Correction #1).
function trackingCorrelationKey(pedidoId, lat, lng) {
  return "tracking.correlation:" + pedidoId + ":" + lat + ":" + lng
}

const EVENT_MAPPING = {
  "chat.message.created": { event: "new-message", requiredRecipientScope: "chat:read" },
  "chat.messages.read": { event: "messages-read", requiredRecipientScope: "chat:read" },
  "tracking.location.updated": { event: "repartidor-location", requiredRecipientScope: "tracking:watch" },
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
  const getRecipientSockets = options.getRecipientSockets
  const auth = options.auth || createInternalPublishAuth()
  const rateLimiter = options.rateLimiter || createBoundedRateLimiter()
  const eventDedupe = options.eventDedupe || createEventDedupeCache()
  const trackingCorrelationDedupe =
    options.trackingCorrelationDedupe || createEventDedupeCache(TRACKING_CORRELATION_DEDUPE_TTL_MS)
  const maxBodyBytes = options.maxBodyBytes || INTERNAL_BODY_LIMIT_BYTES
  const now = options.now || (() => Date.now())

  if (!io || typeof io.to !== "function") throw new Error("INTERNAL_IO_REQUIRED")
  if (typeof getRecipientSockets !== "function") throw new Error("INTERNAL_RECIPIENT_RESOLVER_REQUIRED")

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

    // Tracking-only: bounded best-effort correlation against the legacy
    // location-update socket relay, keyed by the physical GPS sample
    // (pedidoId+lat+lng) rather than any client/server timestamp. Checked
    // after the eventDedupe claim above (which only ever protects this
    // bridge's own retries) and before fan-out. Other event types never
    // touch this cache — EVENT_MAPPING has no correlation concept for Chat.
    let correlationKey = null
    let correlationClaimed = false
    if (envelope.type === "tracking.location.updated") {
      correlationKey = trackingCorrelationKey(envelope.payload.pedidoId, envelope.payload.lat, envelope.payload.lng)
      if (!trackingCorrelationDedupe.claim(correlationKey, now())) {
        sendJson(res, 200, {
          ok: true,
          deduplicated: true,
          eventId: envelope.eventId,
          type: envelope.type,
        })
        return
      }
      correlationClaimed = true
    }

    const mapping = EVENT_MAPPING[envelope.type]
    const room = "pedido:" + envelope.resourceId
    // deliveredCount tracks progress through the fan-out loop so a
    // mid-loop synchronous throw can be told apart from a total failure:
    // releasing the claim on ANY failure (even after some recipients
    // already got the event) would let a retry — internal or the legacy
    // fallback — redeliver to those same recipients. The claim is only
    // released when nothing was actually delivered.
    let deliveredCount = 0
    try {
      const recipientSocketIds = getRecipientSockets(room, mapping.requiredRecipientScope)
      for (const socketId of recipientSocketIds) {
        io.to(socketId).emit(mapping.event, envelope.payload)
        deliveredCount += 1
      }
      // Tracking-only: zero authorized recipients (no throw — nobody is
      // currently watching) means nothing was actually delivered by this
      // attempt, so there is nothing for a later duplicate to redeliver to.
      // Retaining the correlation claim here would only risk suppressing a
      // LATER, genuinely useful cross-path delivery of the same sample once
      // a watcher reconnects within the TTL — releasing it costs nothing
      // (see Focal Precommit Review, zero-recipient cross-path race). This
      // does not touch eventDedupe — Chat's and Tracking's own Internal
      // Publish retry-protection semantics are unchanged.
      if (correlationClaimed && deliveredCount === 0) trackingCorrelationDedupe.release(correlationKey)
    } catch {
      if (deliveredCount === 0) {
        eventDedupe.release(dedupeKey)
        if (correlationClaimed) trackingCorrelationDedupe.release(correlationKey)
      }
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
  TRACKING_CORRELATION_DEDUPE_TTL_MS,
  createBoundedRateLimiter,
  createEventDedupeCache,
  createInternalPublishHandler,
  readRawBody,
  trackingCorrelationKey,
}
