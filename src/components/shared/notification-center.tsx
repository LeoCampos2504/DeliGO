"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell,
  Check,
  CheckCheck,
  Package,
  Star,
  MessageSquare,
  Truck,
  AlertTriangle,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useNotificationStore, type NotificationItem } from "@/store/notification-store"
import { useAuthStore } from "@/store/auth-store"

// ============================================
// Navigation helper — maps notification → tab
// ============================================

interface NavigationData {
  navigateTo?: {
    cliente?: string
    negocio?: string
    repartidor?: string
    empleado?: string
  }
  /**
   * P2-T44-R1P2 (G1): contrato moderno de los productores de Operaciones
   * (mesa_order_ready, operaciones_salon_new_order,
   * operaciones_order_cancelled, operaciones_pyr_new_order,
   * operaciones_pyr_new_review, operaciones_pyr_chat) — una ruta interna
   * completa, nunca un nombre de pestaña. Ver isSafeInternalPath/
   * handleNotifClick para la precedencia real de navegación.
   */
  url?: string
  [key: string]: unknown
}

/**
 * P2-T44-R1P2 (G1): misma lógica exacta que `isSafeInternalUrl` en
 * public/sw.js (reimplementada acá porque sw.js es un asset público, fuera
 * del grafo de módulos de Next.js — no importable desde un componente
 * React). Rechaza cualquier valor que no sea una ruta interna de un solo
 * segmento `/` inicial (nunca `http(s)://`, `//`, `javascript:`, etc.).
 */
export function isSafeInternalPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
}

/** Parseo tolerante — una fila histórica con `datos` inválido nunca debe
 * romper el click de toda la campana, sólo perder su propia navegación. */
export function parseNotificationData(notif: NotificationItem): NavigationData {
  try {
    return JSON.parse(notif.datos || "{}") as NavigationData
  } catch {
    return {}
  }
}

export function getNavigateTab(notif: NotificationItem): string | null {
  const datos = parseNotificationData(notif)
  const userType = notif.userType as "cliente" | "negocio" | "repartidor" | "empleado"
  return datos.navigateTo?.[userType] || null
}

export type NotificationNavigationDecision =
  | { kind: "url"; url: string }
  | { kind: "tab"; tab: string }
  | { kind: "none" }

/**
 * P2-T44-R1P2 (G1): decisión PURA de navegación — extraída para poder
 * testearla sin renderizar el componente (mismo criterio que
 * mesa-cliente-cuenta-ui.ts: sin React, sin DOM, sin infraestructura).
 * Nunca ejecuta la navegación en sí (eso lo hace `handleNotifClick`, el
 * único lugar que llama a `router.push`) — sólo decide QUÉ haría falta
 * hacer, dado el contrato real documentado en R1P1A §18.3:
 *   1. `datos.url` si es una ruta interna segura → navegar ahí (contrato
 *      moderno, los 6 tipos de Operaciones lo usan, nunca `navigateTo`).
 *   2. si no, `navigateTo`/`onNavigate` legacy — SIEMPRE un nombre de
 *      pestaña, nunca una URL — sin cambios de comportamiento.
 *   3. si ninguno, "none".
 */
export function resolveNotificationNavigation(notif: NotificationItem): NotificationNavigationDecision {
  const datos = parseNotificationData(notif)
  if (isSafeInternalPath(datos.url)) {
    return { kind: "url", url: datos.url }
  }
  const tab = getNavigateTab(notif)
  if (tab) {
    return { kind: "tab", tab }
  }
  return { kind: "none" }
}

// ============================================
// Icon per notification type
// ============================================

function getNotifIcon(tipo: string) {
  switch (tipo) {
    case "new_order":
      return <Package className="h-4 w-4 text-primary" />
    case "order_update":
      return <Truck className="h-4 w-4 text-blue-500" />
    case "new_delivery":
      return <Truck className="h-4 w-4 text-emerald-500" />
    case "review":
      return <Star className="h-4 w-4 text-amber-500" />
    case "review_request":
      return <Star className="h-4 w-4 text-amber-500" />
    case "chat":
      return <MessageSquare className="h-4 w-4 text-violet-500" />
    case "account_update":
      return <Settings className="h-4 w-4 text-gray-500" />
    // P2-T44-R1P2 (G1): tipos de Operaciones — antes caían todos al ícono
    // genérico (default) por falta de casos dedicados.
    case "mesa_order_ready":
    case "salon_new_order":
    case "operaciones_salon_new_order":
    case "operaciones_pyr_new_order":
      return <Package className="h-4 w-4 text-primary" />
    case "operaciones_order_cancelled":
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    case "operaciones_pyr_new_review":
      return <Star className="h-4 w-4 text-amber-500" />
    case "operaciones_pyr_chat":
      return <MessageSquare className="h-4 w-4 text-violet-500" />
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />
  }
}

// ============================================
// Time ago helper
// ============================================

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return "Ahora"
  if (diffMin < 60) return `${diffMin}m`
  if (diffHr < 24) return `${diffHr}h`
  if (diffDay < 7) return `${diffDay}d`
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

// ============================================
// NotificationBell Component
// ============================================

interface NotificationBellProps {
  /** Called when a notification is clicked — should navigate to the target tab */
  onNavigate?: (tab: string, notif: NotificationItem) => void
  /** Uses the authenticated operational account and its employee feed. */
  operational?: boolean
}

