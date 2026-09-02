const {
  createInternalPublishAuth,
  getInternalPublishSecret,
} = require("./internal-publish-auth")
const { parseAndValidateEnvelope } = require("./internal-publish-schema")

const INTERNAL_PUBLISH_PATH = "/internal/realtime/publish"
const INTERNAL_BODY_LIMIT_BYTES = 32 * 1024
// Shared sliding-window duration for every limiter below (emergency + both
// per-family budgets) — only the per-bucket MAX differs. Hardcoded per
// P2-T03 Stage 2 §8 (window override is not exposed via env; only the three
// max thresholds are).
const INTERNAL_RATE_LIMIT_WINDOW_MS = 60 * 1000

// P2-T03 Stage 1 found a single 600/min bucket shared by every event type,
// which let Tracking and Chat starve each other's realtime delivery under
// legitimate load (F-P0-01). Stage 2 replaces it with two isolated
// per-family budgets sized from the Stage 1 capacity model, PLUS a mandatory
// (not optional — Stage 1 called it optional, Stage 2 hardened it because
// family selection now happens AFTER schema parsing, which would otherwise
// let an authenticated-but-malformed envelope bypass every rate budget)
// global emergency ceiling that runs BEFORE schema parsing, in the exact
// spot the old shared limiter used to run, so such a request still hits a
// bound before any family can even be selected.
//
// DEFAULT_TRACKING_RATE_LIMIT_MAX=1800: 3x the old shared ceiling. At the
// current re-derived normal cadence of 12 publishes/min per eligible
// delivery (src/hooks/use-repartidor-tracking.ts, unchanged by P2-T01),
// this clears the Stage 1 capacity-table failure point of 720/min (20
// couriers x3 simultaneous deliveries) with ~2.5x headroom, and the 30
// couriers x3 scenario (1080/min) with ~1.67x headroom.
const DEFAULT_TRACKING_RATE_LIMIT_MAX = 1800
// DEFAULT_CHAT_RATE_LIMIT_MAX=600: the former shared ceiling, now Chat's own
// exclusive bucket instead of a number shared (and contested) with
// Tracking. Chat's own upstream per-actor limiter is already 30/min per
// (ip,userId) (src/lib/rate-limit.ts), so 600/min supports 20 simultaneous
// senders each saturating their own upstream maximum — isolation from
// Tracking is what fixes the starvation, not a need to raise this number.
const DEFAULT_CHAT_RATE_LIMIT_MAX = 600
// DEFAULT_EMERGENCY_RATE_LIMIT_MAX=3000: strictly above
// DEFAULT_TRACKING_RATE_LIMIT_MAX + DEFAULT_CHAT_RATE_LIMIT_MAX (2400), so
// fully valid traffic that already respects both family budgets can never
// be bottlenecked by this ceiling first — it exists only as a bound on
// total authenticated request work per process (defense-in-depth against
// internal loops/bugs/a compromised secret, or authenticated-but-malformed
// envelopes that consume this budget without ever reaching a family — see
// resolveEmergencyRateLimitMax()'s invariant enforcement below).
const DEFAULT_EMERGENCY_RATE_LIMIT_MAX = 3000
// P2-T03 Stage 3 focal correction: the invariant "the emergency ceiling can
// never become the bottleneck for traffic that already respects both family
// budgets" must hold STRICTLY (with real margin), not just as an equality,
// for every valid configuration — not only for the hardcoded defaults above.
// resolveEmergencyRateLimitMax() originally clamped only up to familySum
// itself, which meant a family override combination whose sum exceeded
// DEFAULT_EMERGENCY_RATE_LIMIT_MAX (e.g. trackingMax=2400, chatMax=600)
// silently collapsed the emergency ceiling to exactly familySum — zero
// headroom left for authenticated-but-malformed/pre-schema traffic, even
// though fully valid family-respecting traffic would already be right at
// the ceiling. MIN_EMERGENCY_HEADROOM restores the same 600/min margin the
// hardcoded defaults already have (3000 - 1800 - 600 = 600) as an explicit,
// always-enforced floor: engineering headroom for this already-selected
// design, not a business/SLA capacity target, and not something a human
// decision is needed for.
const INTERNAL_PUBLISH_EMERGENCY_MIN_HEADROOM = 600
// Sane upper bound for any of the three optional env overrides below — large
// enough to never constrain a legitimate production value, small enough that
// a malformed/absurd env value (e.g. an accidentally-pasted timestamp) can
// never be mistaken for an intentional configuration.
const INTERNAL_RATE_LIMIT_ENV_MAX_BOUND = 1_000_000

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

