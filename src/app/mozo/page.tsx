"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { FormEvent, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Link2,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Store,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  }
  negocio: {
    id: string
    nombre: string
    slug: string
  }
}

type PanelState =
  | { status: "loading" }
  | { status: "no-session" }
  | { status: "no-link"; cuenta: CuentaOperativa; message: string }
  | { status: "operative"; cuenta: CuentaOperativa; vinculos: VinculoMozo[] }
  | { status: "denied"; message: string }
  | { status: "error"; message: string }

export default function MozoPanelPage() {
  const router = useRouter()
  const [state, setState] = useState<PanelState>({ status: "loading" })
  const [loggingOut, setLoggingOut] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [queryWantsJoin, setQueryWantsJoin] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joinError, setJoinError] = useState("")
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const loadPanel = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const res = await fetch("/api/operativo/me", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))

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
        throw new Error(data.error || "No se pudo cargar el panel")
      }

      if (data.estado === "sin_vinculo" || data.estado === "sin_vinculo_operativo") {
        setState({
          status: "no-link",
          cuenta: data.cuenta,
          message:
            data.estado === "sin_vinculo_operativo"
              ? "Actualmente no tenes un vinculo activo como mozo. Podes unirte a otro negocio con un codigo de invitacion."
              : "Todavia no tenes negocios vinculados. Ingresa un codigo de invitacion para empezar.",
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

      setState({ status: "error", message: "No se pudo resolver tu acceso operativo." })
    } catch {
      setState({
        status: "error",
        message: "No se pudo conectar. Revisa tu conexion e intenta de nuevo.",
      })
    }
  }, [])

  useEffect(() => {
    loadPanel()
  }, [loadPanel])

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
        router.replace("/mozo/iniciar-sesion")
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
      router.replace("/mozo", { scroll: false })
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
      router.replace("/mozo/iniciar-sesion")
    }
  }

  if (state.status === "loading") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm font-medium">Cargando panel de mozo</p>
        </div>
      </main>
    )
  }

  if (state.status === "no-session") {
    return (
      <AuthShell
        icon={<LogIn className="h-6 w-6" />}
        title="Ingresa para continuar"
        description="El panel de mozo requiere una sesion operativa valida."
      >
        <Button asChild className="w-full gap-2">
          <Link href="/mozo/iniciar-sesion">
            <LogIn className="h-4 w-4" />
            Iniciar sesion
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/mozo/registro">Crear cuenta de mozo</Link>
        </Button>
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
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
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
        <Button className="w-full gap-2" onClick={loadPanel}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </AuthShell>
    )
  }

  const cuenta = state.cuenta
  const vinculos = state.status === "operative" ? state.vinculos : []

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 py-4 sm:py-8">
        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit gap-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Cuenta activa
              </Badge>
              <div>
                <h1 className="text-2xl font-bold tracking-normal sm:text-3xl">
                  Hola, {cuenta.nombre}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {state.status === "no-link"
                    ? state.message
                    : "Elegi el negocio desde el que vas a trabajar."}
                </p>
              </div>
            </div>
            <LogoutButton onLogout={handleLogout} loading={loggingOut} />
          </div>
        </section>

        {joinSuccess && (
          <Card className="rounded-xl border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <CardContent className="flex items-start gap-3 p-4 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Vinculacion lista</p>
                <p className="text-sm">{joinSuccess}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {vinculos.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {vinculos.map((vinculo) => (
              <Card key={`${vinculo.negocio.slug}:${vinculo.empleado.codigo}`} className="rounded-xl border-border/60">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Store className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{vinculo.negocio.nombre}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {vinculo.empleado.nombre} - {vinculo.empleado.codigo}
                      </p>
                    </div>
                    <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      Activo
                    </Badge>
                  </div>
                  <Button asChild className="w-full gap-2">
                    <Link href={`/mozo/panel/${vinculo.negocio.slug}`}>
                      Entrar al salon
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {vinculos.length > 0 && !showJoinForm && (
          <Button variant="outline" className="w-full gap-2 sm:w-fit" onClick={() => setJoinOpen(true)}>
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
              router.replace("/mozo", { scroll: false })
            }}
          />
        )}

        <Card className="rounded-xl border-border/60">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
              <p className="font-semibold">Acceso limitado</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Tu cuenta de mozo entra a un salon operativo propio. No habilita configuracion, empleados, invitaciones, menu, precios, caja ni datos de otros negocios.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
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
    <Card className="rounded-xl border-border/60">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Unirme a un negocio</h2>
              <p className="text-sm text-muted-foreground">
                Ingresa el codigo temporal que te entrego el negocio.
              </p>
            </div>
          </div>
          {canClose && (
            <Button variant="ghost" size="icon" onClick={onClose} disabled={joining}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="codigo-union">Codigo de invitacion</Label>
            <Input
              id="codigo-union"
              value={code}
              onChange={(event) => onCodeChange(event.target.value.trim())}
              required
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button type="submit" className="gap-2 sm:self-end" disabled={joining || !code.trim()}>
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Vincular
          </Button>
        </form>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
    <Button variant="outline" className="w-full gap-2 sm:w-auto" onClick={onLogout} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Cerrar sesion
    </Button>
  )
}
