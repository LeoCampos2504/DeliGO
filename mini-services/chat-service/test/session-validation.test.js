const { after, afterEach, before, beforeEach, describe, test } = require("node:test")
const assert = require("node:assert/strict")
const { io } = require("socket.io-client")
const { SignJWT } = require("jose")
const { createChatService } = require("../index")
const { calculateSignature } = require("../internal-publish-auth")
const {
  SESSION_CHECK_PATH,
  SESSION_CHECK_TIMEOUT_MS,
  checkSessionActive,
} = require("../internal-session-check-client")

const actorSecret = "test-only-realtime-secret-01234567890123456789"
const sessionCheckSecret = "test-only-session-check-secret-0123456789012345"

function signedActorToken(claims, expiresIn = "5m") {
  return new SignJWT({ kind: "socket-actor", ...claims })
    .setProtectedHeader({ alg: "HS256", kid: "testing-key" })
    .setIssuer("deligo-next")
    .setAudience("deligo-chat-service")
    .setIssuedAt()
    .setJti(claims.jti)
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(actorSecret))
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function connect(baseUrl, auth) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      auth,
      extraHeaders: { Origin: "http://localhost:3000" },
      reconnection: false,
      timeout: 1500,
    })
    socket.once("connect", () => resolve(socket))
    socket.once("connect_error", (error) => reject(error))
  })
}

