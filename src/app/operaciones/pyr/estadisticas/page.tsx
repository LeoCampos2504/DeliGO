"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Percent,
  ShieldAlert,
  WifiOff,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/shared/logo"
import { cn } from "@/lib/utils"

// ============================================
// Tipos (espejo de las estadísticas seguras de PyR)
// ============================================
type Periodo = "hoy" | "7d" | "30d"

interface Resumen {
  pedidosFinalizados: number
  entregados: number
  cancelados: number
  porcentajeEntregados: number
}

interface EstadisticasData {
  terminal: { nombre: string }
  negocio: { nombre: string; colorPrincipal: string }
  periodo: Periodo
  resumen: Resumen
}

type Phase =
  | { kind: "loading" }
  | { kind: "no-session" }
  | { kind: "no-permission" }
  | { kind: "error" }
  | { kind: "ready"; data: EstadisticasData; stale: boolean }

const PERIODO_OPTIONS: { value: Periodo; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
]

function getTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function toResumen(raw: unknown): Resumen {
  const r = (raw ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
  return {
    pedidosFinalizados: num(r.pedidosFinalizados),
    entregados: num(r.entregados),
    cancelados: num(r.cancelados),
    porcentajeEntregados: num(r.porcentajeEntregados),
  }
}

// ============================================
// Página
// ============================================
export default function OperacionesPyREstadisticasPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" })
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>("hoy")

  const stoppedRef = useRef(false)
  const acRef = useRef<AbortController | null>(null)
  const genRef = useRef(0)
  const periodoRef = useRef<Periodo>(periodo)
  periodoRef.current = periodo

  const applyTransientError = useCallback(() => {
    setPhase((prev) => (prev.kind === "ready" ? { ...prev, stale: true } : { kind: "error" }))
  }, [])

  const refresh = useCallback(
    async (p: Periodo) => {
      if (stoppedRef.current) return
      // Nunca disparar un request con la pestaña oculta (protección dentro de la carga).
      if (document.visibilityState !== "visible") return
      acRef.current?.abort()
      const ac = new AbortController()
      acRef.current = ac
      const gen = ++genRef.current

      try {
        const res = await fetch(`/api/operaciones/pyr/estadisticas?periodo=${p}`, {
          cache: "no-store",
          signal: ac.signal,
          referrerPolicy: "no-referrer",
        })
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
            periodo: (data.periodo as Periodo) ?? p,
            resumen: toResumen(data.resumen),
          },
          stale: false,
        })
        setLastUpdated(Date.now())
      } catch {
        if (ac.signal.aborted) return
        if (gen !== genRef.current) return
        applyTransientError()
      }
    },
    [applyTransientError]
  )

  // Sin polling. Carga al abrir + recarga al cambiar período + foco/visibilidad.
  // NUNCA se ejecutan requests automáticas con la pestaña oculta.
  useEffect(() => {
    if (document.visibilityState === "visible") void refresh(periodo)

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(periodoRef.current)
    }
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh(periodoRef.current)
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      acRef.current?.abort()
    }
  }, [refresh, periodo])

  if (phase.kind === "loading") {
    return (
      <CenteredShell>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando estadísticas…</p>
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
          Esta terminal no tiene permiso para acceder a las estadísticas de PyR.
        </p>
        <Button asChild className="rounded-xl gap-2 font-semibold">
          <Link href="/operaciones/pyr">
            <ArrowLeft className="h-4 w-4" />
            Volver a Pedidos y reseñas
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
          No se pudieron cargar las estadísticas. Revisá la conexión e intentá de nuevo.
        </p>
        <Button className="rounded-xl gap-2 font-semibold" onClick={() => refresh(periodo)}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </CenteredShell>
    )
  }

  return (
    <EstadisticasView
      data={phase.data}
      stale={phase.stale}
      lastUpdated={lastUpdated}
      periodo={periodo}
      onChangePeriodo={setPeriodo}
      onRefresh={() => refresh(periodo)}
    />
  )
}

// ============================================
// Vista principal
// ============================================
function EstadisticasView({
  data,
  stale,
  lastUpdated,
  periodo,
  onChangePeriodo,
  onRefresh,
}: {
  data: EstadisticasData
  stale: boolean
  lastUpdated: number | null
  periodo: Periodo
  onChangePeriodo: (p: Periodo) => void
  onRefresh: () => void
}) {
  const [refreshing, setRefreshing] = useState(false)

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const r = data.resumen
  const sinDatos = r.pedidosFinalizados === 0

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
            <Link href="/operaciones/pyr" aria-label="Volver a Pedidos y reseñas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Logo size="sm" />
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Estadísticas
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
        {stale && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
            <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No se pudo actualizar. Mostrando los últimos datos.
            </p>
          </div>
        )}

        {/* Selector de período */}
        <div className="flex gap-2 flex-wrap">
          {PERIODO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChangePeriodo(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                periodo === opt.value
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tarjetas de métricas operativas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={ClipboardList}
            tone="neutral"
            label="Pedidos finalizados"
            value={r.pedidosFinalizados}
            hint="Pedidos de delivery o retiro entregados o cancelados en el período."
          />
          <MetricCard
            icon={CheckCircle2}
            tone="emerald"
            label="Entregados"
            value={r.entregados}
            hint="Pedidos no-mesa que se completaron y entregaron."
          />
          <MetricCard
            icon={XCircle}
            tone="red"
            label="Cancelados"
            value={r.cancelados}
            hint="Pedidos no-mesa que fueron cancelados."
          />
          <MetricCard
            icon={Percent}
            tone="primary"
            label="% Entregados"
            value={`${r.porcentajeEntregados}%`}
            hint="Entregados sobre el total de finalizados."
          />
        </div>

        {sinDatos && (
          <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-border/50 bg-muted/10">
            <BarChart3 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm font-semibold text-muted-foreground">Sin pedidos finalizados</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              No hay pedidos de delivery o retiro finalizados en este período.
            </p>
          </div>
        )}
      </div>
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

const TONE_STYLES: Record<string, { tile: string; icon: string; value: string }> = {
  neutral: {
    tile: "border-border/50 bg-card",
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
  emerald: {
    tile: "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  red: {
    tile: "border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20",
    icon: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    value: "text-red-700 dark:text-red-300",
  },
  primary: {
    tile: "border-primary/20 bg-primary/5",
    icon: "bg-primary/10 text-primary",
    value: "text-primary",
  },
}

function MetricCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof ClipboardList
  tone: keyof typeof TONE_STYLES
  label: string
  value: number | string
  hint: string
}) {
  const styles = TONE_STYLES[tone]
  return (
    <div className={cn("rounded-2xl border p-4 flex flex-col gap-2", styles.tile)}>
      <div className="flex items-center gap-2">
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-2xl font-extrabold leading-none", styles.value)}>{value}</p>
      <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>
    </div>
  )
}
