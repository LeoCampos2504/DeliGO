const { createServer } = require("http")
const { Server } = require("socket.io")

const PORT = process.env.PORT || 3003

// Permite uno o varios dominios.
// En Railway usá:
// CLIENT_URLS=https://deligo.up.railway.app,https://deligo-copy-production.up.railway.app
//
// También mantiene compatibilidad con CLIENT_URL si ya lo tenías.
const CLIENT_URLS =
  process.env.CLIENT_URLS ||
  process.env.CLIENT_URL ||
  "http://localhost:3000"

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...CLIENT_URLS.split(",").map((url) => url.trim()).filter(Boolean),
]

// Quitar duplicados
const uniqueAllowedOrigins = [...new Set(allowedOrigins)]

console.log("[Chat] Allowed origins:", uniqueAllowedOrigins)

// HTTP server con health check.
// Importante: no responder 404 a /socket.io porque esa ruta la maneja Socket.IO.
const httpServer = createServer((req, res) => {
  const url = req.url || ""

  if (url === "/" || url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        ok: true,
        service: "deligo-chat",
        port: PORT,
        allowedOrigins: uniqueAllowedOrigins,
      })
    )
    return
  }

  // Dejar que Socket.IO maneje estas requests.
  if (url.startsWith("/socket.io")) {
    return
  }

  res.writeHead(404, { "Content-Type": "text/plain" })
  res.end("Not found")
})

const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      // Permitir requests sin origin, como health checks o algunos clientes internos
      if (!origin) {
        return callback(null, true)
      }

      if (uniqueAllowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      console.warn(`[Chat] CORS blocked origin: ${origin}`)
      return callback(new Error(`Origin not allowed: ${origin}`), false)
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  allowEIO3: true,
})

// Track connected users
const connectedUsers = new Map()

