"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import {
  Clock,
  Flame,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Armchair,
  MapPin,
  Users,
  UserCheck,
  RefreshCw,
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

interface MesaInfo {
  id: string
  numero: number
  nombre: string
  zona: string
  capacidad: number
  activa: boolean
  empleadoId: string | null
  empleado?: { id: string; nombre: string; codigo: string } | null
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
  items: PedidoItem[]
  fecha: string
}

const MESA_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  recibido: { label: "Recibido", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: AlertCircle },
  preparando: { label: "Preparando", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800", icon: Flame },
  listo_para_retirar: { label: "Listo para servir", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", icon: CheckCircle2 },
  entregado: { label: "Entregado", color: "text-muted-foreground", bg: "bg-muted/30 border-border/30", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800", icon: X },
}

// ============================================
// Main Salon Shared Page
// ============================================
export default function SalonSharedPage() {
  const params = useParams()
  const token = params.token as string

  const [negocio, setNegocio] = useState<NegocioInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/salon/public?token=${token}`)
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
          <p className="text-sm text-muted-foreground">Cargando salón...</p>
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
              <p className="text-xs text-muted-foreground">Vista del salón</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <SalonView token={token} negocio={negocio} color={color} />
    </div>
  )
}

// ============================================
// Salon View — Mesa grid with orders
// ============================================
function SalonView({ token, negocio, color }: { token: string; negocio: NegocioInfo; color: string }) {
  const [mesas, setMesas] = useState<MesaInfo[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMesa, setExpandedMesa] = useState<number | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/salon/public?token=${token}`)
      if (res.ok) {
        const data = await res.json()
        setMesas(data.mesas)
        setPedidos(data.pedidos)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Build a map of mesaNumero → active orders
  const mesaOrdersMap = useMemo(() => {
    const map = new Map<number, Pedido[]>()
    for (const order of pedidos) {
      const num = order.mesaNumero
      if (!num) continue
      if (!map.has(num)) map.set(num, [])
      map.get(num)!.push(order)
    }
    return map
  }, [pedidos])

  // Get the worst (most urgent) status for a mesa
  const getMesaWorstStatus = (mesaNumero: number): string | null => {
    const orders = mesaOrdersMap.get(mesaNumero)
    if (!orders || orders.length === 0) return null
    const priority = ["recibido", "preparando", "listo_para_retirar"]
    for (const status of priority) {
      if (orders.some((o) => o.estado === status)) return status
    }
    return null
  }

  const updateStatus = async (pedidoId: string, estado: string) => {
    setUpdating(pedidoId)
    try {
      const res = await fetch(`/api/salon/pedidos/${pedidoId}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, estado }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error actualizando")
      }
      await fetchData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error actualizando pedido")
    } finally {
      setUpdating(null)
    }
  }

  const getNextAction = (estado: string): { label: string; nextEstado: string; color: string } | null => {
    switch (estado) {
      case "recibido": return { label: "Preparar", nextEstado: "preparando", color: "bg-orange-500 hover:bg-orange-600" }
      case "preparando": return { label: "Listo", nextEstado: "listo_para_retirar", color: "bg-emerald-500 hover:bg-emerald-600" }
      case "listo_para_retirar": return { label: "Entregado", nextEstado: "entregado", color: "bg-primary hover:bg-primary/90" }
      default: return null
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  // Group mesas by zona
  const zonaGroups = useMemo(() => {
    const groups = new Map<string, MesaInfo[]>()
    for (const mesa of mesas) {
      const key = mesa.zona || ""
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(mesa)
    }
    const sorted = [...groups.keys()].sort((a, b) => {
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b)
    })
    return sorted.map((zona) => ({ zona, mesas: groups.get(zona)! }))
  }, [mesas])

  // Status summary counts
  const statusCounts = useMemo(() => ({
    recibido: pedidos.filter(o => o.estado === "recibido").length,
    preparando: pedidos.filter(o => o.estado === "preparando").length,
    listo_para_retirar: pedidos.filter(o => o.estado === "listo_para_retirar").length,
  }), [pedidos])

  const mesasConPedidos = mesaOrdersMap.size

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-3">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-4 pb-20">
      {/* Status summary bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {statusCounts.recibido} nuevos
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
            {statusCounts.preparando} preparando
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {statusCounts.listo_para_retirar} listos
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Armchair className="h-3.5 w-3.5" />
            {mesasConPedidos}/{mesas.length} con pedidos
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Actualizar"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Mesa grid grouped by zona */}
      {zonaGroups.length > 0 ? (
        zonaGroups.map(({ zona, mesas: zoneMesas }) => (
          <div key={zona || "__no_zona__"}>
            {zona && (
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">{zona}</span>
                <span className="text-[10px] text-muted-foreground/60">({zoneMesas.length})</span>
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {zoneMesas.map((mesa) => {
                const status = getMesaWorstStatus(mesa.numero)
                const orders = mesaOrdersMap.get(mesa.numero) ?? []
                const hasOrders = orders.length > 0
                const isExpanded = expandedMesa === mesa.numero

                return (
                  <div key={mesa.id} className="col-span-1">
                    <button
                      onClick={() => setExpandedMesa(isExpanded ? null : mesa.numero)}
                      className={cn(
                        "w-full relative flex flex-col items-center justify-center aspect-square rounded-2xl border-2 transition-all duration-300 cursor-pointer group",
                        !status && "border-border/50 bg-card hover:border-primary/30 hover:shadow-md",
                        status === "recibido" && "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 shadow-md shadow-amber-200/50 dark:shadow-amber-900/30",
                        status === "preparando" && "border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-950/30 shadow-md shadow-orange-200/50 dark:shadow-orange-900/30",
                        status === "listo_para_retirar" && "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 shadow-md shadow-emerald-200/50 dark:shadow-emerald-900/30",
                      )}
                    >
                      {status === "recibido" && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                        </span>
                      )}
                      <span className={cn(
                        "text-2xl font-extrabold leading-none",
                        !status && "text-foreground/80",
                        status === "recibido" && "text-amber-700 dark:text-amber-300",
                        status === "preparando" && "text-orange-700 dark:text-orange-300",
                        status === "listo_para_retirar" && "text-emerald-700 dark:text-emerald-300",
                      )}>
                        {mesa.numero}
                      </span>
                      {mesa.nombre && (
                        <span className={cn(
                          "text-[10px] font-medium mt-0.5 truncate max-w-[90%]",
                          !status && "text-muted-foreground",
                          status === "recibido" && "text-amber-600 dark:text-amber-400",
                          status === "preparando" && "text-orange-600 dark:text-orange-400",
                          status === "listo_para_retirar" && "text-emerald-600 dark:text-emerald-400",
                        )}>
                          {mesa.nombre}
                        </span>
                      )}
                      {!hasOrders && !mesa.empleado && (
                        <span className="text-[9px] text-muted-foreground mt-1 flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" />
                          {mesa.capacidad}
                        </span>
                      )}
                      {mesa.empleado && (
                        <span className="text-[9px] mt-1 flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-semibold">
                          <UserCheck className="h-2.5 w-2.5" />
                          {mesa.empleado.nombre.split(" ")[0]}
                        </span>
                      )}
                      {hasOrders && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            status === "recibido" && "bg-amber-200/60 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200",
                            status === "preparando" && "bg-orange-200/60 dark:bg-orange-800/40 text-orange-800 dark:text-orange-200",
                            status === "listo_para_retirar" && "bg-emerald-200/60 dark:bg-emerald-800/40 text-emerald-800 dark:text-emerald-200",
                          )}>
                            {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100">
                        <span className="text-[9px] font-semibold text-muted-foreground flex items-center gap-0.5">
                          {isExpanded ? "Cerrar" : "Ver"} {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Expanded mesa orders - shown below the grid for the selected mesa */}
            {zoneMesas.some(m => m.numero === expandedMesa) && (() => {
              const mesa = zoneMesas.find(m => m.numero === expandedMesa)!
              const orders = mesaOrdersMap.get(expandedMesa!) ?? []
              return (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {mesa.numero}
                    </div>
                    <span className="text-sm font-semibold">
                      Mesa {mesa.numero}
                      {mesa.nombre ? ` — ${mesa.nombre}` : ""}
                    </span>
                    {mesa.empleado && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold">
                        {mesa.empleado.nombre}
                      </span>
                    )}
                  </div>

                  {orders.length === 0 ? (
                    <div className="text-center py-6 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
                      <Armchair className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">Sin pedidos activos</p>
                    </div>
                  ) : (
                    orders.map((pedido) => {
                      const config = MESA_STATUS_CONFIG[pedido.estado]
                      const nextAction = getNextAction(pedido.estado)
                      const isUpdating = updating === pedido.id

                      return (
                        <div
                          key={pedido.id}
                          className={cn(
                            "rounded-2xl border overflow-hidden transition-all",
                            config?.bg || "bg-card border-border/50"
                          )}
                        >
                          {/* Order header */}
                          <div className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold truncate">{pedido.clienteNombre}</p>
                                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", config?.color, config?.bg)}>
                                    {config?.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">
                                    {formatPrice(pedido.total)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(pedido.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              </div>
                              {nextAction && (
                                <button
                                  onClick={() => updateStatus(pedido.id, nextAction.nextEstado)}
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
                            </div>
                          </div>

                          {/* Items detail */}
                          <div className="px-3 pb-3 border-t border-border/30 pt-2">
                            <div className="space-y-2">
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
                                        {(item.talle || item.color) && (
                                          <div className="flex flex-wrap gap-1">
                                            {item.talle && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-medium">Talle: {item.talle}</span>}
                                            {item.color && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted font-medium">Color: {item.color}</span>}
                                          </div>
                                        )}
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
                                              return <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{display}</span>
                                            })}
                                          </div>
                                        )}
                                        {item.agregados?.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {item.agregados.map((a, i) => (
                                              <span key={a.id ?? i} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 font-medium">+ {a.nombre}{a.precio > 0 ? ` ($${a.precio})` : ""}</span>
                                            ))}
                                          </div>
                                        )}
                                        {item.ingredientesQuitados?.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {item.ingredientesQuitados.map((ing, i) => (
                                              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 font-medium">Sin {ing}</span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>

                            <div className="flex justify-between items-center py-1.5 border-t border-border/30 mt-2">
                              <span className="text-xs font-bold">Total</span>
                              <span className="text-sm font-bold">{formatPrice(pedido.total)}</span>
                            </div>

                            {pedido.notas && (
                              <div className="mt-2 p-2 rounded-lg bg-muted/50">
                                <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Notas</p>
                                <p className="text-xs">{pedido.notas}</p>
                              </div>
                            )}

                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">
                                Pago: {pedido.metodoPago === "efectivo" ? "Efectivo" : "Transferencia"}
                              </span>
                            </div>

                            {["recibido", "preparando", "listo_para_retirar"].includes(pedido.estado) && (
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
                                  onClick={() => {
                                    if (confirm("¿Cancelar este pedido?")) {
                                      updateStatus(pedido.id, "cancelado")
                                    }
                                  }}
                                  disabled={isUpdating}
                                  className="px-4 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-all"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )
            })()}
          </div>
        ))
      ) : (
        <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
          <Armchair className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-muted-foreground">Sin mesas activas</p>
          <p className="text-xs text-muted-foreground mt-1">No hay mesas configuradas en el salón</p>
        </div>
      )}
    </div>
  )
}
