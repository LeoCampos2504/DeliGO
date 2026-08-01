"use client"

import { useState, Suspense, type FormEvent, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"

// ============================================
// DeliGO — Olvidé mi contraseña (Bugfix-5D)
// ============================================
// `type` es obligatorio y viene siempre de un allowlist estricto — nunca se
// manda un tipo arbitrario a /api/auth/forgot-password. No se importa
// src/lib/password-reset.ts acá a propósito: usa el módulo `crypto` de
// Node, que no debe empaquetarse para el navegador.

type AccountType = "cliente" | "negocio" | "repartidor" | "cuenta_operativa"
const VALID_TYPES: readonly AccountType[] = ["cliente", "negocio", "repartidor", "cuenta_operativa"]

const ROLE_CONFIG: Record<
  AccountType,
  { label: string; emailHint: string; loginHref: string; loginLabel: string }
> = {
  cliente: {
    label: "Cliente",
    emailHint: "Ingresá el email de tu cuenta.",
    loginHref: "/login",
    loginLabel: "Ir al login de Cliente",
  },
  negocio: {
    label: "Negocio",
    emailHint: "Ingresá el email registrado del negocio.",
    loginHref: "/negocio",
    loginLabel: "Ir al login de Negocio",
  },
  repartidor: {
    label: "Repartidor",
    emailHint: "Ingresá el email de tu cuenta de repartidor.",
    loginHref: "/repartidor",
    loginLabel: "Ir a DeliGO Repartidor",
  },
  cuenta_operativa: {
    label: "DeliGO Operaciones",
    emailHint: "Ingresá el email de tu cuenta personal.",
    loginHref: "/operaciones/ingresar",
    loginLabel: "Ir a DeliGO Operaciones",
  },
}

function CenteredCard({ children }: { children: ReactNode }) {
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

function ForgotPasswordContent() {
  const searchParams = useSearchParams()
  const rawType = searchParams.get("type")
  const accountType = VALID_TYPES.includes(rawType as AccountType) ? (rawType as AccountType) : null

  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  if (!accountType) {
    return (
      <CenteredCard>
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold">Recuperar contraseña</h1>
          <p className="text-sm text-muted-foreground">
            No pudimos identificar qué tipo de cuenta querés recuperar.
          </p>
        </div>
        <div className="w-full space-y-2">
          {VALID_TYPES.map((type) => (
            <Button key={type} asChild variant="outline" className="w-full rounded-xl">
              <Link href={`/forgot-password?type=${type}`}>{ROLE_CONFIG[type].label}</Link>
            </Button>
          ))}
        </div>
      </CenteredCard>
    )
  }

  const config = ROLE_CONFIG[accountType]

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email, accountType }),
      })
    } catch {
      // Se ignora a propósito: la respuesta hacia el usuario es siempre la
      // misma genérica, incluso si la request de red falla — nunca se
      // diferencia comportamiento según lo que haya pasado del otro lado.
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <CenteredCard>
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold">Recuperar contraseña</h1>
        <p className="text-sm text-muted-foreground">{config.label}</p>
      </div>

      {sent ? (
        <div className="w-full space-y-4">
          <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              Si existe una cuenta con ese correo, recibirás instrucciones para restablecer la contraseña.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full gap-2 rounded-xl">
            <Link href={config.loginHref}>
              <ArrowLeft className="h-4 w-4" />
              {config.loginLabel}
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <p className="text-xs text-muted-foreground">{config.emailHint}</p>
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

          <Button type="submit" className="h-11 w-full rounded-xl font-semibold" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar instrucciones"}
          </Button>

          <Button asChild variant="ghost" className="h-10 w-full gap-2 rounded-xl text-muted-foreground">
            <Link href={config.loginHref}>
              <ArrowLeft className="h-4 w-4" />
              {config.loginLabel}
            </Link>
          </Button>
        </form>
      )}
    </CenteredCard>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordContent />
    </Suspense>
  )
}
