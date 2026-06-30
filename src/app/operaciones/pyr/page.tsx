"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Clock,
  AlertCircle,
  Flame,
  Bike,
  Package,
  CheckCircle2,
  ShieldAlert,
  WifiOff,
  ClipboardList,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
import { Logo } from "@/components/shared/logo"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"

// Tope seguro del motivo de cancelación (sin límite real en el proyecto; ver CODEX_REPORT).
const MAX_MOTIVO_LEN = 300

// ============================================
// Tipos (espejo del panel seguro de PyR)
// ============================================
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

interface PedidoAcciones {
  puedeIniciarPreparacion: boolean
  puedeMarcarEnCamino: boolean
  puedeMarcarListoParaRetirar: boolean
  puedeMarcarEntregado: boolean
  puedeCancelar: boolean
}

interface PedidoPyR {
  id: string
  estado: string
  metodoEntrega: string
  fecha: string
  total: number
  clienteNombre: string | null
  acciones: PedidoAcciones
  items: PedidoItem[]
}

function normalizeAcciones(raw: unknown): PedidoAcciones {
  const a = (raw ?? {}) as Record<string, unknown>
  return {
    puedeIniciarPreparacion: a.puedeIniciarPreparacion === true,
    puedeMarcarEnCamino: a.puedeMarcarEnCamino === true,
    puedeMarcarListoParaRetirar: a.puedeMarcarListoParaRetirar === true,
    puedeMarcarEntregado: a.puedeMarcarEntregado === true,
    puedeCancelar: a.puedeCancelar === true,
  }
}

interface Capacidades {
  puedeGestionarPedido: boolean
  puedeVerResenas: boolean
  puedeResponderResena: boolean
  puedeVerMensajes: boolean
  puedeResponderMensajes: boolean
}

interface PanelData {
  terminal: { nombre: string }
  negocio: { nombre: string; colorPrincipal: string }
  capacidades: Capacidades
  pedidos: PedidoPyR[]
}

type Phase =
  | { kind: "loading" }
  | { kind: "no-session" }
  | { kind: "no-permission" }
  | { kind: "error" }
  | { kind: "ready"; data: PanelData; stale: boolean }

// ============================================
// Estados activos (mismos labels/colores que el resto de Operaciones)
// ============================================
const STATUS_CONFIG: Record<
  string,
  { label: string; chipColor: string; icon: typeof Clock }
> = {
  recibido: {
    label: "Recibido",
    chipColor: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    icon: AlertCircle,
  },
  preparando: {
    label: "Preparando",
    chipColor: "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
    icon: Flame,
  },
  en_camino: {
    label: "En camino",
    chipColor: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    icon: Bike,
  },
  listo_para_retirar: {
    label: "Listo para retirar",
    chipColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    icon: CheckCircle2,
  },
}

const ENTREGA_CONFIG: Record<string, { label: string; icon: typeof Bike }> = {
  domicilio: { label: "Delivery", icon: Bike },
  retiro: { label: "Retiro", icon: Package },
}

