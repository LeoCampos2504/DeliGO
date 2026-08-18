const { after, before, describe, test } = require("node:test")
const assert = require("node:assert/strict")
const { createHmac } = require("crypto")
const { Readable } = require("stream")
const { io } = require("socket.io-client")
const { SignJWT } = require("jose")
const { createChatService } = require("../index")
const {
  calculateSignature,
  createInternalPublishAuth,
  createReplayCache,
} = require("../internal-publish-auth")
const {
  EVENT_MAPPING,
  INTERNAL_EVENT_DEDUPE_TTL_MS,
  TRACKING_CORRELATION_DEDUPE_TTL_MS,
  createBoundedRateLimiter,
  createEventDedupeCache,
  createInternalPublishHandler,
  trackingCorrelationKey,
} = require("../internal-publish-handler")
const { parseAndValidateEnvelope } = require("../internal-publish-schema")

const internalSecret = "test-only-internal-publish-secret-01234567890123456789"
const socketSecret = "test-only-realtime-secret-01234567890123456789"
let service
let baseUrl

function validMessage(eventId, pedidoId = "pedido-publish-a") {
  return {
    version: 1,
    type: "chat.message.created",
    eventId,
    resourceId: pedidoId,
    occurredAt: new Date().toISOString(),
    payload: {
      id: "mensaje-" + eventId,
      pedidoId,
      remitente: "cliente",
      texto: "mensaje validado",
      imagenUrl: null,
      archivoUrl: null,
      archivoNombre: null,
      archivoTipo: null,
      leido: false,
      fecha: new Date().toISOString(),
      clienteId: "cliente-publish-a",
    },
  }
}

// Real chat.message.created publishes use the persisted message id as both
// the envelope eventId and payload.id (see the Chat producer design doc) —
// unlike validMessage()'s test-only "mensaje-" + eventId convention, this
// keeps them identical so cross-path dedupe tests exercise a genuine key
// collision with the legacy message-sent relay's own message.id-based key.
function validMessageWithMatchingId(id, pedidoId = "pedido-publish-a") {
  return {
    version: 1,
    type: "chat.message.created",
    eventId: id,
    resourceId: pedidoId,
    occurredAt: new Date().toISOString(),
    payload: {
      id,
      pedidoId,
      remitente: "cliente",
      texto: "mensaje validado",
      imagenUrl: null,
      archivoUrl: null,
      archivoNombre: null,
      archivoTipo: null,
      leido: false,
      fecha: new Date().toISOString(),
      clienteId: "cliente-publish-a",
    },
  }
}

function signedHeaders(rawBody, requestId = "request-" + Math.random().toString(36).slice(2)) {
  const timestamp = String(Date.now())
  return {
    "Content-Type": "application/json",
    "X-DeliGO-Timestamp": timestamp,
    "X-DeliGO-Request-Id": requestId,
    "X-DeliGO-Signature": calculateSignature(internalSecret, timestamp, requestId, rawBody),
  }
}

async function publish(body, overrides = {}) {
  const rawBody = typeof body === "string" ? body : JSON.stringify(body)
  return fetch(baseUrl + "/internal/realtime/publish", {
    method: "POST",
    headers: { ...signedHeaders(rawBody), ...(overrides.headers || {}) },
    body: rawBody,
  })
}

async function invokeHandler(handler, body) {
  const rawBody = typeof body === "string" ? body : JSON.stringify(body)
  const requestHeaders = signedHeaders(rawBody)
  const request = Readable.from([Buffer.from(rawBody)])
  request.headers = Object.fromEntries(
    Object.entries({ ...requestHeaders, "Content-Type": "application/json" }).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  )
  let statusCode
  let responseBody
  const response = {
    writeHead(status) {
      statusCode = status
    },
    end(bodyText) {
      responseBody = JSON.parse(bodyText)
    },
  }
  await handler(request, response)
  return { statusCode, body: responseBody }
}

function signedSocketToken(kind, claims, expiresIn = "5m") {
  return new SignJWT({ kind, ...claims })
    .setProtectedHeader({ alg: "HS256", kid: "testing-key" })
    .setIssuer("deligo-next")
    .setAudience("deligo-chat-service")
    .setIssuedAt()
    .setJti(claims.jti)
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(socketSecret))
}

function connect(auth) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ["websocket"],
      auth,
      extraHeaders: { Origin: "http://localhost:3000" },
      reconnection: false,
      timeout: 1500,
    })
    socket.once("connect", () => resolve(socket))
    socket.once("connect_error", reject)
  })
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function uniqueId(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2)
}

// Connects a socket for `userType` and joins `pedidoId` with exactly
// `scopes` granted, mirroring the real join-order-room capability flow.
async function joinAuthorizedRoom(pedidoId, userType, scopes, overrides = {}) {
  const sub = overrides.sub || uniqueId(userType)
  const sid = overrides.sid || uniqueId("session")
  const actorToken = await signedSocketToken("socket-actor", {
    sub,
    userType,
    scopes: [],
    sid,
    jti: uniqueId("actor"),
  })
  const capability = await signedSocketToken(
    "room-capability",
    {
      sub,
      userType,
      scopes,
      sid,
      jti: uniqueId("cap"),
      pedidoId,
      room: "pedido:" + pedidoId,
    },
    overrides.expiresIn || "5m"
  )
  const socket = await connect({ token: actorToken })
  const ack = await new Promise((resolve) => socket.emit("join-order-room", capability, resolve))
  return { socket, ack }
}

function emitLegacyMessage(socket, pedidoId, message) {
  socket.emit("message-sent", { pedidoId, message })
}

function validRead(eventId, pedidoId = "pedido-publish-a") {
  return {
    version: 1,
    type: "chat.messages.read",
    eventId,
    resourceId: pedidoId,
    occurredAt: new Date().toISOString(),
    payload: { pedidoId, readBy: "cliente-publish-a", userType: "cliente" },
  }
}

function validTracking(eventId, pedidoId = "pedido-publish-a", lat = -34.6037, lng = -58.3816) {
  return {
    version: 1,
    type: "tracking.location.updated",
    eventId,
    resourceId: pedidoId,
    occurredAt: new Date().toISOString(),
    payload: { pedidoId, lat, lng, timestamp: new Date().toISOString() },
  }
}

function emitLegacyLocation(socket, pedidoId, lat, lng, timestamp) {
  socket.emit("location-update", { pedidoId, lat, lng, timestamp: timestamp ?? new Date().toISOString() })
}