// -----------------------------------------------------------------------
// Low-level HTTP/HMAC client (internal-session-check-client.js). No test in
// this block performs a real network call or a real >SESSION_CHECK_TIMEOUT_MS
// sleep — fetchImpl/now/sleep are always injected, same pattern already used
// by src/lib/realtime-publish.test.ts for the reverse-direction channel.
// -----------------------------------------------------------------------
describe("internal-session-check-client (Phase B outbound HMAC client)", () => {
  beforeEach(() => {
    process.env.DELIGO_MONOLITH_INTERNAL_URL = "http://internal-monolith.test/base/"
    process.env.REALTIME_SESSION_CHECK_SECRET = sessionCheckSecret
  })

  afterEach(() => {
    delete process.env.DELIGO_MONOLITH_INTERNAL_URL
    delete process.env.REALTIME_SESSION_CHECK_SECRET
  })

  test("composes URL/path and signs with the exact construction the Phase A verifier expects (HMAC interop vector)", async () => {
    const calls = []
    const result = await checkSessionActive("sesion-fixture-abc", {
      now: () => 1_700_000_000_000,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return new Response(JSON.stringify({ valid: true }), { status: 200 })
      },
    })

    assert.equal(result.valid, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "http://internal-monolith.test/base" + SESSION_CHECK_PATH)
    assert.equal(calls[0].init.method, "POST")

    const headers = calls[0].init.headers
    const rawBody = calls[0].init.body
    assert.equal(rawBody, JSON.stringify({ sid: "sesion-fixture-abc" }))
    // Interop oracle: internal-publish-auth.js#calculateSignature is the
    // already-certified, secret-parameterized implementation that
    // src/lib/internal-session-check-auth.ts (Phase A verifier, already
    // deployed) was ported from — same canonical material, same algorithm.
    // If this equality holds, Phase A's verify() accepts this signature.
    const expected = calculateSignature(
      sessionCheckSecret,
      headers["X-DeliGO-Timestamp"],
      headers["X-DeliGO-Request-Id"],
      rawBody
    )
    assert.equal(headers["X-DeliGO-Signature"], expected)
    assert.equal(headers["Content-Type"], "application/json")
  })

  test("request body never contains anything beyond sid", async () => {
    let body
    await checkSessionActive("sesion-minimal", {
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body)
        return new Response(JSON.stringify({ valid: true }), { status: 200 })
      },
    })
    assert.deepEqual(Object.keys(body), ["sid"])
  })

  test("valid:true response accepts", async () => {
    const result = await checkSessionActive("sid-active", {
      fetchImpl: async () => new Response(JSON.stringify({ valid: true }), { status: 200 }),
    })
    assert.deepEqual(result, { valid: true, reason: "active" })
  })

  test("valid:false response rejects without retry", async () => {
    let calls = 0
    const result = await checkSessionActive("sid-inactive", {
      fetchImpl: async () => {
        calls += 1
        return new Response(JSON.stringify({ valid: false }), { status: 200 })
      },
    })
    assert.deepEqual(result, { valid: false, reason: "inactive" })
    assert.equal(calls, 1)
  })

  test("malformed response body (not {valid:boolean}) retries once, then rejects", async () => {
    let calls = 0
    const result = await checkSessionActive("sid-malformed", {
      sleep: async () => {},
      fetchImpl: async () => {
        calls += 1
        return new Response(JSON.stringify({ unexpected: "shape" }), { status: 200 })
      },
    })
    assert.equal(result.valid, false)
    assert.equal(result.reason, "malformed_response")
    assert.equal(calls, 2)
  })

  test("non-JSON response body retries once, then rejects", async () => {
    let calls = 0
    const result = await checkSessionActive("sid-nonjson", {
      sleep: async () => {},
      fetchImpl: async () => {
        calls += 1
        return new Response("not json", { status: 200 })
      },
    })
    assert.equal(result.valid, false)
    assert.equal(result.reason, "malformed_response")
    assert.equal(calls, 2)
  })

  for (const status of [401, 403, 404]) {
    test(`endpoint ${status} rejects without any retry (deterministic, own-HMAC/route problem)`, async () => {
      let calls = 0
      const result = await checkSessionActive("sid-" + status, {
        sleep: async () => {
          throw new Error("must not sleep/retry for status " + status)
        },
        fetchImpl: async () => {
          calls += 1
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status })
        },
      })
      assert.equal(result.valid, false)
      assert.equal(result.reason, "http_" + status)
      assert.equal(calls, 1)
    })
  }

  for (const status of [429, 500, 503]) {
    test(`endpoint ${status} retries exactly once`, async () => {
      let calls = 0
      const result = await checkSessionActive("sid-" + status, {
        sleep: async () => {},
        fetchImpl: async () => {
          calls += 1
          return new Response(JSON.stringify({ error: "unavailable" }), { status })
        },
      })
      assert.equal(result.valid, false)
      assert.equal(result.reason, "http_" + status)
      assert.equal(calls, 2)
    })
  }

  test("network failure retries once, then rejects", async () => {
    let calls = 0
    const result = await checkSessionActive("sid-network", {
      sleep: async () => {},
      fetchImpl: async () => {
        calls += 1
        throw new Error("network unavailable")
      },
    })
    assert.equal(result.valid, false)
    assert.equal(result.reason, "network_or_timeout")
    assert.equal(calls, 2)
  })

  test("bounded timeout aborts the request and retries once", async () => {
    const startedAt = Date.now()
    let calls = 0
    const result = await checkSessionActive("sid-timeout", {
      sleep: async () => {},
      fetchImpl: async (_url, init) => {
        calls += 1
        await new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")))
        })
        throw new Error("unreachable")
      },
    })
    assert.equal(result.valid, false)
    assert.equal(result.reason, "network_or_timeout")
    assert.equal(calls, 2)
    assert.ok(Date.now() - startedAt >= SESSION_CHECK_TIMEOUT_MS)
  })

  test("missing configuration rejects without attempting any HTTP call", async () => {
    delete process.env.DELIGO_MONOLITH_INTERNAL_URL
    let calls = 0
    const result = await checkSessionActive("sid-noconfig", {
      fetchImpl: async () => {
        calls += 1
        return new Response(JSON.stringify({ valid: true }), { status: 200 })
      },
    })
    assert.equal(result.valid, false)
    assert.equal(result.reason, "configuration_configuration_incomplete")
    assert.equal(calls, 0)
  })

  test("invalid configuration URL (query string) rejects without attempting any HTTP call", async () => {
    process.env.DELIGO_MONOLITH_INTERNAL_URL = "http://internal-monolith.test/base?x=1"
    let calls = 0
    const result = await checkSessionActive("sid-badurl", {
      fetchImpl: async () => {
        calls += 1
        return new Response(JSON.stringify({ valid: true }), { status: 200 })
      },
    })
    assert.equal(result.valid, false)
    assert.equal(result.reason, "configuration_configuration_invalid")
    assert.equal(calls, 0)
  })
})

