const { createServer } = require("http")
const { Server } = require("socket.io")
const {
  INTERNAL_PUBLISH_PATH,
  TRACKING_CORRELATION_DEDUPE_TTL_MS,
  createInternalPublishHandler,
  createEventDedupeCache,
  trackingCorrelationKey,
} = require("./internal-publish-handler")

const ALLOWED_USER_TYPES = new Set(["cliente", "negocio", "repartidor"])
const ALLOWED_SCOPES = new Set(["chat:read", "chat:typing", "tracking:watch", "tracking:publish"])
const ORDER_ID_PATTERN = /^[^:]{1,128}$/

const AUTH_REJECT_CODES = {
  INVALID: "TOKEN_INVALID",
  EXPIRED: "TOKEN_EXPIRED",
  CAPABILITY: "CAPABILITY_INVALID",
}

function getAllowedOrigins() {
  const configured = process.env.REALTIME_ALLOWED_ORIGINS || process.env.CLIENT_URLS || process.env.CLIENT_URL || ""
  const origins = configured.split(",").map((value) => value.trim()).filter(Boolean)

  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000", "http://127.0.0.1:3000")
  }

  return [...new Set(origins)]
}

function getTokenSecret() {
  const secret = process.env.REALTIME_SOCKET_TOKEN_SECRET?.trim()
  if (!secret || secret.length < 32) return null
  return new TextEncoder().encode(secret)
}

function getExpectedKeyId() {
  return process.env.REALTIME_KEY_ID?.trim() || null
}

let josePromise
function getJose() {
  josePromise ||= import("jose")
  return josePromise
}

async function verifySignedToken(token, expectedKind) {
  if (typeof token !== "string" || token.length < 32 || token.length > 4096) {
    throw new Error(AUTH_REJECT_CODES.INVALID)
  }

  const secret = getTokenSecret()
  if (!secret) throw new Error("REALTIME_SOCKET_TOKEN_SECRET_MISSING")

  const { jwtVerify } = await getJose()
  let verified
  try {
    verified = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: "deligo-next",
      audience: "deligo-chat-service",
    })
  } catch (error) {
    if (error?.code === "ERR_JWT_EXPIRED" || error?.name === "JWTExpired") {
      throw new Error(AUTH_REJECT_CODES.EXPIRED)
    }
    throw error
  }

  const { payload, protectedHeader } = verified

  const expectedKeyId = getExpectedKeyId()
  if (expectedKeyId && protectedHeader.kid !== expectedKeyId) {
    throw new Error(AUTH_REJECT_CODES.INVALID)
  }

  if (payload.kind !== expectedKind) throw new Error(AUTH_REJECT_CODES.INVALID)
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error(AUTH_REJECT_CODES.INVALID)
  if (!ALLOWED_USER_TYPES.has(payload.userType)) throw new Error(AUTH_REJECT_CODES.INVALID)
  if (typeof payload.sid !== "string" || !payload.sid) throw new Error(AUTH_REJECT_CODES.INVALID)
  if (typeof payload.jti !== "string" || !payload.jti) throw new Error(AUTH_REJECT_CODES.INVALID)
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) throw new Error(AUTH_REJECT_CODES.INVALID)
  if (!Array.isArray(payload.scopes) || payload.scopes.some((scope) => !ALLOWED_SCOPES.has(scope))) {
    throw new Error(AUTH_REJECT_CODES.INVALID)
  }

  if (expectedKind === "room-capability") {
    if (typeof payload.pedidoId !== "string" || !ORDER_ID_PATTERN.test(payload.pedidoId)) {
      throw new Error(AUTH_REJECT_CODES.CAPABILITY)
    }
    if (payload.room !== `pedido:${payload.pedidoId}`) throw new Error(AUTH_REJECT_CODES.CAPABILITY)
  }

  return payload
}

function createMetrics() {
  return {
    activeConnections: 0,
    authRejects: 0,
    roomJoins: 0,
    roomRejects: 0,
    rateLimitedEvents: 0,
  }
}

function createRateLimiter(maxEvents, windowMs) {
  const timestamps = []
  return {
    allow() {
      const now = Date.now()
      while (timestamps.length && timestamps[0] <= now - windowMs) timestamps.shift()
      if (timestamps.length >= maxEvents) return false
      timestamps.push(now)
      return true
    },
  }
}

