"use client"

// ============================================
// T7-F1 — Caja: formulario de RETIRO PERSONAL de mercadería (dueño y cajero)
// ============================================
// Se abre desde «Cobrar» con el MISMO carrito de la venta (productos, variantes y cantidades no se vuelven a elegir).
// Visualmente está junto a los medios de pago, pero NO es un medio de pago: envía a su propio endpoint, que registra
// una salida no comercial de mercadería (sin venta, sin cobro, sin dinero). El servidor calcula los valores; esta
// pantalla sólo muestra el total que ya veía el cajero y lo envía para detectar precios desactualizados.
// Idempotencia (mismo criterio que el cobro de Caja, F10-B0 D9, con almacenamiento PROPIO): el intento — clave +
// contenido exacto + carrito — se guarda en sessionStorage, por negocio y contexto operativo, ANTES de enviarlo. Una
// respuesta incierta (sin respuesta o 5xx) lo conserva: cerrar, reabrir o recargar vuelve al MISMO intento, que sólo
// se reenvía tal cual (misma clave, mismo contenido), y mientras exista la Caja no cobra una venta con ese carrito.
// Sólo una respuesta definitiva lo descarta. El carrito se vacía sólo después de la confirmación del servidor. No se
// guardan costos, decisiones ni credenciales.

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PackageMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn, formatPrice } from "@/lib/utils"
import { cartLineSubtotal, cartTotal, type CartLine } from "@/lib/caja-venta"
import { classifyCheckoutResponse, newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import {
  ETIQUETA_BENEFICIARIO,
  FAMILIAR_NOMBRE_MAX,
  limpiarNombreFamiliar,
  normalizarNombreFamiliar,
  RETIRO_AVISO_SIN_DINERO,
  RETIRO_OBSERVACIONES_MAX,
  type BeneficiarioTipo,
} from "@/lib/retiros-personales"

export interface RetiroContexto {
  habilitado: boolean
  propioEmpleadoId?: string | null
  empleados: Array<{ id: string; nombre: string }>
  familiares: Array<{ id: string; nombre: string }>
  dueno: { nombre: string } | null
}

export const retiroContextoQueryKey = (retirosUrl: string) => ["caja-retiro-contexto", retirosUrl] as const

/** Contexto del formulario (permiso + beneficiarios). Sin permiso o sin endpoint → la opción no aparece. */
export function useRetiroContexto(retirosUrl: string | null | undefined, enabled: boolean) {
  return useQuery<RetiroContexto | null>({
    queryKey: retiroContextoQueryKey(retirosUrl ?? ""),
    enabled: Boolean(retirosUrl) && enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`${retirosUrl}/contexto`, { cache: "no-store" })
      if (!res.ok) return null
      const json = (await res.json().catch(() => null)) as (RetiroContexto & { ok?: boolean }) | null
      return json?.habilitado ? json : null
    },
  })
}

export interface RetiroRegistrado {
  id: string
  beneficiarioNombre: string
  valorComercial: number
  cantidadLineas: number
}

/** Intento de retiro enviado y todavía sin respuesta definitiva. */
export interface PendingRetiroAttempt {
  key: string
  /** Cuerpo EXACTO enviado (beneficiario, productos, cantidades, observaciones, total visto). */
  canonical: string
  /** Carrito del intento (para restaurarlo al recargar). */
  cart: CartLine[]
  beneficiarioNombre: string
  createdAt: number
}

const RETIRO_ATTEMPT_PREFIX = "deligo:caja:retiro-attempt:v1:"
function sesion(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null
  } catch {
    return null
  }
}

/** Lee el intento pendiente de ESTE negocio y contexto operativo (scope); null si no hay o no es válido. */
export function readPendingRetiro(scope: string): PendingRetiroAttempt | null {
  try {
    const raw = sesion()?.getItem(RETIRO_ATTEMPT_PREFIX + scope)
    if (!raw) return null
    const a = JSON.parse(raw) as Partial<PendingRetiroAttempt>
    const body = typeof a.canonical === "string" ? (JSON.parse(a.canonical) as { confirmado?: unknown; items?: unknown }) : null
    if (!isValidVentaIdempotencyKey(a.key) || !body || body.confirmado !== true || !Array.isArray(body.items) || !Array.isArray(a.cart) || a.cart.length === 0 || typeof a.beneficiarioNombre !== "string") return null
    return a as PendingRetiroAttempt
  } catch {
    return null
  }
}
export function writePendingRetiro(scope: string, attempt: PendingRetiroAttempt): void {
  try {
    sesion()?.setItem(RETIRO_ATTEMPT_PREFIX + scope, JSON.stringify(attempt))
  } catch {
    // sin almacenamiento: el intento en memoria protege los reintentos de esta pantalla
  }
}
export function clearPendingRetiro(scope: string): void {
  try {
    sesion()?.removeItem(RETIRO_ATTEMPT_PREFIX + scope)
  } catch {
    // ignorar
  }
}

