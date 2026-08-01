"use client"

import { useState, Suspense, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"

// ============================================
// DeliGO — Restablecer contraseña (Bugfix-5D)
// ============================================
// Lee ÚNICAMENTE ?token=. El tipo de cuenta lo resuelve el backend a partir
// del token (userType + userId guardados junto al hash) — nunca se lo pide o
// infiere en el frontend. Tras un reset exitoso NO se hace auto-login: se
// avisa que las sesiones anteriores se cerraron y se muestra un único botón
// hacia el login correcto (loginPath viene del servidor, por allowlist).

type PageState =
  | { step: "form" }
  | { step: "submitting" }
  | { step: "success"; loginPath: string }
  | { step: "error"; message: string }

const GENERIC_INVALID = "El enlace es inválido o ya venció. Solicitá uno nuevo."

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-2xl border-border/60 shadow-lg">
        <CardContent className="flex flex-col items-center gap-5 p-6">
          <Logo size="sm" />
          {children}
        </CardContent>
      </Card>
    </main>
  )
}

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [state, setState] = useState<PageState>({ step: "form" })

  if (!token) {
    return (
      <CenteredCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-bold">Restablecer contraseña</h1>
          <p className="text-sm text-muted-foreground">{GENERIC_INVALID}</p>
        </div>
        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </CenteredCard>
    )
  }

  if (state.step === "success") {
    return (
      <CenteredCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/30">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold">Contraseña actualizada</h1>
          <p className="text-sm text-muted-foreground">
            Tu contraseña se actualizó correctamente. Por seguridad, cerramos todas tus sesiones
            anteriores.
          </p>
        </div>
        <Button asChild className="h-11 w-full rounded-xl font-semibold">
          <Link href={state.loginPath}>Ir a iniciar sesión</Link>
        </Button>
      </CenteredCard>
    )
  }

  if (state.step === "error") {
    return (
      <CenteredCard>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-xl font-bold">No se pudo restablecer</h1>
          <p className="text-sm text-muted-foreground">{state.message}</p>
        </div>
        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </CenteredCard>
    )
  }

  const submitting = state.step === "submitting"

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password.length < 6) {
      setState({ step: "error", message: "La contraseña debe tener al menos 6 caracteres" })
      return
    }
    if (password !== confirmPassword) {
      setState({ step: "error", message: "Las contraseñas no coinciden" })
      return
    }

    setState({ step: "submitting" })
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.success) {
        setState({ step: "success", loginPath: typeof data.loginPath === "string" ? data.loginPath : "/" })
      } else {
        setState({ step: "error", message: data?.error || GENERIC_INVALID })
      }
    } catch {
      setState({ step: "error", message: GENERIC_INVALID })
    }
  }

  return (
    <CenteredCard>
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold">Restablecer contraseña</h1>
        <p className="text-sm text-muted-foreground">Elegí una nueva contraseña para tu cuenta.</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Nueva contraseña</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="h-11 rounded-xl px-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="h-11 rounded-xl px-9"
            />
          </div>
        </div>

        <Button type="submit" className="h-11 w-full rounded-xl font-semibold" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restablecer contraseña"}
        </Button>
      </form>
    </CenteredCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  )
}