// Rate-limit family for each accepted event type — deliberately every key in
// EVENT_MAPPING must resolve to a family here (checked defensively at
// request time in handleInternalPublish; see the "unresolved_family"
// fail-closed branch), so a future new EVENT_MAPPING entry added without a
// matching family never becomes an unbounded/no-limit event type by
// omission. chat.messages.read has no productive publisher anywhere in the
// app today (P2-T03 Stage 1 §PRODUCER_INVENTORY) but is still bound to the
// "chat" family so its dormant capacity can never bypass rate limiting if a
// producer is added later.
const EVENT_TYPE_FAMILY = {
  "chat.message.created": "chat",
  "chat.messages.read": "chat",
  "tracking.location.updated": "tracking",
}

// Validates an optional numeric env override for one of the three internal
// publish rate limits: must be a finite positive integer within a sane
// bound, otherwise the caller's hardcoded fallback is used untouched. Never
// turns a missing/malformed/zero/negative/absurd value into "disabled" or
// "unlimited" — always resolves to a concrete, safe positive integer.
function parsePositiveIntEnv(rawValue, fallback, maxBound = INTERNAL_RATE_LIMIT_ENV_MAX_BOUND) {
  if (rawValue === undefined || rawValue === null || rawValue === "") return fallback
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0 || parsed > maxBound) {
    return fallback
  }
  return parsed
}

// Resolves the two per-family maxima from their optional env overrides (see
// P2-T03 Stage 2 §8/§10 — non-secret, no new Railway variable required for
// default behavior; these are only read if present).
function resolveFamilyRateLimitMax() {
  return {
    tracking: parsePositiveIntEnv(
      process.env.TRACKING_INTERNAL_PUBLISH_RATE_LIMIT_MAX,
      DEFAULT_TRACKING_RATE_LIMIT_MAX
    ),
    chat: parsePositiveIntEnv(process.env.CHAT_INTERNAL_PUBLISH_RATE_LIMIT_MAX, DEFAULT_CHAT_RATE_LIMIT_MAX),
  }
}

// Config invariant (P2-T03 Stage 2 §22, corrected in Stage 3 §7): the
// emergency ceiling must never be the bottleneck for traffic that already
// respects both family budgets, so it is clamped UP (never down) to at
// least familySum + INTERNAL_PUBLISH_EMERGENCY_MIN_HEADROOM whenever the
// env-provided-or-hardcoded-default candidate would otherwise violate that
// guarantee — whether because the emergency override itself is missing/
// invalid (falls back to DEFAULT_EMERGENCY_RATE_LIMIT_MAX) or because an
// operator raised one or both family maxima via env past what the emergency
// default alone could cover. Stage 2's original version clamped only to
// `familySum` (no added margin), which meant a family-sum-exceeds-3000
// configuration collapsed the ceiling to exact equality with familySum —
// zero headroom for authenticated-but-malformed/pre-schema traffic. This
// never throws/crashes the service for a malformed optional tuning value —
// there is always a safe, concrete fallback.
function resolveEmergencyRateLimitMax(familySum) {
  const candidate = parsePositiveIntEnv(
    process.env.INTERNAL_PUBLISH_EMERGENCY_RATE_LIMIT_MAX,
    DEFAULT_EMERGENCY_RATE_LIMIT_MAX
  )
  return Math.max(candidate, familySum + INTERNAL_PUBLISH_EMERGENCY_MIN_HEADROOM)
}

// Single immutable resolution of all three thresholds, computed once (see
// createInternalPublishHandler) rather than re-read per request.
function resolveInternalPublishRateLimitConfig() {
  const family = resolveFamilyRateLimitMax()
  const emergency = resolveEmergencyRateLimitMax(family.tracking + family.chat)
  return {
    emergencyMax: emergency,
    chatMax: family.chat,
    trackingMax: family.tracking,
    windowMs: INTERNAL_RATE_LIMIT_WINDOW_MS,
  }
}

function sendJson(res, statusCode, body) {
  const serialized = JSON.stringify(body)
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(serialized)
}