function entregaInfo(metodo: string): { label: string; icon: typeof Bike } {
  return ENTREGA_CONFIG[metodo] ?? { label: metodo, icon: Package }
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

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ============================================
// Página
// ============================================
export default function OperacionesPyRPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null)
  const [actingIds, setActingIds] = useState<Set<string>>(() => new Set())

  const stoppedRef = useRef(false)
  const acRef = useRef<AbortController | null>(null)
  const genRef = useRef(0)
  const actingIdsRef = useRef<Set<string>>(new Set())

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
      const res = await fetch("/api/operaciones/pyr/panel", { cache: "no-store", signal: ac.signal })
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
            puedeGestionarPedido: data.capacidades?.puedeGestionarPedido === true,
            puedeVerResenas: data.capacidades?.puedeVerResenas === true,
            puedeResponderResena: data.capacidades?.puedeResponderResena === true,
            puedeVerMensajes: data.capacidades?.puedeVerMensajes === true,
            puedeResponderMensajes: data.capacidades?.puedeResponderMensajes === true,
          },
          pedidos: Array.isArray(data.pedidos)
            ? data.pedidos.map((p: PedidoPyR) => ({ ...p, acciones: normalizeAcciones(p.acciones) }))
            : [],
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

  // Acción de cambio de estado. La autorización real vive en el servidor (el PATCH
  // revalida todo). Control de concurrencia POR PEDIDO: el mismo pedido no dispara dos
  // requests; otros pedidos pueden operarse en paralelo. Sin actualización optimista.
  const handleAction = useCallback(
    async (pedidoId: string, estado: string, motivo?: string) => {
      if (actingIdsRef.current.has(pedidoId)) return
      actingIdsRef.current.add(pedidoId)
      setActingIds((prev) => {
        const next = new Set(prev)
        next.add(pedidoId)
        return next
      })
      try {
        const body = estado === "cancelado" ? { estado, motivo } : { estado }
        const res = await fetch(
          `/api/operaciones/pyr/pedidos/${encodeURIComponent(pedidoId)}/estado`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(body),
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
          toast.error("El pedido cambió en otro dispositivo. Actualizando panel.")
          await refresh()
          return
        }
        if (res.status === 400) {
          toast.error("No se pudo realizar la acción. Revisá e intentá de nuevo.")
          return
        }
        if (!res.ok) {
          // 500 / red: conservar el panel visible y permitir reintentar.
          toast.error("No se pudo actualizar el pedido. Intentá de nuevo.")
          return
        }
        const data = await res.json().catch(() => null)
        if (!data || !data.ok) {
          toast.error("No se pudo actualizar el pedido. Intentá de nuevo.")
          return
        }

        toast.success("Pedido actualizado")
        // Sin optimismo: el refresh trae el estado real desde servidor.
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

  // Sin polling. Carga al abrir (solo si visible) + foco/visibilidad.
  // NUNCA se ejecutan requests automáticas con la pestaña oculta.
  useEffect(() => {
    if (document.visibilityState === "visible") void refresh()

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh()
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)

    return () => {
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
        <p className="text-sm text-muted-foreground">Cargando pedidos…</p>
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
          Esta terminal no tiene permiso para acceder a Pedidos y reseñas.
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
          No se pudieron cargar los pedidos. Revisá la conexión e intentá de nuevo.
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
    <PyRView
      data={phase.data}
      stale={phase.stale}
      lastUpdated={lastUpdated}
      onRefresh={refresh}
      selectedPedidoId={selectedPedidoId}
      onSelectPedido={setSelectedPedidoId}
      actingIds={actingIds}
      onAction={handleAction}
    />
  )
}

// ============================================
// Vista principal de PyR (solo lectura)
// ============================================
function PyRView({
  data,
  stale,
  lastUpdated,
  onRefresh,
  selectedPedidoId,
  onSelectPedido,
  actingIds,
  onAction,
}: {
  data: PanelData
  stale: boolean
  lastUpdated: number | null
  onRefresh: () => void
  selectedPedidoId: string | null
  onSelectPedido: (id: string | null) => void
  actingIds: Set<string>
  onAction: (pedidoId: string, estado: string, motivo?: string) => void
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [, forceTick] = useState(0)
  const [cancelMode, setCancelMode] = useState(false)
  const [motivo, setMotivo] = useState("")

  // Re-render del "actualizado hace" cada 10s (sin requests).
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 10000)
    return () => clearInterval(t)
  }, [])

  // Al cambiar de pedido seleccionado, salir del modo cancelación y limpiar el motivo.
  useEffect(() => {
    setCancelMode(false)
    setMotivo("")
  }, [selectedPedidoId])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const selectedPedido =
    selectedPedidoId != null ? data.pedidos.find((p) => p.id === selectedPedidoId) ?? null : null

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
              <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1">
                <ClipboardList className="h-3 w-3" />
                Pedidos y reseñas
              </span>
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

        {/* Resumen */}
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base font-bold">Pedidos activos</h1>
          <Badge className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-0">
            {data.pedidos.length}
          </Badge>
        </div>

        {/* Listado de pedidos activos */}
        {data.pedidos.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">Sin pedidos activos</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No hay pedidos de delivery o retiro en curso.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.pedidos.map((pedido) => (
              <PedidoRow key={pedido.id} pedido={pedido} onClick={() => onSelectPedido(pedido.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Detalle de pedido (drawer) */}
      <Drawer
        open={selectedPedido != null}
        onOpenChange={(open) => {
          if (!open) onSelectPedido(null)
        }}
      >
        <DrawerContent className="max-h-[85vh]">
          {selectedPedido && (
            <>
              <DrawerHeader className="text-left shrink-0">
                <DrawerTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-muted text-foreground">
                    <EntregaIcon metodo={selectedPedido.metodoEntrega} className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-base font-bold">
                      {entregaInfo(selectedPedido.metodoEntrega).label}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <StatusBadge estado={selectedPedido.estado} />
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(selectedPedido.fecha)}
                      </span>
                    </div>
                  </div>
                </DrawerTitle>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 overscroll-contain">
                <div className="rounded-xl border border-border/50 bg-card p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {selectedPedido.clienteNombre || "Cliente"}
                    </span>
                    <span className="text-sm font-bold">{formatPrice(selectedPedido.total)}</span>
                  </div>

                  <div className="space-y-2 pt-1">
                    {selectedPedido.items.map((item) => (
                      <PedidoItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>

                {/* Acciones de gestión — solo con permiso y según acciones server-side */}
                {data.capacidades.puedeGestionarPedido && (
                  <PedidoAcciones
                    pedido={selectedPedido}
                    saving={actingIds.has(selectedPedido.id)}
                    cancelMode={cancelMode}
                    motivo={motivo}
                    onSetCancelMode={setCancelMode}
                    onSetMotivo={setMotivo}
                    onAction={onAction}
                  />
                )}
              </div>

              <DrawerFooter className="border-t pt-3">
                <Button variant="outline" className="rounded-xl" onClick={() => onSelectPedido(null)}>
                  Cerrar
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </main>
  )
}

// ============================================
// Acciones de gestión de un pedido (solo dentro del drawer, con permiso)
// ============================================
function PedidoAcciones({
  pedido,
  saving,
  cancelMode,
  motivo,
  onSetCancelMode,
  onSetMotivo,
  onAction,
}: {
  pedido: PedidoPyR
  saving: boolean
  cancelMode: boolean
  motivo: string
  onSetCancelMode: (v: boolean) => void
  onSetMotivo: (v: string) => void
  onAction: (pedidoId: string, estado: string, motivo?: string) => void
}) {
  const a = pedido.acciones
  const Spinner = <Loader2 className="h-4 w-4 animate-spin" />

  if (cancelMode) {
    return (
      <div className="mt-4 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
        <p className="text-xs font-semibold text-red-700 dark:text-red-400">Motivo de cancelación</p>
        <textarea
          value={motivo}
          onChange={(e) => onSetMotivo(e.target.value)}
          maxLength={MAX_MOTIVO_LEN}
          rows={2}
          placeholder="Indicá el motivo…"
          disabled={saving}
          className="w-full px-3 py-2 rounded-lg text-sm border border-red-200 dark:border-red-800/50 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-red-300/40"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            disabled={saving}
            onClick={() => {
              onSetCancelMode(false)
              onSetMotivo("")
            }}
          >
            Volver
          </Button>
          <Button
            className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white gap-1.5"
            disabled={saving || !motivo.trim()}
            onClick={() => onAction(pedido.id, "cancelado", motivo.trim())}
          >
            {saving ? Spinner : <X className="h-4 w-4" />}
            Confirmar cancelación
          </Button>
        </div>
      </div>
    )
  }

  const hasAnyAction =
    a.puedeIniciarPreparacion ||
    a.puedeMarcarEnCamino ||
    a.puedeMarcarListoParaRetirar ||
    a.puedeMarcarEntregado ||
    a.puedeCancelar
  if (!hasAnyAction) return null

  return (
    <div className="mt-4 space-y-2">
      {a.puedeIniciarPreparacion && (
        <Button
          className="w-full rounded-xl gap-1.5 h-10 text-sm font-semibold"
          disabled={saving}
          onClick={() => onAction(pedido.id, "preparando")}
        >
          {saving ? Spinner : <Flame className="h-4 w-4" />}
          Empezar preparación
        </Button>
      )}
      {a.puedeMarcarEnCamino && (
        <Button
          className="w-full rounded-xl gap-1.5 h-10 text-sm font-semibold"
          disabled={saving}
          onClick={() => onAction(pedido.id, "en_camino")}
        >
          {saving ? Spinner : <Bike className="h-4 w-4" />}
          Marcar en camino
        </Button>
      )}
      {a.puedeMarcarListoParaRetirar && (
        <Button
          className="w-full rounded-xl gap-1.5 h-10 text-sm font-semibold"
          disabled={saving}
          onClick={() => onAction(pedido.id, "listo_para_retirar")}
        >
          {saving ? Spinner : <Package className="h-4 w-4" />}
          Marcar listo para retirar
        </Button>
      )}
      {a.puedeMarcarEntregado && (
        <Button
          className="w-full rounded-xl gap-1.5 h-10 text-sm font-semibold"
          disabled={saving}
          onClick={() => onAction(pedido.id, "entregado")}
        >
          {saving ? Spinner : <CheckCircle2 className="h-4 w-4" />}
          Marcar entregado
        </Button>
      )}
      {a.puedeCancelar && (
        <Button
          variant="outline"
          className="w-full rounded-xl gap-1.5 h-10 text-sm font-semibold text-red-600 border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-950/30"
          disabled={saving}
          onClick={() => onSetCancelMode(true)}
        >
          <X className="h-4 w-4" />
          Cancelar pedido
        </Button>
      )}
    </div>
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

function EntregaIcon({ metodo, className }: { metodo: string; className?: string }) {
  const Icon = entregaInfo(metodo).icon
  return <Icon className={className} />
}

function StatusBadge({ estado }: { estado: string }) {
  const cfg = STATUS_CONFIG[estado]
  const Icon = cfg?.icon ?? Clock
  return (
    <Badge className={cn("text-[10px] h-5 px-1.5 border-0 gap-1", cfg?.chipColor ?? "bg-muted text-muted-foreground")}>
      <Icon className="h-3 w-3" />
      {cfg?.label ?? estado}
    </Badge>
  )
}

function PedidoRow({ pedido, onClick }: { pedido: PedidoPyR; onClick: () => void }) {
  const entrega = entregaInfo(pedido.metodoEntrega)
  const EIcon = entrega.icon
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted text-foreground/80">
          <EIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge estado={pedido.estado} />
          <span className="text-[10px] font-semibold text-muted-foreground">{entrega.label}</span>
          <span className="text-[10px] text-muted-foreground">{getTimeAgo(pedido.fecha)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {pedido.items.length} {pedido.items.length === 1 ? "ítem" : "ítems"}
          {pedido.clienteNombre ? ` · ${pedido.clienteNombre}` : ""}
        </p>
      </div>
      <span className="text-sm font-bold shrink-0">{formatPrice(pedido.total)}</span>
    </button>
  )
}

function PedidoItemRow({ item }: { item: PedidoItem }) {
  const hasDetails =
    (item.agregados?.length ?? 0) > 0 ||
    Object.keys(item.secciones || {}).length > 0 ||
    (item.ingredientesQuitados?.length ?? 0) > 0 ||
    item.talle ||
    item.color
  return (
    <div>
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
                <span
                  key={a.id ?? i}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 font-medium"
                >
                  + {a.nombre}
                </span>
              ))}
            </div>
          )}
          {item.ingredientesQuitados?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.ingredientesQuitados.map((ing, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 font-medium"
                >
                  Sin {ing}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
