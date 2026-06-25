"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  ShoppingBag,
  Store,
  Bike,
  Shield,
  Mail,
  User,
  Lock,
  Phone,
  AtSign,
  ChevronRight,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  MailCheck,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Logo } from "@/components/shared/logo"
import { LegalDialog } from "@/components/shared/legal-content"
import { useAuthStore } from "@/store/auth-store"
import { toast } from "sonner"
import type { UserType } from "@/lib/auth"

// ============================================
// Types
// ============================================

type AuthStep = "role-select" | "login" | "register" | "approval-pending" | "verify-email"

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialRole?: UserType
  initialMode?: "login" | "register"
}

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
// Role card data
// ============================================

export const roles = [
  {
    type: "cliente" as UserType,
    label: "Quiero pedir",
    desc: "Encontrá los mejores locales y hacé tu pedido",
    icon: ShoppingBag,
    color: "from-orange-500 to-amber-500",
    bgLight: "bg-orange-50 dark:bg-orange-950/20",
    textColor: "text-orange-600 dark:text-orange-400",
    emoji: "🍔",
  },
  {
    type: "negocio" as UserType,
    label: "Tengo un local",
    desc: "Gestioná tu catálogo, pedidos y delivery",
    icon: Store,
    color: "from-emerald-500 to-teal-500",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/20",
    textColor: "text-emerald-600 dark:text-emerald-400",
    emoji: "🏪",
  },
  {
    type: "repartidor" as UserType,
    label: "Soy repartidor",
    desc: "Recibí y entregá pedidos de los locales",
    icon: Bike,
    color: "from-blue-500 to-indigo-500",
    bgLight: "bg-blue-50 dark:bg-blue-950/20",
    textColor: "text-blue-600 dark:text-blue-400",
    emoji: "🛵",
  },
  {
    type: "superadmin" as UserType,
    label: "Administrador",
    desc: "Panel de control de la plataforma",
    icon: Shield,
    color: "from-purple-500 to-violet-500",
    bgLight: "bg-purple-50 dark:bg-purple-950/20",
    textColor: "text-purple-600 dark:text-purple-400",
    emoji: "🔐",
  },
]

// ============================================
// Main Auth Modal Component
// ============================================