// -----------------------------------------------------------------------
// Connect-time enforcement inside io.use() (Phase B). A real chat-service
// instance with a real socket.io-client, exactly like security.test.js —
// but with an injected validateSession spy so no test here performs a real
// network call either.
// -----------------------------------------------------------------------
describe("chat-service connect-time session enforcement (Phase B)", () => {
  let service
  let baseUrl
  let validateSessionCalls
  let validateSessionResult

  before(async () => {
    process.env.NODE_ENV = "test"
    process.env.REALTIME_SOCKET_TOKEN_SECRET = actorSecret
    process.env.REALTIME_KEY_ID = "testing-key"
    process.env.REALTIME_ALLOWED_ORIGINS = "http://localhost:3000"
    validateSessionCalls = []
    validateSessionResult = { valid: true }
    service = createChatService({
      port: 0,
      validateSession: async (sid) => {
        validateSessionCalls.push(sid)
        if (validateSessionResult instanceof Error) throw validateSessionResult
        return validateSessionResult
      },
    })
    await new Promise((resolve) => service.listen(resolve))
    baseUrl = `http://127.0.0.1:${service.httpServer.address().port}`
  })

  after(async () => {
    await service.close()
  })

  beforeEach(() => {
    validateSessionCalls.length = 0
    validateSessionResult = { valid: true }
  })

  test("active session accepts the socket and calls validateSession exactly once with the token's sid", async () => {
    const token = await signedActorToken({
      sub: "cliente-ok", userType: "cliente", scopes: [], sid: "sesion-ok", jti: "actor-ok",
    })
    const socket = await connect(baseUrl, { token })
    assert.deepEqual(validateSessionCalls, ["sesion-ok"])
    socket.disconnect()
  })

  test("inactive session rejects the socket", async () => {
    validateSessionResult = { valid: false, reason: "inactive" }
    const token = await signedActorToken({
      sub: "cliente-revoked", userType: "cliente", scopes: [], sid: "sesion-revoked", jti: "actor-revoked",
    })
    await assert.rejects(connect(baseUrl, { token }), (error) => {
      assert.equal(error.message, "TOKEN_INVALID")
      return true
    })
    assert.deepEqual(validateSessionCalls, ["sesion-revoked"])
  })

  test("post-logout reconnect with an old but cryptographically valid JWT is rejected immediately, without waiting for TTL", async () => {
    // Simulates: logout already deleted the Sesion row, but the actor JWT
    // itself has not expired yet — the connect-time check must still reject.
    validateSessionResult = { valid: false, reason: "inactive" }
    const token = await signedActorToken({
      sub: "cliente-postlogout", userType: "cliente", scopes: [], sid: "sesion-postlogout", jti: "actor-postlogout",
    }, "5m")
    const startedAt = Date.now()
    await assert.rejects(connect(baseUrl, { token }), /TOKEN_INVALID/)
    assert.ok(Date.now() - startedAt < 1000, "must reject immediately, not wait for actor TTL")
  })

  test("validateSession throwing (simulated timeout/outage) fails closed", async () => {
    validateSessionResult = new Error("simulated internal session-check outage")
    const token = await signedActorToken({
      sub: "cliente-outage", userType: "cliente", scopes: [], sid: "sesion-outage", jti: "actor-outage",
    })
    await assert.rejects(connect(baseUrl, { token }), (error) => {
      assert.equal(error.message, "TOKEN_INVALID")
      return true
    })
  })

  test("validateSession returning an unexpected shape fails closed (defensive parsing)", async () => {
    validateSessionResult = { unexpected: "shape" }
    const token = await signedActorToken({
      sub: "cliente-shape", userType: "cliente", scopes: [], sid: "sesion-shape", jti: "actor-shape",
    })
    await assert.rejects(connect(baseUrl, { token }), /TOKEN_INVALID/)
  })

  test("cryptographically invalid JWT is rejected before validateSession is ever invoked", async () => {
    await assert.rejects(connect(baseUrl, { token: "not-a-real-jwt" }), /TOKEN_INVALID/)
    assert.deepEqual(validateSessionCalls, [])
  })

  test("expired JWT is rejected before validateSession is ever invoked", async () => {
    const token = await signedActorToken({
      sub: "cliente-expired", userType: "cliente", scopes: [], sid: "sesion-expired", jti: "actor-expired-connect",
    }, "1s")
    await wait(1200)
    await assert.rejects(connect(baseUrl, { token }), /TOKEN_EXPIRED/)
    assert.deepEqual(validateSessionCalls, [])
  })

  test("JWT missing the sid claim is rejected before validateSession is ever invoked", async () => {
    const token = await new SignJWT({
      kind: "socket-actor", sub: "cliente-nosid", userType: "cliente", scopes: [], jti: "actor-nosid",
    })
      .setProtectedHeader({ alg: "HS256", kid: "testing-key" })
      .setIssuer("deligo-next")
      .setAudience("deligo-chat-service")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(actorSecret))
    await assert.rejects(connect(baseUrl, { token }), /TOKEN_INVALID/)
    assert.deepEqual(validateSessionCalls, [])
  })

  test("validateSession is invoked exactly once per connection, never again for subsequent socket events", async () => {
    const token = await signedActorToken({
      sub: "cliente-once", userType: "cliente", scopes: [], sid: "sesion-once", jti: "actor-once",
    })
    const socket = await connect(baseUrl, { token })
    assert.equal(validateSessionCalls.length, 1)
    await new Promise((resolve) => socket.emit("join-room", "pedido-x", resolve))
    socket.emit("typing", "pedido-x")
    socket.emit("mark-read", "pedido-x")
    await wait(150)
    assert.equal(validateSessionCalls.length, 1)
    socket.disconnect()
  })

  test("a fresh reconnect with an active session validates again and succeeds", async () => {
    const token = await signedActorToken({
      sub: "cliente-reconnect", userType: "cliente", scopes: [], sid: "sesion-reconnect", jti: "actor-reconnect-1",
    })
    const first = await connect(baseUrl, { token })
    first.disconnect()
    await wait(50)

    const secondToken = await signedActorToken({
      sub: "cliente-reconnect", userType: "cliente", scopes: [], sid: "sesion-reconnect", jti: "actor-reconnect-2",
    })
    const second = await connect(baseUrl, { token: secondToken })
    assert.deepEqual(validateSessionCalls, ["sesion-reconnect", "sesion-reconnect"])
    second.disconnect()
  })

  test("rejected connect never leaks the internal reason to the client", async () => {
    validateSessionResult = { valid: false, reason: "http_503_config_missing_on_monolith" }
    const token = await signedActorToken({
      sub: "cliente-leak", userType: "cliente", scopes: [], sid: "sesion-leak", jti: "actor-leak",
    })
    await assert.rejects(connect(baseUrl, { token }), (error) => {
      assert.equal(error.message, "TOKEN_INVALID")
      assert.doesNotMatch(error.message, /503|http_|secret|session|monolith/i)
      return true
    })
  })
})

