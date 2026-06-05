const { createServer } = require("http")
const { Server } = require("socket.io")

const PORT = process.env.PORT || 3003
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000"

const allowedOrigins = [
  "http://localhost:3000",
  CLIENT_URL,
].filter(Boolean)

const httpServer = createServer()

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
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
    socket.disconnect()
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

  socket.on("join-room", (pedidoId) => {
    if (!pedidoId) return

    const room = `pedido:${pedidoId}`
    socket.join(room)

    const user = connectedUsers.get(socket.id)
    if (user) {
      user.rooms.add(room)
    }

    console.log(`[Chat] ${userName} (${userType}) joined room ${room}`)

    socket.to(room).emit("user-joined-room", {
      pedidoId,
      userId,
      userType,
      userName,
    })
  })

  socket.on("leave-all-rooms", () => {
    const user = connectedUsers.get(socket.id)
    if (!user) return

    for (const room of user.rooms) {
      socket.leave(room)

      socket.to(room).emit("user-left-room", {
        pedidoId: room.replace("pedido:", ""),
        userId,
        userType,
        userName,
      })
    }

    user.rooms.clear()
  })

  socket.on("message-sent", (data) => {
    if (!data?.pedidoId || !data?.message) return

    const room = `pedido:${data.pedidoId}`
    socket.to(room).emit("new-message", data.message)
  })

  socket.on("typing", (pedidoId) => {
    if (!pedidoId) return

    const room = `pedido:${pedidoId}`

    socket.to(room).emit("user-typing", {
      pedidoId,
      userId,
      userType,
      userName,
    })
  })

  socket.on("stop-typing", (pedidoId) => {
    if (!pedidoId) return

    const room = `pedido:${pedidoId}`

    socket.to(room).emit("user-stop-typing", {
      pedidoId,
      userId,
    })
  })

  socket.on("mark-read", (pedidoId) => {
    if (!pedidoId) return

    const room = `pedido:${pedidoId}`

    socket.to(room).emit("messages-read", {
      pedidoId,
      readBy: userId,
      userType,
    })
  })

  socket.on("location-update", (data) => {
    if (!data?.pedidoId || typeof data.lat !== "number" || typeof data.lng !== "number") return

    const room = `pedido:${data.pedidoId}`

    socket.to(room).emit("repartidor-location", {
      pedidoId: data.pedidoId,
      lat: data.lat,
      lng: data.lng,
      timestamp: data.timestamp || new Date().toISOString(),
    })

    console.log(
      `[Chat] Location update: ${userName} → room ${room} (${data.lat}, ${data.lng})`
    )
  })

  socket.on("disconnect", (reason) => {
    const user = connectedUsers.get(socket.id)

    if (user) {
      console.log(`[Chat] Disconnected: ${user.userName} (${reason})`)

      for (const room of user.rooms) {
        socket.to(room).emit("user-stop-typing", {
          pedidoId: room.replace("pedido:", ""),
          userId,
        })
      }

      connectedUsers.delete(socket.id)
    }

    console.log(`[Chat] ${connectedUsers.size} users online`)
  })

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
  console.log(`  Client URL: ${CLIENT_URL}`)
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