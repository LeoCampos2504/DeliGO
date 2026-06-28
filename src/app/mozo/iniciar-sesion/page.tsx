"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { Armchair, Eye, EyeOff, LockKeyhole, LogIn, Loader2, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/shared/logo"

export default function MozoLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/operativo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "No se pudo iniciar sesion")
      }
      router.replace("/mozo")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="relative flex w-full max-w-md flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="md" />
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/70 bg-amber-100 text-amber-700 shadow-lg shadow-amber-500/15 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <Armchair className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <Badge className="border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Panel de Mozo
            </Badge>
            <h1 className="text-2xl font-extrabold tracking-tight">Ingresar al salon</h1>
            <p className="text-sm text-muted-foreground">
              Usa tu email y contrasena para administrar tus vinculos de negocio.
            </p>
          </div>
        </div>

        <Card className="w-full rounded-2xl border-border/60 bg-card/95 shadow-xl shadow-amber-950/5 backdrop-blur dark:shadow-black/20">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold">Cuenta operativa</h2>
              <p className="text-sm text-muted-foreground">
                Acceso limitado para tomar mesas y cargar pedidos manuales.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="h-11 rounded-xl pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contrasena</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 rounded-xl pl-9 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                Iniciar sesion
              </Button>
            </form>

            <p className="rounded-xl bg-muted/60 px-3 py-2 text-center text-sm text-muted-foreground">
              No tenes cuenta?{" "}
              <Link href="/mozo/registro" className="font-semibold text-amber-700 hover:underline dark:text-amber-300">
                Crear cuenta de mozo
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
