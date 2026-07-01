"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  KeyRound,
  Link2,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  UserRound,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/shared/logo"

interface CuentaOperativa {
  id: string
  nombre: string
  email: string
  activo: boolean
}

interface VinculoMozo {
  empleado: {
    id: string
    nombre: string
    codigo: string
    rol: string
    activo: boolean
    areaOperativa?: string
    areaOperativaEfectiva?: string
  }
  negocio: {
    id: string
    nombre: string
    slug: string
  }
}

// Etiquetas de presentación del área efectiva (la fuente de verdad es el servidor).
const AREA_LABELS: Record<string, string> = {
  mozo: "Mozo",
  salon: "Salón",
  pyr: "Pedidos y reseñas",
  sin_asignar: "Sin área asignada",
}

// Mensaje informativo (no técnico) para áreas cuyo panel personal aún no existe.
const AREA_PENDIENTE_MSG: Record<string, string> = {
  salon: "Tu área actual es Salón. Este panel personal estará disponible próximamente desde DeliGO Operaciones.",
  pyr: "Tu área actual es Pedidos y reseñas. Este panel personal estará disponible próximamente desde DeliGO Operaciones.",
  sin_asignar: "Pedile al administrador del negocio que asigne tu área operativa.",
}

function areaLabel(area?: string) {
  return AREA_LABELS[area ?? "sin_asignar"] ?? AREA_LABELS.sin_asignar
}

function areaEfectivaDeVinculo(vinculo: VinculoMozo): string {
  // Confiar únicamente en el área efectiva resuelta por el servidor. Sin fallback por
  // rol (Operaciones-1F.2): ante respuesta incompleta/desconocida → "sin_asignar",
  // nunca inferir "mozo" desde rol.
  return vinculo.empleado.areaOperativaEfectiva ?? "sin_asignar"
}

type PanelState =
  | { status: "loading" }
  | { status: "no-session" }
  | { status: "no-link"; cuenta: CuentaOperativa; message: string }
  | { status: "operative"; cuenta: CuentaOperativa; vinculos: VinculoMozo[] }
  | { status: "denied"; message: string }
  | { status: "error"; message: string }

// Refresco automático del contexto personal: como máximo cada 15 s y solo con la
// pestaña visible (más focus/visibilitychange). Es UX + defensa adicional; la
// autorización real la aplica el servidor en cada request protegida.
const PERSONAL_REFRESH_INTERVAL_MS = 15000