// -----------------------------------------------------------------------
// Outage policy: no injected validateSession AND no REALTIME_SESSION_CHECK_
// SECRET/DELIGO_MONOLITH_INTERNAL_URL configured — the real default
// checkSessionActive must fail closed without ever attempting a network
// call, and the service must still be otherwise healthy (REJECT_SOCKET_
// CONNECTS, not FAIL_STARTUP — Stage2 OUTAGE_POLICY).
// -----------------------------------------------------------------------
describe("chat-service Phase B outage policy (missing configuration, no stub)", () => {
  let service
  let baseUrl

  before(async () => {
    process.env.NODE_ENV = "test"
    process.env.REALTIME_SOCKET_TOKEN_SECRET = actorSecret
    process.env.REALTIME_KEY_ID = "testing-key"
    process.env.REALTIME_ALLOWED_ORIGINS = "http://localhost:3000"
    delete process.env.DELIGO_MONOLITH_INTERNAL_URL
    delete process.env.REALTIME_SESSION_CHECK_SECRET
    service = createChatService({ port: 0 })
    await new Promise((resolve) => service.listen(resolve))
    baseUrl = `http://127.0.0.1:${service.httpServer.address().port}`
  })

  after(async () => {
    await service.close()
  })

  test("process starts normally and /health stays 200 despite missing session-check configuration", async () => {
    const response = await fetch(baseUrl + "/health")
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
  })

  test("every new connection is rejected while configuration is missing", async () => {
    const token = await signedActorToken({
      sub: "cliente-noconfig", userType: "cliente", scopes: [], sid: "sesion-noconfig", jti: "actor-noconfig",
    })
    await assert.rejects(connect(baseUrl, { token }), /TOKEN_INVALID/)
  })
})
