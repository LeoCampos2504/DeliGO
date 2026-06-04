"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useAuthStore } from "@/store/auth-store"
import { useHydrated } from "@/hooks/use-hydrated"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  ArrowLeft,
  MailCheck,
  RefreshCw,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

const RepartidorPanel = dynamic(
  () => import("@/components/repartidor/repartidor-panel").then((mod) => mod.RepartidorPanel),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex flex-col bg-background animate-pulse">
        <div className="bg-blue-500/10 px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="h-6 w-20 rounded bg-blue-500/10" />
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-500/10" />
              <div className="h-8 w-8 rounded-full bg-blue-500/10" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15" />
            <div>
              <div className="h-5 w-32 rounded bg-blue-500/10" />
              <div className="mt-1 h-3 w-24 rounded bg-blue-500/5" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="h-16 rounded-xl bg-amber-500/10" />
            <div className="h-16 rounded-xl bg-emerald-500/10" />
          </div>
        </div>
        <div className="px-4 py-1.5 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 rounded-xl bg-muted/30" />
          ))}
        </div>
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
              <div className="h-12 bg-muted/30" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-1/2 rounded bg-muted/20" />
                <div className="h-16 rounded-xl bg-muted/20" />
                <div className="flex gap-2">
                  <div className="flex-1 h-10 rounded-xl bg-muted/20" />
                  <div className="flex-1 h-10 rounded-xl bg-muted/20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  }
)

// ============================================
// Helper: Mask email
// ============================================
function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!local || !domain) return email
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local[0]}***${local[local.length - 1]}@${domain}`
}

// ============================================
// Driver Login Form (shown when not authenticated)
// ============================================
type RepartidorLoginView = "login" | "verify-email"

function RepartidorLoginForm() {
  const router = useRouter()
  const [view, setView] = useState<RepartidorLoginView>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Verification state
  const [unverifiedEmail, setUnverifiedEmail] = useState("")
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "repartidor", email, password }),
      })

      const data = await res.json()

      // Handle needsVerification (status 403)
      if (data.needsVerification && data.email) {
        setUnverifiedEmail(data.email)
        setView("verify-email")
        return
      }

      if (!res.ok) {
        toast.error(data.error || "Error al iniciar sesión")
        return
      }

      // Update auth store
      useAuthStore.getState().loginRepartidor({
        id: data.user.id,
        nombre: data.user.nombre,
        email: data.user.email,
        activo: data.user.activo,
        token: data.token,
      })

      toast.success(`🛵 ¡Bienvenido, ${data.user.nombre}!`)
      router.replace("/")
    } catch {
      toast.error("Error de conexión. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setResent(false)
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail, userType: "repartidor" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al reenviar el email")
        return
      }
      setResent(true)
      toast.success("Email reenviado")
    } catch {
      toast.error("Error de conexión. Intentá de nuevo.")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-500/5" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-blue-500/3" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center gap-6">
        {/* Back link */}
        <Link
          href="/"
          className="self-start flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-3xl">🛵</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Panel de Repartidor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Recibí y entregá pedidos de los locales
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* LOGIN VIEW */}
          {view === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <Card className="w-full border-border/50 shadow-lg shadow-blue-500/5">
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="tu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-11 rounded-xl"
                          required
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-semibold">
                        Contraseña
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 h-11 rounded-xl"
                          required
                          minLength={6}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Ingresar al panel"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* VERIFY EMAIL VIEW */}
          {view === "verify-email" && (
            <motion.div
              key="verify-email"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <Card className="w-full border-border/50 shadow-lg shadow-blue-500/5">
                <CardContent className="p-6 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950/30 mx-auto mb-4 flex items-center justify-center"
                  >
                    <MailCheck className="h-8 w-8 text-blue-500" />
                  </motion.div>

                  <h2 className="text-lg font-extrabold mb-2">Verificá tu email</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Para ingresar como repartidor, necesitamos verificar tu email primero.
                  </p>

                  <div className="inline-flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-2 mb-4">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-semibold">{maskEmail(unverifiedEmail)}</span>
                  </div>

                  <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground bg-muted/50 rounded-xl p-3 mb-4">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" />
                    <span>Revisá tu bandeja de entrada y la carpeta de spam</span>
                  </div>

                  <div className="space-y-2">
                    <Button
                      onClick={handleResend}
                      variant="outline"
                      className="w-full rounded-xl font-semibold"
                      disabled={resending || resent}
                    >
                      {resending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : resent ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1.5 text-blue-500" />
                          Email reenviado
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1.5" />
                          Reenviar email
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => {
                        setView("login")
                        setUnverifiedEmail("")
                      }}
                      variant="outline"
                      className="w-full rounded-xl font-semibold"
                    >
                      Ya verifiqué mi email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Other roles */}
        <div className="w-full border-t border-border/50 pt-4 space-y-2">
          <p className="text-xs text-muted-foreground text-center">¿Tenés otro perfil?</p>
          <div className="flex gap-2 justify-center">
            <Link href="/login">
              <Button variant="outline" size="sm" className="rounded-full text-xs gap-1.5">
                🍔 Cliente
              </Button>
            </Link>
            <Link href="/negocio">
              <Button variant="outline" size="sm" className="rounded-full text-xs gap-1.5">
                🏪 Negocio
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline" size="sm" className="rounded-full text-xs gap-1.5">
                🔐 Admin
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Repartidor Page: Shows login or panel
// ============================================
export default function RepartidorPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userType = useAuthStore((s) => s.userType)

  // Wait for hydration
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 animate-pulse" />
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      </div>
    )
  }

  // Not authenticated — show login form
  if (!isAuthenticated() || userType() !== "repartidor") {
    return <RepartidorLoginForm />
  }

  // Authenticated — show panel
  return <RepartidorPanel />
}
