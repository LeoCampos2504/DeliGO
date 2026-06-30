"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Armchair,
  MapPin,
  Users,
  UserCheck,
  Clock,
  AlertCircle,
  Flame,
  CheckCircle2,
  ShieldAlert,
  WifiOff,
  UserCog,
  UserMinus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Logo } from "@/components/shared/logo"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Tipos (espejo del panel seguro de Salón)
// ============================================
interface MesaPanel {
  id: string
  numero: number
  nombre: string
  zona: string
  capacidad: number
  // `id` solo viene si la terminal puede reasignar (para preseleccionar el mozo).
  empleado: { id?: string; nombre: string } | null
}

interface MozoAsignable {
  id: string
  nombre: string
}

interface PedidoItem {
  id: string
  nombre: string
  cantidad: number
  precio: number
  agregados: Array<{ id?: string; nombre: string; precio: number }>
  secciones: Record<string, string | Record<string, number>>
  ingredientesQuitados: string[]
  talle?: string | null
  color?: string | null
}

interface PedidoPanel {
  id: string
  mesaNumero: number | null
  estado: string
  total: number
  fecha: string
  clienteNombre: string
  empleadoNombre: string | null
  items: PedidoItem[]
}

interface Capacidades {
  puedeCambiarEstadoPedido: boolean
  puedeMarcarPedidoEntregado: boolean
  puedeReasignarMesa: boolean
  puedeLiberarMesa: boolean
}

interface PanelData {
  terminal: { nombre: string }
  negocio: { nombre: string; colorPrincipal: string }
  capacidades: Capacidades
  mesas: MesaPanel[]
  pedidos: PedidoPanel[]
  mozosAsignables: MozoAsignable[]
}

// Acción disponible según estado del pedido + capacidades reales de la terminal.
function nextAction(
  estado: string,
  caps: Capacidades
): { label: string; target: string } | null {
  if (estado === "recibido" && caps.puedeCambiarEstadoPedido) {
    return { label: "Empezar preparación", target: "preparando" }
  }
  if (estado === "preparando" && caps.puedeCambiarEstadoPedido) {
    return { label: "Marcar listo", target: "listo_para_retirar" }
  }
  if (estado === "listo_para_retirar" && caps.puedeMarcarPedidoEntregado) {
    return { label: "Marcar entregado", target: "entregado" }
  }
  return null
}

const ACTION_TOASTS: Record<string, string> = {
  preparando: "Pedido en preparación",
  listo_para_retirar: "Pedido listo para servir",
  entregado: "Pedido marcado como entregado",
}

type Phase =
  | { kind: "loading" }
  | { kind: "no-session" }
  | { kind: "no-permission" }
  | { kind: "error" }
  | { kind: "ready"; data: PanelData; stale: boolean }

// ============================================
// Estados de pedido (mismos labels/colores que el Salón actual)
// ============================================
const STATUS_PRIORITY = ["recibido", "preparando", "listo_para_retirar"] as const

const STATUS_CONFIG: Record<
  string,
  { label: string; chipColor: string; tile: string; numberColor: string; icon: typeof Clock }
> = {
  recibido: {
    label: "Recibido",
    chipColor: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    tile: "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30",
    numberColor: "text-amber-700 dark:text-amber-300",
    icon: AlertCircle,
  },
  preparando: {
    label: "Preparando",
    chipColor: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
    tile: "border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-orange-950/30",
    numberColor: "text-orange-700 dark:text-orange-300",
    icon: Flame,
  },
  listo_para_retirar: {
    label: "Listo para servir",
    chipColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    tile: "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
    numberColor: "text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
  },
}

function getTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

const REFRESH_MS = 5000