before(async () => {
  process.env.NODE_ENV = "test"
  process.env.REALTIME_INTERNAL_PUBLISH_SECRET = internalSecret
  process.env.REALTIME_SOCKET_TOKEN_SECRET = socketSecret
  process.env.REALTIME_KEY_ID = "testing-key"
  process.env.REALTIME_ALLOWED_ORIGINS = "http://localhost:3000"
  service = createChatService({ port: 0 })
  await new Promise((resolve) => service.listen(resolve))
  baseUrl = "http://127.0.0.1:" + service.httpServer.address().port
})

after(async () => {
  await service.close()
  delete process.env.REALTIME_INTERNAL_PUBLISH_SECRET
})

describe("internal publish auth and schema", () => {
  test("verifies HMAC, rejects changed raw body and rejects requestId replay", () => {
    const auth = createInternalPublishAuth({ replayCache: createReplayCache() })
    const rawBody = Buffer.from(JSON.stringify(validMessage("auth-event")))
    const timestamp = String(Date.now())
    const requestId = "auth-request"
    const headers = {
      "x-deligo-timestamp": timestamp,
      "x-deligo-request-id": requestId,
      "x-deligo-signature": calculateSignature(internalSecret, timestamp, requestId, rawBody),
    }

    assert.equal(auth.verify(headers, rawBody).ok, true)
    assert.equal(auth.verify(headers, rawBody).code, "AUTH_REPLAY")

    const changedRequestId = "auth-request-changed-body"
    const changedHeaders = {
      ...headers,
      "x-deligo-request-id": changedRequestId,
      "x-deligo-signature": calculateSignature(
        internalSecret,
        timestamp,
        changedRequestId,
        rawBody
      ),
    }
    assert.equal(auth.verify(changedHeaders, Buffer.from(rawBody + " ")).code, "AUTH_INVALID")
    assert.equal(auth.verify({ ...headers, "x-deligo-signature": undefined }, rawBody).code, "AUTH_INVALID")
    assert.equal(
      auth.verify({ ...headers, "x-deligo-timestamp": undefined }, rawBody).code,
      "AUTH_INVALID"
    )
    assert.equal(
      auth.verify({ ...headers, "x-deligo-request-id": "bad request" }, rawBody).code,
      "AUTH_INVALID"
    )
  })

  test("rejects stale and future timestamps", () => {
    const auth = createInternalPublishAuth({ replayCache: createReplayCache() })
    const rawBody = Buffer.from("{}")
    const staleTimestamp = String(Date.now() - 61_000)
    const staleRequestId = "stale-request"
    assert.equal(
      auth.verify({
        "x-deligo-timestamp": staleTimestamp,
        "x-deligo-request-id": staleRequestId,
        "x-deligo-signature": calculateSignature(
          internalSecret,
          staleTimestamp,
          staleRequestId,
          rawBody
        ),
      }, rawBody).code,
      "AUTH_INVALID"
    )

    const futureTimestamp = String(Date.now() + 31_000)
    const futureRequestId = "future-request"
    assert.equal(
      auth.verify({
        "x-deligo-timestamp": futureTimestamp,
        "x-deligo-request-id": futureRequestId,
        "x-deligo-signature": calculateSignature(
          internalSecret,
          futureTimestamp,
          futureRequestId,
          rawBody
        ),
      }, rawBody).code,
      "AUTH_INVALID"
    )
  })

  test("validates allowlisted schema and canonical resource binding", () => {
    const envelope = validMessage("schema-event")
    assert.equal(parseAndValidateEnvelope(JSON.stringify(envelope)).type, "chat.message.created")
    assert.equal(EVENT_MAPPING["tracking.location.updated"].event, "repartidor-location")
    assert.equal(EVENT_MAPPING["tracking.location.updated"].requiredRecipientScope, "tracking:watch")
    assert.equal(EVENT_MAPPING["chat.message.created"].requiredRecipientScope, "chat:read")
    assert.equal(EVENT_MAPPING["chat.messages.read"].requiredRecipientScope, "chat:read")

    const readEnvelope = {
      version: 1,
      type: "chat.messages.read",
      eventId: "read-schema-event",
      resourceId: "pedido-publish-a",
      occurredAt: new Date().toISOString(),
      payload: {
        pedidoId: "pedido-publish-a",
        readBy: "cliente-publish-a",
        userType: "cliente",
      },
    }
    const trackingEnvelope = {
      version: 1,
      type: "tracking.location.updated",
      eventId: "tracking-schema-event",
      resourceId: "pedido-publish-a",
      occurredAt: new Date().toISOString(),
      payload: {
        pedidoId: "pedido-publish-a",
        lat: -34.6037,
        lng: -58.3816,
        timestamp: new Date().toISOString(),
        version: 4,
      },
    }
    assert.equal(parseAndValidateEnvelope(JSON.stringify(readEnvelope)).type, "chat.messages.read")
    assert.equal(
      parseAndValidateEnvelope(JSON.stringify(trackingEnvelope)).type,
      "tracking.location.updated"
    )

    assert.throws(
      () => parseAndValidateEnvelope(JSON.stringify({ ...envelope, type: "arbitrary.broadcast" })),
      /SCHEMA_UNKNOWN_TYPE/
    )
    assert.throws(
      () => parseAndValidateEnvelope(JSON.stringify({ ...envelope, version: 2 })),
      /SCHEMA_INVALID_VERSION/
    )
    assert.throws(
      () => parseAndValidateEnvelope(JSON.stringify({ ...envelope, eventId: undefined })),
      /SCHEMA_INVALID_EVENT_ID/
    )
    assert.throws(
      () => parseAndValidateEnvelope(JSON.stringify({ ...envelope, resourceId: undefined })),
      /SCHEMA_INVALID_RESOURCE/
    )
    assert.throws(
      () => parseAndValidateEnvelope(JSON.stringify({ ...envelope, occurredAt: "not-a-date" })),
      /SCHEMA_INVALID_DATE/
    )
    assert.throws(
      () => parseAndValidateEnvelope(JSON.stringify({ ...envelope, payload: {} })),
      /SCHEMA_INVALID_IDENTIFIER/
    )
    assert.throws(
      () => parseAndValidateEnvelope(JSON.stringify({ ...envelope, room: "pedido:other" })),
      /SCHEMA_UNKNOWN_FIELD/
    )
    assert.throws(
      () => parseAndValidateEnvelope(JSON.stringify({
        ...envelope,
        payload: { ...envelope.payload, pedidoId: "pedido-other" },
      })),
      /SCHEMA_RESOURCE_MISMATCH/
    )
  })

  test("bounds limiter and event dedupe cache", () => {
    const limiter = createBoundedRateLimiter(2, 60_000)
    assert.equal(limiter.allow(1000), true)
    assert.equal(limiter.allow(1001), true)
    assert.equal(limiter.allow(1002), false)
    assert.equal(limiter.allow(61_001), true)

    const dedupe = createEventDedupeCache(INTERNAL_EVENT_DEDUPE_TTL_MS)
    assert.equal(dedupe.claim("chat.message.created:event-a", 1000), true)
    assert.equal(dedupe.claim("chat.message.created:event-a", 1001), false)
    assert.equal(dedupe.claim("chat.message.created:event-a", 121_001), true)

    const boundedReplay = createReplayCache({ maxEntries: 2 })
    assert.equal(boundedReplay.claim("replay-a"), true)
    assert.equal(boundedReplay.claim("replay-b"), true)
    assert.equal(boundedReplay.claim("replay-c"), false)
    assert.equal(boundedReplay.size(), 2)
  })

  test("tracking correlation key is clock-independent and its dedupe cache expires on the documented bounded TTL", () => {
    // No sleep of real time — the cache's claim() accepts an explicit `now`,
    // so the 2000ms TTL boundary is tested deterministically. Demonstrates
    // TRACKING_CORRELATION_TTL_MS=2000 and the documented bounded-best-effort
    // semantics: a same-coordinate claim after the TTL is NOT suppressed.
    assert.equal(TRACKING_CORRELATION_DEDUPE_TTL_MS, 2000)
    const key = trackingCorrelationKey("pedido-ttl", -34.6037, -58.3816)
    assert.equal(trackingCorrelationKey("pedido-ttl", -34.6037, -58.3816), key)
    assert.equal(trackingCorrelationKey("pedido-other", -34.6037, -58.3816) === key, false)
    // Clock-independent: the formula never embeds any timestamp.
    assert.equal(key.includes(String(Date.now()).slice(0, 5)), false)

    const correlationCache = createEventDedupeCache(TRACKING_CORRELATION_DEDUPE_TTL_MS)
    assert.equal(correlationCache.claim(key, 1000), true)
    // Still within the TTL window (just before expiry) — a duplicate claim
    // for the SAME physical GPS sample must still be suppressed.
    assert.equal(correlationCache.claim(key, 1000 + TRACKING_CORRELATION_DEDUPE_TTL_MS - 1), false)
    // Past the TTL — the next legitimate ~5s-later GPS tick (even with an
    // unchanged coordinate for a stationary repartidor) must NOT be falsely
    // suppressed. This is the documented residual of bounded best-effort
    // duplicate suppression, not a defect.
    assert.equal(correlationCache.claim(key, 1000 + TRACKING_CORRELATION_DEDUPE_TTL_MS + 1), true)
  })
})