io.on("connection", (socket) => {
  console.log(`[Chat] Connected: ${socket.id}`)

  const { userId, userType, userName } = socket.handshake.auth || {}

  if (!userId || !userType) {
    console.warn(`[Chat] Missing auth for socket ${socket.id}, disconnecting`)
    socket.disconnect(true)
    return
  }

  connectedUsers.set(socket.id, {
    socketId: socket.id,
    userId,
    userType,
    userName: userName || "Usuario",
    rooms: new Set(),
  })

  console.log(
    `[Chat] User: ${userName || "Usuario"} (${userType}) - ${connectedUsers.size} users online`
  )

  // ===== JOIN ROOM =====
  socket.on("join-room", (pedidoId) => {
    if (!pedidoId) return

    const room = `pedido:${pedidoId}`
    socket.join(room)

    const user = connectedUsers.get(socket.id)
    if (user) {
      user.rooms.add(room)
    }

    console.log(`[Chat] ${userName || "Usuario"} (${userType}) joined room ${room}`)

    socket.to(room).emit("user-joined-room", {
      pedidoId,
      userId,
      userType,
      userName: userName || "Usuario",
    })
  })

  // ===== LEAVE ALL ROOMS =====
  socket.on("leave-all-rooms", () => {
    const user = connectedUsers.get(socket.id)
    if (!user) return

    for (const room of user.rooms) {
      socket.leave(room)

      socket.to(room).emit("user-left-room", {
        pedidoId: room.replace("pedido:", ""),
        userId,
        userType,
        userName: userName || "Usuario",
      })
    }

    user.rooms.clear()
  })

  // ===== MESSAGE SENT =====
  socket.on("message-sent", (data) => {
    if (!data?.pedidoId || !data?.message) return

    const room = `pedido:${data.pedidoId}`
    const senderType = userType

    // Defense in depth: el repartidor solo usa ubicación, no chat.
    // Si un repartidor emite message-sent (por bug del cliente o intento
    // malicioso), se ignora para que no llegue a cliente/negocio.
    if (senderType === "repartidor") {
      console.warn(`[Chat] Blocked message-sent from repartidor ${userId} in room ${room}`)
      return
    }

    // Solo enviar mensajes de chat a participantes válidos.
    // cliente ↔ negocio pueden chatear.
    // repartidor solo usa ubicación, no mensajes de chat.
    const socketsInRoom = io.sockets.adapter.rooms.get(room)

    if (socketsInRoom) {
      for (const socketId of socketsInRoom) {
        if (socketId === socket.id) continue

        const recipient = connectedUsers.get(socketId)
        if (!recipient) continue

        if (recipient.userType === "repartidor") continue

        io.to(socketId).emit("new-message", data.message)
      }
    }

    console.log(`[Chat] Message from ${senderType} in room ${room}`)
  })

  // ===== TYPING =====
  socket.on("typing", (pedidoId) => {
    if (!pedidoId) return

    const room = `pedido:${pedidoId}`

    // El repartidor no participa del chat cliente-negocio.
    if (userType === "repartidor") return

    // Solo enviar typing a participantes que no sean repartidor
    const socketsInRoom = io.sockets.adapter.rooms.get(room)

    if (socketsInRoom) {
      for (const socketId of socketsInRoom) {
        if (socketId === socket.id) continue

        const recipient = connectedUsers.get(socketId)
        if (!recipient || recipient.userType === "repartidor") continue

        io.to(socketId).emit("user-typing", {
          pedidoId,
          userId,
          userType,
          userName: userName || "Usuario",
        })
      }
    }
  })

  // ===== STOP TYPING =====
  socket.on("stop-typing", (pedidoId) => {
    if (!pedidoId) return

    const room = `pedido:${pedidoId}`

    // El repartidor no participa del chat cliente-negocio.
    if (userType === "repartidor") return

    const socketsInRoom = io.sockets.adapter.rooms.get(room)

    if (socketsInRoom) {
      for (const socketId of socketsInRoom) {
        if (socketId === socket.id) continue

        const recipient = connectedUsers.get(socketId)
        if (!recipient || recipient.userType === "repartidor") continue

        io.to(socketId).emit("user-stop-typing", {
          pedidoId,
          userId,
        })
      }
    }
  })

  // ===== MARK READ =====
  socket.on("mark-read", (pedidoId) => {
    if (!pedidoId) return

    const room = `pedido:${pedidoId}`

    // El repartidor no participa del chat cliente-negocio.
    if (userType === "repartidor") return

    // Solo enviar confirmación de lectura a participantes que no sean repartidor
    const socketsInRoom = io.sockets.adapter.rooms.get(room)

    if (socketsInRoom) {
      for (const socketId of socketsInRoom) {
        if (socketId === socket.id) continue

        const recipient = connectedUsers.get(socketId)
        if (!recipient || recipient.userType === "repartidor") continue

        io.to(socketId).emit("messages-read", {
          pedidoId,
          readBy: userId,
          userType,
        })
      }
    }
  })

  // ===== LOCATION UPDATE =====
  socket.on("location-update", (data) => {
    if (
      !data?.pedidoId ||
      typeof data.lat !== "number" ||
      typeof data.lng !== "number"
    ) {
      return
    }

    const room = `pedido:${data.pedidoId}`

    socket.to(room).emit("repartidor-location", {
      pedidoId: data.pedidoId,
      lat: data.lat,
      lng: data.lng,
      timestamp: data.timestamp || new Date().toISOString(),
    })

    console.log(
      `[Chat] Location update: ${userName || "Usuario"} → room ${room} (${data.lat}, ${data.lng})`
    )
  })

  // ===== DISCONNECT =====
  socket.on("disconnect", (reason) => {
    const user = connectedUsers.get(socket.id)

    if (user) {
      console.log(`[Chat] Disconnected: ${user.userName} (${reason})`)

      for (const room of user.rooms) {
        // `user-stop-typing` is a chat typing receipt → skip repartidor recipients.
        const socketsInRoom = io.sockets.adapter.rooms.get(room)
        if (socketsInRoom) {
          for (const socketId of socketsInRoom) {
            if (socketId === socket.id) continue
            const recipient = connectedUsers.get(socketId)
            if (!recipient || recipient.userType === "repartidor") continue
            io.to(socketId).emit("user-stop-typing", {
              pedidoId: room.replace("pedido:", ""),
              userId,
            })
          }
        }

        // `user-left-room` is a presence event → notify everyone (including repartidor).
        socket.to(room).emit("user-left-room", {
          pedidoId: room.replace("pedido:", ""),
          userId,
          userType,
          userName: user.userName,
        })
      }

      connectedUsers.delete(socket.id)
    }

    console.log(`[Chat] ${connectedUsers.size} users online`)
  })

  // ===== ERROR =====
  socket.on("error", (error) => {
    console.error(`[Chat] Socket error (${socket.id}):`, error?.message || error)
  })
})

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[Chat] Port ${PORT} is already in use! Is another instance running?`)
    process.exit(1)
  }

  console.error("[Chat] Server error:", error)
})

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("============================================")
  console.log(`  DeliGO Chat Service running on port ${PORT}`)
  console.log(`  Health: /health`)
  console.log(`  Allowed origins:`)

  for (const origin of uniqueAllowedOrigins) {
    console.log(`   - ${origin}`)
  }

  console.log("============================================")
})

function shutdown(signal) {
  console.log(`[Chat] Received ${signal}, shutting down...`)

  io.disconnectSockets()

  httpServer.close(() => {
    console.log("[Chat] Server closed")
    process.exit(0)
  })

  setTimeout(() => {
    console.log("[Chat] Force exit")
    process.exit(0)
  }, 5000)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))