"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@/store/auth-store"
import { useHydrated } from "@/hooks/use-hydrated"
import { useSuspensionCheck } from "@/hooks/use-suspension-check"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import {
  Eye,
  EyeOff,
  Loader2,
  AtSign,
  Lock,
  ArrowLeft,
  MailCheck,
  Mail,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Phone,
  MessageCircle,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

const BusinessPanel = dynamic(
  () => import("@/components/business/business-panel").then((mod) => mod.BusinessPanel),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex flex-col bg-background animate-pulse">
        <div className="bg-emerald-500/10 px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="h-6 w-20 rounded bg-emerald-500/10" />
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded-full bg-emerald-500/10" />
              <div className="h-8 w-8 rounded-full bg-emerald-500/10" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15" />
            <div>
              <div className="h-5 w-32 rounded bg-emerald-500/10" />
              <div className="mt-1 h-3 w-24 rounded bg-emerald-500/5" />
            </div>
          </div>
        </div>
        <div className="px-4 py-1.5 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 rounded-xl bg-muted/30" />
          ))}
        </div>
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
              <div className="h-12 bg-muted/30" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-1/2 rounded bg-muted/20" />
                <div className="h-16 rounded-xl bg-muted/20" />
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
// Business Login Form (shown when not authenticated)
// ============================================
type NegocioLoginView = "login" | "verify-email" | "approval-pending" | "suspended"

