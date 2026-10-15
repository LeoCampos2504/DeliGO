"use client"

import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, LifeBuoy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { closedShiftsKey } from "@/components/business/owner-caja-revisiones"

// ============================================
// F10-B2.2-G — owner: administrative recovery of an employee's open shift
// ============================================
// Explicit physical count + mandatory reason + explicit confirmation. The
// server keeps the responsible employee and records the owner as the real
// closing actor. A failed attempt keeps the form and its data; a retry with
// the same data reuses the same Idempotency-Key (never a second close).

export type TurnoAbiertoRecuperable = {
  id: string
  responsableNombre: string
  abiertoEn: string
  fondoInicial: number
  cantidadVentas?: number
  ultimaVentaEn?: string | null
}

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
const AMOUNT = /^\d{1,10}(\.\d{1,2})?$/

export function tiempoTranscurrido(desde: string, ahora = Date.now()): string {
  const minutos = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 60_000))
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas} h ${minutos % 60} min`
  const dias = Math.floor(horas / 24)
  return `${dias} ${dias === 1 ? "día" : "días"} ${horas % 24} h`
}

export function OwnerCajaRecuperacion({ negocioId, registerQueryKey, caja, turno, onRecovered }: {
  negocioId: string
  registerQueryKey: readonly unknown[]
  caja: { id: string; nombre: string }
  turno: TurnoAbiertoRecuperable
  onRecovered: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [contado, setContado] = useState("")
  const [motivo, setMotivo] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const keys = useRef(new Map<string, string>())
  const inFlight = useRef(false)

  const recover = useMutation({
    mutationFn: async () => {
      const body = { cajaFisicaId: caja.id, efectivoContado: contado.trim(), motivo: motivo.trim(), confirmo: true }
      const canonical = JSON.stringify(body)
      let key = keys.current.get(canonical)
      if (!key) { key = newIdempotencyKey(); keys.current.set(canonical, key) }
      let response: Response
      try {
        response = await fetch(`/api/negocio/caja/turnos/${encodeURIComponent(turno.id)}/recuperacion`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": key },
          body: canonical,
        })
      } catch {
        throw Object.assign(new Error("No pudimos confirmar la recuperación por un problema de conexión. Podés reintentar sin duplicarla."), { stale: false })
      }
      const json = await response.json().catch(() => ({}))
      if (response.ok && json.ok) {
        keys.current.clear()
        return json.turno as { diferencia: number | null }
      }
      if (response.status < 500) keys.current.delete(canonical)
      const stale = response.status === 409 && (json.code === "TURNO_NO_ABIERTO" || json.code === "CAJA_NO_COINCIDE")
      const message = response.status >= 500
        ? "No pudimos recuperar el turno por un error del servidor. Podés reintentar sin duplicarlo."
        : json.code === "TURNO_NO_ABIERTO"
          ? "El turno ya fue cerrado (por el empleado u otra recuperación). Actualizamos el estado de la caja."
          : (json.error ?? "No pudimos recuperar el turno.")
      throw Object.assign(new Error(message), { stale })
    },
    onMutate: () => setError(null),
    onSettled: () => { inFlight.current = false },
    onSuccess: () => {
      setAbierto(false)
      setContado("")
      setMotivo("")
      setConfirmo(false)
      onRecovered(`Turno recuperado correctamente — ${caja.nombre}. Ya podés registrar la entrega en el historial y abrir un nuevo turno.`)
      void queryClient.invalidateQueries({ queryKey: registerQueryKey })
      void queryClient.invalidateQueries({ queryKey: closedShiftsKey(negocioId) })
    },
    onError: (failure: Error & { stale?: boolean }) => {
      setError(failure.message)
      if (failure.stale) {
        onRecovered(failure.message)
        void queryClient.invalidateQueries({ queryKey: registerQueryKey })
        void queryClient.invalidateQueries({ queryKey: closedShiftsKey(negocioId) })
      }
    },
  })

  const montoValido = AMOUNT.test(contado.trim())
  const puedeConfirmar = montoValido && motivo.trim().length > 0 && confirmo && !recover.isPending

  return <div className="mt-3 space-y-2 border-t pt-3">
    <dl className="grid grid-cols-2 gap-2 text-xs">
      <div><dt className="text-muted-foreground">Fondo inicial</dt><dd className="font-semibold">{money.format(turno.fondoInicial)}</dd></div>
      <div><dt className="text-muted-foreground">Abierto hace</dt><dd className="font-semibold">{tiempoTranscurrido(turno.abiertoEn)}</dd></div>
      <div className="col-span-2"><dt className="text-muted-foreground">Actividad registrada</dt><dd className="font-semibold">{turno.cantidadVentas ? `${turno.cantidadVentas} ${turno.cantidadVentas === 1 ? "venta" : "ventas"} · última ${new Date(turno.ultimaVentaEn!).toLocaleString("es-AR")}` : "Sin ventas registradas en este turno"}</dd></div>
    </dl>
    {!abierto ? <Button type="button" variant="outline" className="w-full" onClick={() => { setError(null); setAbierto(true) }}><LifeBuoy className="mr-1 h-4 w-4" />Recuperar turno</Button>
      : <form aria-label={`Recuperar turno — ${caja.nombre}`} onSubmit={(event) => { event.preventDefault(); if (!puedeConfirmar || inFlight.current) return; inFlight.current = true; recover.mutate() }} className="space-y-3 rounded-xl border bg-background p-3">
        <div><p className="font-semibold">Recuperar turno — {caja.nombre}</p>
          <p className="text-xs text-muted-foreground">Responsable original: {turno.responsableNombre} · Abierto desde {new Date(turno.abiertoEn).toLocaleString("es-AR")}</p></div>
        <p className="text-sm">Esta operación permitirá cerrar administrativamente el turno para liberar la caja. El historial de ventas y el responsable original permanecerán registrados.</p>
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Un turno abierto no significa que esté abandonado: {turno.responsableNombre} podría seguir operando. Después de recuperarlo no podrá vender ni cerrar en este turno.</p>
        <label className="block space-y-1 text-sm font-medium" htmlFor={`recuperar-contado-${turno.id}`}><span>Efectivo contado físicamente</span>
          <Input id={`recuperar-contado-${turno.id}`} inputMode="decimal" value={contado} onChange={(event) => setContado(event.target.value)} placeholder="Contá el efectivo de la caja" disabled={recover.isPending} className="h-11 rounded-xl" /></label>
        {contado.trim() !== "" && !montoValido && <p className="text-xs text-destructive">Ingresá un importe sin negativos y con hasta 2 decimales.</p>}
        <label className="block space-y-1 text-sm font-medium" htmlFor={`recuperar-motivo-${turno.id}`}><span>Motivo de la recuperación (obligatorio)</span>
          <Input id={`recuperar-motivo-${turno.id}`} value={motivo} maxLength={500} onChange={(event) => setMotivo(event.target.value)} placeholder="Ej.: el empleado se retiró sin cerrar el turno" disabled={recover.isPending} className="h-11 rounded-xl" /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmo} onChange={(event) => setConfirmo(event.target.checked)} disabled={recover.isPending} /><span>Confirmo que revisé la situación y deseo cerrar administrativamente este turno.</span></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" disabled={recover.isPending} onClick={() => { setAbierto(false); setError(null) }}>Cancelar</Button>
          <Button type="submit" disabled={!puedeConfirmar}>{recover.isPending ? "Recuperando…" : "Confirmar recuperación del turno"}</Button>
        </div>
      </form>}
  </div>
}
