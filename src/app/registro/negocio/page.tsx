"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Logo } from "@/components/shared/logo"
import { LegalDialog } from "@/components/shared/legal-content"
import { Loader2, Store, AtSign, Lock, Mail, Tag, ShieldCheck, MailCheck, RefreshCw, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

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
// Negocio Registration Page
// ============================================
type NegocioView = "register" | "verify-email"

export default function NegocioRegisterPage() {
  const router = useRouter()
  const [view, setView] = useState<NegocioView>("register")
  const [loading, setLoading] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [legalDialog, setLegalDialog] = useState<{ open: boolean; type: "terms" | "privacy" }>({
    open: false,
    type: "terms",
  })
  const [form, setForm] = useState({
    nombre_local: "",
    usuario: "",
    email: "",
    password: "",
    rubro: "restaurante",
  })

  // Verification state
  const [registeredEmail, setRegisteredEmail] = useState("")
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!termsAccepted) {
      toast.error("Debés aceptar los términos y condiciones para registrarte")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tipo: "negocio", termsAccepted: "true" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al registrar")
        return
      }

      // Show verify-email step
      setRegisteredEmail(data.email || form.email)
      setView("verify-email")
    } catch {
      toast.error("Error de conexión")
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
        body: JSON.stringify({ email: registeredEmail, userType: "negocio" }),
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

  const rubros = [
    { value: "restaurante", label: "🍔 Restaurante / Comida" },
    { value: "ropa", label: "👕 Ropa / Indumentaria" },
    { value: "negocio", label: "🏪 Otro negocio" },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Logo className="h-10 w-auto mx-auto" />
          <h1 className="text-xl font-bold">Registrá tu local</h1>
          <p className="text-sm text-muted-foreground">Creá tu cuenta y empezá a vender en DeliGO</p>
        </div>

        <AnimatePresence mode="wait">
          {/* REGISTER VIEW */}
          {view === "register" && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-border/50 shadow-lg shadow-emerald-500/5">
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre" className="text-sm font-semibold">
                        Nombre del local
                      </Label>
                      <div className="relative">
                        <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="nombre"
                          placeholder="Mi Negocio"
                          value={form.nombre_local}
                          onChange={(e) => setForm({ ...form, nombre_local: e.target.value })}
                          className="pl-10 h-11 rounded-xl"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="usuario" className="text-sm font-semibold">
                        Usuario
                      </Label>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="usuario"
                          placeholder="mi_negocio"
                          value={form.usuario}
                          onChange={(e) => setForm({ ...form, usuario: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                          className="pl-10 h-11 rounded-xl"
                          required
                          minLength={3}
                          maxLength={30}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">3-30 caracteres, letras, números y _</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-semibold">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="mi@negocio.com"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="pl-10 h-11 rounded-xl"
                          required
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
                          type="password"
                          placeholder="••••••••"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="pl-10 h-11 rounded-xl"
                          required
                          minLength={6}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Mínimo 6 caracteres</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rubro" className="text-sm font-semibold">
                        Rubro
                      </Label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <select
                          id="rubro"
                          value={form.rubro}
                          onChange={(e) => setForm({ ...form, rubro: e.target.value })}
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          required
                        >
                          {rubros.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
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

                    <Button
                      type="submit"
                      className="w-full h-11 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={loading || !termsAccepted}
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : !termsAccepted ? (
                        <>
                          <ShieldCheck className="h-4 w-4 mr-1.5" />
                          Aceptá los términos para continuar
                        </>
                      ) : (
                        "Crear cuenta"
                      )}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                      ¿Ya tenés cuenta?{" "}
                      <a href="/negocio" className="text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2">
                        Ingresar
                      </a>
                    </p>
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
            >
              <Card className="border-border/50 shadow-lg shadow-emerald-500/5">
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
                    Para completar el registro de tu local, necesitamos verificar tu email. También requerirá aprobación del administrador.
                  </p>

                  <div className="inline-flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-2 mb-4">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-semibold">{maskEmail(registeredEmail)}</span>
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
                        router.push("/negocio")
                      }}
                      variant="outline"
                      className="w-full rounded-xl font-semibold"
                    >
                      Ya verifiqué mi email
                    </Button>

                    <Button
                      onClick={() => {
                        setView("register")
                        setRegisteredEmail("")
                      }}
                      variant="ghost"
                      className="w-full rounded-xl text-muted-foreground"
                    >
                      Volver al inicio
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legal Dialogs */}
      <LegalDialog
        open={legalDialog.open}
        onOpenChange={(open) => setLegalDialog({ ...legalDialog, open })}
        type={legalDialog.type}
      />
    </div>
  )
}
