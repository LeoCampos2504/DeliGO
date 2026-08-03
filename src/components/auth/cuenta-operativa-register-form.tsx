"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// ============================================
// Bugfix-5B: formulario de registro de CuentaOperativa, compartido entre
// /mozo/registro (existente) y /operaciones/registro (nuevo). Misma
// validación y mismo POST /api/operativo/register en los dos lugares — no se
// duplica lógica, solo el encabezado/tarjeta que lo envuelve, que cada página
// mantiene con su propio estilo.
//
// A propósito NO pide negocio/área/rol/permisos: crear una CuentaOperativa
// solo crea la identidad personal del empleado. El acceso a un negocio sigue
// dependiendo exclusivamente del código de incorporación que emite ese
// negocio (ver Bugfix-5A, sección 7-8).
export interface CuentaOperativaRegisterFormProps {
  /** Se llama después de un registro exitoso. Cada página decide qué mostrar. */
  onSuccess: () => void
  /** Href de "¿Ya tenés cuenta? Iniciar sesión" — distinto por contexto (mozo vs Operaciones). */
  loginHref: string
}

// Bugfix-5F: mensajes estables para los dos códigos de error que el backend
// puede devolver (además de errores de formato, que ya llegan con su propio
// texto en `data.error`). Nunca se distingue, en la UI, si un bloqueo del
// límite semanal fue por IP o por dispositivo — el backend tampoco lo revela.
const EMAIL_ALREADY_EXISTS_MESSAGE =
  "Ya existe una cuenta con este correo. Iniciá sesión o recuperá tu contraseña."
const WEEKLY_REGISTRATION_LIMIT_MESSAGE =
  "Alcanzaste el límite de 3 cuentas creadas durante los últimos 7 días desde esta red o dispositivo. Probá nuevamente más adelante."

interface RegisterFormError {
  message: string
  code?: string
}

export function CuentaOperativaRegisterForm({ onSuccess, loginHref }: CuentaOperativaRegisterFormProps) {
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<RegisterFormError | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError({ message: "Las contraseñas no coinciden" })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/operativo/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ nombre, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        const message =
          data.code === "EMAIL_ALREADY_EXISTS"
            ? EMAIL_ALREADY_EXISTS_MESSAGE
            : data.code === "WEEKLY_REGISTRATION_LIMIT"
              ? WEEKLY_REGISTRATION_LIMIT_MESSAGE
              : data.error || "No se pudo crear la cuenta"
        setError({ message, code: data.code })
        return
      }
      onSuccess()
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "No se pudo crear la cuenta" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirmar contraseña</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div className="space-y-1.5">
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error.message}
            </p>
            {error.code === "EMAIL_ALREADY_EXISTS" && (
              <p className="px-1 text-xs text-muted-foreground">
                <Link href={loginHref} className="font-semibold text-primary hover:underline">
                  Iniciar sesión
                </Link>
                {" · "}
                <Link
                  href="/forgot-password?type=cuenta_operativa"
                  className="font-semibold text-primary hover:underline"
                >
                  Recuperar contraseña
                </Link>
              </p>
            )}
          </div>
        )}

        <Button type="submit" className="w-full gap-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Crear cuenta
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href={loginHref} className="font-semibold text-primary hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </>
  )
}