function ack(acknowledgement, payload) {
  if (typeof acknowledgement === "function") acknowledgement(payload)
}

function roomForPedido(pedidoId) {
  return `pedido:${pedidoId}`
}

function getAuthorizedRoom(user, pedidoId, requiredScope) {
  const room = roomForPedido(pedidoId)
  const grant = user.roomGrants.get(room)
  if (!grant || grant.exp <= Math.floor(Date.now() / 1000)) {
    if (grant) removeRoomGrant(user, room)
    return null
  }
  if (requiredScope && !grant.scopes.has(requiredScope)) return null
  return room
}

// Enumerates, across all connected sockets, those currently holding a
// non-expired grant for `room` that includes `requiredScope` — the
// recipient-side counterpart to getAuthorizedRoom's sender-side check, used
// by the Internal Publish Bridge so a socket physically joined to a pedido
// room (e.g. a repartidor with only tracking:publish) cannot receive an
// event it was never granted the scope to read.
function getAuthorizedRecipientSockets(connectedUsers, room, requiredScope) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const socketIds = []
  for (const [socketId, recipient] of connectedUsers) {
    const grant = recipient.roomGrants.get(room)
    if (!grant || grant.exp <= nowSeconds) continue
    if (requiredScope && !grant.scopes.has(requiredScope)) continue
    socketIds.push(socketId)
  }
  return socketIds
}

function removeRoomGrant(user, room) {
  const grant = user.roomGrants.get(room)
  if (!grant) return
  clearTimeout(grant.expiryTimer)
  user.roomGrants.delete(room)
  user.rooms.delete(room)
  user.socket.leave(room)
}

function setRoomGrant(user, room, scopes, exp) {
  removeRoomGrant(user, room)
  const expiryTimer = setTimeout(() => removeRoomGrant(user, room), Math.max(0, exp * 1000 - Date.now()))
  expiryTimer.unref?.()
  user.rooms.add(room)
  user.roomGrants.set(room, { scopes, exp, expiryTimer })
  user.socket.join(room)
}

function canUseScope(userType, scope) {
  if (userType === "repartidor") return scope === "tracking:publish"
  if (userType === "cliente") return scope !== "tracking:publish"
  if (userType === "negocio") return scope === "chat:read" || scope === "chat:typing"
  return false
}

function sanitizeLegacyMessage(message, pedidoId, actor) {
  if (!message || typeof message !== "object") return null
  const text = typeof message.texto === "string" ? message.texto.slice(0, 10000) : ""
  const clean = {
    id: typeof message.id === "string" ? message.id.slice(0, 128) : undefined,
    pedidoId,
    remitente: actor.userType === "cliente" ? "cliente" : "vendedor",
    texto: text,
    imagenUrl: typeof message.imagenUrl === "string" ? message.imagenUrl.slice(0, 2048) : null,
    archivoUrl: typeof message.archivoUrl === "string" ? message.archivoUrl.slice(0, 2048) : null,
    archivoNombre: typeof message.archivoNombre === "string" ? message.archivoNombre.slice(0, 120) : null,
    archivoTipo: typeof message.archivoTipo === "string" ? message.archivoTipo.slice(0, 120) : null,
    leido: Boolean(message.leido),
    fecha: typeof message.fecha === "string" ? message.fecha : new Date().toISOString(),
    clienteId: actor.userType === "cliente" ? actor.userId : null,
  }
  if (!clean.texto && !clean.imagenUrl && !clean.archivoUrl) return null
  return clean
}

function locationPayload(data) {
  if (!data || typeof data !== "object") return null
  if (typeof data.pedidoId !== "string" || !ORDER_ID_PATTERN.test(data.pedidoId)) return null
  if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return null
  if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) return null
  const timestamp = typeof data.timestamp === "string" && data.timestamp.length <= 80
    ? data.timestamp
    : new Date().toISOString()
  return { pedidoId: data.pedidoId, lat: data.lat, lng: data.lng, timestamp }
}

