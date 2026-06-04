"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Clock,
  Flame,
  CheckCircle2,
  X,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Bike,
  Package,
  UtensilsCrossed,
  Star,
  MessageSquare,
  Send,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"

// ============================================
// Types
// ============================================
interface NegocioInfo {
  id: string
  slug: string
  nombre: string
  colorPrincipal: string
  rubro: string
}

interface PedidoItem {
  id: string
  nombre: string
  cantidad: number
  precio: number
  agregados: Array<{ id?: string; nombre: string; precio: number }>
  secciones: Record<string, string | Record<string, number>>
  seccionesPrecios: Record<string, number>
  ingredientes: string[]
  ingredientesQuitados: string[]
  talle?: string
  color?: string
}

interface Pedido {
  id: string
  clienteNombre: string
  total: number
  metodoEntrega: string
  metodoPago: string
  estado: string
  mesaNumero: number | null
  empleadoNombre: string | null
  notas: string | null
  clienteConfirmaRecibido: boolean
  items: PedidoItem[]
  fecha: string
}

interface Resena {
  id: string
  clienteNombre: string
  puntuacion: number
  comentario: string
  rapidez: number | null
  calidad: number | null
  precio: number | null
  respuestaNegocio: string | null
  fechaRespuesta: string | null
  fecha: string
}

