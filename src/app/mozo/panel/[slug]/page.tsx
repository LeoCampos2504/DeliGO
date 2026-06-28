"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Armchair,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LogOut,
  Receipt,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  UserCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/shared/logo"
import { cn, formatPrice } from "@/lib/utils"

interface MesaOperativa {
  id: string
  numero: number
  nombre: string
  zona: string
  capacidad: number
  activa: boolean
  asignadaAMi: boolean
  asignadaAOtro: boolean
  pedidosActivos: Array<{
    estado: string
    total: number
  }>
  pedidosActivosCount: number
  pedidosActivosTotal: number
}

interface PanelData {
  estado: "operativo"
  empleado: {
    nombre: string
    codigo: string
    rol: string
    activo: boolean
  }
  negocio: {
    nombre: string
    slug: string
    colorPrincipal: string
    logoUrl: string | null
    salonActivo: boolean
  }
  resumen: {
    mesasActivas: number
    misMesas: number
    mesasConPedidos: number
  }
  mesas: MesaOperativa[]
  accionesDisponibles: string[]
}

type PageState =
  | { status: "loading" }
  | { status: "ready"; data: PanelData }
  | { status: "no-session" }
  | { status: "unavailable" }
  | { status: "error"; message: string }

const ESTADO_LABEL: Record<string, string> = {
  recibido: "Nuevo",
  preparando: "Preparando",
  listo_para_retirar: "Listo",
}

const PANEL_POLL_INTERVAL_MS = 10000

function buildResumen(mesas: MesaOperativa[]): PanelData["resumen"] {
  return {
    mesasActivas: mesas.length,
    misMesas: mesas.filter((mesa) => mesa.asignadaAMi).length,
    mesasConPedidos: mesas.filter((mesa) => mesa.pedidosActivosCount > 0).length,
  }
}

function updatePanelMesa(data: PanelData, updatedMesa: MesaOperativa): PanelData {
  const mesas = data.mesas.map((mesa) => (mesa.id === updatedMesa.id ? updatedMesa : mesa))
  return {
    ...data,
    resumen: buildResumen(mesas),
    mesas,
  }
}