// ============================================
// Página
// ============================================
export default function OperacionesSalonPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [selectedMesa, setSelectedMesa] = useState<number | null>(null)
  const [actingIds, setActingIds] = useState<Set<string>>(() => new Set())
  const [actingMesaIds, setActingMesaIds] = useState<Set<string>>(() => new Set())

  const stoppedRef = useRef(false)
  const actingIdsRef = useRef<Set<string>>(new Set())
  const actingMesaIdsRef = useRef<Set<string>>(new Set())
  const acRef = useRef<AbortController | null>(null)
  const genRef = useRef(0)

  const applyTransientError = useCallback(() => {
    setPhase((prev) => (prev.kind === "ready" ? { ...prev, stale: true } : { kind: "error" }))
  }, [])

  const refresh = useCallback(async () => {
    if (stoppedRef.current) return
    acRef.current?.abort()
    const ac = new AbortController()
    acRef.current = ac
    const gen = ++genRef.current

    try {
      const res = await fetch("/api/operaciones/salon/panel", { cache: "no-store", signal: ac.signal })
      if (gen !== genRef.current) return

      if (res.status === 401) {
        stoppedRef.current = true
        setPhase({ kind: "no-session" })
        return
      }
      if (res.status === 403) {
        stoppedRef.current = true
        setPhase({ kind: "no-permission" })
        return
      }
      if (!res.ok) {
        applyTransientError()
        return
      }

      const data = await res.json().catch(() => null)
      if (gen !== genRef.current) return
      if (!data || !data.ok || !data.negocio || !data.terminal) {
        applyTransientError()
        return
      }

      setPhase({
        kind: "ready",
        data: {
          terminal: { nombre: data.terminal.nombre },
          negocio: {
            nombre: data.negocio.nombre,
            colorPrincipal: data.negocio.colorPrincipal || "#FB8C00",
          },
          capacidades: {
            puedeCambiarEstadoPedido: data.capacidades?.puedeCambiarEstadoPedido === true,
            puedeMarcarPedidoEntregado: data.capacidades?.puedeMarcarPedidoEntregado === true,
            puedeReasignarMesa: data.capacidades?.puedeReasignarMesa === true,
            puedeLiberarMesa: data.capacidades?.puedeLiberarMesa === true,
          },
          mesas: Array.isArray(data.mesas) ? data.mesas : [],
          pedidos: Array.isArray(data.pedidos) ? data.pedidos : [],
          mozosAsignables: Array.isArray(data.mozosAsignables) ? data.mozosAsignables : [],
        },
        stale: false,
      })
      setLastUpdated(Date.now())
    } catch {
      if (ac.signal.aborted) return
      if (gen !== genRef.current) return
      applyTransientError()
    }
  }, [applyTransientError])

  // Acción: avanzar el estado de un pedido. La autorización real vive en el servidor.
  const handleAction = useCallback(
    async (pedidoId: string, estado: string) => {
      // Un segundo click sobre el MISMO pedido mientras guarda no dispara otra request;
      // acciones sobre otros pedidos sí pueden ejecutarse en paralelo.
      if (actingIdsRef.current.has(pedidoId)) return
      actingIdsRef.current.add(pedidoId)
      setActingIds((prev) => {
        const next = new Set(prev)
        next.add(pedidoId)
        return next
      })
      try {
        const res = await fetch(`/api/operaciones/salon/pedidos/${encodeURIComponent(pedidoId)}/estado`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ estado }),
        })

        if (res.status === 401) {
          // Sesión inválida / terminal no activa → detener polling y mostrar no-vinculada.
          stoppedRef.current = true
          setPhase({ kind: "no-session" })
          return
        }
        if (res.status === 403) {
          // Sin permiso para la acción: no expulsar de Salón; refrescar por si cambiaron permisos.
          toast.error("Esta terminal no tiene permiso para realizar esa acción.")
          await refresh()
          return
        }
        if (res.status === 409) {
          toast.error("El pedido cambió en otro dispositivo. Actualizando panel.")
          await refresh()
          return
        }
        if (!res.ok) {
          toast.error("No se pudo actualizar el pedido. Intentá de nuevo.")
          return
        }
        const data = await res.json().catch(() => null)
        if (!data || !data.ok) {
          toast.error("No se pudo actualizar el pedido. Intentá de nuevo.")
          return
        }

        toast.success(ACTION_TOASTS[estado] ?? "Pedido actualizado")
        // Sin actualización optimista: el refresh trae el estado real.
        await refresh()
      } catch {
        toast.error("No se pudo actualizar el pedido. Intentá de nuevo.")
      } finally {
        actingIdsRef.current.delete(pedidoId)
        setActingIds((prev) => {
          const next = new Set(prev)
          next.delete(pedidoId)
          return next
        })
      }
    },
    [refresh]
  )

  // Acción: asignar/reasignar (empleadoId string) o liberar (empleadoId null) una mesa.
  // El control de concurrencia es POR MESA: una mesa en curso no dispara otra request,
  // pero otras mesas pueden operarse en paralelo. La autorización real vive en el servidor.
  const handleMesaAssignment = useCallback(
    async (mesaId: string, empleadoId: string | null) => {
      if (actingMesaIdsRef.current.has(mesaId)) return
      actingMesaIdsRef.current.add(mesaId)
      setActingMesaIds((prev) => {
        const next = new Set(prev)
        next.add(mesaId)
        return next
      })
      try {
        const res = await fetch(
          `/api/operaciones/salon/mesas/${encodeURIComponent(mesaId)}/asignacion`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ empleadoId }),
          }
        )

        if (res.status === 401) {
          stoppedRef.current = true
          setPhase({ kind: "no-session" })
          return
        }
        if (res.status === 403) {
          toast.error("Esta terminal no tiene permiso para realizar esa acción.")
          await refresh()
          return
        }
        if (res.status === 409) {
          toast.error("La mesa cambió en otro dispositivo. Actualizando panel.")
          await refresh()
          return
        }
        if (!res.ok) {
          // 400 / 500 / error de red: conservar datos visibles y permitir reintentar.
          toast.error("No se pudo actualizar la mesa. Intentá de nuevo.")
          return
        }
        const data = await res.json().catch(() => null)
        if (!data || !data.ok) {
          toast.error("No se pudo actualizar la mesa. Intentá de nuevo.")
          return
        }

        toast.success(empleadoId === null ? "Mesa liberada" : "Mozo asignado a la mesa")
        // Sin actualización optimista: el refresh trae el estado real.
        await refresh()
      } catch {
        toast.error("No se pudo actualizar la mesa. Intentá de nuevo.")
      } finally {
        actingMesaIdsRef.current.delete(mesaId)
        setActingMesaIds((prev) => {
          const next = new Set(prev)
          next.delete(mesaId)
          return next
        })
      }
    },
    [refresh]
  )

  // Refresco controlado: inmediato + cada 5s solo con la pestaña visible + foco/visibilidad.
  useEffect(() => {
    void refresh()

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, REFRESH_MS)

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const onFocus = () => void refresh()

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      acRef.current?.abort()
    }
  }, [refresh])

  // ── Estados sin datos ──
  if (phase.kind === "loading") {
    return (
      <CenteredShell>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando salón…</p>
      </CenteredShell>
    )
  }

  if (phase.kind === "no-session") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Esta terminal no está vinculada o su sesión ya no está vigente.
        </p>
        <Button asChild className="rounded-xl gap-2 font-semibold">
          <Link href="/operaciones">
            <ArrowLeft className="h-4 w-4" />
            Volver a Operaciones
          </Link>
        </Button>
      </CenteredShell>
    )
  }

  if (phase.kind === "no-permission") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Esta terminal no tiene permiso para acceder a Salón.
        </p>
        <Button asChild className="rounded-xl gap-2 font-semibold">
          <Link href="/operaciones">
            <ArrowLeft className="h-4 w-4" />
            Volver a Operaciones
          </Link>
        </Button>
      </CenteredShell>
    )
  }

  if (phase.kind === "error") {
    return (
      <CenteredShell>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted text-muted-foreground">
          <WifiOff className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          No se pudo cargar el salón. Revisá la conexión e intentá de nuevo.
        </p>
        <Button className="rounded-xl gap-2 font-semibold" onClick={() => refresh()}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </CenteredShell>
    )
  }

  // ── Terminal válida con datos ──
  return (
    <SalonView
      data={phase.data}
      stale={phase.stale}
      lastUpdated={lastUpdated}
      onRefresh={refresh}
      selectedMesa={selectedMesa}
      onSelectMesa={setSelectedMesa}
      actingIds={actingIds}
      onAction={handleAction}
      actingMesaIds={actingMesaIds}
      onMesaAssignment={handleMesaAssignment}
    />
  )
}