interface ResenasStats {
  promedio: number
  total: number
  sinRespuesta: number
  distribucion: Record<number, number>
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  recibido: { label: "Recibido", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50", icon: AlertCircle },
  preparando: { label: "Preparando", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50", icon: Flame },
  en_camino: { label: "En camino", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50", icon: Bike },
  listo_para_retirar: { label: "Listo", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50", icon: CheckCircle2 },
  entregado: { label: "Entregado", color: "text-muted-foreground", bg: "bg-muted/50 border-border/50", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "text-red-500 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50", icon: X },
}

const ENTREGA_LABELS: Record<string, { label: string; icon: typeof ShoppingBag }> = {
  retiro: { label: "Retiro", icon: Package },
  domicilio: { label: "Delivery", icon: Bike },
  mesa: { label: "Mesa", icon: UtensilsCrossed },
}

const REJECT_REASONS = [
  "Sin stock",
  "Cocina cerrada",
  "Horario no disponible",
  "Datos incorrectos",
  "Zona fuera de cobertura",
]

// ============================================
// Star Rating Component
// ============================================
function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5"
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, rating - star + 1))
        return (
          <div key={star} className={cn("relative", sizeClass)}>
            <Star className={cn("absolute inset-0 text-muted-foreground/20", sizeClass)} />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("text-amber-400 fill-amber-400", sizeClass)} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// Main Combined Employee Page
// ============================================
export default function EmpleadoCombinedPage() {
  const params = useParams()
  const token = params.token as string

  const [negocio, setNegocio] = useState<NegocioInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState<"pedidos" | "resenas">("pedidos")

  // Validate token & load negocio data
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/empleado/validate?token=${token}&type=empleados`)
        if (!res.ok) throw new Error("Token inválido")
        const data = await res.json()
        setNegocio(data.negocio)
      } catch {
        setError("Acceso denegado. Link inválido o fue regenerado.")
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [token])

  const color = negocio?.colorPrincipal || "#FB8C00"

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color }} />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (error || !negocio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-red-50 dark:bg-red-950/30">
            <X className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-lg font-bold mb-1">Acceso denegado</p>
          <p className="text-sm text-muted-foreground">{error || "Link inválido"}</p>
          <p className="text-xs text-muted-foreground mt-2">Pedile el link actualizado al jefe</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white"
              style={{ backgroundColor: color }}
            >
              {negocio.nombre.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{negocio.nombre}</p>
              <p className="text-xs text-muted-foreground">Panel de empleados</p>
            </div>
          </div>
        </div>

        {/* Main tabs: Pedidos / Reseñas */}
        <div className="flex px-4 gap-1">
          <button
            onClick={() => setMainTab("pedidos")}
            className={cn(
              "flex-1 py-2 text-sm font-semibold border-b-2 transition-all",
              mainTab === "pedidos"
                ? "border-current"
                : "border-transparent text-muted-foreground"
            )}
            style={mainTab === "pedidos" ? { color } : undefined}
          >
            <span className="flex items-center justify-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" />
              Pedidos
            </span>
          </button>
          <button
            onClick={() => setMainTab("resenas")}
            className={cn(
              "flex-1 py-2 text-sm font-semibold border-b-2 transition-all",
              mainTab === "resenas"
                ? "border-current"
                : "border-transparent text-muted-foreground"
            )}
            style={mainTab === "resenas" ? { color } : undefined}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Star className="h-3.5 w-3.5" />
              Reseñas
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      {mainTab === "pedidos" ? (
        <PedidosSection token={token} negocioId={negocio.id} color={color} />
      ) : (
        <ResenasSection token={token} negocioId={negocio.id} color={color} />
      )}
    </div>
  )
}

// ============================================
// Pedidos Section
// ============================================
function PedidosSection({ token, negocioId, color }: { token: string; negocioId: string; color: string }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [subTab, setSubTab] = useState<"activos" | "historial">("activos")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [rejectDialog, setRejectDialog] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const fetchPedidos = useCallback(async () => {
    try {
      const estado = subTab === "activos" ? "activos" : "historial"
      const res = await fetch(`/api/empleado/pedidos?token=${token}&type=empleados&estado=${estado}&limit=100`)
      if (res.ok) {
        const data = await res.json()
        setPedidos(data.pedidos)
      }
    } catch {
      // silent
    }
  }, [token, subTab])

  useEffect(() => {
    fetchPedidos()
  }, [fetchPedidos])

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(fetchPedidos, 10000)
    return () => clearInterval(interval)
  }, [fetchPedidos])

  const updateStatus = async (pedidoId: string, estado: string, motivo?: string) => {
    setUpdating(pedidoId)
    try {
      const res = await fetch(`/api/empleado/pedidos/${pedidoId}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type: "empleados", estado, motivo }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error actualizando")
      }
      await fetchPedidos()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error actualizando pedido")
    } finally {
      setUpdating(null)
      setRejectDialog(null)
      setRejectReason("")
    }
  }

  const getNextAction = (estado: string, metodoEntrega: string, clienteConfirmaRecibido: boolean): { label: string; nextEstado: string; color: string } | null => {
    const isDelivery = metodoEntrega === "domicilio"
    const isMesa = metodoEntrega === "mesa"
    switch (estado) {
      case "recibido": return { label: "Preparar", nextEstado: "preparando", color: "bg-orange-500 hover:bg-orange-600" }
      case "preparando": return isDelivery
        ? { label: "En camino", nextEstado: "en_camino", color: "bg-blue-500 hover:bg-blue-600" }
        : { label: "Listo", nextEstado: "listo_para_retirar", color: "bg-emerald-500 hover:bg-emerald-600" }
      case "en_camino":
        // Delivery: negocio/empleado CANNOT mark as entregado — client + repartidor handle that
        return null
      case "listo_para_retirar":
        // Mesa: negocio can mark as entregado directly
        if (isMesa) return { label: "Entregado", nextEstado: "entregado", color: "bg-primary hover:bg-primary/90" }
        // Pickup: only after client confirms receipt
        if (clienteConfirmaRecibido) return { label: "Entregado", nextEstado: "entregado", color: "bg-primary hover:bg-primary/90" }
        return null
      default: return null
    }
  }

  const activePedidos = pedidos.filter(p => ["recibido", "preparando", "en_camino", "listo_para_retirar"].includes(p.estado))
  const historyPedidos = pedidos.filter(p => ["entregado", "cancelado"].includes(p.estado))
  const displayedPedidos = subTab === "activos" ? activePedidos : historyPedidos

  return (
    <>
      {/* Sub-tabs */}
      <div className="flex px-4 pt-3 gap-1">
        <button
          onClick={() => setSubTab("activos")}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
            subTab === "activos"
              ? "text-white"
              : "bg-muted/50 dark:bg-muted/30 text-muted-foreground hover:bg-muted"
          )}
          style={subTab === "activos" ? { backgroundColor: color } : undefined}
        >
          Activos ({activePedidos.length})
        </button>
        <button
          onClick={() => setSubTab("historial")}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all",
            subTab === "historial"
              ? "text-white"
              : "bg-muted/50 dark:bg-muted/30 text-muted-foreground hover:bg-muted"
          )}
          style={subTab === "historial" ? { backgroundColor: color } : undefined}
        >
          Historial
        </button>
      </div>

      {/* Pedidos list */}
      <div className="px-4 py-3 space-y-3 pb-20">
        {displayedPedidos.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">
              {subTab === "activos" ? "Sin pedidos activos" : "Sin historial"}
            </p>
            {subTab === "activos" && (
              <p className="text-xs text-muted-foreground mt-1">Los nuevos pedidos aparecerán aquí</p>
            )}
          </div>
        ) : (
          displayedPedidos.map((pedido) => {
            const config = STATUS_CONFIG[pedido.estado]
            const entrega = ENTREGA_LABELS[pedido.metodoEntrega] || ENTREGA_LABELS.retiro
            const nextAction = getNextAction(pedido.estado, pedido.metodoEntrega, pedido.clienteConfirmaRecibido)
            const isExpanded = expandedId === pedido.id
            const isUpdating = updating === pedido.id
            const EntregaIcon = entrega.icon

            return (
              <div
                key={pedido.id}
                className={cn(
                  "rounded-2xl border overflow-hidden transition-all",
                  config?.bg || "bg-card border-border/50"
                )}
              >
                {/* Order header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : pedido.id)}
                  className="w-full p-3 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 dark:bg-primary/20"
                    >
                      {pedido.metodoEntrega === "mesa" ? (
                        <span className="text-sm font-bold text-primary">{pedido.mesaNumero}</span>
                      ) : (
                        <EntregaIcon className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{pedido.clienteNombre}</p>
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", config?.color, "bg-opacity-80 dark:bg-opacity-100", config?.bg)}>
                          {config?.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <EntregaIcon className="h-3 w-3" />
                          {entrega.label}
                          {pedido.mesaNumero ? ` ${pedido.mesaNumero}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatPrice(pedido.total)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {nextAction && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateStatus(pedido.id, nextAction.nextEstado)
                          }}
                          disabled={isUpdating}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all",
                            nextAction.color,
                            isUpdating && "opacity-50"
                          )}
                        >
                          {isUpdating ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            nextAction.label
                          )}
                        </button>
                      )}
                      {!nextAction && pedido.estado === "en_camino" && (
                        <span className="text-[10px] text-muted-foreground bg-muted/50 dark:bg-muted/30 px-2 py-1 rounded-lg whitespace-nowrap">
                          Esperando confirmación del cliente
                        </span>
                      )}
                      {!nextAction && pedido.estado === "listo_para_retirar" && !pedido.clienteConfirmaRecibido && (
                        <span className="text-[10px] text-muted-foreground bg-muted/50 dark:bg-muted/30 px-2 py-1 rounded-lg whitespace-nowrap">
                          Esperando confirmación del cliente
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border/30 pt-2">
                    <div className="space-y-2 mb-3">
                      {pedido.items.map((item) => {
                        const hasDetails = (item.agregados?.length > 0) || (Object.keys(item.secciones || {}).length > 0) || (item.ingredientesQuitados?.length > 0) || item.talle || item.color
                        return (
                          <div key={item.id}>
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold bg-muted rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                                {item.cantidad}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium">{item.nombre}</p>
                              </div>
                              <span className="text-xs font-medium">{formatPrice(item.precio * item.cantidad)}</span>
                            </div>
                            {hasDetails && (
                              <div className="ml-7 mt-1 space-y-1">
                                {/* Talle / Color */}
                                {(item.talle || item.color) && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.talle && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-medium">Talle: {item.talle}</span>
                                    )}
                                    {item.color && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-medium">Color: {item.color}</span>
                                    )}
                                  </div>
                                )}
                                {/* Secciones (opciones elegidas) */}
                                {Object.keys(item.secciones || {}).length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(item.secciones).map(([k, v]) => {
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
                                )}
                                {/* Agregados */}
                                {item.agregados?.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.agregados.map((a, i) => (
                                      <span key={a.id ?? i} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 font-medium">
                                        + {a.nombre}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* Ingredientes quitados */}
                                {item.ingredientesQuitados?.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.ingredientesQuitados.map((ing, i) => (
                                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 font-medium">
                                        Sin {ing}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-t border-border/30">
                      <span className="text-xs font-bold">Total</span>
                      <span className="text-sm font-bold">{formatPrice(pedido.total)}</span>
                    </div>

                    {pedido.notas && (
                      <div className="mt-2 p-2 rounded-lg bg-muted/50 dark:bg-muted/30">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Notas</p>
                        <p className="text-xs">{pedido.notas}</p>
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        Pago: {pedido.metodoPago === "efectivo" ? "Efectivo" : "Transferencia"}
                      </span>
                    </div>

                    {["recibido", "preparando", "en_camino", "listo_para_retirar"].includes(pedido.estado) && (
                      <div className="flex gap-2 mt-3">
                        {nextAction && (
                          <button
                            onClick={() => updateStatus(pedido.id, nextAction.nextEstado)}
                            disabled={isUpdating}
                            className={cn(
                              "flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all",
                              nextAction.color,
                              isUpdating && "opacity-50"
                            )}
                          >
                            {isUpdating ? "Actualizando..." : nextAction.label}
                          </button>
                        )}
                        <button
                          onClick={() => setRejectDialog(pedido.id)}
                          disabled={isUpdating}
                          className="px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-all"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Reject dialog */}
                {rejectDialog === pedido.id && (
                  <div className="px-3 pb-3">
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
                      <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">Motivo de rechazo</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {REJECT_REASONS.map((reason) => (
                          <button
                            key={reason}
                            onClick={() => setRejectReason(reason)}
                            className={cn(
                              "px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border",
                              rejectReason === reason
                                ? "bg-red-200 dark:bg-red-800 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200"
                                : "bg-white dark:bg-red-950/50 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:border-red-300"
                            )}
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Otro motivo..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs border border-red-200 dark:border-red-800/50 bg-white dark:bg-red-950/30 mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setRejectDialog(null); setRejectReason("") }}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground bg-white dark:bg-muted/50 border border-border/50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => updateStatus(pedido.id, "cancelado", rejectReason)}
                          disabled={!rejectReason.trim() || isUpdating}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

// ============================================
// Reseñas Section
// ============================================
function ResenasSection({ token, color }: { token: string; negocioId: string; color: string }) {
  const [resenas, setResenas] = useState<Resena[]>([])
  const [stats, setStats] = useState<ResenasStats | null>(null)
  const [filtro, setFiltro] = useState<"todas" | "sin_respuesta" | "con_respuesta">("todas")
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchResenas = useCallback(async () => {
    try {
      const res = await fetch(`/api/empleado/resenas?token=${token}&type=empleados&filtro=${filtro}&page=${page}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setResenas(data.resenas)
        setStats(data.stats)
        setTotalPages(data.pagination.totalPages)
      }
    } catch {
      // silent
    }
  }, [token, filtro, page])

  useEffect(() => {
    fetchResenas()
  }, [fetchResenas])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchResenas, 30000)
    return () => clearInterval(interval)
  }, [fetchResenas])

  const replyToReview = async (resenaId: string) => {
    if (!replyText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/empleado/resenas/${resenaId}/responder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type: "empleados", respuestaNegocio: replyText }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error respondiendo")
      }
      setReplyingId(null)
      setReplyText("")
      await fetchResenas()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error respondiendo")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Stats bar */}
      {stats && stats.total > 0 && (
        <div className="px-4 pt-3 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <StarRating rating={stats.promedio} size="sm" />
            <span className="text-sm font-bold">{stats.promedio}</span>
          </div>
          <span className="text-xs text-muted-foreground">({stats.total} reseñas)</span>
          {stats.sinRespuesta > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ml-auto"
              style={{ backgroundColor: color }}
            >
              {stats.sinRespuesta} sin responder
            </span>
          )}
        </div>
      )}

      {/* Filter pills */}
      <div className="flex px-4 pt-2 gap-1.5">
        {[
          { value: "todas" as const, label: "Todas" },
          { value: "sin_respuesta" as const, label: "Sin respuesta" },
          { value: "con_respuesta" as const, label: "Respondidas" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => { setFiltro(f.value); setPage(1) }}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all",
              filtro === f.value
                ? "text-white"
                : "bg-muted/50 dark:bg-muted/30 text-muted-foreground hover:bg-muted"
            )}
            style={filtro === f.value ? { backgroundColor: color } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Reseñas list */}
      <div className="px-4 py-3 space-y-3 pb-20">
        {resenas.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">Sin reseñas</p>
            <p className="text-xs text-muted-foreground mt-1">Las reseñas aparecerán cuando los clientes las dejen</p>
          </div>
        ) : (
          resenas.map((resena) => (
            <div
              key={resena.id}
              className="rounded-2xl border border-border/50 bg-card p-4 space-y-2"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{resena.clienteNombre}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRating rating={resena.puntuacion} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {new Date(resena.fecha).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
                {!resena.respuestaNegocio ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                    Sin respuesta
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                    Respondida
                  </span>
                )}
              </div>

              {/* Comment */}
              {resena.comentario && (
                <p className="text-xs text-foreground/80 leading-relaxed">{resena.comentario}</p>
              )}

              {/* Sub-ratings */}
              {(resena.rapidez || resena.calidad || resena.precio) && (
                <div className="flex gap-4">
                  {resena.rapidez && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Rapidez</span>
                      <StarRating rating={resena.rapidez} size="sm" />
                    </div>
                  )}
                  {resena.calidad && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Calidad</span>
                      <StarRating rating={resena.calidad} size="sm" />
                    </div>
                  )}
                  {resena.precio && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Precio</span>
                      <StarRating rating={resena.precio} size="sm" />
                    </div>
                  )}
                </div>
              )}

              {/* Existing reply */}
              {resena.respuestaNegocio && (
                <div className="p-2.5 rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Respuesta del negocio</span>
                  </div>
                  <p className="text-xs text-foreground/80">{resena.respuestaNegocio}</p>
                </div>
              )}

              {/* Reply form */}
              {replyingId === resena.id ? (
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Escribí tu respuesta..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-border/50 bg-background dark:bg-input/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setReplyingId(null); setReplyText("") }}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-muted-foreground bg-muted/50 dark:bg-muted/30"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => replyToReview(resena.id)}
                      disabled={!replyText.trim() || submitting}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 flex items-center justify-center gap-1"
                      style={{ backgroundColor: color }}
                    >
                      {submitting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-3 w-3" />
                          Responder
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                !resena.respuestaNegocio && (
                  <button
                    onClick={() => { setReplyingId(resena.id); setReplyText("") }}
                    className="w-full py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 text-primary bg-primary/10 dark:bg-primary/20"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Responder
                  </button>
                )
              )}
            </div>
          ))
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl bg-muted/50 dark:bg-muted/30 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl bg-muted/50 dark:bg-muted/30 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
