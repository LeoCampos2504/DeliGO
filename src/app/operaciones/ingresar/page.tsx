"use client"

import { useState, useEffect, type FormEvent, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Chrome,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { toast } from "sonner"

// ============================================
// DeliGO Operaciones — Modo cuenta personal (Operaciones-1B)
// ============================================
// Reglas de aislamiento:
//   - Usa EXCLUSIVAMENTE el contrato personal existente: GET /api/operativo/me y
//     POST /api/operativo/login (cookie deligo_operativo_session).
//   - NO consulta el contexto de terminal ni la cookie deligo_operaciones_terminal.
//   - No persiste email/contraseña/token/sesión en localStorage ni sessionStorage.
// Tras un login válido se continúa al panel personal bajo DeliGO Operaciones
// (/operaciones/mi-panel), que reutiliza el flujo personal moderno de Mozo.

const GENERIC_LOGIN_ERROR = "Email o contraseña incorrectos."
const NETWORK_ERROR = "No se pudo conectar. Revisá tu conexión e intentá de nuevo."

// Bugfix-5C: mensajes del retorno de /api/operativo/auth/google (mode=login).
// El caso exitoso redirige directo a /operaciones/mi-panel sin pasar por
// acá (mismo comportamiento silencioso que ya tiene el login por
// contraseña) — esta página solo necesita mostrar los casos de error.
// Nunca revelan si existe otro googleId, IDs internos ni datos de otra cuenta.
const GOOGLE_LOGIN_MESSAGES: Record<string, string> = {
  "existing-password-account":
    "Ya existe una cuenta con este correo. Iniciá sesión con tu contraseña y después vinculá Google desde tu cuenta.",
  "account-disabled": "Esta cuenta está desactivada. Contactá al administrador.",
  error: "No se pudo continuar con Google. Intentá de nuevo.",
}

type PageState = "checking" | "form" | "has-session"

function OperacionesIngresarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<PageState>("checking")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Detectar una sesión personal ya existente para no pedir credenciales de nuevo.
  // Solo se usa el contrato operativo; nunca se consulta la terminal.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/operativo/me", { cache: "no-store" })
        if (!active) return
        setState(res.ok ? "has-session" : "form")
      } catch {
        // Error temporal: permitir el login manual igualmente.
        if (active) setState("form")
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Bugfix-5C: mensaje de retorno de /api/operativo/auth/google. Solo se
  // limpia el parámetro `google`, nunca toda la query string.
  useEffect(() => {
    const reason = searchParams.get("google")
    if (!reason) return
    const message = GOOGLE_LOGIN_MESSAGES[reason]
    if (message) {
      toast.error(message)
    }
    const params = new URLSearchParams(window.location.search)
    params.delete("google")
    const newSearch = params.toString()
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`
    )
    // Se ejecuta una sola vez al montar: es el único momento en que interesa
    // consumir el resultado del redirect de Google.
  }, [])

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
      if (!res.ok) {
        // Mensaje genérico: no revela si fue email, contraseña o estado de cuenta.
        setError(GENERIC_LOGIN_ERROR)
        return
      }
      // Continuar al panel personal bajo DeliGO Operaciones.
      router.replace("/operaciones/mi-panel")
    } catch {
      setError(NETWORK_ERROR)
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

      <Card className="relative w-full max-w-md rounded-2xl border-border/60 shadow-xl shadow-amber-950/5 dark:shadow-black/20">
        <CardContent className="space-y-5 p-5 sm:p-6">
          {/* Encabezado */}
          <div className="space-y-2">
            <Logo size="sm" />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Ingresar con mi cuenta</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuenta personal de DeliGO Operaciones.
              </p>
            </div>
          </div>

          {state === "checking" ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Verificando tu sesión…</p>
            </div>
          ) : state === "has-session" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  Ya tenés una sesión abierta
                </p>
                <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  Podés continuar a tu panel sin volver a ingresar tus datos.
                </p>
              </div>
              <Button
                className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600"
                onClick={() => router.replace("/operaciones/mi-panel")}
              >
                Continuar a mi panel
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full gap-2 rounded-xl"
                onClick={() => setState("form")}
              >
                Ingresar con otra cuenta
              </Button>
            </div>
          ) : (
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
                <Label htmlFor="password">Contraseña</Label>
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
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="text-right">
                  <Link href="/forgot-password?type=cuenta_operativa" className="text-xs font-medium text-amber-600 hover:underline dark:text-amber-400">
                    ¿Olvidaste tu contraseña?
                  </Link>
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
                Iniciar sesión
              </Button>

              {/* Bugfix-5C: alternativa de Google, exclusiva de la cuenta
                  personal de Operaciones — apunta a /api/operativo/auth/google
                  (ruta dedicada), nunca a /api/auth/google (Cliente/Repartidor). */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">o continuá con</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button asChild variant="outline" className="h-11 w-full gap-2 rounded-xl">
                <a href="/api/operativo/auth/google">
                  <Chrome className="h-4 w-4" />
                  Continuar con Google
                </a>
              </Button>

              {/* Bugfix-5B: el registro de CuentaOperativa ya existía
                  (POST /api/operativo/register, página /mozo/registro), pero
                  no había ningún enlace hacia él desde el ingreso de
                  Operaciones — el empleado quedaba sin forma visible de crear
                  su cuenta desde acá. */}
              <p className="text-center text-sm text-muted-foreground">
                ¿Todavía no tenés cuenta?{" "}
                <Link href="/operaciones/registro" className="font-semibold text-primary hover:underline">
                  Crear cuenta
                </Link>
              </p>
            </form>
          )}

          {/* Volver al selector */}
          <Button asChild variant="ghost" className="h-10 w-full gap-2 rounded-xl text-muted-foreground">
            <Link href="/operaciones">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

export default function OperacionesIngresarPage() {
  return (
    <Suspense fallback={null}>
      <OperacionesIngresarContent />
    </Suspense>
  )
}
