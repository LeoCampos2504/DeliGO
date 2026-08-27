const { createHmac, randomUUID } = require("crypto")

const SESSION_CHECK_PATH = "/api/internal/realtime/session"
const SESSION_CHECK_TIMEOUT_MS = 400
const SESSION_CHECK_MAX_RETRIES = 1
const SESSION_CHECK_RETRY_BACKOFF_MS = 100
const SESSION_CHECK_SECRET_MIN_LENGTH = 32

function getSessionCheckSecret() {
  const secret = process.env.REALTIME_SESSION_CHECK_SECRET?.trim()
  if (!secret || secret.length < SESSION_CHECK_SECRET_MIN_LENGTH) return null
  return secret
}

// Mirrors readConfiguration() in src/lib/realtime-publish.ts (same validation
// rules: protocol must be http/https, no embedded credentials, no query/hash)
// for the reverse direction. Deliberately does NOT read REALTIME_INTERNAL_
// SERVICE_URL/REALTIME_INTERNAL_PUBLISH_SECRET — those belong to the other
// channel (monolith -> chat-service) and are never reused here (Stage2
// SECRET_POLICY: the two internal channels stay cryptographically
// independent).
function readConfiguration() {
  const rawUrl = process.env.DELIGO_MONOLITH_INTERNAL_URL?.trim()
  const secret = getSessionCheckSecret()
  if (!rawUrl || !secret) {
    return { status: "disabled", reason: "configuration_incomplete" }
  }

  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { status: "disabled", reason: "configuration_invalid" }
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    return { status: "disabled", reason: "configuration_invalid" }
  }

  return { status: "ready", url: parsed.toString().replace(/\/+$/, ""), secret }
}

// Same canonical construction as internal-publish-auth.js#calculateSignature
// (timestamp + "." + requestId + "." + rawBody, HMAC-SHA256, hex) — the
// exact formula src/lib/internal-session-check-auth.ts (Phase A, already
// deployed) verifies against. Not imported from internal-publish-auth.js:
// that module is the VERIFIER for the other direction and owns its own
// replay cache; this is a plain, stateless signer with no reason to share a
// module boundary with it.
function signRequest(secret, timestamp, requestId, rawBody) {
  return createHmac("sha256", secret)
    .update(timestamp + "." + requestId + "." + rawBody, "utf8")
    .digest("hex")
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

// Stage2 FAIL_CLOSED matrix: 429 and 5xx are the monolith's own transient/
// operational failures (rate limit, restart, momentary outage) and get
// exactly one retry; 400/401/403/404 are deterministic (malformed request
// shape, our own bad HMAC/clock-skew, unknown route) and retrying the exact
// same request would fail identically — no retry.
function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599)
}

// options.fetchImpl / options.now / options.sleep: same injection pattern as
// publishRealtimeEvent() in src/lib/realtime-publish.ts — tests supply all
// three so no test in this repo ever performs a real network call or a real
// multi-hundred-ms sleep.
async function checkSessionActive(sid, options = {}) {
  const configuration = readConfiguration()
  if (configuration.status !== "ready") {
    return { valid: false, reason: "configuration_" + configuration.reason }
  }

  const fetchImpl = options.fetchImpl || fetch
  const now = options.now || (() => Date.now())
  const sleep = options.sleep || defaultSleep
  const rawBody = JSON.stringify({ sid })
  const url = configuration.url + SESSION_CHECK_PATH

  for (let attempt = 0; attempt <= SESSION_CHECK_MAX_RETRIES; attempt += 1) {
    const timestamp = String(now())
    const requestId = randomUUID()
    const signature = signRequest(configuration.secret, timestamp, requestId, rawBody)

    let response
    try {
      response = await fetchWithTimeout(
        fetchImpl,
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-DeliGO-Timestamp": timestamp,
            "X-DeliGO-Request-Id": requestId,
            "X-DeliGO-Signature": signature,
          },
          body: rawBody,
        },
        SESSION_CHECK_TIMEOUT_MS
      )
    } catch {
      if (attempt === SESSION_CHECK_MAX_RETRIES) return { valid: false, reason: "network_or_timeout" }
      await sleep(SESSION_CHECK_RETRY_BACKOFF_MS)
      continue
    }

    if (response.ok) {
      let parsed = null
      try {
        parsed = await response.json()
      } catch {
        parsed = null
      }
      if (parsed && typeof parsed.valid === "boolean") {
        return { valid: parsed.valid, reason: parsed.valid ? "active" : "inactive" }
      }
      if (attempt === SESSION_CHECK_MAX_RETRIES) return { valid: false, reason: "malformed_response" }
      await sleep(SESSION_CHECK_RETRY_BACKOFF_MS)
      continue
    }

    if (!isRetryableStatus(response.status) || attempt === SESSION_CHECK_MAX_RETRIES) {
      return { valid: false, reason: "http_" + response.status }
    }
    await sleep(SESSION_CHECK_RETRY_BACKOFF_MS)
  }

  return { valid: false, reason: "exhausted" }
}

module.exports = {
  SESSION_CHECK_PATH,
  SESSION_CHECK_TIMEOUT_MS,
  SESSION_CHECK_MAX_RETRIES,
  SESSION_CHECK_RETRY_BACKOFF_MS,
  SESSION_CHECK_SECRET_MIN_LENGTH,
  checkSessionActive,
  getSessionCheckSecret,
  readConfiguration,
}
