"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Receipt, RefreshCw } from "lucide-react"
import { fetchMesaClienteCuenta, type MesaClienteCuentaActiva, type MesaClienteCuentaOutcome } from "@/lib/mesa-cliente-cuenta-client"
import { computeMesaClienteCuentaUiState } from "@/lib/mesa-cliente-cuenta-ui"
import { formatPrice } from "@/lib/utils"

// ============================================
// DeliGO — Panel público de cuenta de mesa para el cliente (23-B)
// ============================================
// Autocontenido: mismo espíritu que MesaOccupancyControl/MesaCuentaDialog/
// CancelarPedidoMesaDialog (src/components/operativo/) — gestiona su propio
// fetch/estado/polling y no asume nada sobre cómo el host maneja el resto de
// sus datos. Solo recibe `slug`/`mesaNumero` (datos públicos, los mismos ya
// impresos en el QR) — nunca negocioId/mesaId/ocupacionId: la autorización
// real la resuelve el servidor exclusivamente a partir de la cookie HttpOnly
// `deligo_mesa_occupancy` (ver src/lib/mesa-cliente-cuenta.ts).
//
// Cuando no hay sesión de cuenta activa para esta mesa (la mayoría de los
// casos: geocerca no calibrada, o el cliente todavía no fue confirmado
// "inside"), el panel NO renderiza nada — no es un estado de error, es el
// estado normal de una mesa sin cuenta pública todavía disponible.

const POLL_INTERVAL_MS = 15000

export interface MesaClienteCuentaPanelProps {
  slug: string
  mesaNumero: number
  colorPrincipal?: string
}

export function MesaClienteCuentaPanel({ slug, mesaNumero, colorPrincipal }: MesaClienteCuentaPanelProps) {
  const sessionKey = `${slug}:${mesaNumero}`

  const [lastOutcome, setLastOutcome] = useState<MesaClienteCuentaOutcome | null>(null)
  const [lastGoodCuenta, setLastGoodCuenta] = useState<MesaClienteCuentaActiva | null>(null)
  const [lastGoodSessionKey, setLastGoodSessionKey] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)

  const sessionKeyRef = useRef(sessionKey)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Cambio de mesa/negocio: nunca conservar el resultado de la sesión
  // anterior mientras se valida la nueva — evita mostrar la cuenta de otra
  // mesa durante el parpadeo de la primera carga. Ajuste de estado durante
  // el render (no en un efecto) — mismo patrón ya usado por
  // `prevMesaGeofenceKey` en src/app/n/[slug]/page.tsx para el mismo caso
  // ("reset visible state when a prop changes").
  const [prevSessionKey, setPrevSessionKey] = useState(sessionKey)
  if (sessionKey !== prevSessionKey) {
    setPrevSessionKey(sessionKey)
    setLastOutcome(null)
  }

  // Mutación de ref permitida en un efecto (nunca durante el render) — usada
  // exclusivamente para que las continuaciones async de abajo (que corren
  // DESPUÉS de un `await`) puedan descartar una respuesta tardía de una
  // sesión ya reemplazada.
  useEffect(() => {
    sessionKeyRef.current = sessionKey
  }, [sessionKey])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function run() {
      setFetching(true)
      const outcome = await fetchMesaClienteCuenta({ slug, mesaNumero }, controller.signal).catch(
        (): MesaClienteCuentaOutcome => ({ kind: "error" })
      )
      if (cancelled || !mountedRef.current || sessionKeyRef.current !== sessionKey) return
      setLastOutcome(outcome)
      if (outcome.kind === "activa") {
        setLastGoodCuenta(outcome.cuenta)
        setLastGoodSessionKey(sessionKey)
      }
      setFetching(false)
    }

    void run()
    const interval = setInterval(() => void run(), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(interval)
    }
  }, [slug, mesaNumero, sessionKey])

  function retryNow() {
    setLastOutcome(null)
    setFetching(true)
    fetchMesaClienteCuenta({ slug, mesaNumero })
      .catch((): MesaClienteCuentaOutcome => ({ kind: "error" }))
      .then((outcome) => {
        if (!mountedRef.current || sessionKeyRef.current !== sessionKey) return
        setLastOutcome(outcome)
        if (outcome.kind === "activa") {
          setLastGoodCuenta(outcome.cuenta)
          setLastGoodSessionKey(sessionKey)
        }
        setFetching(false)
      })
  }

  const state = computeMesaClienteCuentaUiState({
    sessionKey,
    lastGoodSessionKey,
    lastOutcome,
    lastGoodCuenta,
    fetching,
  })

  if (state.kind === "hidden" || state.kind === "loading") return null

  const accent = colorPrincipal ?? "#2563eb"

  if (state.kind === "cerrada") {
    return (
      <div className="mx-4 mt-3 p-3 rounded-2xl border border-border/60 bg-muted/30 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-background">
          <Receipt className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground flex-1 min-w-0">Esta cuenta de mesa ya no está activa.</p>
      </div>
    )
  }

  if (state.kind === "error") {
    return (
      <div className="mx-4 mt-3 p-3 rounded-2xl border border-border/60 bg-muted/30 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-background">
          <Loader2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground flex-1 min-w-0">No pudimos cargar tu cuenta de mesa.</p>
        <button
          type="button"
          onClick={retryNow}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-background transition-colors text-xs font-semibold text-muted-foreground"
          aria-label="Reintentar cargar la cuenta"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  // state.kind === "activa"
  const { cuenta } = state
  return (
    <div
      className="mx-4 mt-3 p-3 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300"
      style={{ backgroundColor: `${accent}10`, borderColor: `${accent}30` }}
      aria-live="polite"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accent}15` }}
      >
        <Receipt className="h-5 w-5" style={{ color: accent }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: accent }}>
          Tu cuenta: {formatPrice(cuenta.totalGeneral)}
        </p>
        <p className="text-xs text-muted-foreground">
          {cuenta.pedidosPendientesCount > 0
            ? `${cuenta.pedidosPendientesCount} pedido${cuenta.pedidosPendientesCount === 1 ? "" : "s"} en preparación`
            : cuenta.pedidosIncluidosCount > 0
              ? `${cuenta.pedidosIncluidosCount} pedido${cuenta.pedidosIncluidosCount === 1 ? "" : "s"} servido${cuenta.pedidosIncluidosCount === 1 ? "" : "s"}`
              : "Todavía no tenés pedidos servidos"}
          {state.stale ? " · actualizando…" : ""}
        </p>
      </div>
    </div>
  )
}
