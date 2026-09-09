"use client"

// ============================================
// GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — pantalla de consentimiento
// ============================================
// /api/auth/google/callback redirige acá cuando la identidad de Google es
// nueva, o cuando la cuenta existente todavía no tiene ningún
// LegalAcceptance persistido. No se crea cuenta ni sesión hasta que el
// usuario tilda el checkbox (desmarcado por defecto) y confirma — mismo
// patrón de UI que el registro tradicional (ver src/app/registro/negocio o
// el paso de registro de src/components/auth/auth-modal.tsx), reutilizando
// el mismo LegalDialog/TermsContent/PrivacyContent, nunca duplicando el
// contenido legal.

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Logo } from "@/components/shared/logo"
import { LegalDialog } from "@/components/shared/legal-content"
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

type LoadState =
  | { status: "loading" }
  | { status: "ready"; email: string; accountType: "cliente" | "repartidor"; isExistingAccount: boolean }
  | { status: "expired" }

export default function GoogleOAuthConsentPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [legalDialog, setLegalDialog] = useState<{ open: boolean; type: "terms" | "privacy" }>({
    open: false,
    type: "terms",
  })

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/google/consent")
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setState({ status: "expired" })
          return
        }
        const data = await res.json()
        setState({
          status: "ready",
          email: data.email,
          accountType: data.accountType,
          isExistingAccount: data.isExistingAccount,
        })
      })
      .catch(() => {
        if (!cancelled) setState({ status: "expired" })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleContinuar = async () => {
    if (!termsAccepted || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/google/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ termsAccepted: "true" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "No se pudo completar el registro. Intentá de nuevo.")
        setSubmitting(false)
        return
      }
      window.location.href = data.redirect
    } catch {
      toast.error("No se pudo completar el registro. Intentá de nuevo.")
      setSubmitting(false)
    }
  }

  const handleCancelar = async () => {
    setCancelling(true)
    try {
      await fetch("/api/auth/google/consent", { method: "DELETE" })
    } catch {
      // El cookie pendiente vence solo si esto falla — cancelar nunca debe
      // quedar bloqueado por un error de red.
    }
    window.location.href = "/"
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Logo className="h-10 w-auto mx-auto" />
          <h1 className="text-xl font-bold">Antes de continuar</h1>
        </div>

        <Card className="border-border/50 shadow-lg shadow-emerald-500/5">
          <CardContent className="p-6">
            {state.status === "loading" && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {state.status === "expired" && (
              <div className="text-center space-y-4 py-4">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Tu sesión de registro con Google expiró. Volvé a intentar iniciando sesión de nuevo.
                </p>
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl"
                  onClick={() => {
                    window.location.href = "/"
                  }}
                >
                  Volver al inicio
                </Button>
              </div>
            )}

            {state.status === "ready" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Vas a continuar como <span className="font-semibold text-foreground">{state.email}</span>
                </p>

                <div className="flex items-start gap-3 py-1">
                  <Checkbox
                    id="google-terms-accept"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="google-terms-accept"
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
                  type="button"
                  className="w-full h-11 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!termsAccepted || submitting}
                  onClick={handleContinuar}
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : !termsAccepted ? (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-1.5" />
                      Aceptá los términos para continuar
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-9 rounded-xl text-sm text-muted-foreground"
                  disabled={cancelling}
                  onClick={handleCancelar}
                >
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LegalDialog
        open={legalDialog.open}
        onOpenChange={(open) => setLegalDialog({ ...legalDialog, open })}
        type={legalDialog.type}
      />
    </div>
  )
}
