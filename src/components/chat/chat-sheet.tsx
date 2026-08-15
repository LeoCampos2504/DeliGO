"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { io, Socket } from "socket.io-client"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useChatStore } from "@/store/chat-store"
import { useAuthStore } from "@/store/auth-store"
import { ConversationList } from "./conversation-list"
import { ChatView } from "./chat-view"
import { MessageCircle, Loader2, WifiOff, RefreshCw } from "lucide-react"
import { SheetDescription } from "@/components/ui/sheet"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { authorizeRealtimeRoom, fetchRealtimeToken, getRealtimeSocketUrl } from "@/lib/realtime-client"

export function ChatSheet() {
  const {
    isSheetOpen,
    setSheetOpen,
    activePedidoId,
    isConnected,
    setConnected,
    setConnecting,
    addMessage,
    addTypingUser,
    removeTypingUser,
    conversations,
    setConversations,
    setUnreadCount,
    updateConversationUnread,
    updateConversationLastMessage,
  } = useChatStore()

  const { user } = useAuthStore()
  const socketRef = useRef<Socket | null>(null)
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Cleanup dead socket reference
  const cleanupSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setConnected(false)
  }, [setConnected])

  // Connect to socket when sheet opens
  useEffect(() => {
    if (!isSheetOpen || !user) return

    // If already connected, skip
    if (socketRef.current?.connected) return

    // Clean up any dead socket first
    cleanupSocket()
    setConnecting(true)

    let cancelled = false

    const connect = async () => {
      let token: string
      try {
        token = await fetchRealtimeToken()
      } catch (error) {
        if (!cancelled) {
          console.warn("[Chat] Realtime auth failed:", safeErrorForLog(error))
          setConnectionFailed(true)
          setConnecting(false)
        }
        return
      }
      if (cancelled) return

      const socket = io(getRealtimeSocketUrl(), {
        transports: ["websocket", "polling"],
        upgrade: true,
        forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
        auth: { token },
        path: "/socket.io",
      })

      socket.on("connect", () => {
        setConnected(true)
        setConnecting(false)
        setConnectionFailed(false)
      })

      socket.on("disconnect", () => {
        setConnected(false)
      })

      socket.on("connect_error", (err) => {
        console.warn("[Chat] Connection error:", safeErrorForLog(err))
        setConnectionFailed(true)
        setConnecting(false)
      })

      socket.on("reconnect_attempt", () => {
        setConnecting(true)
        setConnectionFailed(false)
      })

      socket.on("reconnect_failed", () => {
        setConnectionFailed(true)
        setConnecting(false)
        // Clear the dead socket so it can be recreated on next sheet open
        cleanupSocket()
      })

      socket.on("new-message", (message: any) => {
        if (message && message.pedidoId) {
          addMessage(message.pedidoId, message)
          updateConversationLastMessage(message.pedidoId, message)

        // Update unread count for conversation
        if (message.remitente !== getRemitenteForUserType(user.type)) {
          const conv = conversations.find((c) => c.pedidoId === message.pedidoId)
          if (conv && activePedidoId !== message.pedidoId) {
            updateConversationUnread(message.pedidoId, conv.unreadCount + 1)
          }
        }
        }
      })

      socket.on("user-typing", (data: { pedidoId: string; userId: string; userType: string; userName?: string }) => {
        addTypingUser(data.pedidoId, {
          userId: data.userId,
          userType: data.userType,
          userName: data.userName || "Usuario",
        })

      // Auto-remove typing indicator after 3 seconds
      if (typingTimeoutRef.current[data.userId]) {
        clearTimeout(typingTimeoutRef.current[data.userId])
      }
      typingTimeoutRef.current[data.userId] = setTimeout(() => {
        removeTypingUser(data.pedidoId, data.userId)
      }, 3000)
      })

      socket.on("user-stop-typing", (data: { pedidoId: string; userId: string }) => {
        removeTypingUser(data.pedidoId, data.userId)
        if (typingTimeoutRef.current[data.userId]) {
          clearTimeout(typingTimeoutRef.current[data.userId])
          delete typingTimeoutRef.current[data.userId]
        }
      })

      socket.on("unread-update", (data: { count: number }) => {
        setUnreadCount(data.count)
      })

      socket.on("messages-read", () => {
        // Could trigger a refetch, but polling remains unchanged in this phase.
      })

      socketRef.current = socket
    }

    void connect()

    return () => {
      cancelled = true
      // Don't disconnect on sheet close, keep connection alive
    }
  }, [isSheetOpen, user, cleanupSocket, retryCount])

  // Disconnect socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setConnected(false)
      }
    }
  }, [])

  // Join/leave rooms when activePedidoId changes
  useEffect(() => {
    if (!socketRef.current || !isConnected) return

    const socket = socketRef.current

    // Leave all pedido rooms
    socket.emit("leave-all-rooms")

    if (activePedidoId) {
      let cancelled = false
      void authorizeRealtimeRoom(activePedidoId, ["chat:read", "chat:typing"])
        .then((capability) => {
          if (cancelled || socketRef.current !== socket || !socket.connected) return
          socket.emit("join-order-room", capability, (ack: { ok?: boolean; code?: string }) => {
            if (!ack?.ok) console.warn("[Chat] Order room rejected:", ack?.code || "ROOM_FORBIDDEN")
          })
          // Mark messages as read
          socket.emit("mark-read", activePedidoId)
        })
        .catch(() => {
          // HTTP polling and GET message authorization remain the fallback in this phase.
        })
      return () => {
        cancelled = true
      }
    }
  }, [activePedidoId, isConnected])

  // Load conversations when sheet opens
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversaciones")
      if (!res.ok) return
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch {
      // silently fail
    }
  }, [setConversations])

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/no-leidos")
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount(data.noLeidos || 0)
    } catch {
      // silently fail
    }
  }, [setUnreadCount])

  useEffect(() => {
    if (isSheetOpen) {
      loadConversations()
      loadUnreadCount()
    }
  }, [isSheetOpen, loadConversations, loadUnreadCount])

  // Refresh conversations periodically while sheet is open
  useEffect(() => {
    if (!isSheetOpen) return

    const interval = setInterval(() => {
      loadConversations()
      loadUnreadCount()
    }, 10000)

    return () => clearInterval(interval)
  }, [isSheetOpen, loadConversations, loadUnreadCount])

  // Retry connection manually
  const handleRetryConnection = useCallback(() => {
    cleanupSocket()
    setRetryCount((c) => c + 1) // Trigger useEffect re-run
  }, [cleanupSocket])

  // Expose socket for child components
  const getSocket = useCallback(() => socketRef.current, [])

  return (
    <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden h-dvh"
      >
        <SheetTitle className="sr-only">Chat de pedidos</SheetTitle>
        <SheetDescription className="sr-only">Conversaciones de chat sobre tus pedidos</SheetDescription>
        {activePedidoId ? (
          <ChatView
            pedidoId={activePedidoId}
            getSocket={getSocket}
            onBack={() => useChatStore.getState().closeConversation()}
          />
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base">Chats</h2>
                    <p className="text-xs text-muted-foreground">
                      {isConnected ? (
                        <span className="text-emerald-500">● Conectado</span>
                      ) : connectionFailed ? (
                        <button
                          onClick={handleRetryConnection}
                          className="flex items-center gap-1 text-amber-500 hover:text-amber-600 transition-colors"
                        >
                          <WifiOff className="h-3 w-3" />
                          Sin conexión · Reintentar
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Conectando...
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversation List */}
            <ConversationList />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function getRemitenteForUserType(userType: string): string {
  switch (userType) {
    case "cliente":
      return "cliente"
    case "negocio":
      return "vendedor"
    case "repartidor":
      return "repartidor"
    default:
      return ""
  }
}
