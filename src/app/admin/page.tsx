"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Loader2, Shield } from "lucide-react"

// ============================================
// DeliGO Superadmin — /admin (24-A: Google-only)
// ============================================
// Completamente aislado de useAuthStore/useAuth (cliente/negocio/repartidor):
// consulta su propia sesión vía GET /api/superadmin/auth/me, usando la
// cookie dedicada `deligo_superadmin_session`. Nunca mezcla estado con el
// resto de la app.

const SuperAdminPanel = dynamic(
  () => import("@/components/superadmin/superadmin-panel").then((mod) => mod.SuperAdminPanel),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex flex-col bg-background animate-pulse">
        <div className="bg-purple-500/10 px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="h-6 w-20 rounded bg-purple-500/10" />
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded-full bg-purple-500/10" />
              <div className="h-8 w-8 rounded-full bg-purple-500/10" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15" />
            <div>
              <div className="h-5 w-32 rounded bg-purple-500/10" />
              <div className="mt-1 h-3 w-28 rounded bg-purple-500/5" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-amber-500/10" />
            ))}
          </div>
        </div>
        <div className="px-4 py-1.5 flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-20 rounded-xl bg-muted/30" />
          ))}
        </div>
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-4 bg-muted/30">
                <div className="h-4 w-20 rounded bg-muted/50 mb-2" />
                <div className="h-8 w-16 rounded bg-muted/50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  }
)

// Mensajes genéricos únicamente — nunca revelan qué email/sub está
// autorizado, ni por qué exactamente se rechazó un intento puntual.
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Acceso cancelado. Intentá nuevamente si fue un error.",
  invalid_request: "No pudimos completar el inicio de sesión. Intentá de nuevo.",
  not_authorized: "Esta cuenta de Google no tiene acceso al panel de administración.",
  server_error: "El acceso de administración no está disponible en este momento.",
}

type SessionState = "checking" | "authenticated" | "unauthenticated"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.6 5.6 0 0 1-2.41 3.65v3.03h3.86c2.26-2.09 3.57-5.17 3.57-8.92Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-3.03c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.12A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.25a7.2 7.2 0 0 1 0-4.5V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.12Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.63l3.99 3.12C6.22 6.9 8.87 4.75 12 4.75Z"
      />
    </svg>
  )
}

// ============================================
// Login screen — únicamente "Continuar con Google"
// ============================================
function AdminLoginScreen({ errorCode }: { errorCode: string | null }) {
  const [redirecting, setRedirecting] = useState(false)

  const handleContinueWithGoogle = useCallback(() => {
    if (redirecting) return // evita doble click / doble navegación
    setRedirecting(true)
    window.location.href = "/api/superadmin/auth/google"
  }, [redirecting])

  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.invalid_request : null

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-purple-500/5" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-purple-500/3" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Shield className="h-8 w-8 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">DeliGO Superadmin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acceso exclusivo de administración
            </p>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="w-full rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive text-center"
          >
            {errorMessage}
          </div>
        )}

        <Button
          type="button"
          onClick={handleContinueWithGoogle}
          disabled={redirecting}
          aria-busy={redirecting}
          className="w-full h-12 rounded-xl font-semibold text-sm bg-white text-neutral-800 border border-border hover:bg-neutral-50 dark:bg-white dark:text-neutral-800 dark:hover:bg-neutral-100 flex items-center justify-center gap-3"
        >
          {redirecting ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <GoogleIcon />
          )}
          <span>{redirecting ? "Redirigiendo…" : "Continuar con Google"}</span>
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
          <Shield className="h-4 w-4 shrink-0 text-purple-500" aria-hidden="true" />
          <span>Este acceso es exclusivo para administradores autorizados de la plataforma.</span>
        </div>
      </div>
    </div>
  )
}

function CheckingSessionScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-purple-500/10 animate-pulse" />
        <Skeleton className="h-5 w-40 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>
  )
}

// ============================================
// Admin Page: consulta su propia sesión y decide qué mostrar
// ============================================
export default function AdminPage() {
  return (
    <Suspense fallback={<CheckingSessionScreen />}>
      <AdminPageContent />
    </Suspense>
  )
}

function AdminPageContent() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get("superadmin_auth_error")
  const [sessionState, setSessionState] = useState<SessionState>("checking")
  const hasChecked = useRef(false)

  useEffect(() => {
    if (hasChecked.current) return
    hasChecked.current = true

    let cancelled = false
    fetch("/api/superadmin/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then((res) => {
        if (cancelled) return
        setSessionState(res.ok ? "authenticated" : "unauthenticated")
      })
      .catch(() => {
        if (!cancelled) setSessionState("unauthenticated")
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (sessionState === "checking") {
    return <CheckingSessionScreen />
  }

  if (sessionState === "authenticated") {
    return <SuperAdminPanel />
  }

  return <AdminLoginScreen errorCode={errorCode} />
}
