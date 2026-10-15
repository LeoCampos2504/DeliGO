"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { BadgeCheck, Banknote, LockKeyhole, RefreshCw, Store, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"

type Register = { id: string; nombre: string; esPredeterminada: boolean; ocupada: boolean; fondoTransferible: { turnoOrigenId: string; importe: string } | null }
type Shift = { id: string; caja: { id: string; nombre: string }; abiertoEn: string; fondoInicial: number }
type ClosedShift = { id: string; caja: { id: string; nombre: string }; cerradoEn: string }
type State = {
  loading: boolean
  error: string | null
  modoTurnos: "OPCIONAL" | "OBLIGATORIO"
  aperturaHabilitada: boolean
  cajas: Register[]
  turno: Shift | null
  ultimoCierre: ClosedShift | null
}

const EMPTY: State = { loading: true, error: null, modoTurnos: "OPCIONAL", aperturaHabilitada: false, cajas: [], turno: null, ultimoCierre: null }
const STORAGE_PREFIX = "deligo:caja:apertura-turno:v1:"
const CLOSE_STORAGE_PREFIX = "deligo:caja:cierre-turno:v1:"
const inMemoryAttempts = new Map<string, string>()

// Known opening conflicts: the shown availability is stale, so re-read it.
const STALE_AVAILABILITY_CODES = new Set(["FONDO_REMANENTE_NO_DISPONIBLE", "FONDO_REMANENTE_YA_TRANSFERIDO", "IMPORTE_TRASPASO_NO_COINCIDE", "CAJA_CON_TURNO_ABIERTO", "CAJA_INACTIVA"])
const OPENING_CONFLICT_MESSAGES: Record<string, string> = {
  FONDO_REMANENTE_YA_TRANSFERIDO: "Ese fondo ya fue recibido por otro turno. Actualizamos la disponibilidad de la caja.",
  FONDO_REMANENTE_NO_DISPONIBLE: "El fondo del turno anterior ya no está disponible. Actualizamos la disponibilidad de la caja.",
  IMPORTE_TRASPASO_NO_COINCIDE: "El fondo disponible cambió. Revisá el importe actualizado antes de abrir el turno.",
  CAJA_CON_TURNO_ABIERTO: "Esta caja ya tiene un turno abierto. Elegí otra caja disponible.",
  CAJA_INACTIVA: "Esta caja fue desactivada. Elegí otra caja disponible.",
  TURNO_YA_ABIERTO: "Ya tenés un turno abierto.",
}

function attemptFor(scope: string, canonical: string, prefix = STORAGE_PREFIX): string {
  const mapKey = `${prefix}${scope}:${canonical}`
  const memoryKey = inMemoryAttempts.get(mapKey)
  if (memoryKey) return memoryKey
  try {
    const key = prefix + scope
    const stored = sessionStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored) as { canonical?: string; key?: string }
      if (parsed.canonical === canonical && parsed.key) {
        inMemoryAttempts.set(mapKey, parsed.key)
        return parsed.key
      }
    }
    const idempotencyKey = newIdempotencyKey()
    sessionStorage.setItem(key, JSON.stringify({ canonical, key: idempotencyKey }))
    inMemoryAttempts.set(mapKey, idempotencyKey)
    return idempotencyKey
  } catch {
    const idempotencyKey = newIdempotencyKey()
    inMemoryAttempts.set(mapKey, idempotencyKey)
    return idempotencyKey
  }
}

function clearAttempt(scope: string, prefix = STORAGE_PREFIX) {
  for (const key of inMemoryAttempts.keys()) if (key.startsWith(`${prefix}${scope}:`)) inMemoryAttempts.delete(key)
  try { sessionStorage.removeItem(prefix + scope) } catch { /* storage is optional */ }
}

