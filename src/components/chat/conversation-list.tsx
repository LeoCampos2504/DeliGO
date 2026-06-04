"use client"

import { useEffect } from "react"
import { Clock, Bike, CreditCard, Store, User, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { useChatStore, type Conversation } from "@/store/chat-store"
import { useAuthStore } from "@/store/auth-store"
import { cn, formatPrice } from "@/lib/utils"
import { timeAgo } from "@/lib/utils"

export function ConversationList() {
  const {
    conversations,
    isLoadingConversations,
    openConversation,
    setLoadingConversations,
    setConversations,
  } = useChatStore()

  const { user } = useAuthStore()

  // Load conversations
  useEffect(() => {
    const load = async () => {
      setLoadingConversations(true)
      try {
        const res = await fetch("/api/chat/conversaciones")
        if (!res.ok) return
        const data = await res.json()
        setConversations(data.conversations || [])
      } catch {
        // silently fail
      } finally {
        setLoadingConversations(false)
      }
    }
    load()
  }, [setLoadingConversations, setConversations])

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

  if (conversations.length === 0) {
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
    </div>
  )
}

function ConversationItem({
  conversation: conv,
  userType,
  onClick,
}: {
  conversation: Conversation
  userType: string
  onClick: () => void
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
      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
            {conv.negocioLogoUrl && userType === "cliente" ? (
              <img
                src={conv.negocioLogoUrl}
                alt={conv.negocioNombre}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-primary">
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
              <span className="font-semibold text-sm truncate">
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