function createChatService(options = {}) {
  const port = options.port ?? process.env.PORT ?? 3003
  const allowedOrigins = getAllowedOrigins()
  const metrics = createMetrics()
  const connectedUsers = new Map()
  // Shared across the Internal Publish Bridge and the legacy message-sent
  // relay so both producer paths for the same logical event (keyed by
  // "<eventType>:<id>") deliver exactly once, regardless of which arrives
  // first — see the message-sent handler below.
  const eventDedupe = createEventDedupeCache()
  // Shared with the Internal Publish Bridge (see internal-publish-handler.js)
  // for bounded best-effort Tracking cross-path correlation — deliberately a
  // separate instance/TTL from eventDedupe above, never reused for it.
  const trackingCorrelationDedupe = createEventDedupeCache(TRACKING_CORRELATION_DEDUPE_TTL_MS)
  const startedAt = Date.now()
  let internalPublishHandler

  const httpServer = createServer((req, res) => {
    const url = req.url || ""
    if (url === "/" || url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: true,
        service: "deligo-chat",
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      }))
      return
    }
    const requestPath = new URL(url, "http://127.0.0.1").pathname
    if (requestPath === INTERNAL_PUBLISH_PATH) {
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json; charset=utf-8" })
        res.end(JSON.stringify({ ok: false, error: "Method not allowed" }))
        return
      }
      if (!internalPublishHandler) {
        res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" })
        res.end(JSON.stringify({ ok: false, error: "Internal publish unavailable" }))
        return
      }
      void internalPublishHandler(req, res)
      return
    }
    if (url.startsWith("/socket.io")) return
    res.writeHead(404, { "Content-Type": "text/plain" })
    res.end("Not found")
  })

  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || !allowedOrigins.includes(origin)) {
          console.warn(`[Chat] CORS blocked category=${origin ? "origin_not_allowed" : "origin_missing"}`)
          return callback(new Error("Origin not allowed"), false)
        }
        return callback(null, true)
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    allowEIO3: true,
  })

  internalPublishHandler = createInternalPublishHandler({
    io,
    eventDedupe,
    trackingCorrelationDedupe,
    getRecipientSockets: (room, requiredScope) => getAuthorizedRecipientSockets(connectedUsers, room, requiredScope),
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      const claims = await verifySignedToken(token, "socket-actor")
      socket.data.actor = {
        userId: claims.sub,
        userType: claims.userType,
        scopes: new Set(claims.scopes),
        sid: claims.sid,
        jti: claims.jti,
        tokenExp: claims.exp,
      }
      return next()
    } catch (error) {
      metrics.authRejects += 1
      const message = error?.message === "TOKEN_EXPIRED" ? AUTH_REJECT_CODES.EXPIRED : "TOKEN_INVALID"
      console.warn(`[Chat] socket_auth_rejected category=${message}`)
      return next(new Error(message))
    }
  })

  io.on("connection", (socket) => {
    const actor = socket.data.actor
    const personalRoom = `user:${actor.userType}:${actor.userId}`
    const user = {
      socketId: socket.id,
      socket,
      actor,
      rooms: new Set(),
      roomGrants: new Map(),
      limiters: {
        join: createRateLimiter(20, 60000),
        typing: createRateLimiter(30, 10000),
        message: createRateLimiter(30, 60000),
        location: createRateLimiter(30, 60000),
      },
    }
    connectedUsers.set(socket.id, user)
    metrics.activeConnections = connectedUsers.size
    socket.join(personalRoom)
    const actorExpiryTimer = setTimeout(() => {
      if (!socket.connected) return
      socket.emit("realtime-auth-expired", { code: AUTH_REJECT_CODES.EXPIRED })
      socket.disconnect(true)
    }, Math.max(0, actor.tokenExp * 1000 - Date.now()))
    actorExpiryTimer.unref?.()
    console.log(`[Chat] socket_connected role=${actor.userType} active=${metrics.activeConnections}`)

    socket.on("join-order-room", async (capability, acknowledgement) => {
      if (!user.limiters.join.allow()) {
        metrics.rateLimitedEvents += 1
        metrics.roomRejects += 1
        ack(acknowledgement, { ok: false, code: "RATE_LIMITED" })
        return
      }

      try {
        const claims = await verifySignedToken(capability, "room-capability")
        const room = roomForPedido(claims.pedidoId)
        const scopes = new Set(claims.scopes)
        const identityMatches = claims.sub === actor.userId && claims.userType === actor.userType && claims.sid === actor.sid
        const scopesAllowed = [...scopes].every((scope) => canUseScope(actor.userType, scope))
        if (!identityMatches || claims.room !== room || !scopes.size || !scopesAllowed) throw new Error(AUTH_REJECT_CODES.CAPABILITY)

        setRoomGrant(user, room, scopes, claims.exp)
        metrics.roomJoins += 1
        ack(acknowledgement, { ok: true, room, scopes: [...scopes] })
      } catch (error) {
        metrics.roomRejects += 1
        const code = error?.message === AUTH_REJECT_CODES.EXPIRED ? AUTH_REJECT_CODES.EXPIRED : "CAPABILITY_INVALID"
        ack(acknowledgement, { ok: false, code })
      }
    })

    socket.on("join-room", (_pedidoId, acknowledgement) => {
      metrics.roomRejects += 1
      ack(acknowledgement, { ok: false, code: "CAPABILITY_INVALID" })
    })

    socket.on("leave-order-room", (pedidoId, acknowledgement) => {
      if (typeof pedidoId !== "string" || !ORDER_ID_PATTERN.test(pedidoId)) {
        ack(acknowledgement, { ok: false, code: "ROOM_FORBIDDEN" })
        return
      }
      const room = getAuthorizedRoom(user, pedidoId)
      if (!room) {
        ack(acknowledgement, { ok: false, code: "ROOM_FORBIDDEN" })
        return
      }
      removeRoomGrant(user, room)
      ack(acknowledgement, { ok: true, room })
    })

    socket.on("leave-all-rooms", () => {
      for (const room of [...user.rooms]) removeRoomGrant(user, room)
    })

    socket.on("message-sent", (data) => {
      if (!user.limiters.message.allow()) {
        metrics.rateLimitedEvents += 1
        return
      }
      if (!data || typeof data.pedidoId !== "string") return
      const room = getAuthorizedRoom(user, data.pedidoId, "chat:read")
      if (!room || (actor.userType !== "cliente" && actor.userType !== "negocio")) return
      const message = sanitizeLegacyMessage(data.message, data.pedidoId, actor)
      if (!message) return

      // Cross-path dedupe with the Internal Publish Bridge: a stale/cached
      // browser client can still emit this legacy event even after a
      // server-authoritative chat.message.created publish has already
      // delivered the same message.id. Sharing the same eventDedupe instance
      // (and the same logical key format the bridge uses) means whichever
      // path claims the key first performs the relay, and the other becomes
      // a silent no-op — while still allowing this legacy path to act as the
      // realtime fallback if the bridge publish ever fails (its own failure
      // handling already releases the claim, see internal-publish-handler.js).
      const dedupeKey = message.id ? "chat.message.created:" + message.id : null
      if (dedupeKey && !eventDedupe.claim(dedupeKey)) return

      // Recipient-scope filtering (Capability Revocation Hardening REV1_B):
      // physical room membership alone is not receive authority — a socket
      // that lost chat:read but still holds a grant for another scope on
      // this same physical room (e.g. tracking:watch) must not receive
      // message content. Reuses the same helper already relied on by the
      // Internal Publish Bridge and the location-update relay below.
      const recipientSocketIds = getAuthorizedRecipientSockets(connectedUsers, room, "chat:read")
      // Same partial-fan-out safeguard as the Internal Publish Bridge (see
      // internal-publish-handler.js): only release the claim if this relay
      // delivered to nobody at all, so a mid-loop failure can never cause a
      // recipient who already received the event to receive it again.
      let deliveredCount = 0
      try {
        for (const socketId of recipientSocketIds) {
          if (socketId === socket.id) continue
          const recipient = connectedUsers.get(socketId)
          if (!recipient || recipient.actor.userType === "repartidor") continue
          io.to(socketId).emit("new-message", message)
          deliveredCount += 1
        }
      } catch {
        if (dedupeKey && deliveredCount === 0) eventDedupe.release(dedupeKey)
      }
    })

    socket.on("typing", (pedidoId) => {
      if (!user.limiters.typing.allow()) {
        metrics.rateLimitedEvents += 1
        return
      }
      if (typeof pedidoId !== "string") return
      const room = getAuthorizedRoom(user, pedidoId, "chat:typing")
      if (!room) return
      const payload = {
        pedidoId,
        userId: actor.userId,
        userType: actor.userType,
        userName: "Usuario",
      }
      // Recipient-scope filtering (REV1_B) — see message-sent above.
      for (const socketId of getAuthorizedRecipientSockets(connectedUsers, room, "chat:typing")) {
        if (socketId === socket.id) continue
        io.to(socketId).emit("user-typing", payload)
      }
    })

    socket.on("stop-typing", (pedidoId) => {
      if (typeof pedidoId !== "string") return
      const room = getAuthorizedRoom(user, pedidoId, "chat:typing")
      if (!room) return
      const payload = { pedidoId, userId: actor.userId }
      // Recipient-scope filtering (REV1_B) — see message-sent above.
      for (const socketId of getAuthorizedRecipientSockets(connectedUsers, room, "chat:typing")) {
        if (socketId === socket.id) continue
        io.to(socketId).emit("user-stop-typing", payload)
      }
    })

    socket.on("mark-read", (pedidoId) => {
      if (typeof pedidoId !== "string") return
      const room = getAuthorizedRoom(user, pedidoId, "chat:read")
      if (!room) return
      const payload = {
        pedidoId,
        readBy: actor.userId,
        userType: actor.userType,
      }
      // Recipient-scope filtering (REV1_B) — see message-sent above.
      for (const socketId of getAuthorizedRecipientSockets(connectedUsers, room, "chat:read")) {
        if (socketId === socket.id) continue
        io.to(socketId).emit("messages-read", payload)
      }
    })

    socket.on("location-update", (data) => {
      // Security gates first, in the same order/shape as before this
      // migration — none of them may be bypassed to reach the correlation
      // claim below, so an unauthorized/invalid/rate-limited/wrong-scope
      // event can never poison the shared correlation key space.
      if (!user.limiters.location.allow()) {
        metrics.rateLimitedEvents += 1
        return
      }
      if (actor.userType !== "repartidor") return
      const location = locationPayload(data)
      if (!location) return
      const room = getAuthorizedRoom(user, location.pedidoId, "tracking:publish")
      if (!room) return

      // Stale-PWA compatibility for the server-authoritative Tracking
      // producer (see route.ts): bounded best-effort correlation shared with
      // the Internal Publish Bridge, keyed by the physical GPS sample so
      // whichever path claims pedidoId+lat+lng first performs the relay —
      // see internal-publish-handler.js for the TTL/key rationale. This is
      // NOT exact dedupe: a legacy emit arriving after the TTL can still
      // reach recipients (Tracking Focal Design Correction #2).
      const correlationKey = trackingCorrelationKey(location.pedidoId, location.lat, location.lng)
      if (!trackingCorrelationDedupe.claim(correlationKey)) return

      const recipientSocketIds = getAuthorizedRecipientSockets(connectedUsers, room, "tracking:watch")
      // Same partial-fan-out safeguard as the Internal Publish Bridge: only
      // release the claim if this relay delivered to nobody at all.
      let deliveredCount = 0
      try {
        for (const socketId of recipientSocketIds) {
          io.to(socketId).emit("repartidor-location", location)
          deliveredCount += 1
        }
        // Zero authorized recipients (no throw) means nothing was actually
        // delivered — see internal-publish-handler.js for why releasing the
        // claim here is safe and avoids suppressing a later, genuinely
        // useful cross-path delivery once a watcher reconnects within the
        // TTL (Focal Precommit Review, zero-recipient cross-path race).
        if (deliveredCount === 0) trackingCorrelationDedupe.release(correlationKey)
      } catch {
        if (deliveredCount === 0) trackingCorrelationDedupe.release(correlationKey)
      }
    })

    socket.on("disconnect", (reason) => {
      clearTimeout(actorExpiryTimer)
      for (const room of [...user.rooms]) removeRoomGrant(user, room)
      connectedUsers.delete(socket.id)
      metrics.activeConnections = connectedUsers.size
      console.log(`[Chat] socket_disconnected reason=${reason} active=${metrics.activeConnections}`)
    })

    socket.on("error", () => {
      console.warn("[Chat] socket_error")
    })
  })

  return {
    io,
    httpServer,
    metrics,
    allowedOrigins,
    listen(callback) {
      return httpServer.listen(port, "0.0.0.0", callback)
    },
    async close() {
      io.disconnectSockets(true)
      await new Promise((resolve) => httpServer.close(resolve))
    },
  }
}

if (require.main === module) {
  const service = createChatService()
  service.listen(() => {
    console.log(`[Chat] deligo-chat listening on port ${process.env.PORT || 3003}`)
  })
}

module.exports = {
  createChatService,
  verifySignedToken,
  normalizeAllowedOrigins: getAllowedOrigins,
}