export const RETIRO_INCIERTO_MENSAJE = "No sabemos si el retiro se registró. Tocá Confirmar de nuevo: si ya estaba registrado, no se duplica."

type Seleccion = { tipo: BeneficiarioTipo; empleadoId: string; familiarId: string; nuevoFamiliar: string }

/** Cuerpo del POST (sin precios ni costos). Puro para poder probarlo. */
export function cuerpoRetiro(cart: ReadonlyArray<CartLine>, sel: Seleccion, observaciones: string) {
  const beneficiario =
    sel.tipo === "EMPLEADO" ? { tipo: "EMPLEADO", empleadoId: sel.empleadoId }
    : sel.tipo === "DUENO" ? { tipo: "DUENO" }
    : sel.familiarId ? { tipo: "FAMILIAR", familiarId: sel.familiarId }
    : { tipo: "FAMILIAR", nuevoNombre: limpiarNombreFamiliar(sel.nuevoFamiliar) }
  return {
    beneficiario,
    items: cart.map((l) => ({ productoId: l.productoId, varianteId: l.varianteId ?? undefined, cantidad: l.cantidad })),
    observaciones: observaciones.trim() || null,
    totalMostrado: cartTotal(cart),
    confirmado: true,
  }
}

export function RetiroPersonalDialog({
  retirosUrl,
  cart,
  contexto,
  pendiente,
  onPendienteChange,
  onClose,
  onRegistrado,
  onPreciosDesactualizados,
  onAccessLost,
}: {
  retirosUrl: string
  cart: ReadonlyArray<CartLine>
  /** null sólo cuando se reabre un intento pendiente (no hace falta elegir nada). */
  contexto: RetiroContexto | null
  /** Intento enviado sin respuesta definitiva: el formulario sólo permite reenviarlo tal cual o descartarlo. */
  pendiente: PendingRetiroAttempt | null
  onPendienteChange: (attempt: PendingRetiroAttempt | null) => void
  onClose: () => void
  onRegistrado: (retiro: RetiroRegistrado, replayed: boolean, cartEnviado: ReadonlyArray<CartLine>) => void
  onPreciosDesactualizados?: () => void
  onAccessLost?: (status: number) => void
}) {
  const [sel, setSel] = useState<Seleccion>({ tipo: "EMPLEADO", empleadoId: contexto?.propioEmpleadoId ?? "", familiarId: "", nuevoFamiliar: "" })
  const [observaciones, setObservaciones] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(pendiente ? RETIRO_INCIERTO_MENSAJE : null)
  const total = cartTotal(cart)
  const familiares = contexto?.familiares ?? []

  const familiarExistente = useMemo(() => {
    const n = normalizarNombreFamiliar(sel.nuevoFamiliar)
    return n ? familiares.find((f) => normalizarNombreFamiliar(f.nombre) === n) ?? null : null
  }, [sel.nuevoFamiliar, familiares])

  // Un nombre igual a uno registrado (sin distinguir mayúsculas ni acentos) NO se asume como la misma persona: el
  // cajero elige al registrado o escribe un nombre que los distinga. El servidor aplica la misma regla.
  const beneficiarioListo =
    sel.tipo === "DUENO" ? Boolean(contexto?.dueno)
    : sel.tipo === "EMPLEADO" ? Boolean(sel.empleadoId)
    : Boolean(sel.familiarId) || (!familiarExistente && limpiarNombreFamiliar(sel.nuevoFamiliar).length > 0 && limpiarNombreFamiliar(sel.nuevoFamiliar).length <= FAMILIAR_NOMBRE_MAX)

  const nombreBeneficiario = () =>
    sel.tipo === "DUENO" ? contexto?.dueno?.nombre ?? "Dueño"
    : sel.tipo === "EMPLEADO" ? contexto?.empleados.find((e) => e.id === sel.empleadoId)?.nombre ?? "Empleado"
    : sel.familiarId ? familiares.find((f) => f.id === sel.familiarId)?.nombre ?? "Familiar"
    : limpiarNombreFamiliar(sel.nuevoFamiliar)

  /** Envía un intento ya guardado. Sólo una respuesta DEFINITIVA lo descarta; una incierta lo conserva. */
  async function enviar(attempt: PendingRetiroAttempt) {
    setError(null)
    setEnviando(true)
    try {
      let res: Response
      try {
        res = await fetch(retirosUrl, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.key }, body: attempt.canonical })
      } catch {
        throw new Error(RETIRO_INCIERTO_MENSAJE)
      }
      const json = (await res.json().catch(() => ({}))) as { retiro?: RetiroRegistrado; error?: string; code?: string }
      if (res.status === 401 || res.status === 403) onAccessLost?.(res.status)
      const outcome = classifyCheckoutResponse(res.status, json.code)
      if (outcome === "success" && json.retiro) {
        onPendienteChange(null)
        onRegistrado(json.retiro, res.headers.get("Idempotency-Replayed") === "true", attempt.cart)
        return
      }
      if (outcome === "uncertain" || outcome === "success") throw new Error(RETIRO_INCIERTO_MENSAJE)
      onPendienteChange(null) // rechazo definitivo: con esta clave no quedó nada registrado
      if (json.code === "PRECIOS_CAMBIARON") onPreciosDesactualizados?.()
      throw new Error(json.error ?? "No se pudo registrar el retiro.")
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function confirmar() {
    setError(null)
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setError("Sin conexión: el retiro no se registró. Conectate y volvé a confirmar.")
      return
    }
    const body = cuerpoRetiro(cart, sel, observaciones)
    const attempt: PendingRetiroAttempt = { key: newIdempotencyKey(), canonical: JSON.stringify(body), cart: cart.map((l) => ({ ...l })), beneficiarioNombre: nombreBeneficiario(), createdAt: Date.now() }
    onPendienteChange(attempt) // guardado ANTES de enviar: una respuesta perdida nunca pierde la clave
    await enviar(attempt)
  }

  if (pendiente) {
    const totalPendiente = cartTotal(pendiente.cart)
    return (
      <Dialog open onOpenChange={(open) => !open && !enviando && onClose()}>
        <DialogContent className="max-w-sm sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto" data-testid="retiro-personal-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PackageMinus className="h-5 w-5" /> Retiro personal sin confirmar</DialogTitle>
            <DialogDescription className="text-amber-800 dark:text-amber-200 font-medium">{RETIRO_AVISO_SIN_DINERO}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm" data-testid="retiro-pendiente">
            <p>Para: <span className="font-semibold">{pendiente.beneficiarioNombre}</span></p>
            <ul className="divide-y rounded-xl border text-xs">
              {pendiente.cart.map((l) => (
                <li key={`${l.productoId}:${l.varianteId ?? ""}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="min-w-0 truncate">{l.cantidad} × {l.nombre}{l.varianteNombre ? ` — ${l.varianteNombre}` : ""}</span>
                  <span className="shrink-0 tabular-nums">{formatPrice(cartLineSubtotal(l))}</span>
                </li>
              ))}
            </ul>
            <p className="font-semibold">Valor comercial {formatPrice(totalPendiente)}</p>
            {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="alert">{error}</p>}
            <Button data-testid="retiro-reintentar" className="w-full h-11 rounded-xl font-bold" disabled={enviando} onClick={() => void enviar(pendiente)}>
              {enviando ? "Confirmando…" : "Confirmar de nuevo"}
            </Button>
            <button type="button" data-testid="retiro-descartar" disabled={enviando} className="w-full text-xs font-semibold underline underline-offset-2" onClick={() => { onPendienteChange(null); onClose() }}>
              Descartar este intento (si ya se registró, el dueño lo verá en Retiros personales)
            </button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!contexto) return null

  const tipos: BeneficiarioTipo[] = ["EMPLEADO", "FAMILIAR", "DUENO"]
  return (
    <Dialog open onOpenChange={(open) => !open && !enviando && onClose()}>
      <DialogContent className="max-w-sm sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto" data-testid="retiro-personal-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackageMinus className="h-5 w-5" /> Retiro personal</DialogTitle>
          <DialogDescription className="text-amber-800 dark:text-amber-200 font-medium">{RETIRO_AVISO_SIN_DINERO}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">¿Quién retira?</p>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Tipo de beneficiario">
              {tipos.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={sel.tipo === t}
                  onClick={() => setSel((s) => ({ ...s, tipo: t }))}
                  className={cn("min-h-11 rounded-xl border px-2 text-sm font-semibold", sel.tipo === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
                >
                  {ETIQUETA_BENEFICIARIO[t]}
                </button>
              ))}
            </div>
          </div>

          {sel.tipo === "EMPLEADO" && (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Empleado</span>
              <select data-testid="retiro-empleado" className="h-11 w-full rounded-xl border bg-background px-3" value={sel.empleadoId} onChange={(e) => setSel((s) => ({ ...s, empleadoId: e.target.value }))}>
                <option value="">Elegí un empleado…</option>
                {contexto.empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.id === contexto.propioEmpleadoId ? " (vos)" : ""}</option>)}
              </select>
            </label>
          )}

          {sel.tipo === "FAMILIAR" && (
            <div className="space-y-2">
              {contexto.familiares.length > 0 && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Familiar registrado</span>
                  <select data-testid="retiro-familiar" className="h-11 w-full rounded-xl border bg-background px-3" value={sel.familiarId} onChange={(e) => setSel((s) => ({ ...s, familiarId: e.target.value, nuevoFamiliar: "" }))}>
                    <option value="">Agregar un familiar nuevo…</option>
                    {contexto.familiares.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                  </select>
                </label>
              )}
              {!sel.familiarId && (
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Nombre del familiar nuevo</span>
                  <Input data-testid="retiro-familiar-nuevo" value={sel.nuevoFamiliar} maxLength={FAMILIAR_NOMBRE_MAX} onChange={(e) => setSel((s) => ({ ...s, nuevoFamiliar: e.target.value }))} placeholder="Ej.: Ana Pérez" className="h-11 rounded-xl" />
                  {familiarExistente && (
                    <span className="block space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" data-testid="retiro-familiar-coincide">
                      <span className="block">Ya hay un familiar registrado como «{familiarExistente.nombre}». ¿Es la misma persona?</span>
                      <button type="button" data-testid="retiro-familiar-usar-existente" className="font-semibold underline underline-offset-2" onClick={() => setSel((s) => ({ ...s, familiarId: familiarExistente.id, nuevoFamiliar: "" }))}>
                        Sí, usar «{familiarExistente.nombre}»
                      </button>
                      <span className="block">Si es otra persona, escribí un nombre que los distinga (apellido o parentesco).</span>
                    </span>
                  )}
                </label>
              )}
            </div>
          )}

          {sel.tipo === "DUENO" && <p className="rounded-xl border px-3 py-2">Dueño: <span className="font-semibold">{contexto.dueno?.nombre ?? "—"}</span></p>}

          <div className="rounded-xl border">
            <ul className="divide-y text-xs">
              {cart.map((l) => (
                <li key={`${l.productoId}:${l.varianteId ?? ""}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="min-w-0 truncate">{l.cantidad} × {l.nombre}{l.varianteNombre ? ` — ${l.varianteNombre}` : ""}</span>
                  <span className="shrink-0 tabular-nums">{formatPrice(cartLineSubtotal(l))}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-center justify-between border-t px-3 py-2 font-semibold"><span>Valor comercial</span><span className="tabular-nums">{formatPrice(total)}</span></p>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Observaciones (opcional)</span>
            <textarea data-testid="retiro-observaciones" className="min-h-16 w-full rounded-xl border bg-background px-3 py-2" maxLength={RETIRO_OBSERVACIONES_MAX} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </label>

          <p className="text-xs text-muted-foreground">Si corresponde recuperar el valor, lo decide el dueño más tarde desde Administración.</p>

          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input data-testid="retiro-confirmo" type="checkbox" className="mt-1 h-4 w-4" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
            <span>Confirmo que esta mercadería sale de Caja sin pago.</span>
          </label>

          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200" role="alert">{error}</p>}

          <Button data-testid="retiro-confirmar" className="w-full h-11 rounded-xl font-bold" disabled={enviando || !confirmo || !beneficiarioListo || cart.length === 0} onClick={() => void confirmar()}>
            {enviando ? "Registrando…" : `Registrar retiro · ${formatPrice(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
