"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useCallback, useEffect, useState } from "react"
import { CheckCircle2, Link2, Loader2, LogOut, Plus, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Vinculo {
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

interface OperativoMe {
  cuenta: {
    id: string
    nombre: string
    email: string
    activo: boolean
  }
  vinculos: Vinculo[]
}

export default function MozoUnirsePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<OperativoMe | null>(null)
  const [codigo, setCodigo] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState<Vinculo | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [joining, setJoining] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    try {
      const res = await fetch("/api/operativo/me", { cache: "no-store" })
      if (res.status === 401 || res.status === 403) {
        setProfile(null)
        setCodigo("")
        router.replace("/mozo/iniciar-sesion")
        return
      }
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar la cuenta")
      }
      setProfile({ cuenta: data.cuenta, vinculos: data.vinculos ?? [] })
    } catch {
      setError("No se pudo cargar la cuenta")
    } finally {
      setLoadingProfile(false)
    }
  }, [router])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setSuccess(null)
    setJoining(true)

    try {
      const res = await fetch("/api/operativo/mozos/unirse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ codigo }),
      })
      const data = await res.json()
      if (res.status === 401 || res.status === 403) {
        setCodigo("")
        setProfile(null)
        router.replace("/mozo/iniciar-sesion")
        return
      }
      if (!res.ok) {
        throw new Error(data.error || "No se pudo vincular la cuenta")
      }
      setCodigo("")
      setSuccess(data.vinculo)
      await loadProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular la cuenta")
    } finally {
      setJoining(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    setCodigo("")
    setSuccess(null)
    try {
      await fetch("/api/operativo/logout", {
        method: "POST",
        cache: "no-store",
      })
    } finally {
      setProfile(null)
      setLoggingOut(false)
      router.replace("/mozo/iniciar-sesion")
    }
  }

  if (loadingProfile) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cuenta de mozo</h1>
            <p className="text-sm text-muted-foreground">
              {profile?.cuenta.nombre}
            </p>
          </div>
          <Button variant="outline" className="gap-2 self-start" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Cerrar sesión
          </Button>
        </div>

        {success && (
          <Card className="rounded-xl border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-semibold">Cuenta vinculada</p>
              </div>
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                Tu cuenta quedó asociada a {success.negocio.nombre} como {success.empleado.nombre} ({success.empleado.codigo}).
              </p>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
                El nuevo panel operativo autenticado llegará en la siguiente etapa. Durante la transición, los enlaces legacy del negocio siguen vigentes temporalmente.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl border-border/60">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Unirme a un negocio</h2>
                <p className="text-sm text-muted-foreground">
                  Ingresá el código temporal que te entregó el dueño del negocio.
                </p>
              </div>
            </div>

            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleJoin}>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="codigo">Código de unión</Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(event) => setCodigo(event.target.value.trim())}
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <Button type="submit" className="gap-2 sm:self-end" disabled={joining}>
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

        <Card className="rounded-xl border-border/60">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Vínculos activos</h2>
            </div>

            {profile?.vinculos.length ? (
              <div className="space-y-2">
                {profile.vinculos.map((vinculo) => (
                  <div key={vinculo.empleado.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{vinculo.negocio.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {vinculo.empleado.nombre} · {vinculo.empleado.codigo}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {vinculo.empleado.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no tenés negocios vinculados.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