// ============================================
// Vista principal de Salón
// ============================================
function SalonView({
  data,
  stale,
  lastUpdated,
  onRefresh,
  selectedMesa,
  onSelectMesa,
  actingIds,
  onAction,
  actingMesaIds,
  onMesaAssignment,
}: {
  data: PanelData
  stale: boolean
  lastUpdated: number | null
  onRefresh: () => void
  selectedMesa: number | null
  onSelectMesa: (n: number | null) => void
  actingIds: Set<string>
  onAction: (pedidoId: string, estado: string) => void
  actingMesaIds: Set<string>
  onMesaAssignment: (mesaId: string, empleadoId: string | null) => void
}) {
  const accent = data.negocio.colorPrincipal
  const [refreshing, setRefreshing] = useState(false)
  const [, forceTick] = useState(0)

  // Re-render del "actualizado hace" cada 10s.
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 10000)
    return () => clearInterval(t)
  }, [])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  // Mapa mesaNumero → pedidos activos.
  const mesaOrdersMap = useMemo(() => {
    const map = new Map<number, PedidoPanel[]>()
    for (const p of data.pedidos) {
      if (p.mesaNumero == null) continue
      if (!map.has(p.mesaNumero)) map.set(p.mesaNumero, [])
      map.get(p.mesaNumero)!.push(p)
    }
    return map
  }, [data.pedidos])

  const getWorstStatus = (numero: number): string | null => {
    const orders = mesaOrdersMap.get(numero)
    if (!orders || orders.length === 0) return null
    for (const s of STATUS_PRIORITY) {
      if (orders.some((o) => o.estado === s)) return s
    }
    return null
  }

  // Resumen operativo (mismos estados que el Salón actual).
  const counts = useMemo(
    () => ({
      recibido: data.pedidos.filter((p) => p.estado === "recibido").length,
      preparando: data.pedidos.filter((p) => p.estado === "preparando").length,
      listo: data.pedidos.filter((p) => p.estado === "listo_para_retirar").length,
    }),
    [data.pedidos]
  )

  const mesasConPedidos = mesaOrdersMap.size

  // Agrupar mesas por zona (igual que el Salón actual).
  const zonaGroups = useMemo(() => {
    const groups = new Map<string, MesaPanel[]>()
    for (const m of data.mesas) {
      const key = m.zona || ""
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(m)
    }
    const sorted = [...groups.keys()].sort((a, b) => {
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b)
    })
    return sorted.map((zona) => ({ zona, mesas: groups.get(zona)! }))
  }, [data.mesas])

  const selectedOrders = selectedMesa != null ? mesaOrdersMap.get(selectedMesa) ?? [] : []
  const selectedMesaObj = selectedMesa != null ? data.mesas.find((m) => m.numero === selectedMesa) ?? null : null

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
            <Link href="/operaciones" aria-label="Volver a Operaciones">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Logo size="sm" />
              <span className="text-xs text-muted-foreground hidden sm:inline">Salón</span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {data.negocio.nombre} · {data.terminal.nombre}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {stale ? (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <WifiOff className="h-3 w-3" />
                Sin actualizar
              </span>
            ) : (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {lastUpdated ? `Hace ${getTimeAgo(new Date(lastUpdated).toISOString())}` : "En vivo"}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 h-9 text-xs"
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Actualizar ahora</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Aviso discreto de no-actualización */}
        {stale && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
            <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No se pudo actualizar. Mostrando los últimos datos.
            </p>
          </div>
        )}

        {/* Resumen operativo */}
        <div className="flex items-center gap-3 flex-wrap">
          <SummaryChip color="amber" label={`${counts.recibido} nuevos`} pulse />
          <SummaryChip color="orange" label={`${counts.preparando} preparando`} />
          <SummaryChip color="emerald" label={`${counts.listo} listos`} />
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Armchair className="h-3.5 w-3.5" />
            {mesasConPedidos}/{data.mesas.length} mesas con pedidos
          </span>
        </div>

        {/* Plano de mesas */}
        {data.mesas.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
            <Armchair className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">Sin mesas activas</p>
            <p className="text-xs text-muted-foreground mt-0.5">No hay mesas configuradas en el salón.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {zonaGroups.map(({ zona, mesas }) => (
              <div key={zona || "__no_zona__"}>
                {zona && (
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground">{zona}</span>
                    <span className="text-[10px] text-muted-foreground/60">({mesas.length})</span>
                  </div>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {mesas.map((mesa) => {
                    const status = getWorstStatus(mesa.numero)
                    const orders = mesaOrdersMap.get(mesa.numero) ?? []
                    const hasOrders = orders.length > 0
                    const cfg = status ? STATUS_CONFIG[status] : null
                    return (
                      <button
                        key={mesa.id}
                        onClick={() => onSelectMesa(mesa.numero)}
                        className={cn(
                          "relative flex flex-col items-center justify-center aspect-square rounded-2xl border-2 transition-all duration-200 cursor-pointer",
                          cfg ? cfg.tile + " shadow-md" : "border-border/50 bg-card hover:border-primary/30 hover:shadow-md"
                        )}
                      >
                        {status === "recibido" && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                          </span>
                        )}
                        <span className={cn("text-2xl font-extrabold leading-none", cfg ? cfg.numberColor : "text-foreground/80")}>
                          {mesa.numero}
                        </span>
                        {mesa.nombre && (
                          <span className="text-[10px] font-medium mt-0.5 truncate max-w-[90%] text-muted-foreground">
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
                          <span className="text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-full bg-background/60">
                            {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detalle de mesa (drawer) */}
      <Drawer open={selectedMesa != null} onOpenChange={(open) => { if (!open) onSelectMesa(null) }}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left shrink-0">
            <DrawerTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg shrink-0 bg-muted text-foreground">
                {selectedMesa}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-base font-bold">
                  Mesa {selectedMesa}
                  {selectedMesaObj?.nombre ? ` — ${selectedMesaObj.nombre}` : ""}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {selectedMesaObj && (
                    <>
                      <Users className="h-3 w-3" />
                      <span>{selectedMesaObj.capacidad} personas</span>
                    </>
                  )}
                  {selectedMesaObj?.zona && (
                    <>
                      <MapPin className="h-3 w-3" />
                      <span>{selectedMesaObj.zona}</span>
                    </>
                  )}
                  {selectedMesaObj?.empleado && (
                    <>
                      <UserCheck className="h-3 w-3 text-blue-500" />
                      <span className="text-blue-600 dark:text-blue-400 font-medium">{selectedMesaObj.empleado.nombre}</span>
                    </>
                  )}
                </div>
              </div>
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 overscroll-contain">
            {selectedMesaObj && (
              <MesaAssignmentSection
                key={selectedMesaObj.id}
                mesa={selectedMesaObj}
                mozosAsignables={data.mozosAsignables}
                capacidades={data.capacidades}
                saving={actingMesaIds.has(selectedMesaObj.id)}
                onMesaAssignment={onMesaAssignment}
              />
            )}
            {selectedOrders.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-muted/30">
                  <Armchair className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">Sin pedidos activos</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold">Pedidos activos</h4>
                  <Badge className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-0">
                    {selectedOrders.length}
                  </Badge>
                </div>
                {selectedOrders.map((order) => (
                  <PedidoCard
                    key={order.id}
                    order={order}
                    capacidades={data.capacidades}
                    saving={actingIds.has(order.id)}
                    onAction={onAction}
                  />
                ))}
              </div>
            )}
          </div>

          <DrawerFooter className="border-t pt-3">
            <Button variant="outline" className="rounded-xl" onClick={() => onSelectMesa(null)}>
              Cerrar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </main>
  )
}

// ============================================
// Subcomponentes
// ============================================
function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center text-center gap-3">{children}</div>
    </main>
  )
}

function SummaryChip({ color, label, pulse }: { color: "amber" | "orange" | "emerald"; label: string; pulse?: boolean }) {
  const styles: Record<string, string> = {
    amber: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400",
    orange: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/50 text-orange-700 dark:text-orange-400",
    emerald: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400",
  }
  const dot: Record<string, string> = { amber: "bg-amber-500", orange: "bg-orange-500", emerald: "bg-emerald-500" }
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl border", styles[color])}>
      <span className={cn("w-2.5 h-2.5 rounded-full", dot[color], pulse && "animate-pulse")} />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  )
}

// Gestión segura de asignación de mesa (solo dentro del drawer). Los controles aparecen
// según capacidades derivadas en servidor; la autorización real vive en el backend.
function MesaAssignmentSection({
  mesa,
  mozosAsignables,
  capacidades,
  saving,
  onMesaAssignment,
}: {
  mesa: MesaPanel
  mozosAsignables: MozoAsignable[]
  capacidades: Capacidades
  saving: boolean
  onMesaAssignment: (mesaId: string, empleadoId: string | null) => void
}) {
  const currentId = mesa.empleado?.id ?? null
  const [selected, setSelected] = useState<string>(currentId ?? "")

  // Sincroniza la selección local SOLO cuando cambia la asignación real del servidor
  // (refresh propio, reasignación o liberación desde otra terminal). Las deps son valores
  // primitivos (id/currentId): si el polling devuelve la MISMA asignación, el efecto no
  // se reejecuta y no pisa una elección manual aún sin confirmar. Si la asignación real
  // cambia, vuelve a reflejar el estado del servidor y evita reasignar accidentalmente.
  useEffect(() => {
    setSelected(currentId ?? "")
  }, [mesa.id, currentId])

  // "Liberar" solo tiene sentido cuando hay un mozo asignado (semántica real existente).
  const showLiberar = capacidades.puedeLiberarMesa && mesa.empleado != null
  const showReasignar = capacidades.puedeReasignarMesa

  if (!showReasignar && !showLiberar) return null

  const canConfirmReasignar = !!selected && selected !== currentId

  return (
    <div className="mb-4 rounded-xl border border-border/50 bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-bold">Gestión de mesa</h4>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <UserCheck className="h-3.5 w-3.5 text-blue-500" />
        {mesa.empleado ? (
          <span>
            Mozo asignado:{" "}
            <span className="font-medium text-blue-600 dark:text-blue-400">{mesa.empleado.nombre}</span>
          </span>
        ) : (
          <span>Sin mozo asignado</span>
        )}
      </div>

      {showReasignar && (
        <div className="space-y-2">
          <Select value={selected} onValueChange={setSelected} disabled={saving}>
            <SelectTrigger className="rounded-xl h-9 text-sm">
              <SelectValue placeholder="Elegí un mozo" />
            </SelectTrigger>
            <SelectContent>
              {mozosAsignables.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  No hay mozos disponibles
                </div>
              ) : (
                mozosAsignables.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="w-full rounded-xl gap-1.5 h-9 text-sm font-semibold"
            onClick={() => onMesaAssignment(mesa.id, selected)}
            disabled={saving || !canConfirmReasignar}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
            {currentId ? "Reasignar mozo" : "Asignar mozo"}
          </Button>
        </div>
      )}

      {showLiberar && (
        <Button
          size="sm"
          variant="outline"
          className="w-full rounded-xl gap-1.5 h-9 text-sm font-semibold"
          onClick={() => onMesaAssignment(mesa.id, null)}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
          Liberar mesa
        </Button>
      )}
    </div>
  )
}

function PedidoCard({
  order,
  capacidades,
  saving,
  onAction,
}: {
  order: PedidoPanel
  capacidades: Capacidades
  saving: boolean
  onAction: (pedidoId: string, estado: string) => void
}) {
  const cfg = STATUS_CONFIG[order.estado]
  const StatusIcon = cfg?.icon ?? Clock
  const action = nextAction(order.estado, capacidades)
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className="h-4 w-4 text-muted-foreground" />
          <Badge className={cn("text-[10px] h-5 px-1.5 border-0", cfg?.chipColor)}>
            {cfg?.label ?? order.estado}
          </Badge>
        </div>
        <span className="text-[10px] text-muted-foreground">{getTimeAgo(order.fecha)}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {order.empleadoNombre || order.clienteNombre || "Cliente"}
        </span>
        <span className="text-sm font-bold">{formatPrice(order.total)}</span>
      </div>

      <div className="space-y-2">
        {order.items.map((item) => {
          const hasDetails =
            (item.agregados?.length ?? 0) > 0 ||
            Object.keys(item.secciones || {}).length > 0 ||
            (item.ingredientesQuitados?.length ?? 0) > 0 ||
            item.talle ||
            item.color
          return (
            <div key={item.id}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {item.cantidad > 1 && <span className="font-semibold">{item.cantidad}x </span>}
                  {item.nombre}
                </span>
                <span className="text-muted-foreground font-medium">{formatPrice(item.precio * item.cantidad)}</span>
              </div>
              {hasDetails && (
                <div className="ml-4 mt-1 space-y-1">
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
                            .map(([opt, qty]) => (qty > 1 ? `${opt} x${qty}` : opt))
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
                  {item.agregados?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.agregados.map((a, i) => (
                        <span key={a.id ?? i} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 font-medium">
                          + {a.nombre}
                        </span>
                      ))}
                    </div>
                  )}
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

      {action && (
        <Button
          size="sm"
          className="w-full rounded-xl gap-1.5 h-9 text-sm font-semibold"
          onClick={() => onAction(order.id, action.target)}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  )
}
