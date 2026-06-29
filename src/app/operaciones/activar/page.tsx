"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, AlertTriangle, Loader2, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"

const AREA_LABELS: Record<string, string> = {
  salon: "Salón",
  pyr: "Pedidos y reseñas",
}

interface TerminalInfo {
  id: string
  nombre: string
  estado: string
  perfil: string
  areas: string[]
  scopes: string[]
}

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; terminal: TerminalInfo | null }
  | { status: "error"; message: string }

const GENERIC_ERROR = "Código inválido, vencido o ya utilizado."

export default function OperacionesActivarPage() {
  const router = useRouter()
  const [state, setState] = useState<PageState>({ status: "idle" })
  const [manualInput, setManualInput] = useState("")
  const autoTried = useRef(false)

  const activate = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    setState({ status: "loading" })
    try {
      const res = await fetch("/api/operaciones/terminal/activar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        referrerPolicy: "no-referrer",
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setState({ status: "error", message: data.error || GENERIC_ERROR })
        return
      }
      setManualInput("")
      setState({ status: "success", terminal: data.terminal ?? null })
    } catch {
      setState({ status: "error", message: "No se pudo conectar. Revisá tu conexión e intentá de nuevo." })
    }
  }, [])

  // Tras una activación exitosa (ya confirmada), redirigir a /operaciones reemplazando el
  // historial para que el QR/código no pueda reaparecer con "Atrás".
  useEffect(() => {
    if (state.status !== "success") return
    const t = setTimeout(() => router.replace("/operaciones"), 1500)
    return () => clearTimeout(t)
  }, [state.status, router])

  // Leer el secreto del fragmento (#c=...), limpiarlo de inmediato y activar.
  useEffect(() => {
    if (autoTried.current) return
    autoTried.current = true
    const hash = typeof window !== "undefined" ? window.location.hash : ""
    const match = hash.match(/[#&]c=([^&]+)/)
    if (match) {
      const code = decodeURIComponent(match[1])
      // Eliminar el fragmento del historial antes de cualquier otra cosa.
      window.history.replaceState(null, "", window.location.pathname + window.location.search)
      void activate(code)
    }
  }, [activate])

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Logo size="sm" />
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted text-foreground shrink-0">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Activar terminal</h1>
                <p className="text-xs text-muted-foreground">
                  Ingresá el código temporal o escaneá el QR generado por el administrador.
                </p>
              </div>
            </div>
          </div>

          {state.status === "success" ? (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Terminal activada</p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                Esta terminal ya está vinculada a DeliGO Operaciones.
              </p>
              {state.terminal && (
                <div className="pt-2 space-y-2">
                  <p className="text-sm font-semibold">{state.terminal.nombre}</p>
                  {state.terminal.areas.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {state.terminal.areas.map((area) => (
                        <span
                          key={area}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-card border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-medium"
                        >
                          {AREA_LABELS[area] ?? area}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-700/70 dark:text-emerald-300/70 pt-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Abriendo DeliGO Operaciones…
              </p>
            </div>
          ) : (
            <>
              {state.status === "error" && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400">{state.message}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Código temporal</Label>
                <Input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="rounded-xl font-mono tracking-wider"
                  placeholder="ABCD-EFGH-JKLM-NPQR"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={state.status === "loading"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") activate(manualInput)
                  }}
                />
              </div>

              <Button
                className="w-full rounded-xl gap-2 font-semibold"
                onClick={() => activate(manualInput)}
                disabled={state.status === "loading" || !manualInput.trim()}
              >
                {state.status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Monitor className="h-4 w-4" />
                )}
                Activar terminal
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
