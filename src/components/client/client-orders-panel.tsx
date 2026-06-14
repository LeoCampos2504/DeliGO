"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Package,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  XCircle,
  CheckCircle2,
  Store,
  Bike,
  ShoppingBag,
  RotateCcw,
  Star,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ShoppingCart,
  X,
  Ban,
  ArrowRight,
  Navigation,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn, formatPrice, timeAgo, statusLabel, statusEmoji } from "@/lib/utils"
import { useCartStore, type CartItemAgregado } from "@/store/cart-store"
import { ReviewDialog } from "@/components/client/review-dialog"
import dynamic from "next/dynamic"

// Dynamic import for the tracking map (heavy Leaflet dependency)
const DeliveryTrackingMap = dynamic(
  () => import("@/components/tracking/delivery-tracking-map").then((mod) => ({ default: mod.DeliveryTrackingMap })),
  { ssr: false }
)

// ============================================
// Types
// ============================================
interface PedidoItem {
  id: string
  nombre: string
  precio: number
  cantidad: number
  agregados: string
  secciones: string
  ingredientesQuitados: string
  talle: string
  color: string
}

interface Pedido {
  id: string
  negocioId: string
  negocioSlug: string
  negocioNombre: string
  total: number
  totalProductos: number
  metodoEntrega: string
  metodoPago: string
  estado: string
  fecha: string
  items: PedidoItem[]
  clienteConfirmaRecibido: boolean
  resena: { id: string; puntuacion: number } | null
  canceladoPor: string | null
  canceladoMotivo: string | null
  // Delivery tracking fields (from API)
  lat?: number | null
  lng?: number | null
  direccion?: string | null
  negocioLat?: number | null
  negocioLng?: number | null
  logoUrl?: string | null
  colorPrincipal?: string | null
  seguimientoDeliveryActivo?: boolean
  toleranciaCancelacion?: number
}

// API response type for repeat order
interface RepeatOrderItem {
  id: string
  productoId: string | null
  nombre: string
  precio: number
  precioActual: number | null
  precioOriginal: number | null
  descuentoActivo: boolean
  tipoDescuento: string
  valorDescuento: number
  cantidad: number
  agregados: { id: string; nombre: string; precio: number }[]
  secciones: Record<string, string | Record<string, number>> | string
  seccionesPrecios: Record<string, number> | string
  ingredientesQuitados: string[] | string
  talle: string
  color: string
  disponible: boolean
  motivoIndisponibilidad: string | null
  imagenUrl: string | null
}

interface RepeatOrderResponse {
  ok: boolean
  pedidoId: string
  negocio: {
    id: string
    slug: string
    nombre: string
    logoUrl: string | null
    rubro: string
    precioDelivery: number
    ofreceDelivery: boolean
  }
  items: RepeatOrderItem[]
  disponiblesCount: number
  noDisponiblesCount: number
  totalOriginal: number
}

const ACTIVE_STATUSES = ["recibido", "confirmado", "preparando", "en_camino", "listo_para_retirar"]
const HISTORY_STATUSES = ["entregado", "cancelado"]

// Status timeline steps for active orders
const TIMELINE_STEPS = [
  { key: "recibido", label: "Recibido", emoji: "📩" },
  { key: "confirmado", label: "Confirmado", emoji: "✅" },
  { key: "preparando", label: "Preparando", emoji: "👨‍🍳" },
  { key: "en_camino", label: "En camino", emoji: "🛵" },
  { key: "listo_para_retirar", label: "Listo", emoji: "📦" },
]

