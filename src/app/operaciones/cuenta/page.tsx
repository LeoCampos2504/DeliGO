"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  Chrome,
  Loader2,
  LogOut,
  Mail,
  ShieldAlert,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { toast } from "sonner"

// ============================================
// DeliGO Operaciones — Mi cuenta (Bugfix-5C)
// ============================================
// Pantalla personal mínima para una CuentaOperativa ya autenticada. Único
// propósito de esta etapa: mostrar identidad básica (nombre/email) y ofrecer
// "Vincular cuenta de Google" cuando todavía no está vinculada. No es un
// panel de administración del negocio — no muestra ni permite elegir
// negocio/área/rol/permisos.

interface Cuenta {
  nombre: string
  email: string
  googleLinked: boolean
}

type PageState =
  | { kind: "checking" }
  | { kind: "no-session" }
  | { kind: "ready"; cuenta: Cuenta }

const GOOGLE_MESSAGES: Record<string, { tone: "success" | "error"; text: string }> = {
  linked: { tone: "success", text: "Cuenta de Google vinculada correctamente." },
  "email-mismatch": {
    tone: "error",
    text: "El email de esa cuenta de Google no coincide con el de tu cuenta. Iniciá el proceso desde la cuenta de Google que usa el mismo email.",
  },
  error: { tone: "error", text: "No se pudo vincular la cuenta de Google. Intentá de nuevo." },
}

function CuentaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [state, setState] = useState<PageState>({ kind: "checking" })
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/operativo/me", { cache: "no-store" })
        if (!active) return
        if (!res.ok) {
          setState({ kind: "no-session" })
          return
        }
        const data = await res.json()
        setState({
          kind: "ready",
          cuenta: {
            nombre: data.cuenta?.nombre ?? "",
            email: data.cuenta?.email ?? "",
            googleLinked: Boolean(data.cuenta?.googleLinked),
          },
        })
      } catch {
        if (active) setState({ kind: "no-session" })
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // Bugfix-5C: mensaje de retorno del callback de vinculación. Solo se limpia
  // el parámetro `google` — nunca se borra toda la query string.
  useEffect(() => {
    const reason = searchParams.get("google")
    if (!reason) return
    const message = GOOGLE_MESSAGES[reason]
    if (message) {
      if (message.tone === "success") toast.success(message.text)
      else toast.error(message.text)
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
    // consumir el resultado del redirect de vinculación.
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch("/api/operativo/logout", { method: "POST", cache: "no-store" })
    } finally {
      router.replace("/operaciones/ingresar")
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
          <div className="space-y-2">
            <Logo size="sm" />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Mi cuenta</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuenta personal de DeliGO Operaciones.
              </p>
            </div>
          </div>

          {state.kind === "checking" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cargando…</p>
            </div>
          )}

          {state.kind === "no-session" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Necesitás iniciar sesión para ver tu cuenta.
                </p>
              </div>
              <Button asChild className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600">
                <Link href="/operaciones/ingresar">Iniciar sesión</Link>
              </Button>
            </div>
          )}

          {state.kind === "ready" && (
            <div className="space-y-4">
              <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/40 p-4">
                <div className="flex items-center gap-2.5">
                  <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm font-semibold">{state.cuenta.nombre}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{state.cuenta.email}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 p-4">
                <p className="mb-2.5 text-xs font-semibold text-muted-foreground">Acceso con Google</p>
                {state.cuenta.googleLinked ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Google vinculado
                  </div>
                ) : (
                  <Button asChild variant="outline" className="h-10 w-full gap-2 rounded-xl">
                    <a href="/api/operativo/auth/google?mode=link">
                      <Chrome className="h-4 w-4" />
                      Vincular cuenta de Google
                    </a>
                  </Button>
                )}
              </div>

              <Button asChild variant="outline" className="h-10 w-full gap-2 rounded-xl">
                <Link href="/operaciones/mi-panel">
                  <ArrowLeft className="h-4 w-4" />
                  Volver a mi panel
                </Link>
              </Button>

              <Button
                variant="ghost"
                className="h-10 w-full gap-2 rounded-xl text-muted-foreground"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Cerrar sesión
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default function OperacionesCuentaPage() {
  return (
    <Suspense fallback={null}>
      <CuentaContent />
    </Suspense>
  )
}
