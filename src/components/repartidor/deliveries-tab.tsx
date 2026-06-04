"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  Lock,
  Navigation,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Banknote,
  CreditCard,
  Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn, formatPrice, timeAgo, statusLabel } from "@/lib/utils"
import { useRepartidorStore } from "@/store/repartidor-store"
import { useRepartidorTracking } from "@/hooks/use-repartidor-tracking"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface PedidoItem {
  id: string
  nombre: string
  precio: number
  cantidad: number
  agregados: Array<{ id?: string; nombre: string; precio: number }>
  secciones: Record<string, string | Record<string, number>>
  seccionesPrecios: Record<string, number>
  ingredientes: string[]
  ingredientesQuitados: string[]
  talle: string
  color: string
  producto?: { id: string; nombre: string; imagenUrl: string | null }
}

interface PedidoDelivery {
  id: string
  negocioId: string
  negocioSlug: string
  negocioNombre: string
  clienteNombre: string
  total: number
  totalProductos: number
  tarifaServicio: number
  precioDelivery: number
  metodoEntrega: string
  metodoPago: string
  direccion: string | null
  referencia: string | null
  lat: number | null
  lng: number | null
  notas: string | null
  estado: string
  clienteConfirmaRecibido: boolean
  clienteConfirmaFecha: string | null
  fecha: string
  items: PedidoItem[]
  negocio: {
    id: string
    nombre: string
    slug: string
    logoUrl: string | null
    colorPrincipal: string
  }
}

interface DeliveriesTabProps {
  pedidos: PedidoDelivery[]
  isLoading: boolean
  onRefresh: () => void
}

// ============================================
// Deliveries Tab
// ============================================
export function DeliveriesTab({ pedidos, isLoading, onRefresh }: DeliveriesTabProps) {
  const { trackingActive } = useRepartidorTracking(pedidos)

  if (isLoading) {
    return <DeliveriesSkeleton />
  }

  if (pedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-5xl mb-4">🛵</span>
        <h3 className="font-bold text-lg">Sin entregas activas</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Cuando un local marque un pedido como &quot;en camino&quot;, aparecerá acá.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
          onClick={onRefresh}
        >
          <Package className="h-4 w-4" />
          Actualizar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          {pedidos.length} entrega{pedidos.length !== 1 ? "s" : ""} en camino
        </p>
        {trackingActive && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Compartiendo ubicación
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {pedidos.map((pedido) => (
          <DeliveryCard key={pedido.id} pedido={pedido} />
        ))}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// Delivery Card
// ============================================
function DeliveryCard({ pedido }: { pedido: PedidoDelivery }) {
  const [expanded, setExpanded] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const queryClient = useQueryClient()
  const triggerRefresh = useRepartidorStore((s) => s.triggerRefresh)

  const deliverMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/repartidor/pedidos/${pedido.id}/entregar`, {
        method: "PUT",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al entregar")
      return data
    },
    onMutate: () => setDelivering(true),
    onSuccess: () => {
      toast.success("Pedido entregado", {
        description: `Pedido de ${pedido.clienteNombre} marcado como entregado`,
      })
      triggerRefresh()
      queryClient.invalidateQueries({ queryKey: ["repartidor-pedidos"] })
      queryClient.invalidateQueries({ queryKey: ["repartidor-entregados-hoy"] })
    },
    onError: (error: Error) => {
      toast.error("Error al entregar", {
        description: error.message,
      })
    },
    onSettled: () => setDelivering(false),
  })

  // Google Maps link
  const mapsUrl =
    pedido.lat && pedido.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${pedido.lat},${pedido.lng}`
      : pedido.direccion
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pedido.direccion)}`
        : null

  const isConfirmed = pedido.clienteConfirmaRecibido

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl bg-card border border-border/50 overflow-hidden shadow-sm"
    >
      {/* Negocio header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          background: `linear-gradient(135deg, ${pedido.negocio.colorPrincipal}15, ${pedido.negocio.colorPrincipal}08)`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-background/50 flex items-center justify-center shrink-0">
            {pedido.negocio.logoUrl ? (
              <img
                src={pedido.negocio.logoUrl}
                alt={pedido.negocio.nombre}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-sm font-bold" style={{ color: pedido.negocio.colorPrincipal }}>
                {pedido.negocio.nombre.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{pedido.negocio.nombre}</p>
            <p className="text-[10px] text-muted-foreground">{timeAgo(new Date(pedido.fecha))}</p>
          </div>
        </div>
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0 text-xs font-semibold gap-1">
          🛵 En camino
        </Badge>
      </div>

      {/* Client info */}
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">👤</span>
            <span className="text-sm font-semibold">{pedido.clienteNombre}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {pedido.metodoPago === "efectivo" ? (
              <Badge variant="secondary" className="text-[10px] gap-1 border-0">
                <Banknote className="h-3 w-3" />
                Efectivo
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] gap-1 border-0">
                <CreditCard className="h-3 w-3" />
                Transferencia
              </Badge>
            )}
          </div>
        </div>

        {/* Items preview */}
        <div className="space-y-1">
          {pedido.items.slice(0, expanded ? undefined : 3).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {item.cantidad}x {item.nombre}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatPrice(item.precio * item.cantidad)}
              </span>
            </div>
          ))}
          {!expanded && pedido.items.length > 3 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-primary font-semibold hover:underline"
            >
              +{pedido.items.length - 3} item{pedido.items.length - 3 > 1 ? "s" : ""} más
            </button>
          )}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="font-bold text-base">{formatPrice(pedido.total)}</span>
        </div>

        {/* Delivery address */}
        {pedido.direccion && (
          <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{pedido.direccion}</p>
                {pedido.referencia && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    📍 {pedido.referencia}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {pedido.notas && (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 flex items-start gap-2">
            <MessageSquare className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200">{pedido.notas}</p>
          </div>
        )}

        <Separator className="opacity-50" />

        {/* Client confirmation status */}
        <div
          className={cn(
            "rounded-xl p-3 flex items-center gap-2",
            isConfirmed
              ? "bg-emerald-500/10"
              : "bg-amber-500/10"
          )}
        >
          {isConfirmed ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                El cliente confirmó que recibió el pedido
              </p>
            </>
          ) : (
            <>
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                Esperando que el cliente confirme la recepción
              </p>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button
                variant="outline"
                className="w-full gap-2 rounded-xl h-10"
              >
                <Navigation className="h-4 w-4" />
                Navegar
              </Button>
            </a>
          )}

          {isConfirmed ? (
            <Button
              className="flex-1 gap-2 rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={() => deliverMutation.mutate()}
              disabled={delivering}
            >
              <CheckCircle2 className="h-4 w-4" />
              {delivering ? "Entregando..." : "✅ Entregado"}
            </Button>
          ) : (
            <Button
              className="flex-1 gap-2 rounded-xl h-10"
              variant="secondary"
              disabled
            >
              <Lock className="h-4 w-4" />
              Esperando confirmación
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// Skeleton
// ============================================
function DeliveriesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-card border border-border/50 overflow-hidden animate-pulse"
        >
          <div className="h-12 bg-muted/50" />
          <div className="p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-24 rounded bg-muted/50" />
              <div className="h-5 w-16 rounded bg-muted/50" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-muted/30" />
              <div className="h-3 w-3/4 rounded bg-muted/30" />
            </div>
            <div className="h-16 rounded-xl bg-muted/30" />
            <div className="h-8 rounded-xl bg-muted/30" />
            <div className="flex gap-2">
              <div className="flex-1 h-10 rounded-xl bg-muted/30" />
              <div className="flex-1 h-10 rounded-xl bg-muted/30" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
