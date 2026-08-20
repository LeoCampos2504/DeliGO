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

  test("message-sent delivers only to chat:read recipients, excludes sender and tracking-only recipients", async () => {
    const pedidoId = "pedido-msg-scope-a"
    const room = `pedido:${pedidoId}`
    const senderToken = await signedToken("socket-actor", {
      sub: "cliente-msg-sender", userType: "cliente", scopes: [], sid: "session-msg-sender", jti: "actor-msg-sender",
    })
    const chatRecipientToken = await signedToken("socket-actor", {
      sub: "negocio-msg-recipient", userType: "negocio", scopes: [], sid: "session-msg-recipient", jti: "actor-msg-recipient",
    })
    const trackingOnlyToken = await signedToken("socket-actor", {
      sub: "cliente-msg-tracking-only", userType: "cliente", scopes: [], sid: "session-msg-tracking-only", jti: "actor-msg-tracking-only",
    })
    const senderCapability = await signedToken("room-capability", {
      sub: "cliente-msg-sender", userType: "cliente", scopes: ["chat:read"], sid: "session-msg-sender",
      jti: "cap-msg-sender", pedidoId, room,
    })
    const chatRecipientCapability = await signedToken("room-capability", {
      sub: "negocio-msg-recipient", userType: "negocio", scopes: ["chat:read"], sid: "session-msg-recipient",
      jti: "cap-msg-recipient", pedidoId, room,
    })
    const trackingOnlyCapability = await signedToken("room-capability", {
      sub: "cliente-msg-tracking-only", userType: "cliente", scopes: ["tracking:watch"], sid: "session-msg-tracking-only",
      jti: "cap-msg-tracking-only", pedidoId, room,
    })

    const sender = await connect({ token: senderToken })
    const chatRecipient = await connect({ token: chatRecipientToken })
    const trackingOnly = await connect({ token: trackingOnlyToken })
    await new Promise((resolve) => sender.emit("join-order-room", senderCapability, resolve))
    await new Promise((resolve) => chatRecipient.emit("join-order-room", chatRecipientCapability, resolve))
    await new Promise((resolve) => trackingOnly.emit("join-order-room", trackingOnlyCapability, resolve))

    const chatReceived = []
    const trackingReceived = []
    const senderReceived = []
    chatRecipient.on("new-message", (m) => chatReceived.push(m))
    trackingOnly.on("new-message", (m) => trackingReceived.push(m))
    sender.on("new-message", (m) => senderReceived.push(m))

    sender.emit("message-sent", { pedidoId, message: { id: "msg-scope-test-1", texto: "hola" } })
    await wait(250)

    // Control assertion first: proves the event was not globally swallowed
    // by dedupe — a "0" on the wrong-scope assertions below would not be
    // meaningful security evidence if this control also received zero.
    assert.equal(chatReceived.length, 1)
    assert.equal(chatReceived[0].texto, "hola")
    assert.equal(trackingReceived.length, 0)
    assert.equal(senderReceived.length, 0)

    sender.disconnect()
    chatRecipient.disconnect()
    trackingOnly.disconnect()
  })

  test("message-sent still excludes repartidor recipients physically in the room", async () => {
    const pedidoId = "pedido-msg-scope-repartidor"
    const room = `pedido:${pedidoId}`
    const senderToken = await signedToken("socket-actor", {
      sub: "cliente-msg-sender-2", userType: "cliente", scopes: [], sid: "session-msg-sender-2", jti: "actor-msg-sender-2",
    })
    const repartidorToken = await signedToken("socket-actor", {
      sub: "repartidor-msg-recipient", userType: "repartidor", scopes: [], sid: "session-msg-repartidor", jti: "actor-msg-repartidor",
    })
    const senderCapability = await signedToken("room-capability", {
      sub: "cliente-msg-sender-2", userType: "cliente", scopes: ["chat:read"], sid: "session-msg-sender-2",
      jti: "cap-msg-sender-2", pedidoId, room,
    })
    const repartidorCapability = await signedToken("room-capability", {
      sub: "repartidor-msg-recipient", userType: "repartidor", scopes: ["tracking:publish"], sid: "session-msg-repartidor",
      jti: "cap-msg-repartidor", pedidoId, room,
    })

    const sender = await connect({ token: senderToken })
    const repartidor = await connect({ token: repartidorToken })
    await new Promise((resolve) => sender.emit("join-order-room", senderCapability, resolve))
    await new Promise((resolve) => repartidor.emit("join-order-room", repartidorCapability, resolve))

    const repartidorReceived = []
    repartidor.on("new-message", (m) => repartidorReceived.push(m))
    sender.emit("message-sent", { pedidoId, message: { id: "msg-scope-test-repartidor", texto: "hola" } })
    await wait(250)

    assert.equal(repartidorReceived.length, 0)
    sender.disconnect()
    repartidor.disconnect()
  })

  test("typing delivers only to chat:typing recipients, excludes sender and tracking-only recipients", async () => {
    const pedidoId = "pedido-typing-scope-a"
    const room = `pedido:${pedidoId}`
    const senderToken = await signedToken("socket-actor", {
      sub: "cliente-typing-sender", userType: "cliente", scopes: [], sid: "session-typing-sender", jti: "actor-typing-sender",
    })
    const chatRecipientToken = await signedToken("socket-actor", {
      sub: "negocio-typing-recipient", userType: "negocio", scopes: [], sid: "session-typing-recipient", jti: "actor-typing-recipient",
    })
    const trackingOnlyToken = await signedToken("socket-actor", {
      sub: "cliente-typing-tracking-only", userType: "cliente", scopes: [], sid: "session-typing-tracking-only", jti: "actor-typing-tracking-only",
    })
    const senderCapability = await signedToken("room-capability", {
      sub: "cliente-typing-sender", userType: "cliente", scopes: ["chat:typing"], sid: "session-typing-sender",
      jti: "cap-typing-sender", pedidoId, room,
    })
    const chatRecipientCapability = await signedToken("room-capability", {
      sub: "negocio-typing-recipient", userType: "negocio", scopes: ["chat:typing"], sid: "session-typing-recipient",
      jti: "cap-typing-recipient", pedidoId, room,
    })
    const trackingOnlyCapability = await signedToken("room-capability", {
      sub: "cliente-typing-tracking-only", userType: "cliente", scopes: ["tracking:watch"], sid: "session-typing-tracking-only",
      jti: "cap-typing-tracking-only", pedidoId, room,
    })

    const sender = await connect({ token: senderToken })
    const chatRecipient = await connect({ token: chatRecipientToken })
    const trackingOnly = await connect({ token: trackingOnlyToken })
    await new Promise((resolve) => sender.emit("join-order-room", senderCapability, resolve))
    await new Promise((resolve) => chatRecipient.emit("join-order-room", chatRecipientCapability, resolve))
    await new Promise((resolve) => trackingOnly.emit("join-order-room", trackingOnlyCapability, resolve))

    const chatReceived = []
    const trackingReceived = []
    const senderReceived = []
    chatRecipient.on("user-typing", (p) => chatReceived.push(p))
    trackingOnly.on("user-typing", (p) => trackingReceived.push(p))
    sender.on("user-typing", (p) => senderReceived.push(p))

    sender.emit("typing", pedidoId)
    await wait(250)

    assert.equal(chatReceived.length, 1)
    assert.equal(chatReceived[0].pedidoId, pedidoId)
    assert.equal(trackingReceived.length, 0)
    assert.equal(senderReceived.length, 0)

    sender.disconnect()
    chatRecipient.disconnect()
    trackingOnly.disconnect()
  })

  test("stop-typing delivers only to chat:typing recipients, excludes sender and tracking-only recipients", async () => {
    const pedidoId = "pedido-stop-typing-scope-a"
    const room = `pedido:${pedidoId}`
    const senderToken = await signedToken("socket-actor", {
      sub: "cliente-stop-typing-sender", userType: "cliente", scopes: [], sid: "session-stop-typing-sender", jti: "actor-stop-typing-sender",
    })
    const chatRecipientToken = await signedToken("socket-actor", {
      sub: "negocio-stop-typing-recipient", userType: "negocio", scopes: [], sid: "session-stop-typing-recipient", jti: "actor-stop-typing-recipient",
    })
    const trackingOnlyToken = await signedToken("socket-actor", {
      sub: "cliente-stop-typing-tracking-only", userType: "cliente", scopes: [], sid: "session-stop-typing-tracking-only", jti: "actor-stop-typing-tracking-only",
    })
    const senderCapability = await signedToken("room-capability", {
      sub: "cliente-stop-typing-sender", userType: "cliente", scopes: ["chat:typing"], sid: "session-stop-typing-sender",
      jti: "cap-stop-typing-sender", pedidoId, room,
    })
    const chatRecipientCapability = await signedToken("room-capability", {
      sub: "negocio-stop-typing-recipient", userType: "negocio", scopes: ["chat:typing"], sid: "session-stop-typing-recipient",
      jti: "cap-stop-typing-recipient", pedidoId, room,
    })
    const trackingOnlyCapability = await signedToken("room-capability", {
      sub: "cliente-stop-typing-tracking-only", userType: "cliente", scopes: ["tracking:watch"], sid: "session-stop-typing-tracking-only",
      jti: "cap-stop-typing-tracking-only", pedidoId, room,
    })

    const sender = await connect({ token: senderToken })
    const chatRecipient = await connect({ token: chatRecipientToken })
    const trackingOnly = await connect({ token: trackingOnlyToken })
    await new Promise((resolve) => sender.emit("join-order-room", senderCapability, resolve))
    await new Promise((resolve) => chatRecipient.emit("join-order-room", chatRecipientCapability, resolve))
    await new Promise((resolve) => trackingOnly.emit("join-order-room", trackingOnlyCapability, resolve))

    const chatReceived = []
    const trackingReceived = []
    const senderReceived = []
    chatRecipient.on("user-stop-typing", (p) => chatReceived.push(p))
    trackingOnly.on("user-stop-typing", (p) => trackingReceived.push(p))
    sender.on("user-stop-typing", (p) => senderReceived.push(p))

    sender.emit("stop-typing", pedidoId)
    await wait(250)

    assert.equal(chatReceived.length, 1)
    assert.equal(chatReceived[0].pedidoId, pedidoId)
    assert.equal(trackingReceived.length, 0)
    assert.equal(senderReceived.length, 0)

    sender.disconnect()
    chatRecipient.disconnect()
    trackingOnly.disconnect()
  })

  test("mark-read delivers only to chat:read recipients, excludes sender and tracking-only recipients", async () => {
    const pedidoId = "pedido-mark-read-scope-a"
    const room = `pedido:${pedidoId}`
    const senderToken = await signedToken("socket-actor", {
      sub: "cliente-mark-read-sender", userType: "cliente", scopes: [], sid: "session-mark-read-sender", jti: "actor-mark-read-sender",
    })
    const chatRecipientToken = await signedToken("socket-actor", {
      sub: "negocio-mark-read-recipient", userType: "negocio", scopes: [], sid: "session-mark-read-recipient", jti: "actor-mark-read-recipient",
    })
    const trackingOnlyToken = await signedToken("socket-actor", {
      sub: "cliente-mark-read-tracking-only", userType: "cliente", scopes: [], sid: "session-mark-read-tracking-only", jti: "actor-mark-read-tracking-only",
    })
    const senderCapability = await signedToken("room-capability", {
      sub: "cliente-mark-read-sender", userType: "cliente", scopes: ["chat:read"], sid: "session-mark-read-sender",
      jti: "cap-mark-read-sender", pedidoId, room,
    })
    const chatRecipientCapability = await signedToken("room-capability", {
      sub: "negocio-mark-read-recipient", userType: "negocio", scopes: ["chat:read"], sid: "session-mark-read-recipient",
      jti: "cap-mark-read-recipient", pedidoId, room,
    })
    const trackingOnlyCapability = await signedToken("room-capability", {
      sub: "cliente-mark-read-tracking-only", userType: "cliente", scopes: ["tracking:watch"], sid: "session-mark-read-tracking-only",
      jti: "cap-mark-read-tracking-only", pedidoId, room,
    })

    const sender = await connect({ token: senderToken })
    const chatRecipient = await connect({ token: chatRecipientToken })
    const trackingOnly = await connect({ token: trackingOnlyToken })
    await new Promise((resolve) => sender.emit("join-order-room", senderCapability, resolve))
    await new Promise((resolve) => chatRecipient.emit("join-order-room", chatRecipientCapability, resolve))
    await new Promise((resolve) => trackingOnly.emit("join-order-room", trackingOnlyCapability, resolve))

    const chatReceived = []
    const trackingReceived = []
    const senderReceived = []
    chatRecipient.on("messages-read", (p) => chatReceived.push(p))
    trackingOnly.on("messages-read", (p) => trackingReceived.push(p))
    sender.on("messages-read", (p) => senderReceived.push(p))

    sender.emit("mark-read", pedidoId)
    await wait(250)

    assert.equal(chatReceived.length, 1)
    assert.equal(chatReceived[0].pedidoId, pedidoId)
    assert.equal(trackingReceived.length, 0)
    assert.equal(senderReceived.length, 0)

    sender.disconnect()
    chatRecipient.disconnect()
    trackingOnly.disconnect()
  })

  test("expired chat grant stops receiving new-message, user-typing, and messages-read even while still connected", async () => {
    const pedidoId = "pedido-msg-scope-expired"
    const room = `pedido:${pedidoId}`
    const senderToken = await signedToken("socket-actor", {
      sub: "cliente-exp-sender", userType: "cliente", scopes: [], sid: "session-exp-sender", jti: "actor-exp-sender",
    })
    const recipientToken = await signedToken("socket-actor", {
      sub: "negocio-exp-recipient", userType: "negocio", scopes: [], sid: "session-exp-recipient", jti: "actor-exp-recipient",
    })
    const senderCapability = await signedToken("room-capability", {
      sub: "cliente-exp-sender", userType: "cliente", scopes: ["chat:read", "chat:typing"], sid: "session-exp-sender",
      jti: "cap-exp-sender", pedidoId, room,
    })
    const recipientCapability = await signedToken("room-capability", {
      sub: "negocio-exp-recipient", userType: "negocio", scopes: ["chat:read", "chat:typing"], sid: "session-exp-recipient",
      jti: "cap-exp-recipient", pedidoId, room,
    }, "1s")

    const sender = await connect({ token: senderToken })
    const recipient = await connect({ token: recipientToken })
    await new Promise((resolve) => sender.emit("join-order-room", senderCapability, resolve))
    await new Promise((resolve) => recipient.emit("join-order-room", recipientCapability, resolve))
    await wait(1300) // let the recipient's 1s room-capability grant expire naturally

    const events = { newMessage: 0, typing: 0, stopTyping: 0, read: 0 }
    recipient.on("new-message", () => { events.newMessage += 1 })
    recipient.on("user-typing", () => { events.typing += 1 })
    recipient.on("user-stop-typing", () => { events.stopTyping += 1 })
    recipient.on("messages-read", () => { events.read += 1 })

    sender.emit("message-sent", { pedidoId, message: { id: "msg-scope-test-expired", texto: "hola" } })
    sender.emit("typing", pedidoId)
    sender.emit("stop-typing", pedidoId)
    sender.emit("mark-read", pedidoId)
    await wait(250)

    assert.deepEqual(events, { newMessage: 0, typing: 0, stopTyping: 0, read: 0 })
    sender.disconnect()
    recipient.disconnect()
  })

  test("chat events for one pedido are not delivered to a recipient authorized only for a different pedido", async () => {
    const pedidoA = "pedido-msg-scope-room-a"
    const pedidoB = "pedido-msg-scope-room-b"
    const senderToken = await signedToken("socket-actor", {
      sub: "cliente-room-sender", userType: "cliente", scopes: [], sid: "session-room-sender", jti: "actor-room-sender",
    })
    const otherRoomToken = await signedToken("socket-actor", {
      sub: "negocio-room-other", userType: "negocio", scopes: [], sid: "session-room-other", jti: "actor-room-other",
    })
    const senderCapability = await signedToken("room-capability", {
      sub: "cliente-room-sender", userType: "cliente", scopes: ["chat:read", "chat:typing"], sid: "session-room-sender",
      jti: "cap-room-sender", pedidoId: pedidoA, room: `pedido:${pedidoA}`,
    })
    const otherRoomCapability = await signedToken("room-capability", {
      sub: "negocio-room-other", userType: "negocio", scopes: ["chat:read", "chat:typing"], sid: "session-room-other",
      jti: "cap-room-other", pedidoId: pedidoB, room: `pedido:${pedidoB}`,
    })

    const sender = await connect({ token: senderToken })
    const other = await connect({ token: otherRoomToken })
    await new Promise((resolve) => sender.emit("join-order-room", senderCapability, resolve))
    await new Promise((resolve) => other.emit("join-order-room", otherRoomCapability, resolve))

    const events = { newMessage: 0, typing: 0, stopTyping: 0, read: 0 }
    other.on("new-message", () => { events.newMessage += 1 })
    other.on("user-typing", () => { events.typing += 1 })
    other.on("user-stop-typing", () => { events.stopTyping += 1 })
    other.on("messages-read", () => { events.read += 1 })

    sender.emit("message-sent", { pedidoId: pedidoA, message: { id: "msg-scope-test-otherroom", texto: "hola" } })
    sender.emit("typing", pedidoA)
    sender.emit("stop-typing", pedidoA)
    sender.emit("mark-read", pedidoA)
    await wait(250)

    assert.deepEqual(events, { newMessage: 0, typing: 0, stopTyping: 0, read: 0 })
    sender.disconnect()
    other.disconnect()
  })
})
