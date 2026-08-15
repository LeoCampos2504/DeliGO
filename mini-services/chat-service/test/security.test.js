const { after, before, describe, test } = require("node:test")
const assert = require("node:assert/strict")
const { io } = require("socket.io-client")
const { SignJWT } = require("jose")
const { createChatService } = require("../index")

const secret = "test-only-realtime-secret-01234567890123456789"
let service
let baseUrl

function signedToken(kind, claims, expiresIn = "5m") {
  return new SignJWT({ kind, ...claims })
    .setProtectedHeader({ alg: "HS256", kid: "testing-key" })
    .setIssuer("deligo-next")
    .setAudience("deligo-chat-service")
    .setIssuedAt()
    .setJti(claims.jti)
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret))
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
    socket.once("connect_error", (error) => reject(error))
  })
}

before(async () => {
  process.env.NODE_ENV = "test"
  process.env.REALTIME_SOCKET_TOKEN_SECRET = secret
  process.env.REALTIME_KEY_ID = "testing-key"
  process.env.REALTIME_ALLOWED_ORIGINS = "http://localhost:3000"
  service = createChatService({ port: 0 })
  await new Promise((resolve) => service.listen(resolve))
  baseUrl = `http://127.0.0.1:${service.httpServer.address().port}`
})

after(async () => {
  await service.close()
})

describe("chat-service secure socket foundation", () => {
  test("rejects anonymous connections", async () => {
    await assert.rejects(connect({}), /TOKEN_INVALID|websocket error|Origin not allowed/)
  })

  test("derives identity from token and ignores spoofed handshake fields", async () => {
    const token = await signedToken("socket-actor", {
      sub: "cliente-a",
      userType: "cliente",
      scopes: [],
      sid: "session-a",
      jti: "actor-a",
    })
    const socket = await connect({ token, userId: "cliente-b", userType: "negocio", userName: "spoof" })
    assert.equal(service.io.sockets.adapter.rooms.has("user:cliente:cliente-a"), true)
    assert.equal(service.io.sockets.adapter.rooms.has("user:negocio:cliente-b"), false)
    socket.disconnect()
  })

  test("blocks raw legacy join and accepts only a matching signed capability", async () => {
    const actorToken = await signedToken("socket-actor", {
      sub: "cliente-a",
      userType: "cliente",
      scopes: [],
      sid: "session-a",
      jti: "actor-b",
    })
    const capability = await signedToken("room-capability", {
      sub: "cliente-a",
      userType: "cliente",
      scopes: ["chat:read", "chat:typing"],
      sid: "session-a",
      jti: "cap-a",
      pedidoId: "pedido-a",
      room: "pedido:pedido-a",
    })
    const socket = await connect({ token: actorToken })
    const legacyAck = await new Promise((resolve) => socket.emit("join-room", "pedido-a", resolve))
    assert.deepEqual(legacyAck, { ok: false, code: "CAPABILITY_INVALID" })
    const joinAck = await new Promise((resolve) => socket.emit("join-order-room", capability, resolve))
    assert.deepEqual(joinAck, { ok: true, room: "pedido:pedido-a", scopes: ["chat:read", "chat:typing"] })
    const tamperedCapability = await signedToken("room-capability", {
      sub: "cliente-b",
      userType: "cliente",
      scopes: ["chat:read"],
      sid: "session-b",
      jti: "cap-b",
      pedidoId: "pedido-a",
      room: "pedido:pedido-a",
    })
    const tamperedAck = await new Promise((resolve) => socket.emit("join-order-room", tamperedCapability, resolve))
    assert.deepEqual(tamperedAck, { ok: false, code: "CAPABILITY_INVALID" })
    socket.disconnect()
  })

  test("disconnects an already-connected socket when the actor token expires", async () => {
    const token = await signedToken("socket-actor", {
      sub: "cliente-expiring",
      userType: "cliente",
      scopes: [],
      sid: "session-expiring",
      jti: "actor-expiring",
    }, "1s")
    const socket = await connect({ token })
    assert.equal(service.io.sockets.adapter.rooms.has("user:cliente:cliente-expiring"), true)
    const disconnectReason = new Promise((resolve) => socket.once("disconnect", resolve))
    const reason = await Promise.race([disconnectReason, wait(2500).then(() => "timeout")])
    assert.notEqual(reason, "timeout")
    assert.equal(service.io.sockets.adapter.rooms.has("user:cliente:cliente-expiring"), false)
  })

  test("revokes an expired room grant before sensitive legacy events", async () => {
    const senderToken = await signedToken("socket-actor", {
      sub: "cliente-expiring-room",
      userType: "cliente",
      scopes: [],
      sid: "session-room-a",
      jti: "actor-room-a",
    })
    const recipientToken = await signedToken("socket-actor", {
      sub: "negocio-room-recipient",
      userType: "negocio",
      scopes: [],
      sid: "session-room-b",
      jti: "actor-room-b",
    })
    const senderCapability = await signedToken("room-capability", {
      sub: "cliente-expiring-room",
      userType: "cliente",
      scopes: ["chat:read"],
      sid: "session-room-a",
      jti: "cap-room-a",
      pedidoId: "pedido-expiring-room",
      room: "pedido:pedido-expiring-room",
    }, "1s")
    const recipientCapability = await signedToken("room-capability", {
      sub: "negocio-room-recipient",
      userType: "negocio",
      scopes: ["chat:read"],
      sid: "session-room-b",
      jti: "cap-room-b",
      pedidoId: "pedido-expiring-room",
      room: "pedido:pedido-expiring-room",
    })
    const sender = await connect({ token: senderToken })
    const recipient = await connect({ token: recipientToken })
    await new Promise((resolve) => sender.emit("join-order-room", senderCapability, resolve))
    await new Promise((resolve) => recipient.emit("join-order-room", recipientCapability, resolve))
    await wait(1300)

    let received = false
    recipient.once("new-message", () => { received = true })
    sender.emit("message-sent", {
      pedidoId: "pedido-expiring-room",
      message: { texto: "no debe llegar" },
    })
    await wait(250)

    assert.equal(received, false)
    assert.equal(service.io.sockets.adapter.rooms.get("pedido:pedido-expiring-room")?.has(sender.id) ?? false, false)
    sender.disconnect()
    recipient.disconnect()
  })
})
