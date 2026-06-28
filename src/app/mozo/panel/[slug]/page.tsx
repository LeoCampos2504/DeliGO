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
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm font-medium">Cargando salon operativo</p>
        </div>
      </main>
    )
  }

  if (state.status === "no-session") {
    return (
      <StatusShell
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Sesion requerida"
        description="Inicia sesion con tu cuenta de mozo para entrar al salon."
      >
        <Button asChild className="w-full">
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
        <Button asChild className="w-full">
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
        <Button className="w-full gap-2" onClick={() => loadPanel()}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </StatusShell>
    )
  }

  const { data } = state

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 py-4 sm:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="outline" className="w-fit gap-2">
            <Link href="/mozo">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Button variant="outline" className="w-fit gap-2" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Cerrar sesion
          </Button>
        </div>

        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit gap-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Salon operativo
              </Badge>
              <div>
                <h1 className="text-2xl font-bold tracking-normal sm:text-3xl">
                  {data.negocio.nombre}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.empleado.nombre} - {data.empleado.codigo}
                </p>
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
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </p>
          )}

          {zonas.length === 0 ? (
            <Card className="rounded-xl border-border/60">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No hay mesas activas en este salon.
              </CardContent>
            </Card>
          ) : (
            zonas.map(([zona, mesas]) => (
              <section key={zona} className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">{zona}</p>
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
        "rounded-xl border-border/60",
        mesa.asignadaAMi && "border-emerald-300 dark:border-emerald-800",
        mesa.asignadaAOtro && "opacity-70"
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">Mesa {mesa.numero}</p>
            {mesa.nombre && (
              <p className="text-sm text-muted-foreground">{mesa.nombre}</p>
            )}
          </div>
          <MesaBadge mesa={mesa} />
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{mesa.capacidad} lugares</p>
          {mesa.pedidosActivosCount > 0 ? (
            <p>
              {mesa.pedidosActivosCount} pedido{mesa.pedidosActivosCount === 1 ? "" : "s"} activo{mesa.pedidosActivosCount === 1 ? "" : "s"} - {formatPrice(mesa.pedidosActivosTotal)}
            </p>
          ) : (
            <p>Sin pedidos activos</p>
          )}
        </div>

        {mesa.pedidosActivos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mesa.pedidosActivos.map((pedido, index) => (
              <Badge key={`${mesa.id}:${index}`} variant="outline" className="text-[10px]">
                {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid gap-2">
          {mesa.asignadaAMi && (
            <Button className="w-full gap-2" onClick={onOrder} disabled={actionDisabled}>
              <Receipt className="h-4 w-4" />
              Tomar pedido
            </Button>
          )}
          <Button
            className="w-full"
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
    <Card className="rounded-xl border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <p className="text-xl font-bold">{value}</p>
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
      <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
        Mia
      </Badge>
    )
  }

  if (mesa.asignadaAOtro) {
    return <Badge variant="outline">Ocupada</Badge>
  }

  return <Badge variant="outline">Libre</Badge>
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
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-xl border-border/60">
        <CardContent className="p-5 space-y-5">
          <div className="space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