function NegocioLoginForm() {
  const router = useRouter()
  const [view, setView] = useState<NegocioLoginView>("login")
  const [usuario, setUsuario] = useState("")
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
        body: JSON.stringify({ tipo: "negocio", usuario, password }),
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

      if (data.needsApproval) {
        setView("approval-pending")
        return
      }

      // Handle suspended account — log them in but show suspended screen
      if (data.suspended) {
        useAuthStore.getState().loginNegocio({
          id: data.user.id,
          nombre: data.user.nombre,
          slug: data.user.slug,
          rubro: data.user.rubro,
          aprobado: data.user.aprobado,
          suspendido: true,
          token: data.token,
        })
        setView("suspended")
        return
      }

      // Update auth store
      useAuthStore.getState().loginNegocio({
        id: data.user.id,
        nombre: data.user.nombre,
        slug: data.user.slug,
        rubro: data.user.rubro,
        aprobado: data.user.aprobado,
        token: data.token,
      })

      toast.success(`🏪 ¡Bienvenido, ${data.user.nombre}!`)
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
        body: JSON.stringify({ email: unverifiedEmail, userType: "negocio" }),
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
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-emerald-500/5" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-emerald-500/3" />
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
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-3xl">🏪</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Panel de Negocio</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestioná tu catálogo, pedidos y delivery
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
              <Card className="w-full border-border/50 shadow-lg shadow-emerald-500/5">
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="usuario" className="text-sm font-semibold">
                        Usuario
                      </Label>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="usuario"
                          type="text"
                          placeholder="tu_usuario"
                          value={usuario}
                          onChange={(e) => setUsuario(e.target.value)}
                          className="pl-10 h-11 rounded-xl"
                          required
                          autoComplete="username"
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
                      className="w-full h-11 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
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
              <Card className="w-full border-border/50 shadow-lg shadow-emerald-500/5">
                <CardContent className="p-6 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 mx-auto mb-4 flex items-center justify-center"
                  >
                    <MailCheck className="h-8 w-8 text-emerald-500" />
                  </motion.div>

                  <h2 className="text-lg font-extrabold mb-2">Verificá tu email</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Para ingresar a tu local, necesitamos verificar tu email primero.
                  </p>

                  <div className="inline-flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-2 mb-4">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-semibold">{maskEmail(unverifiedEmail)}</span>
                  </div>

                  <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground bg-muted/50 rounded-xl p-3 mb-4">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
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
                          <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-500" />
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

          {/* SUSPENDED VIEW */}
          {view === "suspended" && (
            <motion.div
              key="suspended"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <Card className="w-full border-red-200 dark:border-red-900/50 shadow-lg shadow-red-500/10">
                <CardContent className="p-6 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/30 mx-auto mb-4 flex items-center justify-center"
                  >
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                  </motion.div>

                  <h2 className="text-lg font-extrabold mb-2">Tu local está suspendido</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Si creés que es un error o querés más información, contactanos por WhatsApp.
                  </p>

                  <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-red-500 shrink-0" />
                      <span className="text-sm font-bold text-red-700 dark:text-red-400">
                        3886418011
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Horario de atención: Lunes a Viernes 9:00 - 18:00
                    </p>
                  </div>

                  <a
                    href="https://wa.me/5493886418011?text=Hola%2C%20mi%20local%20está%20suspendido%20y%20necesito%20más%20información"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button
                      className="w-full rounded-xl font-bold text-sm bg-green-600 hover:bg-green-700 text-white gap-2"
                      size="lg"
                    >
                      <MessageCircle className="h-5 w-5" />
                      Escribinos por WhatsApp
                    </Button>
                  </a>

                  <div className="mt-3">
                    <Button
                      onClick={() => {
                        useAuthStore.getState().logout()
                        setView("login")
                      }}
                      variant="outline"
                      className="w-full rounded-xl font-semibold"
                    >
                      Cerrar sesión
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* APPROVAL PENDING VIEW */}
          {view === "approval-pending" && (
            <motion.div
              key="approval-pending"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <Card className="w-full border-border/50 shadow-lg shadow-amber-500/5">
                <CardContent className="p-6 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/30 mx-auto mb-4 flex items-center justify-center"
                  >
                    <Clock className="h-8 w-8 text-amber-500" />
                  </motion.div>

                  <h2 className="text-lg font-extrabold mb-2">Esperando aprobación</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Tu email fue verificado correctamente. Un administrador tiene que aprobar tu local antes de que puedas ingresar.
                  </p>

                  <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl px-4 py-2 mb-4">
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      Pendiente de aprobación del admin
                    </span>
                  </div>

                  <Button
                    onClick={() => setView("login")}
                    variant="outline"
                    className="w-full rounded-xl font-semibold"
                  >
                    Volver a intentar
                  </Button>
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
            <Link href="/repartidor">
              <Button variant="outline" size="sm" className="rounded-full text-xs gap-1.5">
                🛵 Repartidor
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
// Business Page: Shows login or panel
// ============================================
export default function NegocioPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userType = useAuthStore((s) => s.userType)

  // Real-time suspension/reactivation detection via polling
  useSuspensionCheck()

  // Wait for hydration
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 animate-pulse" />
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      </div>
    )
  }

  // Not authenticated — show login form
  if (!isAuthenticated() || userType() !== "negocio") {
    return <NegocioLoginForm />
  }

  // Suspended — show suspended screen instead of panel
  if (user?.suspendido) {
    return <NegocioSuspendedScreen nombre={user.nombre} />
  }

  // Fetch negocio profile data
  return <NegocioPanelLoader user={user} />
}

function NegocioSuspendedScreen({ nombre }: { nombre: string }) {
  const logout = useAuthStore((s) => s.logout)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch { /* continue */ }
    logout()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-red-500/5" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-red-500/3" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center gap-6">
        <Link
          href="/"
          className="self-start flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">Local suspendido</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hola <span className="font-semibold">{nombre}</span>, tu local está temporalmente suspendido.
          </p>
        </div>

        <Card className="w-full border-red-200 dark:border-red-900/50 shadow-lg shadow-red-500/10">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Si creés que es un error o querés más información, contactanos por WhatsApp.
            </p>

            <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-red-500 shrink-0" />
                <span className="text-sm font-bold text-red-700 dark:text-red-400">
                  3886418011
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Horario de atención: Lunes a Viernes 9:00 - 18:00
              </p>
            </div>

            <a
              href="https://wa.me/5493886418011?text=Hola%2C%20mi%20local%20está%20suspendido%20y%20necesito%20más%20información"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button
                className="w-full rounded-xl font-bold text-sm bg-green-600 hover:bg-green-700 text-white gap-2"
                size="lg"
              >
                <MessageCircle className="h-5 w-5" />
                Escribinos por WhatsApp
              </Button>
            </a>

            <div className="mt-3">
              <Button
                onClick={handleLogout}
                disabled={loggingOut}
                variant="outline"
                className="w-full rounded-xl font-semibold"
              >
                {loggingOut ? "Cerrando..." : "Cerrar sesión"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function NegocioPanelLoader({ user }: { user: any }) {
  const { data: negocioData } = useQuery({
    queryKey: ["negocio-profile", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocios/${user?.slug}`)
      if (!res.ok) throw new Error("Error")
      return res.json()
    },
    enabled: !!user?.slug,
  })

  return (
    <BusinessPanel
      negocio={{
        id: user.id,
        nombre: user.nombre,
        slug: user.slug ?? "",
        rubro: user.rubro ?? "restaurante",
        colorPrincipal: negocioData?.colorPrincipal ?? "#FB8C00",
        aprobado: user.aprobado ?? false,
      }}
    />
  )
}