export default function MozoPanelPage() {
  const router = useRouter()
  const nav = useOperativoNav()
  const [state, setState] = useState<PanelState>({ status: "loading" })
  // Una sola solicitud de refresco activa (abort de la anterior) + guardia de
  // generación para nunca aplicar una respuesta vieja sobre una nueva.
  const refreshAcRef = useRef<AbortController | null>(null)
  const refreshGenRef = useRef(0)
  const [loggingOut, setLoggingOut] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [queryWantsJoin, setQueryWantsJoin] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joinError, setJoinError] = useState("")
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const loadPanel = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true

    // Sin solapamiento (Operaciones-1G.1): un refresco silencioso NO se inicia si ya
    // hay una solicitud activa (no aborta, no incrementa generación, retorna en
    // silencio). Una carga inicial/manual SÍ puede abortar una silenciosa previa para
    // priorizar la acción explícita. Siempre queda una única solicitud activa.
    if (silent && refreshAcRef.current) return
    refreshAcRef.current?.abort()
    const ac = new AbortController()
    refreshAcRef.current = ac
    const generation = ++refreshGenRef.current

    // Carga inicial/manual muestra el skeleton; el refresco silencioso conserva la
    // pantalla actual (sin flicker).
    if (!silent) setState({ status: "loading" })

    try {
      const res = await fetch("/api/operativo/me", { cache: "no-store", signal: ac.signal })
      const data = await res.json().catch(() => ({}))
      if (generation !== refreshGenRef.current) return

      if (res.status === 401 || data.estado === "sin_sesion") {
        setState({ status: "no-session" })
        return
      }

      if (res.status === 403 || data.estado === "acceso_denegado") {
        setState({
          status: "denied",
          message: data.error || "Tu acceso operativo no esta activo.",
        })
        return
      }

      if (!res.ok) {
        // Fallo transitorio: en refresco silencioso conservar el estado visible.
        if (!silent) {
          setState({ status: "error", message: "No se pudo resolver tu acceso operativo." })
        }
        return
      }

      if (data.estado === "sin_vinculo" || data.estado === "sin_vinculo_operativo") {
        setState({
          status: "no-link",
          cuenta: data.cuenta,
          // Usar el mensaje real del servidor cuando esté disponible (una cuenta puede
          // estar vinculada como Salón/PyR/Sin área, no solo como mozo).
          message:
            data.mensaje ||
            (data.estado === "sin_vinculo_operativo"
              ? "Actualmente no tenes un vinculo operativo disponible. Podes unirte a un negocio con un codigo de invitacion."
              : "Todavia no tenes negocios vinculados. Ingresa un codigo de invitacion para empezar."),
        })
        return
      }

      if (data.estado === "operativo") {
        setState({
          status: "operative",
          cuenta: data.cuenta,
          vinculos: data.vinculos ?? [],
        })
        return
      }

      if (!silent) {
        setState({ status: "error", message: "No se pudo resolver tu acceso operativo." })
      }
    } catch {
      // Abort o respuesta superada: no tocar el estado. Error de red en silencioso:
      // conservar la pantalla; en carga inicial/manual mostrar el error.
      if (ac.signal.aborted || generation !== refreshGenRef.current) return
      if (!silent) {
        setState({
          status: "error",
          message: "No se pudo conectar. Revisa tu conexion e intenta de nuevo.",
        })
      }
    } finally {
      // Liberar el ref solo si sigue apuntando a ESTA solicitud: evita que el finally
      // de una request vieja limpie el ref de una nueva.
      if (refreshAcRef.current === ac) refreshAcRef.current = null
    }
  }, [])

  useEffect(() => {
    loadPanel()
  }, [loadPanel])

  // Refresco automático silencioso: intervalo (solo pestaña visible) + focus +
  // visibilitychange. No hace polling oculto y limpia interval/listeners/abort.
  useEffect(() => {
    const silentRefresh = () => {
      if (document.visibilityState === "visible") void loadPanel({ silent: true })
    }
    const interval = window.setInterval(silentRefresh, PERSONAL_REFRESH_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") silentRefresh()
    }
    const onFocus = () => silentRefresh()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      refreshAcRef.current?.abort()
    }
  }, [loadPanel])

  // En el árbol /operaciones/mi-panel, sin sesión personal se redirige a login
  // (en /mozo se muestran los accesos). Nunca usa identidad de terminal.
  useEffect(() => {
    if (nav.noSessionMode === "redirect" && state.status === "no-session") {
      router.replace(nav.loginHref)
    }
  }, [nav, state.status, router])

  useEffect(() => {
    setQueryWantsJoin(new URLSearchParams(window.location.search).get("accion") === "unirse")
  }, [])

  const showJoinForm = useMemo(() => {
    return state.status === "no-link" || joinOpen || queryWantsJoin
  }, [joinOpen, queryWantsJoin, state.status])

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setJoinError("")
    setJoinSuccess(null)
    setJoining(true)

    try {
      const res = await fetch("/api/operativo/mozos/unirse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ codigo: joinCode }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 401 || res.status === 403) {
        setJoinCode("")
        setState({ status: "no-session" })
        router.replace(nav.loginHref)
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "No se pudo vincular la cuenta")
      }

      const negocioNombre = data.vinculo?.negocio?.nombre
      setJoinCode("")
      setJoinOpen(false)
      setQueryWantsJoin(false)
      setJoinSuccess(
        negocioNombre
          ? `Cuenta vinculada a ${negocioNombre}.`
          : "Cuenta vinculada correctamente."
      )
      router.replace(nav.homeHref, { scroll: false })
      await loadPanel()
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "No se pudo vincular la cuenta")
    } finally {
      setJoining(false)
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
      setState({ status: "no-session" })
      setLoggingOut(false)
      router.replace(nav.loginHref)
    }
  }

  if (state.status === "loading") {
    return <MozoPageSkeleton />
  }

  if (state.status === "no-session") {
    // En /operaciones/mi-panel se redirige a login (el efecto ya lo dispara);
    // se muestra un placeholder mínimo para no exponer accesos de otro árbol.
    if (nav.noSessionMode === "redirect") {
      return <MozoPageSkeleton />
    }
    return (
      <AuthShell
        icon={<LogIn className="h-6 w-6" />}
        title="Ingresa para continuar"
        description="El panel de mozo requiere una sesion operativa valida."
      >
        <Button asChild className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600">
          <Link href={nav.loginHref}>
            <LogIn className="h-4 w-4" />
            Iniciar sesion
          </Link>
        </Button>
        {nav.registroHref && (
          <Button asChild variant="outline" className="h-11 w-full rounded-xl">
            <Link href={nav.registroHref}>Crear cuenta de mozo</Link>
          </Button>
        )}
      </AuthShell>
    )
  }

  if (state.status === "denied") {
    return (
      <AuthShell
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Acceso operativo no disponible"
        description={state.message}
      >
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          Tu sesion operativa no esta habilitada para este panel. Podes iniciar sesion nuevamente o aceptar una nueva invitacion cuando el negocio reactive tu acceso.
        </p>
        <LogoutButton onLogout={handleLogout} loading={loggingOut} />
      </AuthShell>
    )
  }

  if (state.status === "error") {
    return (
      <AuthShell
        icon={<AlertTriangle className="h-6 w-6" />}
        title="No pudimos cargar el panel"
        description={state.message}
      >
        <Button className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600" onClick={loadPanel}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </AuthShell>
    )
  }

  const cuenta = state.cuenta
  const vinculos = state.status === "operative" ? state.vinculos : []

  return (
    <main className="min-h-screen bg-background">
      <PanelHeader
        cuenta={cuenta}
        vinculosCount={vinculos.length}
        loggingOut={loggingOut}
        onRefresh={loadPanel}
        onLogout={handleLogout}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:py-6">
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="border-b border-border/60 bg-gradient-to-r from-amber-500/12 via-orange-500/8 to-transparent p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <Badge className="w-fit gap-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Cuenta activa
                </Badge>
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Hola, {cuenta.nombre}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {state.status === "no-link"
                      ? state.message
                      : "Elegi el negocio desde el que vas a trabajar."}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:min-w-64">
                <InfoPill icon={<Mail className="h-4 w-4" />} label="Email" value={cuenta.email} />
                <InfoPill icon={<Building2 className="h-4 w-4" />} label="Negocios" value={String(vinculos.length)} />
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            <MiniMetric icon={<BadgeCheck className="h-4 w-4" />} label="Estado" value={cuenta.activo ? "Activa" : "Inactiva"} />
            <MiniMetric icon={<UserRound className="h-4 w-4" />} label="Vinculos activos" value={String(vinculos.length)} />
            <MiniMetric
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Areas operativas"
              value={
                Array.from(new Set(vinculos.map((v) => areaLabel(areaEfectivaDeVinculo(v))))).join(", ") || "Sin area"
              }
            />
          </div>
        </section>

        {joinSuccess && (
          <Card className="rounded-2xl border-emerald-200 bg-emerald-50 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <CardContent className="flex items-start gap-3 p-4 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Vinculacion lista</p>
                <p className="text-sm">{joinSuccess}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {vinculos.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {vinculos.map((vinculo) => {
              const areaEfectiva = areaEfectivaDeVinculo(vinculo)
              const esMozo = areaEfectiva === "mozo"
              return (
                <Card
                  key={`${vinculo.negocio.slug}:${vinculo.empleado.codigo}`}
                  className="group overflow-hidden rounded-2xl border-border/60 shadow-sm transition hover:border-amber-300/70 hover:shadow-md dark:hover:border-amber-700/60"
                >
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                        <Store className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-lg font-bold">{vinculo.negocio.nombre}</p>
                          <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            {areaLabel(areaEfectiva)}
                          </Badge>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {vinculo.empleado.nombre} - Codigo {vinculo.empleado.codigo}
                        </p>
                      </div>
                    </div>
                    {esMozo ? (
                      <Button asChild className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/15 hover:bg-amber-600">
                        <Link href={nav.panelHref(vinculo.negocio.slug)}>
                          Entrar al salon
                          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                        </Link>
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <p className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                          {AREA_PENDIENTE_MSG[areaEfectiva] ?? AREA_PENDIENTE_MSG.sin_asignar}
                        </p>
                        <Button asChild variant="outline" className="h-10 w-full gap-2 rounded-xl">
                          <Link href="/operaciones">Ir a DeliGO Operaciones</Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="rounded-2xl border-dashed border-amber-300/70 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/10">
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <Link2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-bold">Sin negocios vinculados</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ingresa un codigo de invitacion para empezar a trabajar en un salon.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {vinculos.length > 0 && !showJoinForm && (
          <Button variant="outline" className="h-11 w-full gap-2 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-950/20 sm:w-fit" onClick={() => setJoinOpen(true)}>
            <Plus className="h-4 w-4" />
            Unirme a otro negocio
          </Button>
        )}

        {showJoinForm && (
          <JoinBusinessCard
            code={joinCode}
            error={joinError}
            joining={joining}
            canClose={state.status !== "no-link"}
            onCodeChange={setJoinCode}
            onSubmit={handleJoin}
            onClose={() => {
              setJoinOpen(false)
              setQueryWantsJoin(false)
              setJoinError("")
              router.replace(nav.homeHref, { scroll: false })
            }}
          />
        )}

        <Card className="rounded-2xl border-border/60 bg-card/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Acceso limitado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tu cuenta de mozo entra a un salon operativo propio. No habilita configuracion, empleados, invitaciones, menu, precios, caja ni datos de otros negocios.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function PanelHeader({
  cuenta,
  vinculosCount,
  loggingOut,
  onRefresh,
  onLogout,
}: {
  cuenta: CuentaOperativa
  vinculosCount: number
  loggingOut: boolean
  onRefresh: () => void
  onLogout: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="min-w-0">
          <Logo size="sm" />
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{cuenta.nombre}</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            <span>{vinculosCount} negocio{vinculosCount === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={onRefresh} aria-label="Actualizar panel">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={onLogout} disabled={loggingOut} aria-label="Cerrar sesion">
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  )
}

function JoinBusinessCard({
  code,
  error,
  joining,
  canClose,
  onCodeChange,
  onSubmit,
  onClose,
}: {
  code: string
  error: string
  joining: boolean
  canClose: boolean
  onCodeChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">Unirme a un negocio</h2>
              <p className="text-sm text-muted-foreground">
                Ingresa el codigo temporal que te entrego el negocio.
              </p>
            </div>
          </div>
          {canClose && (
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose} disabled={joining}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="codigo-union">Codigo de invitacion</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="codigo-union"
                value={code}
                onChange={(event) => onCodeChange(event.target.value.trim())}
                required
                autoComplete="off"
                spellCheck={false}
                className="h-11 rounded-xl pl-9"
              />
            </div>
          </div>
          <Button type="submit" className="h-11 gap-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 sm:self-end" disabled={joining || !code.trim()}>
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Vincular
          </Button>
        </form>

        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function AuthShell({
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
          <div className="space-y-2">{children}</div>
        </CardContent>
      </Card>
    </main>
  )
}

function LogoutButton({
  onLogout,
  loading,
}: {
  onLogout: () => void
  loading: boolean
}) {
  return (
    <Button variant="outline" className="h-11 w-full gap-2 rounded-xl sm:w-auto" onClick={onLogout} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Cerrar sesion
    </Button>
  )
}

function InfoPill({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  )
}

function MiniMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold">{value}</p>
      </div>
    </div>
  )
}

function MozoPageSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Skeleton className="h-7 w-24 rounded-lg" />
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
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    </main>
  )
}
