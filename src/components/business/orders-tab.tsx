"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Clock,
  Bike,
  PackageCheck,
  XCircle,
  ChevronRight,
  Banknote,
  CreditCard,
  MapPin,
  StickyNote,
  Filter,
  ClipboardList,
  CheckCircle2,
  Armchair,
  User,
  Link2,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Flag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { cn, formatPrice, timeAgo, statusLabel, statusEmoji } from "@/lib/utils"
import { toast } from "sonner"
import { TAB_COUNTS_KEY } from "./business-panel"

// ============================================
// Types
// ============================================
interface OrdersTabProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
  }
}

type SubTab = "activos" | "historial"

interface Pedido {
  id: string
  clienteId: string | null
  clienteNombre: string
  total: number
  totalProductos: number
  tarifaServicio: number
  precioDelivery: number
  metodoEntrega: string
  metodoPago: string
  direccion: string | null
  referencia: string | null
  notas: string | null
  estado: string
  fecha: string
  clienteConfirmaRecibido: boolean
  mesaNumero: number | null
  empleadoNombre: string | null
  items: PedidoItemData[]
}

interface DenunciaWarning {
  count: number
  denuncias: Array<{ motivoTipo: string; motivo: string; negocioNombre: string; fecha: string }>
}

interface PedidoItemData {
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

// Robust client-side JSON parser for order item fields
function parseItemField(value: unknown, fallback: unknown) {
  if (!value) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value
}

const activeStatuses = ["recibido", "preparando", "en_camino", "listo_para_retirar"]
const historyStatuses = ["entregado", "cancelado"]

const rejectReasonsRestaurant = [
  "Sin stock de un producto",
  "Local cerrado",
  "Demasiados pedidos",
  "Datos incorrectos",
  "Otro motivo",
]

const rejectReasonsRopa = [
  "Sin stock del talle/color",
  "Producto discontinuado",
  "Local cerrado",
  "Datos incorrectos",
  "Otro motivo",
]

// ============================================
// Orders Tab Component
// ============================================
export function OrdersTab({ negocio }: OrdersTabProps) {
  const queryClient = useQueryClient()
  const isRopa = negocio.rubro === "ropa"
  const isNegocio = negocio.rubro === "negocio"
  const isRestaurante = !isRopa && !isNegocio
  const [subTab, setSubTab] = useState<SubTab>("activos")
  const [selectedOrder, setSelectedOrder] = useState<Pedido | null>(null)
  const [rejectDialog, setRejectDialog] = useState<Pedido | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [customReason, setCustomReason] = useState("")
  const [filterStatus, setFilterStatus] = useState("todos")

  // Denuncia dialog state
  const [denunciaDialog, setDenunciaDialog] = useState<Pedido | null>(null)
  const [denunciaMotivoTipo, setDenunciaMotivoTipo] = useState("")
  const [denunciaMotivoCustom, setDenunciaMotivoCustom] = useState("")
  const [denunciando, setDenunciando] = useState(false)

  // Shared employee link state
  const [tokenEmpleados, setTokenEmpleados] = useState<string | null>(null)
  const [tokenEmpleadosMasked, setTokenEmpleadosMasked] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const hasEmployeeLinkMetadata = !!tokenEmpleados || !!tokenEmpleadosMasked

  useEffect(() => {
    fetch("/api/negocio/access-tokens")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          const revealed = data.tokenEmpleadosRevealed === true
          setTokenEmpleados(revealed ? data.tokenEmpleados : null)
          setTokenEmpleadosMasked(data.tokenEmpleadosMasked ?? (revealed ? data.tokenEmpleados : null))
        }
      })
      .catch(() => {})
  }, [])

  const copySharedLink = async () => {
    if (!tokenEmpleados) {
      await regenerateToken()
      return
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/e/${tokenEmpleados}`)
      setCopiedLink(true)
      toast.success("Link de empleados copiado")
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  const regenerateToken = async () => {
    setRegenerating(true)
    try {
      const res = await fetch("/api/negocio/access-tokens", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setTokenEmpleados(data.tokenEmpleados)
        setTokenEmpleadosMasked(data.tokenEmpleadosMasked ?? data.tokenEmpleados)
        toast.success("Link regenerado. El link anterior ya no funciona.")
      } else {
        toast.error("Error al regenerar el link")
      }
    } catch {
      toast.error("Error al regenerar el link")
    } finally {
      setRegenerating(false)
    }
  }

  // Fetch orders
  const { data: pedidos = [], isLoading } = useQuery<Pedido[]>({
    queryKey: ["negocio-pedidos", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/pedidos?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando pedidos")
      const json = await res.json()
      // Store denuncia warnings separately
      if (json.denunciaWarnings) {
        denunciaWarningsRef.current = json.denunciaWarnings
      }
      return json.data ?? json.pedidos ?? json
    },
    refetchInterval: 15000,
  })

  // Denuncia warnings ref (populated from API response)
  const denunciaWarningsRef = useRef<Record<string, DenunciaWarning>>({})

  // When orders data refreshes (e.g. new order from customer), also refresh tab counts
  const prevActiveCountRef = useRef(-1)
  useEffect(() => {
    const activeCount = pedidos.filter((p) => activeStatuses.includes(p.estado) && p.metodoEntrega !== "mesa").length
    if (prevActiveCountRef.current !== -1 && activeCount !== prevActiveCountRef.current) {
      queryClient.invalidateQueries({ queryKey: [TAB_COUNTS_KEY] })
    }
    prevActiveCountRef.current = activeCount
  }, [pedidos, queryClient])

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, estado, motivo }: { id: string; estado: string; motivo?: string }) => {
      const res = await fetch(`/api/negocio/pedidos/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, motivo, negocioId: negocio.id }),
      })
      if (!res.ok) throw new Error("Error actualizando estado")
      return res.json()
    },
    onSuccess: (updatedPedido, variables) => {
      // Immediately update the order in cache
      queryClient.setQueryData<Pedido[]>(["negocio-pedidos", negocio.id], (old) =>
        old ? old.map((p) => p.id === variables.id ? { ...p, ...updatedPedido } : p) : old
      )
      // Also invalidate for full consistency
      queryClient.invalidateQueries({ queryKey: ["negocio-pedidos", negocio.id] })
      // Invalidate tab counts so Pedidos badge updates instantly
      queryClient.invalidateQueries({ queryKey: [TAB_COUNTS_KEY] })
      // Invalidate salon stats so Estadísticas sub-tab updates when orders are delivered
      queryClient.invalidateQueries({ queryKey: ["salon-stats", negocio.id] })
      if (variables.estado === "cancelado") {
        toast.success("Pedido rechazado")
        setRejectDialog(null)
      } else {
        toast.success(`Pedido ${statusLabel(variables.estado).toLowerCase()}`)
      }
    },
    onError: () => {
      toast.error("Error al actualizar el pedido")
    },
  })

  // Derived data — mesa orders go to Salon tab only
  const nonMesaOrders = pedidos.filter((p) => p.metodoEntrega !== "mesa")

  const activeOrders = nonMesaOrders.filter((p) => activeStatuses.includes(p.estado))
  const historyOrders = nonMesaOrders.filter((p) => historyStatuses.includes(p.estado))

  const filteredHistory = filterStatus === "todos"
    ? historyOrders
    : historyOrders.filter((p) => p.estado === filterStatus)

  // Handle status transitions
  const getNextAction = (order: Pedido) => {
    switch (order.estado) {
      case "recibido":
        return { label: "Preparando", nextStatus: "preparando", icon: Clock }
      case "preparando":
        if (order.metodoEntrega === "domicilio") {
          return { label: "En camino", nextStatus: "en_camino", icon: Bike }
        }
        // Mesa orders go directly to "listo"
        if (order.metodoEntrega === "mesa") {
          return { label: "Listo para servir", nextStatus: "listo_para_retirar", icon: Armchair }
        }
        return { label: "Listo para retirar", nextStatus: "listo_para_retirar", icon: PackageCheck }
      case "en_camino":
        // Delivery: business CANNOT mark as entregado — client + repartidor handle that
        return null
      case "listo_para_retirar":
        // Mesa orders: business can mark as entregado directly (no client confirmation needed)
        if (order.metodoEntrega === "mesa") {
          return { label: "Entregado", nextStatus: "entregado", icon: CheckCircle2 }
        }
        // Pickup: only allow entregado after client confirms receipt
        if (order.clienteConfirmaRecibido) {
          return { label: "Entregado", nextStatus: "entregado", icon: PackageCheck }
        }
        return null
      default:
        return null
    }
  }

  // Handle denuncia submission
  const handleDenunciar = async () => {
    if (!denunciaDialog?.clienteId) {
      toast.error("No se puede denunciar a un invitado")
      return
    }
    if (!denunciaMotivoTipo) {
      toast.error("Seleccioná un motivo")
      return
    }
    if (denunciaMotivoTipo === "otro" && !denunciaMotivoCustom.trim()) {
      toast.error("Escribí el motivo de la denuncia")
      return
    }

    setDenunciando(true)
    try {
      const motivoMap: Record<string, string> = {
        direccion_falsa: "Dirección falsa o incorrecta",
        no_retiro: "No retiró el pedido",
        no_pago: "No pagó el pedido",
        comportamiento: "Comportamiento inadecuado",
      }
      const motivo = denunciaMotivoTipo === "otro" ? denunciaMotivoCustom.trim() : (motivoMap[denunciaMotivoTipo] || denunciaMotivoTipo)

      const res = await fetch("/api/denuncias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: denunciaDialog.clienteId,
          pedidoId: denunciaDialog.id,
          motivoTipo: denunciaMotivoTipo,
          motivo,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al denunciar")
      }

      const data = await res.json()
      toast.success(data.mensaje || "Denuncia registrada")
      setDenunciaDialog(null)
      setDenunciaMotivoTipo("")
      setDenunciaMotivoCustom("")
      // Refresh orders to update warnings
      queryClient.invalidateQueries({ queryKey: ["negocio-pedidos", negocio.id] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al denunciar")
    } finally {
      setDenunciando(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ===== SUB-TABS ===== */}
      <div className="flex items-center gap-2">
        <div className="flex bg-muted/60 rounded-xl p-1 flex-1">
          <button
            onClick={() => setSubTab("activos")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
              subTab === "activos"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            Activos
            {activeOrders.length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-[10px] h-4 min-w-4 px-1 border-0">
                {activeOrders.length}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setSubTab("historial")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all",
              subTab === "historial"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Historial
          </button>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9 text-xs">
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Compartir</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0 rounded-xl" align="end">
            <div className="p-3 border-b border-border/50">
              <p className="text-sm font-bold">Link de empleados</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pedidos + Reseñas en un solo link. Compartilo con tus empleados.
              </p>
            </div>
            <div className="p-3 space-y-2">
              {hasEmployeeLinkMetadata && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border/50 text-[10px] font-mono text-muted-foreground truncate">
                    {tokenEmpleados
                      ? `${typeof window !== "undefined" ? window.location.origin : ""}/e/${tokenEmpleados}`
                      : "Link oculto por seguridad. Regeneralo para obtener uno nuevo."}
                    {!tokenEmpleados && tokenEmpleadosMasked ? ` (${tokenEmpleadosMasked})` : ""}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-7 w-7 rounded-lg shrink-0",
                      copiedLink
                        ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={copySharedLink}
                    disabled={regenerating}
                    title={tokenEmpleados ? "Copiar link de empleados" : "Regenerar link de empleados"}
                  >
                    {regenerating && !tokenEmpleados ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : copiedLink ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : tokenEmpleados ? (
                      <Copy className="h-3.5 w-3.5" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl gap-1.5 text-xs font-semibold border-dashed"
                style={{ borderColor: `${negocio.colorPrincipal}40`, color: negocio.colorPrincipal }}
                onClick={regenerateToken}
                disabled={regenerating}
              >
                {regenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Regenerar link
              </Button>
              <p className="text-[9px] text-muted-foreground text-center">
                Al regenerar, el link anterior deja de funcionar
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* ===== CONTENT ===== */}
      <AnimatePresence mode="wait">
        {subTab === "activos" && (
          <motion.div
            key="activos"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            {isLoading ? (
              <OrdersSkeleton />
            ) : activeOrders.length === 0 ? (
              <EmptyOrders message="No tenés pedidos activos" emoji="📭" />
            ) : (
              <div className="space-y-3">
                {activeOrders.map((order, i) => {
                  const nextAction = getNextAction(order)
                  return (
                    <OrderCard
                      key={order.id}
                      order={order}
                      colorPrincipal={negocio.colorPrincipal}
                      delay={i * 0.04}
                      denunciaWarning={order.clienteId ? denunciaWarningsRef.current[order.clienteId] : undefined}
                      onViewDetail={() => setSelectedOrder(order)}
                      onNextStatus={nextAction ? () => updateStatusMutation.mutate({ id: order.id, estado: nextAction.nextStatus }) : undefined}
                      nextAction={nextAction}
                      onReject={() => { setRejectDialog(order); setRejectReason(""); setCustomReason("") }}
                      isUpdating={updateStatusMutation.isPending}
                    />
                  )
                })}
              </div>
            )}
          </motion.div>
        )}

        {subTab === "historial" && (
          <motion.div
            key="historial"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/* Filters */}
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 rounded-lg text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entregado">Entregados</SelectItem>
                  <SelectItem value="cancelado">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <OrdersSkeleton />
            ) : filteredHistory.length === 0 ? (
              <EmptyOrders message="No hay pedidos en el historial" emoji="📋" />
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((order) => (
                  <HistoryCard
                    key={order.id}
                    order={order}
                    denunciaWarning={order.clienteId ? denunciaWarningsRef.current[order.clienteId] : undefined}
                    onViewDetail={() => setSelectedOrder(order)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== ORDER DETAIL SHEET ===== */}
      <Sheet open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="text-lg">{statusEmoji(selectedOrder?.estado ?? "")}</span>
              Pedido #{selectedOrder?.id.slice(-6)}
            </SheetTitle>
            <SheetDescription className="sr-only">Detalle del pedido</SheetDescription>
          </SheetHeader>

          {selectedOrder && (
            <div className="flex-1 overflow-y-auto pb-6">
              {/* Status */}
              <div className="p-4">
                <StatusBadge status={selectedOrder.estado} />
                <p className="text-xs text-muted-foreground mt-1">
                  {timeAgo(new Date(selectedOrder.fecha))}
                </p>
              </div>

              {/* Client info */}
              <div className="px-4 pb-3">
                <h4 className="text-sm font-semibold mb-2">Cliente</h4>
                <p className="text-sm">{selectedOrder.clienteNombre}</p>
                {selectedOrder.clienteConfirmaRecibido && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Cliente confirmó recepción
                  </p>
                )}
              </div>

              {/* Denuncia Warning */}
              {selectedOrder.clienteId && denunciaWarningsRef.current[selectedOrder.clienteId] && (
                <div className="mx-4 mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span className="text-sm font-bold text-red-700 dark:text-red-300">
                      Cliente denunciado ({denunciaWarningsRef.current[selectedOrder.clienteId].count} denuncia{denunciaWarningsRef.current[selectedOrder.clienteId].count !== 1 ? "s" : ""})
                    </span>
                  </div>
                  <div className="space-y-1.5 ml-6">
                    {denunciaWarningsRef.current[selectedOrder.clienteId].denuncias.slice(0, 3).map((d, i) => (
                      <div key={i} className="text-xs text-red-600 dark:text-red-400">
                        <span className="font-medium">{d.motivo}</span>
                        <span className="text-red-400 dark:text-red-500"> — {d.negocioNombre}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="mx-4" />

              {/* Delivery info */}
              <div className="p-4">
                <h4 className="text-sm font-semibold mb-2">Entrega</h4>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={cn(
                    "text-xs font-semibold",
                    selectedOrder.metodoEntrega === "domicilio"
                      ? "border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-300"
                      : selectedOrder.metodoEntrega === "mesa"
                        ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300"
                        : "border-teal-300 text-teal-700 bg-teal-50 dark:bg-teal-950/30 dark:text-teal-300"
                  )}>
                    {selectedOrder.metodoEntrega === "domicilio" ? (
                      <><Bike className="h-3 w-3 mr-1" /> Delivery</>
                    ) : selectedOrder.metodoEntrega === "mesa" ? (
                      <><Armchair className="h-3 w-3 mr-1" /> Mesa {selectedOrder.mesaNumero}</>
                    ) : (
                      <><PackageCheck className="h-3 w-3 mr-1" /> Retiro en local</>
                    )}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    "text-xs font-semibold",
                    selectedOrder.metodoPago === "efectivo"
                      ? "border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-300"
                      : "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300"
                  )}>
                    {selectedOrder.metodoPago === "efectivo" ? (
                      <><Banknote className="h-3 w-3 mr-1" /> Efectivo</>
                    ) : (
                      <><CreditCard className="h-3 w-3 mr-1" /> Transferencia</>
                    )}
                  </Badge>
                </div>
                {selectedOrder.direccion && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                    {selectedOrder.direccion}
                    {selectedOrder.referencia && ` (${selectedOrder.referencia})`}
                  </p>
                )}
                {selectedOrder.empleadoNombre && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
                    <User className="h-3 w-3" />
                    {isRopa ? "Vendedor" : "Mozo"}: {selectedOrder.empleadoNombre}
                  </p>
                )}
              </div>

              <Separator className="mx-4" />

              {/* Items */}
              <div className="p-4">
                <h4 className="text-sm font-semibold mb-3">Productos</h4>

                <div className="space-y-3">
                  {selectedOrder.items.map((item) => {
                    // Robust client-side parsing in case API returns strings
                    const agregados = parseItemField(item.agregados, []) as Array<{ id?: string; nombre: string; precio: number }>
                    const secciones = parseItemField(item.secciones, {}) as Record<string, string>
                    const ingredientesQuitados = isRestaurante ? parseItemField(item.ingredientesQuitados, []) as string[] : []
                    const hasDetails = agregados.length > 0 || Object.keys(secciones).length > 0 || ingredientesQuitados.length > 0 || item.talle || item.color

                    return (
                      <div key={item.id} className="rounded-xl bg-muted/30 p-3">
                        <div className="flex gap-3">
                          <span className="text-sm font-bold text-primary min-w-[24px]">
                            {item.cantidad}x
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{item.nombre}</p>
                          </div>
                          <span className="text-sm font-bold shrink-0">
                            {formatPrice(item.precio * item.cantidad)}
                          </span>
                        </div>
                        {hasDetails && (
                          <div className="mt-2 ml-[24px] space-y-1.5">
                            {/* Talle / Color */}
                            {(item.talle || item.color) && (
                              <div className="flex flex-wrap gap-1">
                                {item.talle && (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                                    Talle: {item.talle}
                                  </Badge>
                                )}
                                {item.color && (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                                    Color: {item.color}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {/* Secciones (opciones elegidas) */}
                            {Object.keys(secciones).length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(secciones).map(([k, v]) => {
                                  let display: string
                                  if (typeof v === "string") {
                                    display = `${k}: ${v}`
                                  } else {
                                    // Multi-select: { optionName: quantity }
                                    const parts = Object.entries(v as Record<string, number>)
                                      .filter(([, qty]) => qty > 0)
                                      .map(([opt, qty]) => qty > 1 ? `${opt} x${qty}` : opt)
                                    display = `${k}: ${parts.join(", ")}`
                                  }
                                  return (
                                    <Badge key={k} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-primary/10 text-primary">
                                      {display}
                                    </Badge>
                                  )
                                })}
                              </div>
                            )}
                            {/* Agregados */}
                            {agregados.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {agregados.map((a, i) => (
                                  <Badge key={a.id ?? i} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                    + {a.nombre}{a.precio > 0 ? ` (${formatPrice(a.precio)})` : ""}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {/* Ingredientes quitados */}
                            {ingredientesQuitados.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {ingredientesQuitados.map((ing, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                                    Sin {ing}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <Separator className="mx-4" />

              {/* Notes */}
              {selectedOrder.notas && (
                <>
                  <div className="p-4">
                    <h4 className="text-sm font-semibold mb-1 flex items-center gap-1">
                      <StickyNote className="h-3.5 w-3.5" />
                      Notas del cliente
                    </h4>
                    <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-2.5">
                      {selectedOrder.notas}
                    </p>
                  </div>
                  <Separator className="mx-4" />
                </>
              )}

              {/* Totals */}
              <div className="p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Productos</span>
                  <span>{formatPrice(selectedOrder.totalProductos)}</span>
                </div>
                {selectedOrder.precioDelivery > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span>{formatPrice(selectedOrder.precioDelivery)}</span>
                  </div>
                )}
                {selectedOrder.tarifaServicio > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Servicio</span>
                    <span>{formatPrice(selectedOrder.tarifaServicio)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Denunciar cliente button */}
              {selectedOrder.clienteId && selectedOrder.estado !== "cancelado" && (
                <div className="px-4 pb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl h-9 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => {
                      setDenunciaDialog(selectedOrder)
                      setDenunciaMotivoTipo("")
                      setDenunciaMotivoCustom("")
                    }}
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Denunciar cliente
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ===== REJECT DIALOG ===== */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) setRejectDialog(null) }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Rechazar pedido
            </DialogTitle>
            <DialogDescription>
              Seleccioná un motivo para rechazar el pedido de {rejectDialog?.clienteNombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(isRopa ? rejectReasonsRopa : rejectReasonsRestaurant).map((reason) => (
              <label
                key={reason}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-colors border",
                  rejectReason === reason
                    ? "bg-destructive/5 border-destructive/30"
                    : "border-border/50 hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  name="reject-reason"
                  value={reason}
                  checked={rejectReason === reason}
                  onChange={(e) => { setRejectReason(e.target.value); setCustomReason("") }}
                  className="accent-destructive"
                />
                <span className="text-sm">{reason}</span>
              </label>
            ))}
            {rejectReason === "Otro motivo" && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Escribí el motivo..."
                className="w-full mt-2 px-3 py-2 rounded-xl border border-border/50 bg-background text-sm"
                autoFocus
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setRejectDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={!rejectReason || (rejectReason === "Otro motivo" && !customReason)}
              onClick={() => {
                if (rejectDialog) {
                  updateStatusMutation.mutate({
                    id: rejectDialog.id,
                    estado: "cancelado",
                    motivo: rejectReason === "Otro motivo" ? customReason : rejectReason,
                  })
                }
              }}
            >
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DENUNCIA DIALOG ===== */}
      <Dialog open={!!denunciaDialog} onOpenChange={(open) => { if (!open) setDenunciaDialog(null) }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              Denunciar cliente
            </DialogTitle>
            <DialogDescription>
              Denunciar a {denunciaDialog?.clienteNombre} por mala conducta. A las 3 denuncias la cuenta se bloquea automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { value: "direccion_falsa", label: "Dirección falsa o incorrecta", icon: "📍" },
              { value: "no_retiro", label: "No retiró el pedido", icon: "🚫" },
              { value: "no_pago", label: "No pagó el pedido", icon: "💸" },
              { value: "comportamiento", label: "Comportamiento inadecuado", icon: "⚠️" },
              { value: "otro", label: "Otro motivo", icon: "📝" },
            ].map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-colors border",
                  denunciaMotivoTipo === option.value
                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                    : "border-border/50 hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  name="denuncia-motivo"
                  value={option.value}
                  checked={denunciaMotivoTipo === option.value}
                  onChange={(e) => { setDenunciaMotivoTipo(e.target.value); setDenunciaMotivoCustom("") }}
                  className="accent-red-500"
                />
                <span className="text-base">{option.icon}</span>
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
            {denunciaMotivoTipo === "otro" && (
              <textarea
                value={denunciaMotivoCustom}
                onChange={(e) => setDenunciaMotivoCustom(e.target.value)}
                placeholder="Describí el motivo de la denuncia..."
                className="w-full mt-2 px-3 py-2 rounded-xl border border-border/50 bg-background text-sm resize-none min-h-[80px]"
                autoFocus
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDenunciaDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={!denunciaMotivoTipo || (denunciaMotivoTipo === "otro" && !denunciaMotivoCustom.trim()) || denunciando}
              onClick={handleDenunciar}
            >
              {denunciando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Flag className="h-4 w-4" />
              )}
              Denunciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Active Order Card
// ============================================
function OrderCard({
  order,
  colorPrincipal,
  delay,
  denunciaWarning,
  onViewDetail,
  onNextStatus,
  nextAction,
  onReject,
  isUpdating,
}: {
  order: Pedido
  colorPrincipal: string
  delay: number
  denunciaWarning?: DenunciaWarning
  onViewDetail: () => void
  onNextStatus?: () => void
  nextAction: { label: string; nextStatus: string; icon: typeof Clock } | null
  onReject: () => void
  isUpdating: boolean
}) {
  const Icon = nextAction?.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="rounded-2xl border-border/50 overflow-hidden">
        <CardContent className="p-4">
          {/* Top row: Status + Time */}
          <div className="flex items-center justify-between mb-2">
            <StatusBadge status={order.estado} className="text-[10px]" />
            <span className="text-xs text-muted-foreground">
              {timeAgo(new Date(order.fecha))}
            </span>
          </div>

          {/* Client + Total */}
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold truncate">{order.clienteNombre}</h4>
            <span className="text-sm font-bold shrink-0">{formatPrice(order.total)}</span>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            {denunciaWarning && denunciaWarning.count > 0 && (
              <Badge className="text-[10px] font-semibold px-1.5 py-0 bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                {denunciaWarning.count} denuncia{denunciaWarning.count !== 1 ? "s" : ""}
              </Badge>
            )}
            <Badge variant="outline" className={cn(
              "text-[10px] font-semibold px-1.5 py-0",
              order.metodoEntrega === "domicilio"
                ? "border-purple-300 text-purple-700 dark:text-purple-300"
                : order.metodoEntrega === "mesa"
                  ? "border-amber-300 text-amber-700 dark:text-amber-300"
                  : "border-teal-300 text-teal-700 dark:text-teal-300"
            )}>
              {order.metodoEntrega === "domicilio" ? "🛵 Delivery" : order.metodoEntrega === "mesa" ? `🪑 Mesa ${order.mesaNumero ?? ""}` : "📦 Retiro"}
            </Badge>
            <Badge variant="outline" className={cn(
              "text-[10px] font-semibold px-1.5 py-0",
              order.metodoPago === "efectivo"
                ? "border-green-300 text-green-700 dark:text-green-300"
                : "border-blue-300 text-blue-700 dark:text-blue-300"
            )}>
              {order.metodoPago === "efectivo" ? "💵 Efectivo" : "💳 Transferencia"}
            </Badge>
          </div>

          {/* Items preview */}
          <div className="mb-3">
            <p className="text-xs text-muted-foreground">
              {order.items.slice(0, 3).map((it) => `${it.cantidad}x ${it.nombre}`).join(" · ")}
              {order.items.length > 3 && (
                <span className="text-primary font-semibold">
                  {" "}y {order.items.length - 3} más
                </span>
              )}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl h-9 text-xs"
              onClick={onViewDetail}
            >
              Ver detalle
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
            {nextAction && onNextStatus && (
              <Button
                size="sm"
                className="flex-1 rounded-xl h-9 text-xs gap-1"
                style={{ backgroundColor: colorPrincipal }}
                onClick={onNextStatus}
                disabled={isUpdating}
              >
                {Icon && <Icon className="h-3 w-3" />}
                {nextAction.label}
              </Button>
            )}
            {!nextAction && order.estado === "en_camino" && (
              <div className="flex-1 text-center text-[11px] text-muted-foreground py-2 px-3 rounded-xl bg-muted/50">
                Esperando confirmación del cliente
              </div>
            )}
            {!nextAction && order.estado === "listo_para_retirar" && !order.clienteConfirmaRecibido && (
              <div className="flex-1 text-center text-[11px] text-muted-foreground py-2 px-3 rounded-xl bg-muted/50">
                Esperando que el cliente confirme recepción
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-xl text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onReject}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// History Card (simplified)
// ============================================
function HistoryCard({
  order,
  denunciaWarning,
  onViewDetail,
}: {
  order: Pedido
  denunciaWarning?: DenunciaWarning
  onViewDetail: () => void
}) {
  return (
    <Card
      className="rounded-xl border-border/50 hover:shadow-sm transition-shadow cursor-pointer"
      onClick={onViewDetail}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold truncate">{order.clienteNombre}</span>
            {denunciaWarning && denunciaWarning.count > 0 && (
              <Badge className="text-[9px] px-1 py-0 bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 shrink-0">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                {denunciaWarning.count}
              </Badge>
            )}
            {order.metodoEntrega === "mesa" && order.mesaNumero && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-700 dark:text-amber-300 shrink-0">
                🪑 {order.mesaNumero}
              </Badge>
            )}
            <StatusBadge status={order.estado} className="text-[10px] px-1.5 py-0" showEmoji={false} />
          </div>
          <p className="text-xs text-muted-foreground">{timeAgo(new Date(order.fecha))}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold">{formatPrice(order.total)}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Empty State
// ============================================
function EmptyOrders({ message, emoji }: { message: string; emoji: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4">{emoji}</span>
      <h3 className="font-bold text-lg">{message}</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Los pedidos nuevos aparecerán acá
      </p>
    </div>
  )
}

// ============================================
// Skeleton
// ============================================
function OrdersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="rounded-2xl border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-48 mb-3" />
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1 rounded-xl" />
              <Skeleton className="h-9 flex-1 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