export function NotificationBell({ onNavigate, operational = false }: NotificationBellProps) {
  const { noLeidos, setNoLeidos, decrementNoLeidos, isOpen, setIsOpen } = useNotificationStore()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const router = useRouter()

  // Fetch unread count
  const { data: notifData } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => {
      const res = await fetch("/api/notificaciones?limit=1&unread=true")
      if (!res.ok) return { noLeidos: 0 }
      return res.json() as Promise<{ noLeidos: number }>
    },
    refetchInterval: 10000, // Poll every 10s
    enabled: operational || (!!user && (user.type === "cliente" || user.type === "negocio" || user.type === "repartidor")),
  })

  // Fetch full notification list (only when popover is open)
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["notifications-list"],
    queryFn: async () => {
      const res = await fetch("/api/notificaciones?limit=50")
      if (!res.ok) return { notificaciones: [] as NotificationItem[], noLeidos: 0 }
      return res.json() as Promise<{ notificaciones: NotificationItem[]; noLeidos: number }>
    },
    enabled: isOpen && (operational || !!user),
    staleTime: 0,
  })

  // Sync unread count
  useEffect(() => {
    if (notifData?.noLeidos !== undefined) {
      setNoLeidos(notifData.noLeidos)
    }
  }, [notifData, setNoLeidos])

  // Mark single as read
  const markAsRead = useCallback(async (notifId: string) => {
    try {
      const res = await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notificationId: notifId }),
      })
      if (res.ok) {
        const data = await res.json()
        setNoLeidos(data.noLeidos ?? 0)
        queryClient.invalidateQueries({ queryKey: ["notifications-list"] })
      }
    } catch {}
  }, [setNoLeidos, queryClient])

  // Mark all as read
  const markAllRead = useCallback(async () => {
    try {
      const res = await fetch("/api/notificaciones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      })
      if (res.ok) {
        setNoLeidos(0)
        queryClient.invalidateQueries({ queryKey: ["notifications-list"] })
      }
    } catch {}
  }, [setNoLeidos, queryClient])

  // Handle notification click — navigate + mark as read.
  // P2-T44-R1P2 (G1): precedencia de navegación —
  //   1. `datos.url` si es una ruta interna segura (isSafeInternalPath) →
  //      router.push directo, resuelto ACÁ dentro del componente, sin
  //      depender de que el host pase `onNavigate` (contrato moderno de los
  //      6 tipos de Operaciones, todos embeben `url`, nunca `navigateTo`).
  //   2. si no, el contrato legacy sin cambios: `navigateTo`/`onNavigate`
  //      (siempre un NOMBRE DE PESTAÑA — "pedidos"/"resenas"/etc. — nunca
  //      una URL; jamás se pasa a router.push).
  //   3. si ninguno, sólo se marca como leído (comportamiento actual).
  const handleNotifClick = useCallback(async (notif: NotificationItem) => {
    // Mark as read
    if (!notif.leido) {
      await markAsRead(notif.id)
    }

    const decision = resolveNotificationNavigation(notif)
    if (decision.kind === "url") {
      router.push(decision.url)
    } else if (decision.kind === "tab" && onNavigate) {
      onNavigate(decision.tab, notif)
    }

    // Close popover
    setIsOpen(false)
  }, [markAsRead, onNavigate, setIsOpen, router])

  const notificaciones = listData?.notificaciones ?? []

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          title="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          {noLeidos > 0 && (
            <motion.div
              key={`bell-badge-${noLeidos}`}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center"
            >
              <Badge className="h-4 min-w-4 px-1 text-[9px] font-bold border-0 bg-red-500 text-white">
                {noLeidos > 99 ? "99+" : noLeidos}
              </Badge>
            </motion.div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] p-0 rounded-xl border shadow-xl"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notificaciones</h3>
            {noLeidos > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {noLeidos}
              </Badge>
            )}
          </div>
          {noLeidos > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todo leído
            </Button>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-[400px]">
          {listLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No hay notificaciones</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notificaciones.map((notif) => (
                <NotificationRow
                  key={notif.id}
                  notif={notif}
                  onClick={() => handleNotifClick(notif)}
                  onMarkRead={() => markAsRead(notif.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// ============================================
// Notification Row Component
// ============================================

interface NotificationRowProps {
  notif: NotificationItem
  onClick: () => void
  onMarkRead: () => void
}

function NotificationRow({ notif, onClick, onMarkRead }: NotificationRowProps) {
  const isUnread = !notif.leido

  return (
    <div
      className={cn(
        "relative flex gap-3 px-4 py-3 cursor-pointer transition-colors group",
        isUnread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={cn(
        "flex-shrink-0 mt-0.5 flex items-center justify-center h-8 w-8 rounded-lg",
        isUnread ? "bg-primary/10" : "bg-muted/50"
      )}>
        {getNotifIcon(notif.tipo)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm leading-snug",
          isUnread ? "font-semibold text-foreground" : "text-foreground/80"
        )}>
          {notif.titulo}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notif.cuerpo}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {timeAgo(notif.createdAt)}
        </p>
      </div>

      {/* Mark as read button (only for unread) */}
      {isUnread && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation()
            onMarkRead()
          }}
          title="Marcar como leído"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