// ============================================
// Main Orders Panel Component
// ============================================
export function ClientOrdersPanel() {
  const [activeTab, setActiveTab] = useState<"activos" | "historial">("activos")
  const [repeatDialogOpen, setRepeatDialogOpen] = useState(false)
  const [repeatPedidoId, setRepeatPedidoId] = useState<string | null>(null)
  const [trackingPedido, setTrackingPedido] = useState<Pedido | null>(null)
  const [trackingOpen, setTrackingOpen] = useState(false)

  const { data: pedidosActivos = [], isLoading: loadingActivos } = useQuery<Pedido[]>({
    queryKey: ["cliente-pedidos", "activos"],
    queryFn: async () => {
      const res = await fetch("/api/cliente/pedidos?estado=activos")
      if (!res.ok) throw new Error("Error al cargar pedidos activos")
      const data = await res.json()
      return data.pedidos ?? []
    },
    refetchInterval: 15_000, // Refresh every 15s for active orders
  })

  const { data: pedidosHistorial = [], isLoading: loadingHistorial } = useQuery<Pedido[]>({
    queryKey: ["cliente-pedidos", "historial"],
    queryFn: async () => {
      const res = await fetch("/api/cliente/pedidos?estado=historial")
      if (!res.ok) throw new Error("Error al cargar historial")
      const data = await res.json()
      return data.pedidos ?? []
    },
  })

  const isLoading = loadingActivos && loadingHistorial

  const openRepeatDialog = useCallback((pedidoId: string) => {
    setRepeatPedidoId(pedidoId)
    setRepeatDialogOpen(true)
  }, [])

  const closeRepeatDialog = useCallback(() => {
    setRepeatDialogOpen(false)
    setRepeatPedidoId(null)
  }, [])

  // Find the most recent non-cancelled order for the shortcut card
  const lastDeliveredOrder = pedidosHistorial.find((p) => p.estado === "entregado")

  if (isLoading) {
    return <OrdersSkeleton />
  }

  return (
    <div className="flex-1 bg-background">
      {/* Header */}
      <OrdersHeader />

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 pb-24">
        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1 mb-4">
          <button
            onClick={() => setActiveTab("activos")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
              activeTab === "activos"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>📋</span>
            Activos
            {pedidosActivos.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ml-0.5">
                {pedidosActivos.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("historial")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
              activeTab === "historial"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>📜</span>
            Historial
            {pedidosHistorial.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ml-0.5">
                {pedidosHistorial.length}
              </Badge>
            )}
          </button>
        </div>

        {/* Panels */}
        <AnimatePresence mode="wait">
          {activeTab === "activos" ? (
            <motion.div
              key="activos"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {pedidosActivos.length === 0 ? (
                <>
                  {/* Repeat last order shortcut card */}
                  {lastDeliveredOrder && (
                    <RepeatLastOrderCard
                      pedido={lastDeliveredOrder}
                      onRepeat={openRepeatDialog}
                    />
                  )}
                  <EmptyState
                    emoji="📭"
                    title="Sin pedidos activos"
                    description="Cuando hagas un pedido, vas a poder seguirlo en tiempo real desde acá"
                  />
                </>
              ) : (
                <div className="space-y-3">
                  {pedidosActivos.map((pedido) => (
                    <ActiveOrderCard key={pedido.id} pedido={pedido} onTrackDelivery={(p) => { setTrackingPedido(p); setTrackingOpen(true) }} />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="historial"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {pedidosHistorial.length === 0 ? (
                <EmptyState
                  emoji="🗃️"
                  title="Sin historial"
                  description="Tus pedidos completados y cancelados van a aparecer acá"
                />
              ) : (
                <div className="space-y-3">
                  {pedidosHistorial.map((pedido) => (
                    <HistoryOrderCard
                      key={pedido.id}
                      pedido={pedido}
                      onRepeat={openRepeatDialog}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Repeat Order Dialog */}
      {repeatPedidoId && (
        <RepeatOrderDialog
          pedidoId={repeatPedidoId}
          open={repeatDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeRepeatDialog()
          }}
        />
      )}

      {/* Delivery Tracking Map */}
      {trackingPedido && (
        <DeliveryTrackingMap
          pedidoId={trackingPedido.id}
          destinoLat={trackingPedido.lat ?? -26.1856}
          destinoLng={trackingPedido.lng ?? -58.1732}
          destinoDireccion={trackingPedido.direccion ?? undefined}
          origenLat={trackingPedido.negocioLat ?? undefined}
          origenLng={trackingPedido.negocioLng ?? undefined}
          origenNombre={trackingPedido.negocioNombre}
          colorPrincipal={trackingPedido.colorPrincipal ?? undefined}
          logoUrl={trackingPedido.logoUrl ?? undefined}
          open={trackingOpen}
          onOpenChange={(open) => {
            setTrackingOpen(open)
            if (!open) setTrackingPedido(null)
          }}
        />
      )}
    </div>
  )
}

// ============================================
// Repeat Order Dialog
// ============================================
function RepeatOrderDialog({
  pedidoId,
  open,
  onOpenChange,
}: {
  pedidoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const cart = useCartStore()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const { data, isLoading, error } = useQuery<RepeatOrderResponse>({
    queryKey: ["repeat-order", pedidoId],
    queryFn: async () => {
      const res = await fetch(`/api/cliente/pedidos/${pedidoId}/repetir`, {
        method: "PUT",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al verificar disponibilidad")
      }
      return res.json()
    },
    enabled: open,
  })

  const handleConfirmRepeat = async () => {
    if (!data) return
    setConfirming(true)

    try {
      const { negocio, items } = data
      const availableItems = items.filter((i) => i.disponible)

      if (availableItems.length === 0) {
        toast.error("No hay productos disponibles para repetir")
        setConfirming(false)
        onOpenChange(false)
        return
      }

      // Set active negocio context (this clears cart if different negocio)
      cart.setActiveNegocio(negocio.id, negocio.slug, negocio.nombre, negocio.precioDelivery)

      // Add each available item to cart
      for (const item of availableItems) {
        // Parse secciones (API may return parsed object or string)
        let seccionesParsed: Record<string, string | Record<string, number>> = {}
        try {
          seccionesParsed = typeof item.secciones === "string"
            ? JSON.parse(item.secciones || "{}")
            : (item.secciones || {})
        } catch {
          seccionesParsed = {}
        }
        if (typeof seccionesParsed !== "object" || Array.isArray(seccionesParsed)) seccionesParsed = {}

        // Parse ingredientes quitados (API may return parsed array or string)
        let ingredientesQuitados: string[] = []
        try {
          ingredientesQuitados = typeof item.ingredientesQuitados === "string"
            ? JSON.parse(item.ingredientesQuitados || "[]")
            : (Array.isArray(item.ingredientesQuitados) ? item.ingredientesQuitados : [])
        } catch {
          ingredientesQuitados = []
        }

        // Use updated price if available
        const precio = item.precioActual ?? item.precio

        cart.addItem({
          productoId: item.productoId || item.id,
          nombre: item.nombre,
          precio,
          cantidad: item.cantidad,
          agregados: item.agregados as CartItemAgregado[],
          secciones: seccionesParsed,
          ingredientesQuitados,
          talle: item.talle || "",
          color: item.color || "",
          notas: "",
        })
      }

      // Show appropriate toast
      const unavailableCount = data.noDisponiblesCount
      if (unavailableCount > 0) {
        toast.warning(
          `${availableItems.length} producto${availableItems.length !== 1 ? "s" : ""} agregado${availableItems.length !== 1 ? "s" : ""}, ${unavailableCount} no disponible${unavailableCount !== 1 ? "s" : ""}`,
          { duration: 4000 }
        )
      } else {
        toast.success(
          `${availableItems.length} producto${availableItems.length !== 1 ? "s" : ""} agregado${availableItems.length !== 1 ? "s" : ""} al carrito 🛒`
        )
      }

      onOpenChange(false)

      // Invalidate cart queries if any
      queryClient.invalidateQueries({ queryKey: ["cart"] })

      // Navigate to business page
      router.push(`/n/${negocio.slug}`)
    } catch {
      toast.error("Error al agregar productos al carrito")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Repetir pedido
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Verificando disponibilidad..."
              : data
                ? `Revisá los productos de ${data.negocio.nombre}`
                : "Cargando..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-sm text-muted-foreground">
              Verificando disponibilidad...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm font-medium text-destructive">{error.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
          </div>
        ) : data ? (
          <>
            {/* Business info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {data.negocio.logoUrl ? (
                  <img
                    src={data.negocio.logoUrl}
                    alt={data.negocio.nombre}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <Store className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{data.negocio.nombre}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{data.negocio.rubro}</p>
              </div>
            </div>

            {/* Availability summary */}
            {data.noDisponiblesCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {data.noDisponiblesCount} producto{data.noDisponiblesCount !== 1 ? "s" : ""} no disponible{data.noDisponiblesCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    Solo se agregarán los productos disponibles
                  </p>
                </div>
              </motion.div>
            )}

            {/* Items list */}
            <div className="space-y-2 overflow-y-auto flex-1 max-h-[40vh] scrollbar-thin pr-1">
              {data.items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl transition-colors",
                    item.disponible
                      ? "bg-muted/30 hover:bg-muted/50"
                      : "bg-destructive/5 border border-destructive/10"
                  )}
                >
                  {/* Quantity badge */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-xs font-bold",
                      item.disponible
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {item.cantidad}x
                  </div>

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          !item.disponible && "line-through text-muted-foreground"
                        )}
                      >
                        {item.nombre}
                      </p>
                    {/* Discount badge */}
                    {item.disponible && item.descuentoActivo && item.valorDescuento > 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] h-4 px-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 shrink-0"
                      >
                        -{item.tipoDescuento === "porcentaje" ? `${item.valorDescuento}%` : formatPrice(item.valorDescuento)}
                      </Badge>
                    )}
                    {!item.disponible && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] h-4 px-1 bg-destructive/10 text-destructive border-destructive/20 shrink-0"
                      >
                        <Ban className="h-2.5 w-2.5 mr-0.5" />
                        No disponible
                      </Badge>
                    )}
                  </div>
                    {/* Unavailable reason */}
                    {!item.disponible && item.motivoIndisponibilidad && (
                      <p className="text-[10px] text-destructive/70 mt-0.5">
                        {item.motivoIndisponibilidad}
                      </p>
                    )}
                    {/* Agregados */}
                    {item.disponible && item.agregados.length > 0 && (
                      <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                        + {item.agregados.map((a) => a.nombre).join(", ")}
                      </p>
                    )}
                    {/* Secciones (option sections) */}
                    {item.disponible && (() => {
                      let parsed: Record<string, string | Record<string, number>> = {}
                      try {
                        parsed = typeof item.secciones === "string" ? JSON.parse(item.secciones || "{}") : (item.secciones || {})
                      } catch { parsed = {} }
                      if (typeof parsed !== "object" || Array.isArray(parsed)) parsed = {}
                      return Object.keys(parsed).length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {Object.entries(parsed).map(([k, v]) => {
                            let display: string
                            if (typeof v === "string") {
                              display = `${k}: ${v}`
                            } else {
                              const parts = Object.entries(v as Record<string, number>)
                                .filter(([, qty]) => qty > 0)
                                .map(([opt, qty]) => qty > 1 ? `${opt} x${qty}` : opt)
                              display = `${k}: ${parts.join(", ")}`
                            }
                            return (
                              <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                {display}
                              </span>
                            )
                          })}
                        </div>
                      ) : null
                    })()}
                    {/* Ingredientes quitados */}
                    {item.disponible && (() => {
                      let parsed: string[] = []
                      try {
                        parsed = typeof item.ingredientesQuitados === "string"
                          ? JSON.parse(item.ingredientesQuitados || "[]")
                          : (Array.isArray(item.ingredientesQuitados) ? item.ingredientesQuitados : [])
                      } catch { parsed = [] }
                      return parsed.length > 0 ? (
                        <p className="text-[11px] text-orange-600/70 dark:text-orange-400/70 mt-0.5">
                          Sin {parsed.join(", ")}
                        </p>
                      ) : null
                    })()}
                    {/* Price / Discount notice */}
                    {item.disponible && item.descuentoActivo && item.valorDescuento > 0 && item.precioOriginal !== null && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        En oferta: {formatPrice(item.precioActual ?? item.precio)} <span className="line-through text-muted-foreground">{formatPrice(item.precioOriginal)}</span>
                      </p>
                    )}
                    {item.disponible && !item.descuentoActivo && item.precioActual !== null && item.precioActual !== item.precio && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                        Precio actualizado: {formatPrice(item.precioActual)} (era {formatPrice(item.precio)})
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex flex-col items-end shrink-0">
                    {item.disponible && item.descuentoActivo && item.valorDescuento > 0 && item.precioOriginal !== null ? (
                      <>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatPrice((item.precioActual ?? item.precio) * item.cantidad)}
                        </span>
                        <span className="text-[10px] line-through text-muted-foreground">
                          {formatPrice(item.precioOriginal * item.cantidad)}
                        </span>
                      </>
                    ) : (
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          !item.disponible && "text-muted-foreground/50"
                        )}
                      >
                        {formatPrice((item.precioActual ?? item.precio) * item.cantidad)}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer with summary and confirm */}
            <DialogFooter className="flex-col sm:flex-col gap-3 pt-2 border-t">
              {/* Summary */}
              <div className="flex items-center justify-between w-full text-sm">
                <span className="text-muted-foreground">
                  {data.disponiblesCount} de {data.items.length} productos disponibles
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Se agregarán al carrito
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                  disabled={confirming}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handleConfirmRepeat}
                  disabled={confirming || data.disponiblesCount === 0}
                >
                  {confirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Agregando...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4" />
                      {data.disponiblesCount === 0
                        ? "Sin productos disponibles"
                        : `Agregar ${data.disponiblesCount} al carrito`
                      }
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Repeat Last Order Shortcut Card
// ============================================
function RepeatLastOrderCard({
  pedido,
  onRepeat,
}: {
  pedido: Pedido
  onRepeat: (pedidoId: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 shadow-sm overflow-hidden mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <RefreshCw className="h-6 w-6 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Repetir último pedido</p>
              <p className="text-xs text-muted-foreground truncate">
                {pedido.negocioNombre} · {pedido.items.reduce((s, i) => s + i.cantidad, 0)} producto{pedido.items.reduce((s, i) => s + i.cantidad, 0) !== 1 ? "s" : ""} · {formatPrice(pedido.total)}
              </p>
            </div>

            {/* Button */}
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => onRepeat(pedido.id)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Repetir
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Quick preview of items */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
            {pedido.items.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-1.5 bg-background/80 rounded-lg px-2 py-1 shrink-0"
              >
                <span className="text-[10px] font-bold text-primary">{item.cantidad}x</span>
                <span className="text-[11px] truncate max-w-[80px]">{item.nombre}</span>
              </div>
            ))}
            {pedido.items.length > 4 && (
              <div className="text-[11px] text-muted-foreground shrink-0 px-1">
                +{pedido.items.length - 4} más
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Header
// ============================================
function OrdersHeader() {
  return (
    <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-4 pt-12 pb-8 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

      <div className="relative flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="text-4xl mb-2"
        >
          📦
        </motion.div>
        <motion.h1
          className="text-xl font-bold text-white"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          Mis Pedidos
        </motion.h1>
        <motion.p
          className="text-white/60 text-sm mt-1"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          Seguí tus pedidos en tiempo real
        </motion.p>
      </div>
    </div>
  )
}

// ============================================
// Active Order Card
// ============================================
function ActiveOrderCard({ pedido, onTrackDelivery }: { pedido: Pedido; onTrackDelivery: (pedido: Pedido) => void }) {
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()

  const canCancel = (() => {
    if (pedido.estado !== "recibido" && pedido.estado !== "confirmado") return false
    const tolerancia = pedido.toleranciaCancelacion ?? 5
    if (tolerancia <= 0) return false // negocio doesn't allow cancellation
    const tiempoTranscurrido = Date.now() - new Date(pedido.fecha).getTime()
    const toleranciaMs = tolerancia * 60 * 1000
    return tiempoTranscurrido <= toleranciaMs
  })()
  const canConfirm = (pedido.estado === "listo_para_retirar" || pedido.estado === "en_camino") && !pedido.clienteConfirmaRecibido

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "cancelar" | "confirmar" }) => {
      const res = await fetch(`/api/cliente/pedidos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al procesar la acción")
      }
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cliente-pedidos"] })
      toast.success(
        variables.action === "cancelar"
          ? "Pedido cancelado"
          : "¡Recepción confirmada! El local será notificado."
      )
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Get current step index in timeline
  const currentStepIndex = TIMELINE_STEPS.findIndex((s) => s.key === pedido.estado)
  const isDelivery = pedido.metodoEntrega === "domicilio"

  // Adjust timeline: if pickup, skip "en_camino"
  const relevantSteps = isDelivery
    ? TIMELINE_STEPS
    : TIMELINE_STEPS.filter((s) => s.key !== "en_camino")
  const adjustedStepIndex = relevantSteps.findIndex((s) => s.key === pedido.estado)

  return (
    <SectionCard
      icon={Package}
      title={pedido.negocioNombre}
      badge={`${statusEmoji(pedido.estado)} ${statusLabel(pedido.estado)}`}
    >
      {/* Delivery method & time */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isDelivery ? (
            <Bike className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ShoppingBag className="h-3.5 w-3.5 text-primary" />
          )}
          <span className="font-medium">
            {isDelivery ? "Delivery" : "Retiro en local"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{timeAgo(new Date(pedido.fecha))}</span>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="mb-3">
        <div className="flex items-center justify-between relative">
          {/* Background line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted" />
          {/* Progress line */}
          <div
            className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-500"
            style={{
              width: adjustedStepIndex >= 0
                ? `${(adjustedStepIndex / (relevantSteps.length - 1)) * 100}%`
                : "0%",
            }}
          />

          {relevantSteps.map((step, i) => {
            const isCompleted = i <= adjustedStepIndex
            const isCurrent = i === adjustedStepIndex
            return (
              <div key={step.key} className="relative flex flex-col items-center z-10">
                <motion.div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all duration-300",
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-background border-muted-foreground/30 text-muted-foreground/50",
                    isCurrent && "ring-4 ring-primary/20 scale-110"
                  )}
                  initial={isCurrent ? { scale: 0.8 } : {}}
                  animate={isCurrent ? { scale: 1.1 } : {}}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {isCompleted ? step.emoji : (i + 1)}
                </motion.div>
                <span
                  className={cn(
                    "text-[9px] mt-1 font-medium text-center leading-tight",
                    isCompleted ? "text-foreground" : "text-muted-foreground/50"
                  )}
                >
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {pedido.items.reduce((s, i) => s + i.cantidad, 0)} producto{pedido.items.reduce((s, i) => s + i.cantidad, 0) !== 1 ? "s" : ""}
        </span>
        <span className="text-sm font-bold">{formatPrice(pedido.total)}</span>
      </div>

      {/* Cancel info */}
      {pedido.estado === "cancelado" && pedido.canceladoMotivo && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs mb-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {pedido.canceladoPor === "cliente" ? "Cancelaste este pedido" : "El negocio canceló este pedido"}
            {pedido.canceladoMotivo && `: ${pedido.canceladoMotivo}`}
          </span>
        </div>
      )}

      {/* Expand items */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-primary font-medium hover:bg-muted/50 rounded-lg transition-colors"
      >
        {expanded ? (
          <>
            Ocultar items
            <ChevronUp className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            Ver items
            <ChevronDown className="h-3.5 w-3.5" />
          </>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Separator className="opacity-50 my-2" />
            <ItemsList items={pedido.items} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Track delivery button */}
      {isDelivery && pedido.estado === "en_camino" && pedido.seguimientoDeliveryActivo !== false && (
        <>
          <Separator className="opacity-50 my-2" />
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => onTrackDelivery(pedido)}
          >
            <Navigation className="h-4 w-4" />
            🛵 Seguir delivery en vivo
          </Button>
        </>
      )}

      {/* Pickup: show store location when ready */}
      {!isDelivery && pedido.estado === "listo_para_retirar" && pedido.negocioLat && pedido.negocioLng && (
        <>
          <Separator className="opacity-50 my-2" />
          <a
            href={`https://www.google.com/maps?q=${pedido.negocioLat},${pedido.negocioLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/30 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Navigation className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">¡Listo para retirar!</p>
              <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">Ver ubicación del local en Google Maps</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          </a>
        </>
      )}

      {/* Action buttons */}
      {(canCancel || canConfirm) && (
        <>
          <Separator className="opacity-50 my-2" />
          <div className="flex gap-2">
            {canCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancelar pedido
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Cancelar pedido?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Si cancelás tu pedido de {pedido.negocioNombre}, el negocio será notificado.{" "}
                      {pedido.estado === "confirmado"
                        ? "Como el negocio ya confirmó tu pedido, la cancelación puede no ser aceptada."
                        : "El pedido será cancelado inmediatamente."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>No, seguir</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => actionMutation.mutate({ id: pedido.id, action: "cancelar" })}
                      disabled={actionMutation.isPending}
                    >
                      {actionMutation.isPending ? "Cancelando..." : "Sí, cancelar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canConfirm && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs flex-1"
                onClick={() => actionMutation.mutate({ id: pedido.id, action: "confirmar" })}
                disabled={actionMutation.isPending}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {actionMutation.isPending ? "Confirmando..." : "Confirmar recepción"}
              </Button>
            )}
            {pedido.clienteConfirmaRecibido && pedido.estado !== "entregado" && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                Recepción confirmada. Esperando confirmación del {pedido.metodoEntrega === "domicilio" ? "delivery" : "local"}.
              </div>
            )}
          </div>
        </>
      )}
    </SectionCard>
  )
}

// ============================================
// History Order Card
// ============================================
function HistoryOrderCard({
  pedido,
  onRepeat,
}: {
  pedido: Pedido
  onRepeat: (pedidoId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const queryClient = useQueryClient()

  const isCancelled = pedido.estado === "cancelado"
  const isDelivered = pedido.estado === "entregado"
  const isDelivery = pedido.metodoEntrega === "domicilio"

  return (
    <SectionCard
      icon={isCancelled ? XCircle : CheckCircle2}
      title={pedido.negocioNombre}
      badge={`${statusEmoji(pedido.estado)} ${statusLabel(pedido.estado)}`}
    >
      {/* Delivery method & time */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isDelivery ? (
            <Bike className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ShoppingBag className="h-3.5 w-3.5 text-primary" />
          )}
          <span className="font-medium">
            {isDelivery ? "Delivery" : "Retiro en local"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{timeAgo(new Date(pedido.fecha))}</span>
        </div>
      </div>

      {/* Cancel info */}
      {isCancelled && pedido.canceladoMotivo && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs mb-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {pedido.canceladoPor === "cliente" ? "Cancelaste este pedido" : "El negocio canceló este pedido"}
            {pedido.canceladoMotivo && `: ${pedido.canceladoMotivo}`}
          </span>
        </div>
      )}

      {/* Review indicator */}
      {pedido.resena && !isCancelled && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs mb-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-3.5 w-3.5",
                  i < pedido.resena!.puntuacion
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <span className="font-medium">Tu reseña</span>
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {pedido.items.reduce((s, i) => s + i.cantidad, 0)} producto{pedido.items.reduce((s, i) => s + i.cantidad, 0) !== 1 ? "s" : ""}
        </span>
        <span className="text-sm font-bold">{formatPrice(pedido.total)}</span>
      </div>

      {/* Expand items */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-primary font-medium hover:bg-muted/50 rounded-lg transition-colors"
      >
        {expanded ? (
          <>
            Ocultar items
            <ChevronUp className="h-3.5 w-3.5" />
          </>
        ) : (
          <>
            Ver items
            <ChevronDown className="h-3.5 w-3.5" />
          </>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <Separator className="opacity-50 my-2" />
            <ItemsList items={pedido.items} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {!isCancelled && (
        <>
          <Separator className="opacity-50 my-2" />
          <div className="flex gap-2">
            {/* Leave Review button */}
            {isDelivered && !pedido.resena && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs flex-1"
                onClick={() => setReviewOpen(true)}
              >
                <Star className="h-3.5 w-3.5" />
                Dejar reseña
              </Button>
            )}
            {/* Repeat order button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs flex-1"
              onClick={() => onRepeat(pedido.id)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Repetir
            </Button>
          </div>
        </>
      )}

      {/* Review Dialog */}
      <ReviewDialog
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        pedidoId={pedido.id}
        negocioNombre={pedido.negocioNombre}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["cliente-pedidos"] })}
      />
    </SectionCard>
  )
}

// ============================================
// Items List
// ============================================
function ItemsList({ items }: { items: PedidoItem[] }) {
  return (
    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
      {items.map((item) => {
        // Parse agregados
        let agregados: string[] = []
        try {
          const parsed = JSON.parse(item.agregados || "[]")
          agregados = Array.isArray(parsed) ? parsed.map((a: { nombre: string } | string) =>
            typeof a === "string" ? a : a.nombre
          ) : []
        } catch {
          agregados = []
        }

        // Parse secciones (options chosen from each section)
        let secciones: string[] = []
        try {
          const parsed = JSON.parse(item.secciones || "{}")
          if (typeof parsed === "object" && parsed !== null) {
            secciones = Object.entries(parsed).map(([section, value]) => {
              const val = value as Record<string, number> | string
              return typeof val === "string" ? val : Object.keys(val).join(", ")
            })
          }
        } catch {
          secciones = []
        }

        // Parse ingredientes quitados
        let ingredientesQuitados: string[] = []
        try {
          const parsed = JSON.parse(item.ingredientesQuitados || "[]")
          ingredientesQuitados = Array.isArray(parsed) ? parsed : []
        } catch {
          ingredientesQuitados = []
        }

        return (
          <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
              {item.cantidad}x
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.nombre}</p>
              {(item.talle || item.color) && (
                <p className="text-[11px] text-muted-foreground">
                  {[item.talle, item.color].filter(Boolean).join(" · ")}
                </p>
              )}
              {secciones.length > 0 && (
                <p className="text-[11px] text-primary/70">
                  {secciones.join(" · ")}
                </p>
              )}
              {agregados.length > 0 && (
                <p className="text-[11px] text-primary/70">
                  + {agregados.join(", ")}
                </p>
              )}
              {ingredientesQuitados.length > 0 && (
                <p className="text-[11px] text-red-500/70 dark:text-red-400/70">
                  Sin {ingredientesQuitados.join(", ")}
                </p>
              )}
            </div>
            <span className="text-xs font-semibold shrink-0">
              {formatPrice(item.precio * item.cantidad)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// Empty State
// ============================================
function EmptyState({
  emoji,
  title,
  description,
}: {
  emoji: string
  title: string
  description: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <span className="text-6xl mb-4">{emoji}</span>
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">{description}</p>
    </motion.div>
  )
}

// ============================================
// Section Card (reused from profile pattern)
// ============================================
function SectionCard({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: React.ElementType
  title: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold truncate max-w-[180px]">{title}</h2>
            </div>
          </div>
          {badge && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
              {badge}
            </Badge>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

// ============================================
// Loading Skeleton
// ============================================
function OrdersSkeleton() {
  return (
    <div className="flex-1 bg-background animate-pulse">
      <div className="bg-primary/20 px-4 pt-12 pb-8">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 rounded-full bg-white/10 mb-2" />
          <div className="mt-1 h-5 w-32 rounded bg-white/10" />
          <div className="mt-2 h-3 w-44 rounded bg-white/5" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pb-24">
        <div className="flex gap-1 bg-muted rounded-xl p-1 mb-4">
          <div className="flex-1 h-9 rounded-lg bg-background/50" />
          <div className="flex-1 h-9 rounded-lg" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-card border border-border/50 p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="flex gap-3 mb-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex items-center justify-between gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="flex flex-col items-center gap-1">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-2 w-10" />
                </div>
              ))}
            </div>
            <div className="flex justify-between mb-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-7 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