// Generic reusable sliding-window-log limiter factory — shared by the
// emergency ceiling and both per-family budgets (P2-T03 Stage 2). The
// defaults below exist only so a bare createBoundedRateLimiter() call never
// throws; every real call site in this file (and in tests) passes explicit
// values, since "the" internal rate limit is no longer a single number.
function createBoundedRateLimiter(maxEvents = DEFAULT_EMERGENCY_RATE_LIMIT_MAX, windowMs = INTERNAL_RATE_LIMIT_WINDOW_MS) {
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
  // P2-T18-CLIENTE-DELIVERY-PIPELINE-INSTRUMENTATION-R2 (TEMPORARY): optional,
  // read-only — only used by the trace lines added below.
  const resolveActorType = options.resolveActorType || (() => "unknown")
  const auth = options.auth || createInternalPublishAuth()
  // Three isolated, process-local limiters (one instance each per process —
  // never re-created per request): a global emergency ceiling that runs
  // BEFORE schema parsing (so it also bounds authenticated-but-malformed
  // requests), and two per-family budgets that run AFTER schema parsing
  // (once envelope.type — and therefore the family — is known). Tests may
  // inject any of the three directly (e.g. createBoundedRateLimiter(2,
  // 60000)) to exercise 429 behavior with a handful of requests instead of
  // thousands — see P2-T03 Stage 2 §14.
  const rateLimitConfig = resolveInternalPublishRateLimitConfig()
  const emergencyLimiter =
    options.emergencyLimiter || createBoundedRateLimiter(rateLimitConfig.emergencyMax, rateLimitConfig.windowMs)
  const chatLimiter =
    options.chatLimiter || createBoundedRateLimiter(rateLimitConfig.chatMax, rateLimitConfig.windowMs)
  const trackingLimiter =
    options.trackingLimiter || createBoundedRateLimiter(rateLimitConfig.trackingMax, rateLimitConfig.windowMs)
  const familyLimiters = { chat: chatLimiter, tracking: trackingLimiter }
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

    // Global emergency ceiling — runs BEFORE schema parsing, in the exact
    // spot the old single shared limiter used to run (P2-T03 Stage 2 §4/§17):
    // an authenticated request still hits a bound here even if its envelope
    // turns out to be malformed and never resolves to a family below. Only
    // an authenticated request reaches this point (auth.verify() above threw
    // first for anything else), so this can never be starved by
    // unauthenticated traffic.
    if (!emergencyLimiter.allow(now())) {
      console.warn("[Chat] internal_publish_rejected category=rate_limited bucket=emergency")
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
    // P2-T18-CLIENTE-DELIVERY-PIPELINE-INSTRUMENTATION-R2 (TEMPORARY — remove
    // before closing R2): pure read-only trace, no behavior change.
    console.log(
      "[P2T18R2] TRACE_STAGE=PUBLISH_RECEIVED eventId=" + envelope.eventId +
      " type=" + envelope.type + " resourceId=" + String(envelope.resourceId).slice(0, 8) +
      " occurredAt=" + new Date().toISOString()
    )

    // Per-family budget — only reachable once the envelope is known-valid,
    // so envelope.type is guaranteed to be one of EVENT_MAPPING's keys.
    // EVENT_TYPE_FAMILY is expected to cover that same key set exactly; the
    // undefined branch below is a defensive fail-closed guard against that
    // invariant ever drifting (e.g. a new EVENT_MAPPING entry added without
    // a matching family), not a case reachable via any currently-valid
    // schema input.
    const family = EVENT_TYPE_FAMILY[envelope.type]
    if (!family || !familyLimiters[family]) {
      console.warn("[Chat] internal_publish_rejected category=unresolved_family")
      sendJson(res, 500, { ok: false, error: "Internal error" })
      return
    }
    if (!familyLimiters[family].allow(now())) {
      console.warn("[Chat] internal_publish_rejected category=rate_limited bucket=" + family)
      sendJson(res, 429, { ok: false, error: "Rate limited" })
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
    // P2-T18-CLIENTE-DELIVERY-PIPELINE-INSTRUMENTATION-R2 (TEMPORARY): see note above.
    console.log("[P2T18R2] TRACE_STAGE=PUBLISH_ACCEPTED eventId=" + envelope.eventId)

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
      const recipientSocketIds = getRecipientSockets(room, mapping.requiredRecipientScope, envelope.eventId)
      for (const socketId of recipientSocketIds) {
        // P2-T18-CLIENTE-DELIVERY-PIPELINE-INSTRUMENTATION-R2 (TEMPORARY):
        // pure read-only trace around the emit call itself — Socket.IO's
        // emit() does not prove client receipt, only that the server called it.
        console.log(
          "[P2T18R2] TRACE_STAGE=SERVER_EMIT_ATTEMPT eventId=" + envelope.eventId +
          " target_socket=" + socketId.slice(0, 8) + " actorType=" + resolveActorType(socketId)
        )
        io.to(socketId).emit(mapping.event, envelope.payload)
        console.log(
          "[P2T18R2] TRACE_STAGE=SERVER_EMIT_CALLED eventId=" + envelope.eventId +
          " target_socket=" + socketId.slice(0, 8)
        )
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
  DEFAULT_CHAT_RATE_LIMIT_MAX,
  DEFAULT_EMERGENCY_RATE_LIMIT_MAX,
  DEFAULT_TRACKING_RATE_LIMIT_MAX,
  EVENT_MAPPING,
  EVENT_TYPE_FAMILY,
  INTERNAL_BODY_LIMIT_BYTES,
  INTERNAL_EVENT_DEDUPE_TTL_MS,
  INTERNAL_PUBLISH_EMERGENCY_MIN_HEADROOM,
  INTERNAL_PUBLISH_PATH,
  TRACKING_CORRELATION_DEDUPE_TTL_MS,
  createBoundedRateLimiter,
  createEventDedupeCache,
  createInternalPublishHandler,
  parsePositiveIntEnv,
  readRawBody,
  resolveEmergencyRateLimitMax,
  resolveFamilyRateLimitMax,
  trackingCorrelationKey,
}
