"use client"

import { useCallback, useEffect, useState } from "react"
import { BadgeCheck, Banknote, LockKeyhole, RefreshCw, Store, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"

type Register = { id: string; nombre: string; esPredeterminada: boolean; ocupada: boolean }
type Shift = { id: string; caja: { id: string; nombre: string }; abiertoEn: string; fondoInicial: number }
type State = {
  loading: boolean
  error: string | null
  modoTurnos: "OPCIONAL" | "OBLIGATORIO"
  aperturaHabilitada: boolean
  cajas: Register[]
  turno: Shift | null
}

const EMPTY: State = { loading: true, error: null, modoTurnos: "OPCIONAL", aperturaHabilitada: false, cajas: [], turno: null }
const STORAGE_PREFIX = "deligo:caja:apertura-turno:v1:"
const inMemoryAttempts = new Map<string, string>()

function attemptFor(scope: string, canonical: string): string {
  const mapKey = `${scope}:${canonical}`
  const memoryKey = inMemoryAttempts.get(mapKey)
  if (memoryKey) return memoryKey
  try {
    const key = STORAGE_PREFIX + scope
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

function clearAttempt(scope: string) {
  for (const key of inMemoryAttempts.keys()) if (key.startsWith(`${scope}:`)) inMemoryAttempts.delete(key)
  try { sessionStorage.removeItem(STORAGE_PREFIX + scope) } catch { /* storage is optional */ }
}

export function OperationalShiftPanel({ slug, negocioId, empleadoId, empleadoNombre, onAccessLost }: { slug: string; negocioId: string; empleadoId: string; empleadoNombre: string; onAccessLost: (status: number, estado?: string) => void }) {
  const [state, setState] = useState<State>(EMPTY)
  const [selected, setSelected] = useState("")
  const [fondoInicial, setFondoInicial] = useState("0")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const scope = `${negocioId}:${empleadoId}`

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const response = await fetch(`/api/operativo/caja/${encodeURIComponent(slug)}/turno`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) onAccessLost(response.status, json.estado)
      if (!response.ok || !json.ok) throw new Error(json.error ?? "No pudimos cargar los turnos.")
      setState({ loading: false, error: null, modoTurnos: json.modoTurnos, aperturaHabilitada: json.aperturaHabilitada === true, cajas: json.cajas ?? [], turno: json.turno ?? null })
      setSelected((current) => json.cajas?.some((c: Register) => c.id === current && !c.ocupada) ? current : (json.cajas?.find((c: Register) => !c.ocupada)?.id ?? ""))
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "No pudimos cargar los turnos." }))
    }
  }, [slug, onAccessLost])

  useEffect(() => { void refresh() }, [refresh])

  async function openShift() {
    const fondo = Number(fondoInicial)
    if (!selected || !Number.isFinite(fondo) || fondo < 0 || !/^\d+(\.\d{1,2})?$/.test(fondoInicial.trim())) {
      setMessage("Elegí una caja disponible e ingresá un fondo inicial válido.")
      return
    }
    setSaving(true)
    setMessage(null)
    const body = { cajaFisicaId: selected, fondoInicial: fondoInicial.trim() }
    const canonical = JSON.stringify(body)
    try {
      const response = await fetch(`/api/operativo/caja/${encodeURIComponent(slug)}/turno`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": attemptFor(scope, canonical) },
        body: JSON.stringify(body),
      })
      const json = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) onAccessLost(response.status, json.estado)
      if (!response.ok || !json.ok) {
        if (response.status < 500) clearAttempt(scope)
        throw new Error(json.error ?? "No pudimos iniciar el turno.")
      }
      clearAttempt(scope)
      setMessage("Turno iniciado.")
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos confirmar la apertura. Podés reintentar sin duplicarla.")
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
        </div>
      )}

      {!state.loading && !state.error && !state.turno && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold">Seleccioná una caja disponible para iniciar tu turno.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {state.cajas.map((caja) => (
              <button key={caja.id} type="button" disabled={caja.ocupada || !state.aperturaHabilitada || saving} onClick={() => setSelected(caja.id)}
                aria-pressed={selected === caja.id} className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm ${caja.ocupada ? "cursor-not-allowed bg-muted text-muted-foreground" : selected === caja.id ? "border-primary bg-primary/5" : "bg-background"}`}>
                <span className="font-semibold">{caja.nombre}{caja.esPredeterminada ? " · Principal" : ""}</span>
                <span className="mt-0.5 block text-xs">{caja.ocupada ? "Ocupada" : "Disponible"}</span>
              </button>
            ))}
          </div>
          <label className="block space-y-1 text-sm font-medium" htmlFor="fondo-inicial-turno">
            <span className="flex items-center gap-1.5"><Banknote className="h-4 w-4" />Fondo inicial declarado</span>
            <Input id="fondo-inicial-turno" inputMode="decimal" type="number" min="0" step="0.01" value={fondoInicial} onChange={(event) => setFondoInicial(event.target.value)} disabled={!state.aperturaHabilitada || saving} className="h-12 rounded-xl" />
          </label>
          {!state.aperturaHabilitada && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground"><LockKeyhole className="mr-1 inline h-4 w-4" />La apertura está reservada para cuentas controladas de TESTING hasta que exista el flujo de cierre y recuperación.</p>}
          {state.modoTurnos === "OPCIONAL" && <p className="text-xs text-muted-foreground">Mientras no haya un turno abierto, las ventas existentes siguen disponibles en modo opcional.</p>}
          <Button type="button" onClick={() => void openShift()} disabled={!state.aperturaHabilitada || saving || !selected} className="h-12 w-full rounded-xl font-bold sm:w-auto">
            {saving ? "Iniciando…" : "Iniciar turno"}
          </Button>
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </section>
  )
}
