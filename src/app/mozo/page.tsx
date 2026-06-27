"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Store,
  UserCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

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
  | { status: "no-link"; cuenta: CuentaOperativa }
  | { status: "operative"; cuenta: CuentaOperativa; vinculos: VinculoMozo[] }
  | { status: "denied"; message: string }
  | { status: "error"; message: string }

export default function MozoPanelPage() {
  const router = useRouter()
  const [state, setState] = useState<PanelState>({ status: "loading" })
  const [loggingOut, setLoggingOut] = useState(false)

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
          message: data.error || "Tu acceso operativo no está activo.",
        })
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar el panel")
      }

      if (data.estado === "sin_vinculo") {
        setState({ status: "no-link", cuenta: data.cuenta })
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
        message: "No se pudo conectar. Revisá tu conexión e intentá de nuevo.",
      })
    }
  }, [])

  useEffect(() => {
    loadPanel()
  }, [loadPanel])

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
        title="Ingresá para continuar"
        description="El panel de mozo requiere una sesión operativa válida."
      >
        <Button asChild className="w-full gap-2">
          <Link href="/mozo/iniciar-sesion">
            <LogIn className="h-4 w-4" />
            Iniciar sesión
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/mozo/registro">Crear cuenta de mozo</Link>
        </Button>
      </AuthShell>
    )
  }

  if (state.status === "no-link") {
    return (
      <AuthShell
        icon={<Link2 className="h-6 w-6" />}
        title="Cuenta pendiente de vinculación"
        description={`Hola, ${state.cuenta.nombre}. Para usar el panel necesitás vincularte a un mozo del negocio con un código de invitación.`}
      >
        <Button asChild className="w-full gap-2">
          <Link href="/mozo/unirse">
            <Link2 className="h-4 w-4" />
            Ingresar código de invitación
          </Link>
        </Button>
        <LogoutButton onLogout={handleLogout} loading={loggingOut} />
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
          Tu sesión operativa fue invalidada para este panel. Iniciá sesión nuevamente cuando el negocio reactive tu acceso.
        </p>
        <LogoutButton onLogout={handleLogout} loading={loggingOut} />
        <Button asChild variant="outline" className="w-full">
          <Link href="/mozo/iniciar-sesion">Ir a iniciar sesión</Link>
        </Button>
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

  const primaryLink = state.vinculos[0]

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 py-4 sm:py-8">
        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit gap-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Cuenta activa y vinculada
              </Badge>
              <div>
                <h1 className="text-2xl font-bold tracking-normal sm:text-3xl">
                  Hola, {primaryLink.empleado.nombre}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Panel operativo de {primaryLink.negocio.nombre}
                </p>
              </div>
            </div>
            <LogoutButton onLogout={handleLogout} loading={loggingOut} />
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-xl border-border/60">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Mozo</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {primaryLink.empleado.nombre} · {primaryLink.empleado.codigo}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Negocio vinculado</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {primaryLink.negocio.nombre}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="h-5 w-5" />
                <p className="font-semibold">Acceso protegido</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Las funciones de mesas y pedidos estarán disponibles próximamente en este panel autenticado.
              </p>
            </CardContent>
          </Card>
        </div>

        {state.vinculos.length > 1 && (
          <Card className="rounded-xl border-border/60">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold">Vínculos activos</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {state.vinculos.map((vinculo) => (
                  <div key={vinculo.empleado.id} className="rounded-lg border border-border/60 p-3">
                    <p className="font-semibold">{vinculo.negocio.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      {vinculo.empleado.nombre} · {vinculo.empleado.codigo}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
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
      Cerrar sesión
    </Button>
  )
}