export function AuthModal({ isOpen, onClose, initialRole, initialMode }: AuthModalProps) {
  const [step, setStep] = useState<AuthStep>(initialRole ? (initialMode === "register" ? "register" : "login") : "role-select")
  const [selectedRole, setSelectedRole] = useState<UserType | null>(initialRole ?? null)
  const [mode, setMode] = useState<"login" | "register">(initialMode ?? "login")

  // Email verification state
  const [unverifiedEmail, setUnverifiedEmail] = useState<string>("")
  const [unverifiedUserType, setUnverifiedUserType] = useState<string>("")

  // Reset state when modal opens — if initialRole is set, go directly to that role's login/register
  useEffect(() => {
    if (!isOpen) return

    const resetTimer = window.setTimeout(() => {
      if (initialRole) {
        setSelectedRole(initialRole)
        if (initialMode === "register") {
          setStep("register")
          setMode("register")
        } else {
          setStep("login")
          setMode("login")
        }
      } else {
        setStep("role-select")
        setSelectedRole(null)
        setMode("login")
      }
      setUnverifiedEmail("")
      setUnverifiedUserType("")
    }, 0)

    return () => window.clearTimeout(resetTimer)
  }, [isOpen, initialRole, initialMode])

  const handleRoleSelect = (type: UserType) => {
    setSelectedRole(type)
    setMode("login")
    setStep("login")
  }

  const handleBack = () => {
    setStep("role-select")
    setSelectedRole(null)
    setMode("login")
  }

  const handleSwitchMode = () => {
    if (mode === "login") {
      if (selectedRole === "repartidor") {
        window.location.href = "/repartidor/registro/"
        return
      }

      setMode("register")
      setStep("register")
    } else {
      setMode("login")
      setStep("login")
    }
  }

  const handleClose = () => {
    setStep("role-select")
    setSelectedRole(null)
    setMode("login")
    setUnverifiedEmail("")
    setUnverifiedUserType("")
    onClose()
  }

  const handleApprovalPending = () => {
    setStep("approval-pending")
  }

  const handleNeedsVerification = (email: string, userType: string) => {
    setUnverifiedEmail(email)
    setUnverifiedUserType(userType)
    setStep("verify-email")
  }

  const handleLoginSuccess = (data: {
    ok: boolean
    user?: {
      id: string
      type: UserType
      nombre: string
      email?: string
      telefono?: string
      slug?: string
      rubro?: string
      aprobado?: boolean
      activo?: boolean
    }
    needsApproval?: boolean
    needsVerification?: boolean
    email?: string
    userType?: string
  }) => {
    // Handle email verification needed (from register or login)
    if (data.needsVerification && data.email && data.userType) {
      handleNeedsVerification(data.email, data.userType)
      return
    }

    if (data.needsApproval) {
      handleApprovalPending()
      return
    }

    if (!data.user) return

    const { user } = data

    switch (user.type) {
      case "cliente":
        useAuthStore.getState().loginCliente({
          id: user.id,
          nombre: user.nombre,
          email: user.email!,
        })
        break
      case "negocio":
        useAuthStore.getState().loginNegocio({
          id: user.id,
          nombre: user.nombre,
          slug: user.slug!,
          rubro: user.rubro!,
          aprobado: user.aprobado!,
        })
        break
      case "repartidor":
        useAuthStore.getState().loginRepartidor({
          id: user.id,
          nombre: user.nombre,
          email: user.email!,
          activo: user.activo!,
        })
        break
      case "superadmin":
        useAuthStore.getState().loginSuperAdmin({
          id: user.id,
        })
        break
    }

    const roleEmoji = roles.find((r) => r.type === user.type)?.emoji ?? ""
    toast.success(`${roleEmoji} ¡Bienvenido, ${user.nombre}!`)
    handleClose()
  }

  const currentRole = roles.find((r) => r.type === selectedRole)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[95vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md px-5 pt-4 pb-3 border-b border-border/50 flex items-center justify-between rounded-t-3xl sm:rounded-2xl">
              <div className="flex items-center gap-3">
                {step !== "role-select" && !initialRole && (
                  <button
                    onClick={handleBack}
                    className="p-1.5 -ml-1.5 rounded-xl hover:bg-muted transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <Logo size="sm" />
              </div>
              <button
                onClick={handleClose}
                className="p-2 -mr-2 rounded-xl hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-5">
              <AnimatePresence mode="wait">
                {step === "role-select" && (
                  <motion.div
                    key="role-select"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <RoleSelectStep onSelect={handleRoleSelect} />
                  </motion.div>
                )}

                {step === "login" && selectedRole && (
                  <motion.div
                    key={`login-${selectedRole}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LoginStep
                      role={selectedRole}
                      roleData={currentRole!}
                      onSuccess={handleLoginSuccess}
                      onSwitchToRegister={handleSwitchMode}
                      onClose={handleClose}
                    />
                  </motion.div>
                )}

                {step === "register" && selectedRole && (
                  <motion.div
                    key={`register-${selectedRole}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <RegisterStep
                      role={selectedRole}
                      roleData={currentRole!}
                      onSuccess={handleLoginSuccess}
                      onSwitchToLogin={handleSwitchMode}
                    />
                  </motion.div>
                )}

                {step === "approval-pending" && selectedRole && (
                  <motion.div
                    key="approval-pending"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ApprovalPendingStep onClose={handleClose} />
                  </motion.div>
                )}

                {step === "verify-email" && (
                  <motion.div
                    key="verify-email"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <VerifyEmailStep
                      email={unverifiedEmail}
                      userType={unverifiedUserType}
                      onClose={handleClose}
                      onBackToLogin={() => {
                        setMode("login")
                        setStep("login")
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================
// Role Selection Step
// ============================================

function RoleSelectStep({ onSelect }: { onSelect: (type: UserType) => void }) {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-extrabold">¿Cómo querés ingresar?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Elegí tu perfil para continuar
        </p>
      </div>

      <div className="space-y-3">
        {roles.map((role) => {
          const Icon = role.icon
          return (
            <motion.button
              key={role.type}
              onClick={() => onSelect(role.type)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-200 text-left group"
            >
              <div
                className={`w-12 h-12 rounded-xl ${role.bgLight} flex items-center justify-center shrink-0`}
              >
                <span className="text-2xl">{role.emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm">{role.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {role.desc}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </motion.button>
          )
        })}
      </div>

    </div>
  )
}

// ============================================
// Login Step
// ============================================

interface LoginStepProps {
  role: UserType
  roleData: (typeof roles)[0]
  onSuccess: (data: any) => void
  onSwitchToRegister: () => void
  onClose: () => void
}

function LoginStep({
  role,
  roleData,
  onSuccess,
  onSwitchToRegister,
  onClose,
}: LoginStepProps) {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Cliente & Repartidor
  const [email, setEmail] = useState("")
  // Negocio
  const [usuario, setUsuario] = useState("")
  // All
  const [password, setPassword] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const body: Record<string, string> = { tipo: role }

      if (role === "cliente" || role === "repartidor") {
        body.email = email
      } else if (role === "negocio") {
        body.usuario = usuario
      }
      body.password = password

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      // Handle needsVerification (status 403)
      if (data.needsVerification) {
        onSuccess(data)
        return
      }

      if (!res.ok) {
        toast.error(data.error || "Error al iniciar sesión")
        return
      }

      onSuccess(data)
    } catch {
      toast.error("Error de conexión. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{roleData.emoji}</span>
          <h2 className="text-xl font-extrabold">
            {role === "cliente"
              ? "Ingresá a tu cuenta"
              : role === "negocio"
              ? "Ingresá a tu local"
              : role === "repartidor"
              ? "Ingresá como repartidor"
              : "Panel de admin"}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {role === "superadmin"
            ? "Ingresá la contraseña de administrador"
            : "Ingresá tus datos para continuar"}
        </p>
      </div>

      {/* Google Sign In button (cliente & repartidor) */}
      {(role === "cliente" || role === "repartidor") && (
        <button
          type="button"
          onClick={() => {
            onClose()
            // Small delay so modal closes before navigation
            // Pass role so OAuth callback knows which user type to create
            const googleUrl = role === "repartidor" ? "/api/auth/google?role=repartidor" : "/api/auth/google"
            setTimeout(() => { window.location.href = googleUrl }, 150)
          }}
          className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border/50 bg-background hover:bg-muted/50 transition-all duration-200 text-sm font-semibold"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continuar con Google
        </button>
      )}

      {/* Divider */}
      {(role === "cliente" || role === "repartidor") && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-[11px] text-muted-foreground font-medium">o</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email field (cliente, repartidor) */}
        {(role === "cliente" || role === "repartidor") && (
          <div className="space-y-2">
            <Label htmlFor="login-email" className="text-sm font-semibold">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-email"
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
        )}

        {/* Username field (negocio) */}
        {role === "negocio" && (
          <div className="space-y-2">
            <Label htmlFor="login-usuario" className="text-sm font-semibold">
              Usuario
            </Label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-usuario"
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
        )}

        {/* Password field (all) */}
        <div className="space-y-2">
          <Label htmlFor="login-password" className="text-sm font-semibold">
            Contraseña
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="login-password"
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
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-11 rounded-xl font-bold text-sm"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Iniciar sesión"
          )}
        </Button>
      </form>

      {/* Switch to register */}
      {role !== "superadmin" && (
        <div className="mt-5 text-center">
          <p className="text-sm text-muted-foreground">
            ¿No tenés cuenta?{" "}
            <button
              onClick={onSwitchToRegister}
              className="text-primary font-semibold hover:underline"
            >
              Registrate acá
            </button>
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================
// Register Step
// ============================================

interface RegisterStepProps {
  role: UserType
  roleData: (typeof roles)[0]
  onSuccess: (data: any) => void
  onSwitchToLogin: () => void
  showSwitchToLogin?: boolean
}

export function RegisterStep({
  role,
  roleData,
  onSuccess,
  onSwitchToLogin,
  showSwitchToLogin = true,
}: RegisterStepProps) {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [legalDialog, setLegalDialog] = useState<{ open: boolean; type: "terms" | "privacy" }>({
    open: false,
    type: "terms",
  })

  // Common fields
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [telefono, setTelefono] = useState("")

  // Negocio-specific
  const [negocioEmail, setNegocioEmail] = useState("")
  const [usuario, setUsuario] = useState("")
  const [rubro, setRubro] = useState("restaurante")

  // Real-time name availability check for negocio
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null)
  const [nameChecking, setNameChecking] = useState(false)
  const nameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Only check for negocio role
    if (role !== "negocio" || !nombre.trim()) {
      setNameAvailable(null)
      setNameChecking(false)
      return
    }

    setNameChecking(true)
    setNameAvailable(null)

    if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current)

    nameCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-negocio-name?nombre=${encodeURIComponent(nombre.trim())}`
        )
        const data = await res.json()
        setNameAvailable(data.available)
      } catch {
        setNameAvailable(null)
      } finally {
        setNameChecking(false)
      }
    }, 400)

    return () => {
      if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current)
    }
  }, [nombre, role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!termsAccepted) {
      toast.error("Debés aceptar los términos y condiciones para registrarte")
      return
    }

    setLoading(true)

    try {
      const body: Record<string, string> = { tipo: role, termsAccepted: "true" }

      if (role === "cliente") {
        body.nombre = nombre
        body.email = email
        body.password = password
        if (telefono) body.telefono = telefono
      } else if (role === "negocio") {
        body.nombre_local = nombre
        body.usuario = usuario
        body.email = negocioEmail
        body.password = password
        body.rubro = rubro
      } else if (role === "repartidor") {
        body.nombre = nombre
        body.email = email
        body.password = password
        if (telefono) body.telefono = telefono
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Error al registrarse")
        return
      }

      onSuccess(data)
    } catch {
      toast.error("Error de conexión. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const rubros = [
    { value: "restaurante", label: "🍔 Restaurante", desc: "Comida y bebidas" },
    { value: "ropa", label: "👕 Indumentaria", desc: "Ropa y accesorios" },
    { value: "negocio", label: "🏪 Negocio", desc: "Ferretería, gomería, etc." },
  ]

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{roleData.emoji}</span>
          <h2 className="text-xl font-extrabold">
            {role === "cliente"
              ? "Creá tu cuenta"
              : role === "negocio"
              ? "Registra tu local"
              : "Registrate como repartidor"}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Completá tus datos para empezar
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Nombre */}
        <div className="space-y-2">
          <Label htmlFor="reg-nombre" className="text-sm font-semibold">
            {role === "negocio" ? "Nombre del local" : "Nombre completo"}
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="reg-nombre"
              type="text"
              placeholder={role === "negocio" ? "Mi Negocio" : "Tu nombre"}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={`pl-10 h-11 rounded-xl ${
                role === "negocio" && nombre.trim()
                  ? nameAvailable === false
                    ? "pr-10 border-red-400 focus-visible:ring-red-400"
                    : nameAvailable === true
                    ? "pr-10 border-emerald-400 focus-visible:ring-emerald-400"
                    : ""
                  : ""
              }`}
              required
              autoComplete="name"
            />
            {role === "negocio" && nombre.trim() && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {nameChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : nameAvailable === false ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : nameAvailable === true ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : null}
              </span>
            )}
          </div>
          {role === "negocio" && nombre.trim() && !nameChecking && nameAvailable === false && (
            <p className="text-xs text-red-500 font-medium">
              Ya existe un local con ese nombre. Elegí otro.
            </p>
          )}
          {role === "negocio" && nombre.trim() && !nameChecking && nameAvailable === true && (
            <p className="text-xs text-emerald-600 font-medium">
              Nombre disponible
            </p>
          )}
        </div>

        {/* Email (cliente, repartidor) */}
        {(role === "cliente" || role === "repartidor") && (
          <div className="space-y-2">
            <Label htmlFor="reg-email" className="text-sm font-semibold">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="reg-email"
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
        )}

        {/* Email (negocio) — between usuario and rubro */}
        {role === "negocio" && (
          <div className="space-y-2">
            <Label htmlFor="reg-negocio-email" className="text-sm font-semibold">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="reg-negocio-email"
                type="email"
                placeholder="contacto@minegocio.com"
                value={negocioEmail}
                onChange={(e) => setNegocioEmail(e.target.value)}
                className="pl-10 h-11 rounded-xl"
                required
                autoComplete="email"
              />
            </div>
          </div>
        )}

        {/* Usuario (negocio) */}
        {role === "negocio" && (
          <div className="space-y-2">
            <Label htmlFor="reg-usuario" className="text-sm font-semibold">
              Usuario de acceso
            </Label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="reg-usuario"
                type="text"
                placeholder="mi_negocio"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="pl-10 h-11 rounded-xl"
                required
                pattern="^[a-zA-Z0-9_]{3,30}$"
                title="3-30 caracteres: letras, números y _"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Letras, números y guión bajo. 3-30 caracteres.
            </p>
          </div>
        )}

        {/* Rubro (negocio) */}
        {role === "negocio" && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Rubro</Label>
            <div className="grid grid-cols-3 gap-2">
              {rubros.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRubro(r.value)}
                  className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                    rubro === r.value
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border/50 hover:border-primary/30"
                  }`}
                >
                  <span className="text-lg block">{r.label.split(" ")[0]}</span>
                  <span className="text-[11px] font-semibold block mt-0.5">
                    {r.label.split(" ").slice(1).join(" ")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Teléfono (cliente, repartidor) */}
        {(role === "cliente" || role === "repartidor") && (
          <div className="space-y-2">
            <Label htmlFor="reg-telefono" className="text-sm font-semibold">
              Teléfono{" "}
              <span className="text-muted-foreground font-normal">
                (opcional)
              </span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="reg-telefono"
                type="tel"
                placeholder="381 555-1234"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="pl-10 h-11 rounded-xl"
                autoComplete="tel"
              />
            </div>
          </div>
        )}

        {/* Contraseña */}
        <div className="space-y-2">
          <Label htmlFor="reg-password" className="text-sm font-semibold">
            Contraseña
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-11 rounded-xl"
              required
              minLength={6}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Terms & Privacy Consent */}
        <div className="flex items-start gap-3 py-1">
          <Checkbox
            id="terms-accept"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
            className="mt-0.5"
          />
          <label
            htmlFor="terms-accept"
            className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
          >
            Acepto los{" "}
            <button
              type="button"
              className="text-primary font-semibold hover:underline"
              onClick={(e) => {
                e.preventDefault()
                setLegalDialog({ open: true, type: "terms" })
              }}
            >
              Términos y Condiciones
            </button>{" "}
            y la{" "}
            <button
              type="button"
              className="text-primary font-semibold hover:underline"
              onClick={(e) => {
                e.preventDefault()
                setLegalDialog({ open: true, type: "privacy" })
              }}
            >
              Política de Privacidad
            </button>
            , incluyendo el tratamiento de mis datos personales.
          </label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-11 rounded-xl font-bold text-sm mt-1"
          disabled={loading || !termsAccepted || (role === "negocio" && nameAvailable === false)}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : !termsAccepted ? (
            <>
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              Aceptá los términos para continuar
            </>
          ) : role === "negocio" && nameAvailable === false ? (
            <>
              <AlertCircle className="h-4 w-4 mr-1.5" />
              Elegí otro nombre
            </>
          ) : (
            "Crear cuenta"
          )}
        </Button>
      </form>

      {/* Switch to login */}
      {showSwitchToLogin && (
        <div className="mt-5 text-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{" "}
            <button
              onClick={onSwitchToLogin}
              className="text-primary font-semibold hover:underline"
            >
              Iniciá sesión
            </button>
          </p>
        </div>
      )}

      {/* Legal Dialogs */}
      <LegalDialog
        open={legalDialog.open}
        onOpenChange={(open) => setLegalDialog({ ...legalDialog, open })}
        type={legalDialog.type}
      />
    </div>
  )
}

// ============================================
// Verify Email Step
// ============================================

interface VerifyEmailStepProps {
  email: string
  userType: string
  onClose: () => void
  onBackToLogin: () => void
}

export function VerifyEmailStep({ email, userType, onClose, onBackToLogin }: VerifyEmailStepProps) {
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleResend = async () => {
    setResending(true)
    setResent(false)

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, userType }),
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

  const roleLabel = userType === "negocio" ? "tu local" : userType === "repartidor" ? "tu cuenta de repartidor" : "tu cuenta"

  return (
    <div className="py-6 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          damping: 15,
          stiffness: 200,
          delay: 0.1,
        }}
        className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-950/30 mx-auto mb-5 flex items-center justify-center"
      >
        <MailCheck className="h-10 w-10 text-orange-500" />
      </motion.div>

      <h2 className="text-xl font-extrabold mb-2">Verificá tu email</h2>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-2">
        Para completar el registro de {roleLabel}, necesitamos verificar tu email.
      </p>

      {/* Masked email display */}
      <div className="inline-flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-2 mb-5">
        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold">{maskEmail(email)}</span>
      </div>

      {/* Info message */}
      <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground bg-muted/50 rounded-xl p-3 mb-6">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>Revisá tu bandeja de entrada y la carpeta de spam</span>
      </div>

      {/* Resend button */}
      <div className="space-y-3">
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
          onClick={onBackToLogin}
          variant="outline"
          className="w-full rounded-xl font-semibold"
        >
          Ya verifiqué mi email
        </Button>

        <Button
          onClick={onClose}
          variant="ghost"
          className="w-full rounded-xl text-muted-foreground"
        >
          Volver al inicio
        </Button>
      </div>
    </div>
  )
}

// ============================================
// Approval Pending Step
// ============================================

function ApprovalPendingStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="py-6 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring",
          damping: 15,
          stiffness: 200,
          delay: 0.1,
        }}
        className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-950/30 mx-auto mb-5 flex items-center justify-center"
      >
        <Clock className="h-10 w-10 text-amber-500" />
      </motion.div>

      <h2 className="text-xl font-extrabold mb-2">Registro exitoso</h2>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
        Tu solicitud de registro fue enviada. Un administrador debe aprobar tu
        local antes de que puedas acceder al panel.
      </p>

      <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground bg-muted/50 rounded-xl p-3 mb-6">
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>Te notificaremos cuando tu cuenta sea aprobada</span>
      </div>

      <Button
        onClick={onClose}
        className="rounded-xl font-semibold px-8"
        variant="outline"
      >
        Volver al inicio
      </Button>
    </div>
  )
}
