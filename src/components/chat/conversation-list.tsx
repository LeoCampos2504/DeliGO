"use client"

import { useEffect, useState } from "react"
import { Clock, Bike, CreditCard, Store, User, Loader2, ChevronDown, ChevronUp, Archive } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { useChatStore, type Conversation } from "@/store/chat-store"
import { useAuthStore } from "@/store/auth-store"
import { cn, formatPrice } from "@/lib/utils"
import { timeAgo } from "@/lib/utils"

export function ConversationList() {
  const {
    conversations,
    archivedConversations,
    isLoadingConversations,
    openConversation,
    setLoadingConversations,
    setConversations,
    setArchivedConversations,
  } = useChatStore()

  const user = useAuthStore((s) => s.user)
  const [showArchived, setShowArchived] = useState(false)

  // Load conversations
  useEffect(() => {
    const load = async () => {
      setLoadingConversations(true)
      try {
        const res = await fetch("/api/chat/conversaciones")
        if (!res.ok) return
        const data = await res.json()
        setConversations(data.conversations || [])
        setArchivedConversations(data.archived || [])
      } catch {
        // silently fail
      } finally {
        setLoadingConversations(false)
      }
    }
    load()
  }, [setLoadingConversations, setConversations, setArchivedConversations])

  if (isLoadingConversations) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando chats...</p>
        </div>
      </div>
    )
  }

  const hasNoChats = conversations.length === 0 && archivedConversations.length === 0

  if (hasNoChats) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <MessageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-bold text-base">Sin conversaciones</h3>
          <p className="text-sm text-muted-foreground">
            {user?.type === "cliente"
              ? "Tus chats con los negocios aparecerán aquí cuando hagas un pedido"
              : user?.type === "negocio"
              ? "Los chats con tus clientes aparecerán aquí cuando reciban pedidos"
              : "Los chats de los pedidos asignados aparecerán aquí"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Active conversations */}
      <AnimatePresence>
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.pedidoId}
            conversation={conv}
            userType={user?.type || "cliente"}
            onClick={() => openConversation(conv.pedidoId)}
          />
        ))}
      </AnimatePresence>

      {/* Archived conversations */}
      {archivedConversations.length > 0 && (
        <div className="mt-1">
          {/* Toggle button */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">
              Chats anteriores ({archivedConversations.length})
            </span>
            {showArchived ? (
              <ChevronUp className="h-3.5 w-3.5 ml-auto" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 ml-auto" />
            )}
          </button>

          {/* Archived list */}
          <AnimatePresence>
            {showArchived && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {archivedConversations.map((conv) => (
                  <ConversationItem
                    key={conv.pedidoId}
                    conversation={conv}
                    userType={user?.type || "cliente"}
                    onClick={() => openConversation(conv.pedidoId)}
                    isArchived
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function ConversationItem({
  conversation: conv,
  userType,
  onClick,
  isArchived = false,
}: {
  conversation: Conversation
  userType: string
  onClick: () => void
  isArchived?: boolean
}) {
  // Determine the "other party" name based on user type
  const otherParty =
    userType === "cliente" ? conv.negocioNombre : conv.clienteNombre

  const otherPartyIcon =
    userType === "cliente" ? (
      <Store className="h-4 w-4 text-primary" />
    ) : (
      <User className="h-4 w-4 text-primary" />
    )

  // Determine last message preview
  const lastMessagePreview = conv.lastMessage
    ? conv.lastMessageRemitente === "vendedor"
      ? `🏪 ${conv.lastMessage}`
      : conv.lastMessageRemitente === "repartidor"
      ? `🛵 ${conv.lastMessage}`
      : `👤 ${conv.lastMessage}`
    : "Sin mensajes aún"

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30",
        isArchived && "opacity-60 hover:opacity-100"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden",
            isArchived ? "bg-muted" : "bg-primary/10"
          )}>
            {conv.negocioLogoUrl && userType === "cliente" ? (
              <img
                src={conv.negocioLogoUrl}
                alt={conv.negocioNombre}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className={cn(
                "text-lg font-bold",
                isArchived ? "text-muted-foreground" : "text-primary"
              )}>
                {otherParty.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {/* Unread badge on avatar */}
          {conv.unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {otherPartyIcon}
              <span className={cn(
                "font-semibold text-sm truncate",
                isArchived && "text-muted-foreground"
              )}>
                {otherParty}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {conv.lastMessageDate
                ? timeAgo(new Date(conv.lastMessageDate))
                : timeAgo(new Date(conv.fecha))}
            </span>
          </div>

          {/* Last message */}
          <p
            className={cn(
              "text-xs mt-0.5 truncate",
              conv.unreadCount > 0
                ? "text-foreground font-semibold"
                : "text-muted-foreground"
            )}
          >
            {lastMessagePreview}
          </p>

          {/* Order info row */}
          <div className="flex items-center gap-2 mt-1.5">
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] px-1.5 py-0 h-4 font-semibold",
                getEstadoColor(conv.estado)
              )}
            >
              {getEstadoLabel(conv.estado)}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              {conv.metodoEntrega === "domicilio" ? (
                <Bike className="h-2.5 w-2.5" />
              ) : (
                <Clock className="h-2.5 w-2.5" />
              )}
              {conv.metodoEntrega === "domicilio" ? "Delivery" : "Retiro"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatPrice(conv.total)}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  )
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
    </svg>
  )
}

function getEstadoColor(estado: string): string {
  switch (estado) {
    case "recibido":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    case "preparando":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    case "en_camino":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
    case "listo_para_retirar":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    case "entregado":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
    case "cancelado":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function getEstadoLabel(estado: string): string {
  switch (estado) {
    case "recibido":
      return "Recibido"
    case "preparando":
      return "Preparando"
    case "en_camino":
      return "En camino"
    case "listo_para_retirar":
      return "Listo"
    case "entregado":
      return "Entregado"
    case "cancelado":
      return "Cancelado"
    default:
      return estado
  }
}
