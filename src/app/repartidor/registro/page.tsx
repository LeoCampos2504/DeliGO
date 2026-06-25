"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Bike } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { RegisterStep, VerifyEmailStep, roles } from "@/components/auth/auth-modal"
import { toast } from "sonner"

type RepartidorRegisterView = "register" | "verify-email"

export default function RepartidorRegisterPage() {
  const router = useRouter()
  const [view, setView] = useState<RepartidorRegisterView>("register")
  const [registeredEmail, setRegisteredEmail] = useState("")
  const roleData = roles.find((role) => role.type === "repartidor")!

  const handleRegisterSuccess = (data: {
    needsVerification?: boolean
    email?: string
    userType?: string
    user?: { nombre?: string }
  }) => {
    if (data.needsVerification && data.email) {
      setRegisteredEmail(data.email)
      setView("verify-email")
      return
    }

    if (data.user?.nombre) {
      toast.success(`Bienvenido, ${data.user.nombre}`)
    }

    router.replace("/repartidor")
  }

  const goToLogin = () => {
    router.push("/repartidor")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-500/5" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-blue-500/3" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="md" />
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bike className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Registrate como repartidor
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crea tu cuenta para recibir y entregar pedidos de los locales.
            </p>
          </div>
        </div>

        <Card className="w-full border-border/50 shadow-lg shadow-blue-500/5">
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {view === "register" && (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <a
                    href="/api/auth/google?role=repartidor"
                    className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-border/50 bg-background hover:bg-muted/50 transition-all duration-200 text-sm font-semibold mb-4"
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
                  </a>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-[11px] text-muted-foreground font-medium">o</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>

                  <RegisterStep
                    role="repartidor"
                    roleData={roleData}
                    onSuccess={handleRegisterSuccess}
                    onSwitchToLogin={goToLogin}
                    showSwitchToLogin={false}
                  />
                </motion.div>
              )}

              {view === "verify-email" && (
                <motion.div
                  key="verify-email"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <VerifyEmailStep
                    email={registeredEmail}
                    userType="repartidor"
                    onClose={goToLogin}
                    onBackToLogin={goToLogin}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          ¿Ya tenés cuenta?{" "}
          <Link href="/repartidor" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