export function OperationalShiftPanel({ slug, negocioId, empleadoId, empleadoNombre, onAccessLost }: { slug: string; negocioId: string; empleadoId: string; empleadoNombre: string; onAccessLost: (status: number, estado?: string) => void }) {
  const [state, setState] = useState<State>(EMPTY)
  const [selected, setSelected] = useState("")
  const [fondoInicial, setFondoInicial] = useState("0")
  const [usarFondoTransferido, setUsarFondoTransferido] = useState(false)
  const [confirmoRecepcionFondo, setConfirmoRecepcionFondo] = useState(false)
  const [efectivoContado, setEfectivoContado] = useState("")
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const openingRef = useRef(false)
  const scope = `${negocioId}:${empleadoId}`

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const response = await fetch(`/api/operativo/caja/${encodeURIComponent(slug)}/turno`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) onAccessLost(response.status, json.estado)
      if (!response.ok || !json.ok) throw new Error(json.error ?? "No pudimos cargar los turnos.")
      setState({ loading: false, error: null, modoTurnos: json.modoTurnos, aperturaHabilitada: json.aperturaHabilitada === true, cajas: json.cajas ?? [], turno: json.turno ?? null, ultimoCierre: json.ultimoCierre ?? null })
      setSelected((current) => json.cajas?.some((c: Register) => c.id === current && !c.ocupada) ? current : (json.cajas?.find((c: Register) => !c.ocupada)?.id ?? ""))
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "No pudimos cargar los turnos." }))
    }
  }, [slug, onAccessLost])

  useEffect(() => { void refresh() }, [refresh])

  async function openShift() {
    const fondo = Number(fondoInicial)
    const registroSeleccionado = state.cajas.find((caja) => caja.id === selected)
    const transferencia = usarFondoTransferido ? registroSeleccionado?.fondoTransferible : null
    if (!selected || (!transferencia && (!Number.isFinite(fondo) || fondo < 0 || !/^\d+(\.\d{1,2})?$/.test(fondoInicial.trim())))) {
      setMessage("Elegí una caja disponible e ingresá un fondo inicial válido.")
      return
    }
    if (usarFondoTransferido && (!transferencia || !confirmoRecepcionFondo)) {
      setMessage("Confirmá que recibiste físicamente el fondo disponible antes de iniciar el turno.")
      return
    }
    if (openingRef.current) return
    openingRef.current = true
    setSaving(true)
    setMessage(null)
    const body = transferencia
      ? { cajaFisicaId: selected, fondoInicial: transferencia.importe, transferirDesdeTurnoCajaId: transferencia.turnoOrigenId, confirmoRecepcionFondo: true }
      : { cajaFisicaId: selected, fondoInicial: fondoInicial.trim() }
    const canonical = JSON.stringify(body)
    try {
      let response: Response
      try {
        response = await fetch(`/api/operativo/caja/${encodeURIComponent(slug)}/turno`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": attemptFor(scope, canonical) },
          body: JSON.stringify(body),
        })
      } catch {
        // The key is kept: a retry replays the original opening instead of duplicating it.
        setMessage("No pudimos confirmar la apertura por un problema de conexión. Podés reintentar sin duplicarla.")
        return
      }
      const json = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) onAccessLost(response.status, json.estado)
      if (response.ok && json.ok && json.turno) {
        clearAttempt(scope)
        setUsarFondoTransferido(false)
        setConfirmoRecepcionFondo(false)
        // The server confirmed the shift: show it now, then reconcile with a fresh read.
        setState((current) => ({ ...current, turno: json.turno, cajas: current.cajas.map((caja) => caja.id === json.turno.caja?.id ? { ...caja, ocupada: true, fondoTransferible: null } : caja) }))
        setMessage(transferencia ? "Turno iniciado con el fondo recibido del turno anterior." : "Turno iniciado.")
        await refresh()
        return
      }
      if (response.status >= 500) {
        // Keep the key so a retry is idempotent; the server logged the real cause.
        setMessage("No pudimos abrir el turno por un error del servidor. Podés reintentar sin duplicarlo; si persiste, avisá al responsable del negocio.")
        return
      }
      clearAttempt(scope)
      const code = typeof json.code === "string" ? json.code : ""
      if (response.status === 409 && (STALE_AVAILABILITY_CODES.has(code) || code === "TURNO_YA_ABIERTO")) {
        setUsarFondoTransferido(false)
        setConfirmoRecepcionFondo(false)
        setMessage(OPENING_CONFLICT_MESSAGES[code] ?? json.error ?? "La disponibilidad de la caja cambió. Revisá el estado actualizado.")
        await refresh()
        return
      }
      setMessage(json.error ?? "No pudimos iniciar el turno.")
    } finally {
      openingRef.current = false
      setSaving(false)
    }
  }

  async function closeShift() {
    const amount = efectivoContado.trim()
    if (!state.turno || !/^\d{1,10}(\.\d{1,2})?$/.test(amount)) {
      setMessage("Ingresá el efectivo contado, sin negativos y con hasta 2 decimales.")
      return
    }
    setSaving(true)
    setMessage(null)
    const body = { action: "close", turnoCajaId: state.turno.id, efectivoContado: amount }
    const canonical = JSON.stringify(body)
    const closeScope = `${scope}:${state.turno.id}`
    try {
      const response = await fetch(`/api/operativo/caja/${encodeURIComponent(slug)}/turno`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attemptFor(closeScope, canonical, CLOSE_STORAGE_PREFIX) },
        body: JSON.stringify(body),
      })
      const json = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) onAccessLost(response.status, json.estado)
      if (!response.ok || !json.ok) {
        if (response.status < 500) clearAttempt(closeScope, CLOSE_STORAGE_PREFIX)
        throw new Error(json.error ?? "No pudimos cerrar el turno.")
      }
      clearAttempt(closeScope, CLOSE_STORAGE_PREFIX)
      setConfirmingClose(false)
      setEfectivoContado("")
      setMessage("Cierre declarado registrado.")
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos confirmar el cierre. Podés reintentar sin duplicarlo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-label="Turno de Caja">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-base font-bold"><Store className="h-4 w-4" />Caja y turno</p>
          <p className="mt-1 text-sm text-muted-foreground">{state.loading ? "Cargando cajas…" : "Negocio y caja física"}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Actualizar cajas" onClick={() => void refresh()} disabled={state.loading || saving}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {state.error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}
      {!state.loading && !state.error && state.turno && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <p className="flex items-center gap-2 font-bold"><BadgeCheck className="h-4 w-4" />Turno abierto</p>
          <p className="mt-1 text-sm">{state.turno.caja.nombre}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm"><UserRound className="h-4 w-4" />Responsable: {empleadoNombre}</p>
          <p className="mt-1 text-xs text-muted-foreground">Desde {new Date(state.turno.abiertoEn).toLocaleString("es-AR")}</p>
          {!confirmingClose ? (
            <Button type="button" variant="outline" onClick={() => { setMessage(null); setConfirmingClose(true) }} disabled={!state.aperturaHabilitada || saving} className="mt-4 h-12 w-full rounded-xl font-bold">Cerrar turno</Button>
          ) : (
            <div className="mt-4 space-y-3 rounded-xl border border-emerald-900/15 bg-background p-3 text-foreground">
              <p className="text-sm font-semibold">Contá el efectivo que hay físicamente en la caja. El sistema no muestra el esperado.</p>
              <label className="block space-y-1 text-sm font-medium" htmlFor="efectivo-contado-turno">
                <span className="flex items-center gap-1.5"><Banknote className="h-4 w-4" />Efectivo contado</span>
                <Input id="efectivo-contado-turno" inputMode="decimal" type="number" min="0" step="0.01" value={efectivoContado} onChange={(event) => setEfectivoContado(event.target.value)} disabled={!state.aperturaHabilitada || saving} className="h-12 rounded-xl" />
              </label>
              <p className="text-xs text-muted-foreground">Al confirmar, el turno queda cerrado y no admite nuevas ventas.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmingClose(false)} disabled={saving} className="h-12 rounded-xl">Volver</Button>
                <Button type="button" onClick={() => void closeShift()} disabled={!state.aperturaHabilitada || saving || !efectivoContado.trim()} className="h-12 rounded-xl font-bold">{saving ? "Cerrando…" : "Confirmar cierre"}</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!state.loading && !state.error && !state.turno && (
        <div className="mt-4 space-y-3">
          {state.ultimoCierre && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"><p className="font-semibold">Último cierre declarado registrado</p><p>{state.ultimoCierre.caja.nombre} · {new Date(state.ultimoCierre.cerradoEn).toLocaleString("es-AR")}</p></div>}
          <p className="text-sm font-semibold">Seleccioná una caja disponible para iniciar tu turno.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {state.cajas.map((caja) => (
              <button key={caja.id} type="button" disabled={caja.ocupada || !state.aperturaHabilitada || saving} onClick={() => { setSelected(caja.id); setUsarFondoTransferido(false); setConfirmoRecepcionFondo(false) }}
                aria-pressed={selected === caja.id} className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm ${caja.ocupada ? "cursor-not-allowed bg-muted text-muted-foreground" : selected === caja.id ? "border-primary bg-primary/5" : "bg-background"}`}>
                <span className="font-semibold">{caja.nombre}{caja.esPredeterminada ? " · Principal" : ""}</span>
                <span className="mt-0.5 block text-xs">{caja.ocupada ? "Ocupada" : "Disponible"}</span>
              </button>
            ))}
          </div>
          {(() => {
            const selectedRegister = state.cajas.find((caja) => caja.id === selected)
            const available = selectedRegister?.fondoTransferible
            return <>
              {available && <div className="space-y-3 rounded-xl border p-3">
                <p className="text-sm font-semibold">Fondo disponible del turno anterior: {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(available.importe))}</p>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={usarFondoTransferido} onChange={(event) => { setUsarFondoTransferido(event.target.checked); setConfirmoRecepcionFondo(false) }} disabled={!state.aperturaHabilitada || saving} /><span>Recibir el fondo del turno anterior como fondo inicial</span></label>
                {!usarFondoTransferido && <p className="text-xs text-muted-foreground">Si abrís manualmente, este remanente dejará de estar disponible para un traspaso posterior.</p>}
                {usarFondoTransferido && <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" checked={confirmoRecepcionFondo} onChange={(event) => setConfirmoRecepcionFondo(event.target.checked)} disabled={!state.aperturaHabilitada || saving} /><span>Confirmo que recibí físicamente {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(available.importe))} para comenzar mi turno</span></label>}
              </div>}
              {!usarFondoTransferido && <label className="block space-y-1 text-sm font-medium" htmlFor="fondo-inicial-turno">
                <span className="flex items-center gap-1.5"><Banknote className="h-4 w-4" />Fondo inicial declarado</span>
                <Input id="fondo-inicial-turno" inputMode="decimal" type="number" min="0" step="0.01" value={fondoInicial} onChange={(event) => setFondoInicial(event.target.value)} disabled={!state.aperturaHabilitada || saving} className="h-12 rounded-xl" />
              </label>}
            </>
          })()}
          {!state.aperturaHabilitada && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground"><LockKeyhole className="mr-1 inline h-4 w-4" />La apertura y el cierre están limitados a cuentas controladas de TESTING.</p>}
          {state.modoTurnos === "OPCIONAL" && <p className="text-xs text-muted-foreground">Mientras no haya un turno abierto, las ventas existentes siguen disponibles en modo opcional.</p>}
          <Button type="button" onClick={() => void openShift()} disabled={!state.aperturaHabilitada || saving || !selected || (usarFondoTransferido && !confirmoRecepcionFondo)} className="h-12 w-full rounded-xl font-bold sm:w-auto">
            {saving ? "Iniciando…" : usarFondoTransferido ? "Abrir turno con fondo transferido" : "Iniciar turno"}
          </Button>
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </section>
  )
}

