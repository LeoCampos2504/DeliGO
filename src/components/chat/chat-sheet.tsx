"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useChatStore } from "@/store/chat-store"
import { useAuthStore } from "@/store/auth-store"
import { ConversationList } from "./conversation-list"
import { ChatView } from "./chat-view"
import { MessageCircle, Loader2, WifiOff, RefreshCw } from "lucide-react"
import { SheetDescription } from "@/components/ui/sheet"
import { useRealtime } from "@/hooks/use-realtime"

export function ChatSheet() {
  const {
    isSheetOpen,
    setSheetOpen,
    activePedidoId,
    addMessage,
    addTypingUser,
    removeTypingUser,
    conversations,
    setConversations,
    setUnreadCount,
    updateConversationUnread,
    updateConversationLastMessage,
  } = useChatStore()

  const user = useAuthStore((s) => s.user)
  const { client, snapshot } = useRealtime()
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
  const conversationsRef = useRef(conversations)
  const activePedidoIdRef = useRef(activePedidoId)
  const [retryNonce, setRetryNonce] = useState(0)

  const isConnected = snapshot.state === "connected"
  const isConnecting = snapshot.state === "connecting" ||
    snapshot.state === "reauthenticating" || snapshot.state === "reconnecting"
  const connectionFailed = snapshot.state === "error"

  useEffect(() => {
    conversationsRef.current = conversations
    activePedidoIdRef.current = activePedidoId
  }, [activePedidoId, conversations])

  // Shared subscription registry: Chat owns no physical socket or raw listener.
  useEffect(() => {
    if (!user || user.type === "repartidor") return

    const clearTypingTimeouts = () => {
      for (const timeout of Object.values(typingTimeoutRef.current)) clearTimeout(timeout)
      typingTimeoutRef.current = {}
    }

    const unsubscribers = [
      client.subscribe("new-message", (message) => {
        if (!message?.pedidoId) return
        addMessage(message.pedidoId, message)
        updateConversationLastMessage(message.pedidoId, message)

        if (message.remitente !== getRemitenteForUserType(user.type)) {
          const conv = conversationsRef.current.find((conversation) => conversation.pedidoId === message.pedidoId)
          if (conv && activePedidoIdRef.current !== message.pedidoId) {
            updateConversationUnread(message.pedidoId, conv.unreadCount + 1)
          }
        }
      }),
      client.subscribe("user-typing", (data) => {
        addTypingUser(data.pedidoId, {
          userId: data.userId,
          userType: data.userType,
          userName: data.userName || "Usuario",
        })
        const timeoutKey = `${data.pedidoId}:${data.userId}`
        if (typingTimeoutRef.current[timeoutKey]) clearTimeout(typingTimeoutRef.current[timeoutKey])
        typingTimeoutRef.current[timeoutKey] = setTimeout(() => {
          removeTypingUser(data.pedidoId, data.userId)
          delete typingTimeoutRef.current[timeoutKey]
        }, 3000)
      }),
      client.subscribe("user-stop-typing", (data) => {
        removeTypingUser(data.pedidoId, data.userId)
        const timeoutKey = `${data.pedidoId}:${data.userId}`
        if (typingTimeoutRef.current[timeoutKey]) {
          clearTimeout(typingTimeoutRef.current[timeoutKey])
          delete typingTimeoutRef.current[timeoutKey]
        }
      }),
      client.subscribe("unread-update", (data) => {
        setUnreadCount(data.count)
      }),
      client.subscribe("messages-read", () => {
        // HTTP polling remains the fallback; this event has no local UI effect yet.
      }),
    ]

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      clearTypingTimeouts()
    }
  }, [addMessage, addTypingUser, client, removeTypingUser, setUnreadCount, updateConversationLastMessage, updateConversationUnread, user?.id, user?.type])

  // A Chat room is a lease, not a physical socket owned by this component.
  useEffect(() => {
    if (!isSheetOpen || !activePedidoId || !user || user.type === "repartidor") return

    let cancelled = false
    let lease: { release: () => void } | null = null
    const controller = new AbortController()
    void client.acquireOrderRoom(activePedidoId, ["chat:read", "chat:typing"], { signal: controller.signal })
      .then((nextLease) => {
        if (cancelled) {
          nextLease.release()
          return
        }
        lease = nextLease
        client.markMessagesRead(activePedidoId)
      })
      .catch(() => {
        // HTTP polling and GET message authorization remain the fallback in this phase.
      })

    return () => {
      cancelled = true
      controller.abort()
      lease?.release()
    }
  }, [activePedidoId, client, isSheetOpen, retryNonce, user?.id, user?.type])

  // Load conversations when sheet opens
  const loadConversations = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/chat/conversaciones", { signal })
      if (!res.ok) return
      const data = await res.json()
      if (signal?.aborted) return
      setConversations(data.conversations || [])
    } catch {
      // silently fail
    }
  }, [setConversations])

  // Load unread count
  const loadUnreadCount = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/chat/no-leidos", { signal })
      if (!res.ok) return
      const data = await res.json()
      if (signal?.aborted) return
      setUnreadCount(data.noLeidos || 0)
    } catch {
      // silently fail
    }
  }, [setUnreadCount])

  useEffect(() => {
    if (isSheetOpen && user?.type !== "repartidor") {
      const controller = new AbortController()
      void loadConversations(controller.signal)
      void loadUnreadCount(controller.signal)
      return () => controller.abort()
    }
  }, [isSheetOpen, loadConversations, loadUnreadCount, user?.id, user?.type])

  // Refresh conversations periodically while sheet is open
  useEffect(() => {
    if (!isSheetOpen || user?.type === "repartidor") return

    const controller = new AbortController()
    const interval = setInterval(() => {
      void loadConversations(controller.signal)
      void loadUnreadCount(controller.signal)
    }, 10000)

    return () => {
      clearInterval(interval)
      controller.abort()
    }
  }, [isSheetOpen, loadConversations, loadUnreadCount, user?.id, user?.type])

  // Retry connection manually
  const handleRetryConnection = useCallback(() => {
    if (activePedidoId) setRetryNonce((current) => current + 1)
  }, [activePedidoId])

  if (!user || user.type === "repartidor") return null

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
                      ) : isConnecting ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Conectando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <WifiOff className="h-3 w-3" />
                          Sin conexión
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
