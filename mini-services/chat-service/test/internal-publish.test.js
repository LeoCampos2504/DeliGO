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
  createBoundedRateLimiter,
  createEventDedupeCache,
  createInternalPublishHandler,
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
    assert.equal(EVENT_MAPPING["tracking.location.updated"], "repartidor-location")

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
    const handler = createInternalPublishHandler({ io: failingIo })
    const body = validMessage("emit-failure-event")

    const first = await invokeHandler(handler, body)
    assert.equal(first.statusCode, 503)
    shouldFail = false
    const second = await invokeHandler(handler, body)
    assert.equal(second.statusCode, 200)
    assert.equal(second.body.published, true)
    assert.equal(emitCount, 1)
  })
})