describe("internal publish endpoint", () => {
  test("publishes only the explicit mapping and deduplicates logical retries", async () => {
    const body = validMessage("http-publish-event")
    const first = await publish(body)
    assert.equal(first.status, 200)
    assert.deepEqual(await first.json(), {
      ok: true,
      published: true,
      eventId: "http-publish-event",
      type: "chat.message.created",
    })

    const second = await publish(body)
    assert.equal(second.status, 200)
    assert.deepEqual(await second.json(), {
      ok: true,
      deduplicated: true,
      eventId: "http-publish-event",
      type: "chat.message.created",
    })
  })

  test("rejects wrong auth, incompatible content type and oversized body", async () => {
    const body = validMessage("negative-auth-event")
    const wrongAuth = await publish(body, {
      headers: { "X-DeliGO-Signature": "0".repeat(64) },
    })
    assert.equal(wrongAuth.status, 401)

    const contentType = await publish(body, {
      headers: { "Content-Type": "text/plain" },
    })
    assert.equal(contentType.status, 415)

    const oversized = JSON.stringify({ ...body, padding: "x".repeat(33 * 1024) })
    const oversizedResponse = await publish(oversized)
    assert.equal(oversizedResponse.status, 413)
  })

  test("fails closed when the dedicated secret is absent", async () => {
    const previous = process.env.REALTIME_INTERNAL_PUBLISH_SECRET
    delete process.env.REALTIME_INTERNAL_PUBLISH_SECRET
    try {
      const response = await fetch(baseUrl + "/internal/realtime/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      assert.equal(response.status, 503)
    } finally {
      process.env.REALTIME_INTERNAL_PUBLISH_SECRET = previous
    }
  })

  test("emits a valid event to the canonical authorized socket room", async () => {
    const actorToken = await signedSocketToken("socket-actor", {
      sub: "cliente-publish-a",
      userType: "cliente",
      scopes: [],
      sid: "session-publish-a",
      jti: "actor-publish-a",
    })
    const capability = await signedSocketToken("room-capability", {
      sub: "cliente-publish-a",
      userType: "cliente",
      scopes: ["chat:read"],
      sid: "session-publish-a",
      jti: "cap-publish-a",
      pedidoId: "pedido-publish-a",
      room: "pedido:pedido-publish-a",
    })
    const socket = await connect({ token: actorToken })
    const joinAck = await new Promise((resolve) => socket.emit("join-order-room", capability, resolve))
    assert.equal(joinAck.ok, true)

    const received = new Promise((resolve) => socket.once("new-message", resolve))
    const response = await publish(validMessage("socket-publish-event"))
    assert.equal(response.status, 200)
    const message = await received
    assert.equal(message.pedidoId, "pedido-publish-a")
    assert.equal(message.id, "mensaje-socket-publish-event")
    socket.disconnect()
  })

  test("handles synchronous emit failure without poisoning logical dedupe", async () => {
    let shouldFail = true
    let emitCount = 0
    const failingIo = {
      to() {
        return {
          emit() {
            if (shouldFail) throw new Error("test emit failure")
            emitCount += 1
          },
        }
      },
    }
    const handler = createInternalPublishHandler({
      io: failingIo,
      getRecipientSockets: () => ["stub-socket-1"],
    })
    const body = validMessage("emit-failure-event")

    const first = await invokeHandler(handler, body)
    assert.equal(first.statusCode, 503)
    shouldFail = false
    const second = await invokeHandler(handler, body)
    assert.equal(second.statusCode, 200)
    assert.equal(second.body.published, true)
    assert.equal(emitCount, 1)
  })

  test("a partial fan-out failure retains the claim instead of releasing it for full redelivery", async () => {
    const sharedDedupe = createEventDedupeCache()
    let callCount = 0
    const partiallyFailingIo = {
      to() {
        return {
          emit() {
            callCount += 1
            // First recipient succeeds; the second throws mid-loop.
            if (callCount === 2) throw new Error("simulated partial fan-out failure")
          },
        }
      },
    }
    const handler = createInternalPublishHandler({
      io: partiallyFailingIo,
      eventDedupe: sharedDedupe,
      getRecipientSockets: () => ["stub-socket-1", "stub-socket-2", "stub-socket-3"],
    })
    const body = validMessageWithMatchingId("mensaje-partial-fanout")
    const result = await invokeHandler(handler, body)
    assert.equal(result.statusCode, 503)

    // stub-socket-1 already received the event (callCount reached 1 before
    // the throw at callCount 2) — a retry via either producer path must not
    // be allowed to redeliver to it, so the claim must still be held here.
    assert.equal(sharedDedupe.claim("chat.message.created:mensaje-partial-fanout"), false)
  })

  test("tracking internal fan-out failure before any delivery releases both the eventDedupe and correlation claims", async () => {
    const sharedEventDedupe = createEventDedupeCache()
    const sharedCorrelationDedupe = createEventDedupeCache(TRACKING_CORRELATION_DEDUPE_TTL_MS)
    const failingIo = {
      to() {
        return {
          emit() {
            throw new Error("simulated tracking emit failure")
          },
        }
      },
    }
    const handler = createInternalPublishHandler({
      io: failingIo,
      eventDedupe: sharedEventDedupe,
      trackingCorrelationDedupe: sharedCorrelationDedupe,
      getRecipientSockets: () => ["stub-socket-1"],
    })
    const body = validTracking("tracking-zero-delivery-event", "pedido-tracking-zero", -31.5, -68.5)
    const result = await invokeHandler(handler, body)
    assert.equal(result.statusCode, 503)

    assert.equal(
      sharedEventDedupe.claim("tracking.location.updated:tracking-zero-delivery-event"),
      true
    )
    assert.equal(
      sharedCorrelationDedupe.claim(trackingCorrelationKey("pedido-tracking-zero", -31.5, -68.5)),
      true
    )
  })

  test("tracking internal partial fan-out failure retains both the eventDedupe and correlation claims", async () => {
    const sharedEventDedupe = createEventDedupeCache()
    const sharedCorrelationDedupe = createEventDedupeCache(TRACKING_CORRELATION_DEDUPE_TTL_MS)
    let callCount = 0
    const partiallyFailingIo = {
      to() {
        return {
          emit() {
            callCount += 1
            if (callCount === 2) throw new Error("simulated tracking partial fan-out failure")
          },
        }
      },
    }
    const handler = createInternalPublishHandler({
      io: partiallyFailingIo,
      eventDedupe: sharedEventDedupe,
      trackingCorrelationDedupe: sharedCorrelationDedupe,
      getRecipientSockets: () => ["stub-socket-1", "stub-socket-2", "stub-socket-3"],
    })
    const body = validTracking("tracking-partial-event", "pedido-tracking-partial", -30.2, -67.1)
    const result = await invokeHandler(handler, body)
    assert.equal(result.statusCode, 503)

    assert.equal(
      sharedEventDedupe.claim("tracking.location.updated:tracking-partial-event"),
      false
    )
    assert.equal(
      sharedCorrelationDedupe.claim(trackingCorrelationKey("pedido-tracking-partial", -30.2, -67.1)),
      false
    )
  })
})

describe("internal publish recipient scope filtering", () => {
  test("chat.message.created delivers new-message only to cliente and negocio sockets holding chat:read", async () => {
    const pedidoId = "pedido-recipient-chat-a"
    const { socket: clienteSocket, ack: clienteAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["chat:read"])
    assert.equal(clienteAck.ok, true)
    const { socket: negocioSocket, ack: negocioAck } = await joinAuthorizedRoom(pedidoId, "negocio", ["chat:read"])
    assert.equal(negocioAck.ok, true)

    const clienteReceived = new Promise((resolve) => clienteSocket.once("new-message", resolve))
    const negocioReceived = new Promise((resolve) => negocioSocket.once("new-message", resolve))
    const response = await publish(validMessage("recipient-chat-a-event", pedidoId))
    assert.equal(response.status, 200)

    const [clienteMessage, negocioMessage] = await Promise.all([clienteReceived, negocioReceived])
    assert.equal(clienteMessage.pedidoId, pedidoId)
    assert.equal(negocioMessage.pedidoId, pedidoId)
    clienteSocket.disconnect()
    negocioSocket.disconnect()
  })

  test("chat.message.created does not deliver to a repartidor holding only tracking:publish", async () => {
    const pedidoId = "pedido-recipient-chat-b"
    const { socket, ack } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(ack.ok, true)
    let received = false
    socket.once("new-message", () => { received = true })

    const response = await publish(validMessage("recipient-chat-b-event", pedidoId))
    assert.equal(response.status, 200)
    await wait(200)
    assert.equal(received, false)
    socket.disconnect()
  })

  test("chat.message.created does not deliver to a cliente holding only tracking:watch", async () => {
    const pedidoId = "pedido-recipient-chat-c"
    const { socket, ack } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(ack.ok, true)
    let received = false
    socket.once("new-message", () => { received = true })

    const response = await publish(validMessage("recipient-chat-c-event", pedidoId))
    assert.equal(response.status, 200)
    await wait(200)
    assert.equal(received, false)
    socket.disconnect()
  })

  test("chat.message.created does not deliver once the recipient's chat:read grant has expired", async () => {
    const pedidoId = "pedido-recipient-chat-d"
    const { socket, ack } = await joinAuthorizedRoom(pedidoId, "cliente", ["chat:read"], { expiresIn: "1s" })
    assert.equal(ack.ok, true)
    await wait(1300)
    let received = false
    socket.once("new-message", () => { received = true })

    const response = await publish(validMessage("recipient-chat-d-event", pedidoId))
    assert.equal(response.status, 200)
    await wait(200)
    assert.equal(received, false)
    socket.disconnect()
  })

  test("chat.message.created for one pedido does not leak to a socket authorized only for another room", async () => {
    const pedidoA = "pedido-recipient-chat-e1"
    const pedidoB = "pedido-recipient-chat-e2"
    const { socket, ack } = await joinAuthorizedRoom(pedidoB, "cliente", ["chat:read"])
    assert.equal(ack.ok, true)
    let received = false
    socket.once("new-message", () => { received = true })

    const response = await publish(validMessage("recipient-chat-e-event", pedidoA))
    assert.equal(response.status, 200)
    await wait(200)
    assert.equal(received, false)
    socket.disconnect()
  })

  test("chat.message.created delivers to a recipient whose grant includes chat:read among multiple scopes", async () => {
    const pedidoId = "pedido-recipient-chat-f"
    const { socket, ack } = await joinAuthorizedRoom(pedidoId, "cliente", ["chat:read", "chat:typing"])
    assert.equal(ack.ok, true)
    const received = new Promise((resolve) => socket.once("new-message", resolve))

    const response = await publish(validMessage("recipient-chat-f-event", pedidoId))
    assert.equal(response.status, 200)
    const message = await received
    assert.equal(message.pedidoId, pedidoId)
    socket.disconnect()
  })

  test("chat.messages.read delivers messages-read to a recipient holding chat:read", async () => {
    const pedidoId = "pedido-recipient-read-a"
    const { socket, ack } = await joinAuthorizedRoom(pedidoId, "negocio", ["chat:read"])
    assert.equal(ack.ok, true)
    const received = new Promise((resolve) => socket.once("messages-read", resolve))

    const response = await publish(validRead("recipient-read-a-event", pedidoId))
    assert.equal(response.status, 200)
    const message = await received
    assert.equal(message.pedidoId, pedidoId)
    socket.disconnect()
  })

  test("chat.messages.read does not deliver to a tracking-only recipient", async () => {
    const pedidoId = "pedido-recipient-read-b"
    const { socket, ack } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(ack.ok, true)
    let received = false
    socket.once("messages-read", () => { received = true })

    const response = await publish(validRead("recipient-read-b-event", pedidoId))
    assert.equal(response.status, 200)
    await wait(200)
    assert.equal(received, false)
    socket.disconnect()
  })

  test("tracking.location.updated delivers repartidor-location to a recipient holding tracking:watch", async () => {
    const pedidoId = "pedido-recipient-track-a"
    const { socket, ack } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(ack.ok, true)
    const received = new Promise((resolve) => socket.once("repartidor-location", resolve))

    const response = await publish(validTracking("recipient-track-a-event", pedidoId))
    assert.equal(response.status, 200)
    const message = await received
    assert.equal(message.pedidoId, pedidoId)
    socket.disconnect()
  })

  test("tracking.location.updated does not deliver to a repartidor holding only tracking:publish", async () => {
    const pedidoId = "pedido-recipient-track-b"
    const { socket, ack } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(ack.ok, true)
    let received = false
    socket.once("repartidor-location", () => { received = true })

    const response = await publish(validTracking("recipient-track-b-event", pedidoId))
    assert.equal(response.status, 200)
    await wait(200)
    assert.equal(received, false)
    socket.disconnect()
  })
})

describe("cross-path dedupe between internal publish and legacy message-sent", () => {
  test("internal publish first suppresses a later legacy relay with the same message id", async () => {
    const pedidoId = "pedido-crosspath-a"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["chat:read"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "negocio", ["chat:read"])
    assert.equal(recipientAck.ok, true)

    let deliveryCount = 0
    recipient.on("new-message", () => { deliveryCount += 1 })

    const publishResponse = await publish(validMessageWithMatchingId("mensaje-crosspath-a", pedidoId))
    assert.equal(publishResponse.status, 200)
    await wait(150)

    emitLegacyMessage(sender, pedidoId, {
      id: "mensaje-crosspath-a",
      pedidoId,
      texto: "duplicado stale",
      leido: false,
      fecha: new Date().toISOString(),
    })
    await wait(150)

    assert.equal(deliveryCount, 1)
    sender.disconnect()
    recipient.disconnect()
  })

  test("legacy relay first suppresses a later internal publish with the same message id", async () => {
    const pedidoId = "pedido-crosspath-b"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["chat:read"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "negocio", ["chat:read"])
    assert.equal(recipientAck.ok, true)

    let deliveryCount = 0
    recipient.on("new-message", () => { deliveryCount += 1 })

    emitLegacyMessage(sender, pedidoId, {
      id: "mensaje-crosspath-b",
      pedidoId,
      texto: "primero legacy",
      leido: false,
      fecha: new Date().toISOString(),
    })
    await wait(150)

    const publishResponse = await publish(validMessageWithMatchingId("mensaje-crosspath-b", pedidoId))
    assert.equal(publishResponse.status, 200)
    assert.equal((await publishResponse.json()).deduplicated, true)
    await wait(150)

    assert.equal(deliveryCount, 1)
    sender.disconnect()
    recipient.disconnect()
  })

  test("a failed internal publish releases the claim so the legacy relay can still act as fallback", async () => {
    const sharedDedupe = createEventDedupeCache()
    let shouldFail = true
    const failingIo = {
      to() {
        return {
          emit() {
            if (shouldFail) throw new Error("simulated bridge emit failure")
          },
        }
      },
    }
    const handler = createInternalPublishHandler({
      io: failingIo,
      eventDedupe: sharedDedupe,
      getRecipientSockets: () => ["stub-socket-1"],
    })
    const body = validMessageWithMatchingId("mensaje-crosspath-fallback-event")
    const result = await invokeHandler(handler, body)
    assert.equal(result.statusCode, 503)

    // Same shared instance the legacy message-sent handler would consult —
    // the claim must succeed here, proving the failed bridge publish did not
    // leave the key poisoned for the legacy fallback path.
    assert.equal(sharedDedupe.claim("chat.message.created:mensaje-crosspath-fallback-event"), true)
  })

  test("a failed internal publish on the live service still lets the real legacy relay deliver exactly once as fallback", async () => {
    const pedidoId = "pedido-crosspath-h"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["chat:read"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "negocio", ["chat:read"])
    assert.equal(recipientAck.ok, true)

    let deliveryCount = 0
    recipient.on("new-message", () => { deliveryCount += 1 })

    const messageId = "mensaje-crosspath-h"
    // Temporarily intercept the live service's real io.to so the FIRST
    // fan-out attempt (the bridge's own) throws before delivering to
    // anyone, then restore it before the legacy relay runs — this exercises
    // the real HTTP publish path and the real connected socket's real
    // message-sent handler, not a manual claim()/release() call.
    const originalTo = service.io.to.bind(service.io)
    let intercepted = false
    service.io.to = (target) => {
      if (!intercepted) {
        intercepted = true
        return { emit() { throw new Error("simulated live bridge emit failure") } }
      }
      return originalTo(target)
    }
    try {
      const publishResponse = await publish(validMessageWithMatchingId(messageId, pedidoId))
      assert.equal(publishResponse.status, 503)
    } finally {
      service.io.to = originalTo
    }

    emitLegacyMessage(sender, pedidoId, {
      id: messageId,
      pedidoId,
      texto: "fallback real tras fallo del bridge",
      leido: false,
      fecha: new Date().toISOString(),
    })
    await wait(150)

    assert.equal(deliveryCount, 1)
    sender.disconnect()
    recipient.disconnect()
  })

  test("different message ids are not cross-suppressed", async () => {
    const pedidoId = "pedido-crosspath-d"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["chat:read"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "negocio", ["chat:read"])
    assert.equal(recipientAck.ok, true)

    const receivedIds = []
    recipient.on("new-message", (message) => { receivedIds.push(message.id) })

    const publishResponse = await publish(validMessage("crosspath-d1", pedidoId))
    assert.equal(publishResponse.status, 200)
    await wait(100)

    emitLegacyMessage(sender, pedidoId, {
      id: "legacy-crosspath-d2",
      pedidoId,
      texto: "mensaje distinto",
      leido: false,
      fecha: new Date().toISOString(),
    })
    await wait(150)

    assert.deepEqual(receivedIds.sort(), ["legacy-crosspath-d2", "mensaje-crosspath-d1"].sort())
    sender.disconnect()
    recipient.disconnect()
  })

  test("a repeated legacy message-sent with the same id is suppressed", async () => {
    const pedidoId = "pedido-crosspath-e"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["chat:read"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "negocio", ["chat:read"])
    assert.equal(recipientAck.ok, true)

    let deliveryCount = 0
    recipient.on("new-message", () => { deliveryCount += 1 })

    const message = {
      id: "legacy-repeat-e",
      pedidoId,
      texto: "repetido",
      leido: false,
      fecha: new Date().toISOString(),
    }
    emitLegacyMessage(sender, pedidoId, message)
    await wait(100)
    emitLegacyMessage(sender, pedidoId, message)
    await wait(150)

    assert.equal(deliveryCount, 1)
    sender.disconnect()
    recipient.disconnect()
  })

  test("an unauthorized legacy message-sent does not claim the dedupe key", async () => {
    const pedidoId = "pedido-crosspath-f"
    const unauthorizedToken = await signedSocketToken("socket-actor", {
      sub: "cliente-crosspath-f",
      userType: "cliente",
      scopes: [],
      sid: "session-crosspath-f",
      jti: "actor-crosspath-f",
    })
    const unauthorizedSocket = await connect({ token: unauthorizedToken })
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "negocio", ["chat:read"])
    assert.equal(recipientAck.ok, true)

    const messageId = "crosspath-f-message"
    const receivedFirst = []
    recipient.on("new-message", (message) => { receivedFirst.push(message.id) })

    emitLegacyMessage(unauthorizedSocket, pedidoId, {
      id: messageId,
      pedidoId,
      texto: "no autorizado",
      leido: false,
      fecha: new Date().toISOString(),
    })
    await wait(150)
    assert.deepEqual(receivedFirst, [])

    const { socket: authorizedSender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["chat:read"])
    assert.equal(senderAck.ok, true)
    const receivedSecond = new Promise((resolve) => recipient.once("new-message", resolve))
    emitLegacyMessage(authorizedSender, pedidoId, {
      id: messageId,
      pedidoId,
      texto: "autorizado",
      leido: false,
      fecha: new Date().toISOString(),
    })
    const message = await receivedSecond
    assert.equal(message.id, messageId)

    unauthorizedSocket.disconnect()
    authorizedSender.disconnect()
    recipient.disconnect()
  })

  test("an invalid legacy payload does not claim the dedupe key", async () => {
    const pedidoId = "pedido-crosspath-g"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["chat:read"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "negocio", ["chat:read"])
    assert.equal(recipientAck.ok, true)

    const messageId = "crosspath-g-message"
    const receivedFirst = []
    recipient.on("new-message", (message) => { receivedFirst.push(message.id) })

    emitLegacyMessage(sender, pedidoId, {
      id: messageId,
      pedidoId,
      texto: "",
      leido: false,
      fecha: new Date().toISOString(),
    })
    await wait(150)
    assert.deepEqual(receivedFirst, [])

    const receivedSecond = new Promise((resolve) => recipient.once("new-message", resolve))
    emitLegacyMessage(sender, pedidoId, {
      id: messageId,
      pedidoId,
      texto: "ahora valido",
      leido: false,
      fecha: new Date().toISOString(),
    })
    const message = await receivedSecond
    assert.equal(message.id, messageId)

    sender.disconnect()
    recipient.disconnect()
  })
})

