"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { CuentaOperativaRegisterForm } from "@/components/auth/cuenta-operativa-register-form"

// ============================================
// DeliGO Operaciones — Crear cuenta personal (Bugfix-5B)
// ============================================
// Registro de CuentaOperativa integrado al contexto visual de Operaciones.
// Reutiliza exactamente el mismo formulario/API que /mozo/registro
// (CuentaOperativaRegisterForm → POST /api/operativo/register) — no hay dos
// lógicas de validación distintas, solo dos encabezados distintos.
//
// A propósito NO pide negocio/área/rol: crear la cuenta solo crea la
// identidad personal. Vincularse a un negocio sigue requiriendo el código de
// incorporación que emite ese negocio, después de iniciar sesión.
export default function OperacionesRegistroPage() {
  const router = useRouter()
  const [success, setSuccess] = useState(false)

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
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Crear cuenta</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuenta personal de DeliGO Operaciones.
              </p>
            </div>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Cuenta creada correctamente. Ahora iniciá sesión para vincularte con tu negocio.
                  </p>
                </div>
              </div>
              <Button
                className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600"
                onClick={() => router.push("/operaciones/ingresar")}
              >
                Iniciar sesión
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Después de crear tu cuenta, necesitás el código de incorporación que te entrega tu negocio.
                </p>
              </div>

              <CuentaOperativaRegisterForm
                onSuccess={() => setSuccess(true)}
                loginHref="/operaciones/ingresar"
              />
            </>
          )}

          {/* Volver al login de empleado */}
          <Button asChild variant="ghost" className="h-10 w-full gap-2 rounded-xl text-muted-foreground">
            <Link href="/operaciones/ingresar">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