export default function MozoSalonPanelPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const slug = params.slug
  const [state, setState] = useState<PageState>({ status: "loading" })
  const [actionMesaIds, setActionMesaIds] = useState<Set<string>>(() => new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const refreshGenerationRef = useRef(0)
  const silentRefreshRef = useRef<{ controller: AbortController; generation: number } | null>(null)

  const invalidateSilentRefresh = useCallback(() => {
    refreshGenerationRef.current += 1
    silentRefreshRef.current?.controller.abort()
    silentRefreshRef.current = null
  }, [])

  const loadPanel = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    let controller: AbortController | null = null
    let generation = refreshGenerationRef.current

    if (silent) {
      if (silentRefreshRef.current) return
      controller = new AbortController()
      generation = refreshGenerationRef.current
      silentRefreshRef.current = { controller, generation }
    } else {
      invalidateSilentRefresh()
      setState((current) => (current.status === "ready" ? current : { status: "loading" }))
      setActionError(null)
    }

    const canApplySilentResponse = () =>
      !silent ||
      (
        silentRefreshRef.current?.controller === controller &&
        silentRefreshRef.current.generation === generation &&
        refreshGenerationRef.current === generation
      )

    try {
      const res = await fetch(`/api/operativo/mozo/panel/${encodeURIComponent(slug)}`, {
        cache: "no-store",
        signal: controller?.signal,
      })
      const data = await res.json().catch(() => ({}))

      if (!canApplySilentResponse()) return

      if (res.status === 401 || data.estado === "sin_sesion") {
        setState({ status: "no-session" })
        return
      }

      if (res.status === 403 || data.estado === "acceso_no_disponible") {
        setState({ status: "unavailable" })
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar el salon")
      }

      setState({ status: "ready", data })
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      if (!silent) {
        setState({
          status: "error",
          message: "No se pudo conectar. Revisa tu conexion e intenta de nuevo.",
        })
      }
    } finally {
      if (silent && silentRefreshRef.current?.controller === controller) {
        silentRefreshRef.current = null
      }
    }
  }, [invalidateSilentRefresh, slug])

  useEffect(() => {
    loadPanel()
  }, [loadPanel])

  useEffect(() => {
    const refreshSilently = () => {
      if (document.visibilityState === "visible") {
        void loadPanel({ silent: true })
      }
    }

    const interval = window.setInterval(refreshSilently, PANEL_POLL_INTERVAL_MS)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSilently()
      }
    }
    const handleFocus = () => refreshSilently()

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
      invalidateSilentRefresh()
    }
  }, [invalidateSilentRefresh, loadPanel])

  const zonas = useMemo(() => {
    if (state.status !== "ready") return []
    const groups = new Map<string, MesaOperativa[]>()
    for (const mesa of state.data.mesas) {
      const key = mesa.zona || "Salon"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(mesa)
    }
    return Array.from(groups.entries())
  }, [state])

  const handleMesaAction = async (mesa: MesaOperativa) => {
    invalidateSilentRefresh()
    setActionMesaIds((current) => {
      const next = new Set(current)
      next.add(mesa.id)
      return next
    })
    setActionError(null)
    try {
      const res = await fetch(`/api/operativo/mozo/panel/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          mesaId: mesa.id,
          accion: mesa.asignadaAMi ? "liberar_mesa" : "tomar_mesa",
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 401) {
        setState({ status: "no-session" })
        return
      }

      if (res.status === 403 || data.estado === "acceso_no_disponible") {
        setState({ status: "unavailable" })
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "No se pudo completar la accion")
      }

      if (data.mesa) {
        setState((current) =>
          current.status === "ready"
            ? { status: "ready", data: updatePanelMesa(current.data, data.mesa) }
            : current
        )
      }
      invalidateSilentRefresh()
      void loadPanel({ silent: true })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo completar la accion")
    } finally {
      setActionMesaIds((current) => {
        const next = new Set(current)
        next.delete(mesa.id)
        return next
      })
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch("/api/operativo/logout", {
        method: "POST",
        cache: "no-store",
      })
    } finally {
      setLoggingOut(false)
      router.replace("/mozo/iniciar-sesion")
    }
  }

  if (state.status === "loading") {
    return <SalonSkeleton />
  }

  if (state.status === "no-session") {
    return (
      <StatusShell
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Sesion requerida"
        description="Inicia sesion con tu cuenta de mozo para entrar al salon."
      >
        <Button asChild className="h-11 w-full rounded-xl bg-amber-500 text-white hover:bg-amber-600">
          <Link href="/mozo/iniciar-sesion">Iniciar sesion</Link>
        </Button>
      </StatusShell>
    )
  }

  if (state.status === "unavailable") {
    return (
      <StatusShell
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Salon no disponible"
        description="No tenes acceso operativo activo para este salon. Volve al panel y elegi un negocio disponible."
      >
        <Button asChild className="h-11 w-full rounded-xl bg-amber-500 text-white hover:bg-amber-600">
          <Link href="/mozo">Volver a mi panel</Link>
        </Button>
      </StatusShell>
    )
  }

  if (state.status === "error") {
    return (
      <StatusShell
        icon={<AlertTriangle className="h-6 w-6" />}
        title="No pudimos cargar el salon"
        description={state.message}
      >
        <Button className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600" onClick={() => loadPanel()}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </StatusShell>
    )
  }

  const { data } = state

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
              <Link href="/mozo" aria-label="Volver al panel de mozo">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <Logo size="sm" />
              <p className="truncate text-xs text-muted-foreground">
                {data.negocio.nombre} - {data.empleado.nombre}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => loadPanel({ silent: true })} aria-label="Actualizar salon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={handleLogout} disabled={loggingOut} aria-label="Cerrar sesion">
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:py-6">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="border-b border-border/60 bg-gradient-to-r from-amber-500/12 via-orange-500/8 to-transparent p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <Badge className="w-fit gap-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Salon activo
                </Badge>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    {data.negocio.nombre}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.empleado.nombre} - Codigo {data.empleado.codigo}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-sm">
                <p className="font-semibold">Operacion de salon</p>
                <p className="text-muted-foreground">Toma mesas, carga pedidos y mantenete sincronizado.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard icon={<Armchair className="h-4 w-4" />} label="Mesas activas" value={data.resumen.mesasActivas} />
          <SummaryCard icon={<UserCheck className="h-4 w-4" />} label="Mis mesas" value={data.resumen.misMesas} />
          <SummaryCard icon={<ShoppingBag className="h-4 w-4" />} label="Con pedidos" value={data.resumen.mesasConPedidos} />
        </div>

        <div className="space-y-4">
          {actionError && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </p>
          )}

          {zonas.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border/70 bg-card/80">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <Armchair className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">No hay mesas activas</p>
                  <p className="mt-1 text-sm text-muted-foreground">Cuando el negocio active mesas, van a aparecer en este salon.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            zonas.map(([zona, mesas]) => (
              <section key={zona} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-muted-foreground">{zona}</p>
                  <Badge variant="outline" className="rounded-full">{mesas.length} mesa{mesas.length === 1 ? "" : "s"}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {mesas.map((mesa) => {
                    const isMesaActionActive = actionMesaIds.has(mesa.id)
                    return (
                      <MesaCard
                        key={mesa.id}
                        mesa={mesa}
                        loading={isMesaActionActive}
                        actionDisabled={isMesaActionActive}
                        onMesaAction={() => handleMesaAction(mesa)}
                        onOrder={() => router.push(`/mozo/panel/${encodeURIComponent(slug)}/pedido/${encodeURIComponent(mesa.id)}`)}
                      />
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </main>
  )
}

function MesaCard({
  mesa,
  loading,
  actionDisabled,
  onMesaAction,
  onOrder,
}: {
  mesa: MesaOperativa
  loading: boolean
  actionDisabled: boolean
  onMesaAction: () => void
  onOrder: () => void
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm transition hover:shadow-md",
        mesa.asignadaAMi && "border-amber-300 ring-1 ring-amber-200/70 dark:border-amber-800 dark:ring-amber-900/50",
        mesa.asignadaAOtro && "opacity-75"
      )}
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                mesa.asignadaAMi
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Armchair className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold">Mesa {mesa.numero}</p>
              {mesa.nombre && (
                <p className="truncate text-sm text-muted-foreground">{mesa.nombre}</p>
              )}
            </div>
          </div>
          <MesaBadge mesa={mesa} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-border/60 bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Capacidad</p>
            <p className="font-bold">{mesa.capacidad} lugares</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Activos</p>
            <p className="font-bold">{mesa.pedidosActivosCount} pedido{mesa.pedidosActivosCount === 1 ? "" : "s"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
          {mesa.pedidosActivosCount > 0 ? (
            <p className="font-semibold">
              Total activo: {formatPrice(mesa.pedidosActivosTotal)}
            </p>
          ) : (
            <p className="text-muted-foreground">Sin pedidos activos</p>
          )}
        </div>

        {mesa.pedidosActivos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mesa.pedidosActivos.map((pedido, index) => (
              <Badge key={`${mesa.id}:${index}`} variant="outline" className="rounded-full text-[10px]">
                {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid gap-2">
          {mesa.asignadaAMi && (
            <Button className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/15 hover:bg-amber-600" onClick={onOrder} disabled={actionDisabled}>
              <Receipt className="h-4 w-4" />
              Tomar pedido
            </Button>
          )}
          <Button
            className="h-10 w-full rounded-xl"
            variant={mesa.asignadaAMi ? "outline" : "default"}
            onClick={onMesaAction}
            disabled={actionDisabled || mesa.asignadaAOtro}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mesa.asignadaAMi ? (
              "Liberar mesa"
            ) : mesa.asignadaAOtro ? (
              "Asignada a otro mozo"
            ) : (
              "Tomar mesa"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/90 shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {icon}
          </div>
          <div>
            <p className="text-xl font-extrabold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MesaBadge({ mesa }: { mesa: MesaOperativa }) {
  if (mesa.asignadaAMi) {
    return (
      <Badge className="rounded-full border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        Mia
      </Badge>
    )
  }

  if (mesa.asignadaAOtro) {
    return <Badge variant="outline" className="rounded-full">Ocupada</Badge>
  }

  return <Badge variant="outline" className="rounded-full">Libre</Badge>
}

function StatusShell({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
      </div>
      <Card className="relative w-full max-w-md rounded-2xl border-border/60 shadow-xl shadow-amber-950/5 dark:shadow-black/20">
        <CardContent className="space-y-5 p-5">
          <div className="space-y-2">
            <Logo size="sm" />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {icon}
            </div>
            <div>
              <h1 className="text-xl font-bold">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <div>{children}</div>
        </CardContent>
      </Card>
    </main>
  )
}

function SalonSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1">
              <Skeleton className="h-6 w-24 rounded-lg" />
              <Skeleton className="h-3 w-40 rounded-lg" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5">
        <Card className="rounded-2xl border-border/60">
          <CardContent className="space-y-4 p-5">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-8 w-56 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-lg rounded-lg" />
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    </main>
  )
}