// Tracking's cross-path semantics are BOUNDED_BEST_EFFORT_DUPLICATE_SUPPRESSION,
// not exact dedupe (see Tracking Focal Design Correction #2): the shared
// trackingCorrelationDedupe cache (pedidoId+lat+lng, 2000ms TTL) suppresses
// the common/fast stale-PWA case, but a legacy emit arriving after the TTL
// CAN still be delivered — that residual is intentional and tested honestly
// below rather than asserted away. tracking.location.updated's tracking:watch
// vs tracking:publish recipient scope filtering is already covered by the
// "internal publish recipient scope filtering" describe block above.
describe("cross-path bounded correlation between internal publish and legacy location-update", () => {
  test("tracking internal-first + immediate legacy relay with the same pedido/lat/lng delivers exactly once", async () => {
    const pedidoId = "pedido-tracking-crosspath-a"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(recipientAck.ok, true)

    let deliveryCount = 0
    recipient.on("repartidor-location", () => { deliveryCount += 1 })

    const lat = -34.1234
    const lng = -58.5678
    const publishResponse = await publish(validTracking("tracking-crosspath-a-event", pedidoId, lat, lng))
    assert.equal(publishResponse.status, 200)
    await wait(150)

    emitLegacyLocation(sender, pedidoId, lat, lng)
    await wait(150)

    assert.equal(deliveryCount, 1)
    sender.disconnect()
    recipient.disconnect()
  })

  test("tracking cross-path: immediate legacy relay is suppressed even with client clock +30s (key never uses any timestamp)", async () => {
    const pedidoId = "pedido-tracking-crosspath-b"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(recipientAck.ok, true)

    let deliveryCount = 0
    recipient.on("repartidor-location", () => { deliveryCount += 1 })

    const lat = -33.111
    const lng = -70.222
    const publishResponse = await publish(validTracking("tracking-crosspath-b-event", pedidoId, lat, lng))
    assert.equal(publishResponse.status, 200)
    await wait(150)

    const skewedTimestamp = new Date(Date.now() + 30_000).toISOString()
    emitLegacyLocation(sender, pedidoId, lat, lng, skewedTimestamp)
    await wait(150)

    assert.equal(deliveryCount, 1)
    sender.disconnect()
    recipient.disconnect()
  })

  test("tracking cross-path: immediate legacy relay is suppressed even with client clock -30s (key never uses any timestamp)", async () => {
    const pedidoId = "pedido-tracking-crosspath-c"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(recipientAck.ok, true)

    let deliveryCount = 0
    recipient.on("repartidor-location", () => { deliveryCount += 1 })

    const lat = -33.999
    const lng = -70.888
    const publishResponse = await publish(validTracking("tracking-crosspath-c-event", pedidoId, lat, lng))
    assert.equal(publishResponse.status, 200)
    await wait(150)

    const skewedTimestamp = new Date(Date.now() - 30_000).toISOString()
    emitLegacyLocation(sender, pedidoId, lat, lng, skewedTimestamp)
    await wait(150)

    assert.equal(deliveryCount, 1)
    sender.disconnect()
    recipient.disconnect()
  })

  test("tracking correlation does not cross-suppress the same coordinates across different pedidos", async () => {
    const pedidoA = "pedido-tracking-crosspath-iso-a"
    const pedidoB = "pedido-tracking-crosspath-iso-b"
    const { socket: recipientA, ack: ackA } = await joinAuthorizedRoom(pedidoA, "cliente", ["tracking:watch"])
    assert.equal(ackA.ok, true)
    const { socket: recipientB, ack: ackB } = await joinAuthorizedRoom(pedidoB, "cliente", ["tracking:watch"])
    assert.equal(ackB.ok, true)

    const lat = -32.5
    const lng = -60.5
    const receivedA = new Promise((resolve) => recipientA.once("repartidor-location", resolve))
    const receivedB = new Promise((resolve) => recipientB.once("repartidor-location", resolve))

    const responseA = await publish(validTracking("tracking-crosspath-iso-a-event", pedidoA, lat, lng))
    assert.equal(responseA.status, 200)
    const responseB = await publish(validTracking("tracking-crosspath-iso-b-event", pedidoB, lat, lng))
    assert.equal(responseB.status, 200)

    const [msgA, msgB] = await Promise.all([receivedA, receivedB])
    assert.equal(msgA.pedidoId, pedidoA)
    assert.equal(msgB.pedidoId, pedidoB)
    recipientA.disconnect()
    recipientB.disconnect()
  })

  test("legacy tracking fan-out failure before any delivery releases the correlation claim so a retry can still relay", async () => {
    const pedidoId = "pedido-tracking-legacy-zero"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(recipientAck.ok, true)

    let deliveryCount = 0
    recipient.on("repartidor-location", () => { deliveryCount += 1 })

    const originalTo = service.io.to.bind(service.io)
    let intercepted = false
    service.io.to = (target) => {
      if (!intercepted) {
        intercepted = true
        return { emit() { throw new Error("simulated live legacy tracking emit failure") } }
      }
      return originalTo(target)
    }
    try {
      emitLegacyLocation(sender, pedidoId, -31.1, -64.1)
      await wait(150)
    } finally {
      service.io.to = originalTo
    }
    assert.equal(deliveryCount, 0)

    emitLegacyLocation(sender, pedidoId, -31.1, -64.1)
    await wait(150)
    assert.equal(deliveryCount, 1)

    sender.disconnect()
    recipient.disconnect()
  })

  test("legacy tracking partial fan-out failure retains the correlation claim", async () => {
    const pedidoId = "pedido-tracking-legacy-partial"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(senderAck.ok, true)
    const { socket: recipientA, ack: ackA } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"], { sub: "cliente-tracking-partial-a" })
    assert.equal(ackA.ok, true)
    const { socket: recipientB, ack: ackB } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"], { sub: "cliente-tracking-partial-b" })
    assert.equal(ackB.ok, true)

    let delivered = 0
    recipientA.on("repartidor-location", () => { delivered += 1 })
    recipientB.on("repartidor-location", () => { delivered += 1 })

    const originalTo = service.io.to.bind(service.io)
    let callCount = 0
    service.io.to = (target) => {
      callCount += 1
      if (callCount === 2) return { emit() { throw new Error("simulated live legacy tracking partial fan-out failure") } }
      return originalTo(target)
    }
    try {
      emitLegacyLocation(sender, pedidoId, -31.2, -64.2)
      await wait(150)
    } finally {
      service.io.to = originalTo
    }
    // Exactly one of the two recipients got the first (successful) call
    // before the second call threw.
    assert.equal(delivered, 1)

    // A retry with the SAME coords must NOT relay again — the claim is
    // retained precisely because someone already received it.
    emitLegacyLocation(sender, pedidoId, -31.2, -64.2)
    await wait(150)
    assert.equal(delivered, 1)

    sender.disconnect()
    recipientA.disconnect()
    recipientB.disconnect()
  })

  test("an unauthorized legacy location-update does not claim the correlation key", async () => {
    const pedidoId = "pedido-tracking-crosspath-unauth"
    const unauthorizedToken = await signedSocketToken("socket-actor", {
      sub: "repartidor-unauth",
      userType: "repartidor",
      scopes: [],
      sid: "session-unauth",
      jti: "actor-unauth",
    })
    const unauthorizedSocket = await connect({ token: unauthorizedToken })
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(recipientAck.ok, true)

    const lat = -29.9
    const lng = -71.2
    let received = false
    recipient.once("repartidor-location", () => { received = true })

    // Never joined the room, so getAuthorizedRoom rejects before the
    // correlation claim is ever attempted.
    emitLegacyLocation(unauthorizedSocket, pedidoId, lat, lng)
    await wait(150)
    assert.equal(received, false)

    const { socket: authorizedSender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(senderAck.ok, true)
    const receivedSecond = new Promise((resolve) => recipient.once("repartidor-location", resolve))
    emitLegacyLocation(authorizedSender, pedidoId, lat, lng)
    const message = await receivedSecond
    assert.equal(message.pedidoId, pedidoId)

    unauthorizedSocket.disconnect()
    authorizedSender.disconnect()
    recipient.disconnect()
  })

  test("an invalid legacy location payload does not claim any correlation key", async () => {
    const pedidoId = "pedido-tracking-crosspath-invalid"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(recipientAck.ok, true)

    const lat = -28.4
    const lng = -65.7
    let received = false
    recipient.once("repartidor-location", () => { received = true })

    // Out-of-range lat fails locationPayload() validation before the
    // correlation claim is ever attempted.
    sender.emit("location-update", { pedidoId, lat: 999, lng })
    await wait(150)
    assert.equal(received, false)

    const receivedSecond = new Promise((resolve) => recipient.once("repartidor-location", resolve))
    emitLegacyLocation(sender, pedidoId, lat, lng)
    const message = await receivedSecond
    assert.equal(message.pedidoId, pedidoId)

    sender.disconnect()
    recipient.disconnect()
  })

  test("a rate-limited legacy location-update does not claim the correlation key", async () => {
    const pedidoId = "pedido-tracking-crosspath-ratelimited"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(senderAck.ok, true)
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(recipientAck.ok, true)

    const lat = -27.3
    const lng = -63.4
    let targetDelivered = false
    recipient.on("repartidor-location", (message) => {
      if (message.lat === lat && message.lng === lng) targetDelivered = true
    })

    // Exhausts this socket's own 30/min location rate limiter with distinct
    // coordinates first, so request #31 (the real coordinate) is rejected by
    // the rate limiter — the first gate, before locationPayload validation
    // and before the correlation claim is ever attempted.
    for (let i = 0; i < 30; i += 1) {
      emitLegacyLocation(sender, pedidoId, -1 - i, -1 - i)
    }
    emitLegacyLocation(sender, pedidoId, lat, lng)
    await wait(200)
    assert.equal(targetDelivered, false)

    // A second, freshly-connected socket has its own independent rate
    // limiter budget — if the rate-limited attempt above had poisoned the
    // correlation key for (lat,lng), this legitimate relay would now be
    // silently suppressed too.
    const { socket: secondSender, ack: secondAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(secondAck.ok, true)
    emitLegacyLocation(secondSender, pedidoId, lat, lng)
    await wait(150)
    assert.equal(targetDelivered, true)

    sender.disconnect()
    secondSender.disconnect()
    recipient.disconnect()
  })

  test("tracking internal publish with zero authorized recipients releases the correlation claim so a later watcher can still receive the same sample", async () => {
    const pedidoId = "pedido-tracking-zero-recipient-internal"
    const lat = -25.1
    const lng = -55.2

    // No recipient joined yet — this internal publish attempt itself will
    // find zero tracking:watch recipients for this room.
    const first = await publish(validTracking("tracking-zero-recip-internal-a", pedidoId, lat, lng))
    assert.equal(first.status, 200)
    assert.equal((await first.json()).published, true)

    // A watcher joins AFTER that zero-recipient attempt, still well within
    // the 2000ms correlation TTL.
    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(recipientAck.ok, true)
    const received = new Promise((resolve) => recipient.once("repartidor-location", resolve))

    // A second internal publish for the SAME sample (different eventId,
    // same pedido/lat/lng) must NOT be suppressed by a stale correlation
    // claim left over from the zero-recipient attempt above.
    const second = await publish(validTracking("tracking-zero-recip-internal-b", pedidoId, lat, lng))
    assert.equal(second.status, 200)
    assert.equal((await second.json()).published, true)
    const message = await received
    assert.equal(message.pedidoId, pedidoId)

    recipient.disconnect()
  })

  test("legacy location-update with zero authorized recipients releases the correlation claim so a later watcher can still receive the same sample", async () => {
    const pedidoId = "pedido-tracking-zero-recipient-legacy"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(senderAck.ok, true)

    const lat = -26.3
    const lng = -56.4
    // No recipient joined yet.
    emitLegacyLocation(sender, pedidoId, lat, lng)
    await wait(150)

    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(recipientAck.ok, true)
    const received = new Promise((resolve) => recipient.once("repartidor-location", resolve))

    // A second legacy emit for the SAME sample must not be suppressed by a
    // stale correlation claim left by the zero-recipient attempt above.
    emitLegacyLocation(sender, pedidoId, lat, lng)
    const message = await received
    assert.equal(message.pedidoId, pedidoId)

    sender.disconnect()
    recipient.disconnect()
  })

  test("a legacy zero-recipient attempt does not suppress a LATER internal publish of the same sample once a watcher joins (closes the zero-recipient cross-path race)", async () => {
    const pedidoId = "pedido-tracking-zero-recipient-crosspath"
    const { socket: sender, ack: senderAck } = await joinAuthorizedRoom(pedidoId, "repartidor", ["tracking:publish"])
    assert.equal(senderAck.ok, true)

    const lat = -27.5
    const lng = -57.6
    // Legacy relays first, with zero tracking:watch recipients present yet.
    emitLegacyLocation(sender, pedidoId, lat, lng)
    await wait(150)

    const { socket: recipient, ack: recipientAck } = await joinAuthorizedRoom(pedidoId, "cliente", ["tracking:watch"])
    assert.equal(recipientAck.ok, true)
    const received = new Promise((resolve) => recipient.once("repartidor-location", resolve))

    // The internal path's later attempt for the SAME sample must reach the
    // now-present watcher — not be silently deduplicated against the
    // legacy path's earlier zero-recipient claim.
    const response = await publish(validTracking("tracking-zero-recip-crosspath-event", pedidoId, lat, lng))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).published, true)
    const message = await received
    assert.equal(message.pedidoId, pedidoId)

    sender.disconnect()
    recipient.disconnect()
  })
})
