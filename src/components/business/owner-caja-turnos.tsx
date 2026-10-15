"use client"

import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BadgeCheck, CircleSlash, Plus, RefreshCw, Star, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { OwnerCajaRevisiones } from "@/components/business/owner-caja-revisiones"
import { OwnerCajaRecuperacion } from "@/components/business/owner-caja-recuperacion"

type Turno = { id: string; responsableTipo: "NEGOCIO" | "EMPLEADO"; responsableNombre: string; abiertoEn: string; fondoInicial: number; cantidadVentas?: number; ultimaVentaEn?: string | null }
export type CajaFisicaResumen = {
  id: string
  nombre: string
  descripcion: string | null
  esPredeterminada: boolean
  activa: boolean
  turnoAbierto: Turno | null
  fondoTransferible: { turnoOrigenId: string; importe: string; cerradoEn: string } | null
}
type TraspasoResumen = { id: string; caja: { id: string; nombre: string }; importe: string; confirmadoEn: string; estado: string; turnoOrigen: { id: string; responsableNombre: string }; turnoDestino: { id: string; responsableNombre: string } }
type CajaResponse = { modoTurnos: "OPCIONAL" | "OBLIGATORIO"; cajas: CajaFisicaResumen[]; traspasos: TraspasoResumen[] }

export const ownerRegisterQueryKey = (negocioId: string) => ["negocio-caja-registros-turnos", negocioId] as const

export function OwnerCajaTurnosPanel({ negocioId }: { negocioId: string }) {
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState("")
  const [nombresEditados, setNombresEditados] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null)
  const [efectivoContado, setEfectivoContado] = useState<Record<string, string>>({})
  const [confirmingClose, setConfirmingClose] = useState<string | null>(null)
  const [fondosIniciales, setFondosIniciales] = useState<Record<string, string>>({})
  const [usarTransferencia, setUsarTransferencia] = useState<Record<string, boolean>>({})
  const [confirmarRecepcion, setConfirmarRecepcion] = useState<Record<string, boolean>>({})
  const closeKeys = useRef(new Map<string, string>())
  const openKeys = useRef(new Map<string, string>())
  const query = useQuery<CajaResponse>({
    queryKey: ownerRegisterQueryKey(negocioId),
    queryFn: async () => {
      const response = await fetch("/api/negocio/caja/cajas", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudieron cargar las cajas.")
      return json
    },
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ownerRegisterQueryKey(negocioId) })
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/negocio/caja/cajas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombre.trim() }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudo crear la caja.")
      return json
    },
    onSuccess: () => { setNombre(""); setMessage("Caja creada."); void refresh() },
    onError: (error) => setMessage(error.message),
  })
  const update = useMutation({
    mutationFn: async ({ caja, patch }: { caja: CajaFisicaResumen; patch: Record<string, unknown> }) => {
      const response = await fetch(`/api/negocio/caja/cajas/${encodeURIComponent(caja.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudo actualizar la caja.")
      return { caja, json }
    },
    onSuccess: ({ caja }) => { setNombresEditados((current) => { const next = { ...current }; delete next[caja.id]; return next }); setMessage("Caja actualizada."); void refresh() },
    onError: (error) => setMessage(error.message),
  })
  const close = useMutation({
    mutationFn: async ({ turnoId, amount }: { turnoId: string; amount: string }) => {
      const canonical = `${turnoId}:${amount}`
      let key = closeKeys.current.get(canonical)
      if (!key) { key = newIdempotencyKey(); closeKeys.current.set(canonical, key) }
      const response = await fetch(`/api/negocio/caja/turnos/${encodeURIComponent(turnoId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ efectivoContado: amount }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error ?? "No se pudo cerrar el turno.")
      return { turnoId }
    },
    onSuccess: ({ turnoId }) => {
      for (const key of closeKeys.current.keys()) if (key.startsWith(`${turnoId}:`)) closeKeys.current.delete(key)
      setConfirmingClose(null)
      setMessage("Cierre declarado registrado.")
      void refresh()
    },
    onError: (error) => setMessage(error.message),
  })
  const open = useMutation({
    mutationFn: async ({ caja, fondo, transferencia }: { caja: CajaFisicaResumen; fondo: string; transferencia: boolean }) => {
      const source = transferencia ? caja.fondoTransferible : null
      if (transferencia && !source) throw new Error("El fondo del turno anterior ya no está disponible.")
      if (!transferencia && !/^\d{1,10}(\.\d{1,2})?$/.test(fondo.trim())) throw new Error("Ingresá un fondo inicial válido, con hasta dos decimales.")
      if (transferencia && !confirmarRecepcion[caja.id]) throw new Error("Confirmá que recibiste físicamente el fondo antes de abrir el turno.")
      const body = source
        ? { cajaFisicaId: caja.id, fondoInicial: source.importe, transferirDesdeTurnoCajaId: source.turnoOrigenId, confirmoRecepcionFondo: true }
        : { cajaFisicaId: caja.id, fondoInicial: fondo.trim() }
      const canonical = JSON.stringify(body)
      let key = openKeys.current.get(canonical)
      if (!key) { key = newIdempotencyKey(); openKeys.current.set(canonical, key) }
      const response = await fetch("/api/negocio/caja/turnos", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: canonical })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status < 500) openKeys.current.delete(canonical)
        throw new Error(json.error ?? "No se pudo abrir el turno.")
      }
      openKeys.current.delete(canonical)
      return { transferencia: Boolean(source) }
    },
    onSuccess: ({ transferencia }) => {
      setMessage(transferencia ? "Turno abierto con el fondo recibido del turno anterior." : "Turno abierto.")
      setUsarTransferencia({})
      setConfirmarRecepcion({})
      void refresh()
    },
    onError: (error) => setMessage(error.message),
  })

  if (query.isLoading) return <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Cargando cajas…</p>
  if (query.isError) return <div className="rounded-xl border bg-card p-5"><p role="alert" className="text-sm text-destructive">{query.error.message}</p><Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></div>

  const cajas = query.data?.cajas ?? []
  const traspasos = query.data?.traspasos ?? []
  const ownerHasOpenShift = cajas.some((caja) => caja.turnoAbierto?.responsableTipo === "NEGOCIO")
  return (
    <section className="space-y-4" aria-label="Administración de cajas y turnos">
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-base font-bold">Cajas y turnos</h3><p className="text-sm text-muted-foreground">Los turnos abiertos se muestran sin datos de recaudación.</p></div>
        <Button variant="ghost" size="icon" aria-label="Actualizar cajas y turnos" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {recoveryNotice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">{recoveryNotice}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {cajas.map((caja) => {
          const nombreActual = nombresEditados[caja.id] ?? caja.nombre
          const ocupada = Boolean(caja.turnoAbierto)
          return (
            <article key={caja.id} className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h4 className="truncate font-bold">{caja.nombre}{caja.esPredeterminada ? " · Principal" : ""}</h4><p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${ocupada ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : caja.activa ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>{ocupada ? "Turno abierto" : caja.activa ? "Disponible" : "Inactiva"}</p></div>
                {caja.esPredeterminada && <Star className="h-4 w-4 shrink-0 fill-current text-primary" aria-label="Predeterminada" />}
              </div>
              {caja.turnoAbierto && <div className="rounded-xl bg-muted/50 p-3 text-sm"><p className="flex items-center gap-1.5 font-semibold"><UserRound className="h-4 w-4" />Responsable: {caja.turnoAbierto.responsableNombre}</p><p className="mt-1 text-xs text-muted-foreground">Abierto {new Date(caja.turnoAbierto.abiertoEn).toLocaleString("es-AR")}</p>
                {caja.turnoAbierto.responsableTipo === "NEGOCIO" && <div className="mt-3 space-y-2">
                  <label className="block space-y-1 text-sm font-medium" htmlFor={`cierre-dueno-${caja.turnoAbierto.id}`}><span>Efectivo contado para tu turno</span><Input id={`cierre-dueno-${caja.turnoAbierto.id}`} inputMode="decimal" type="number" min="0" step="0.01" value={efectivoContado[caja.turnoAbierto.id] ?? ""} onChange={(event) => setEfectivoContado((current) => ({ ...current, [caja.turnoAbierto!.id]: event.target.value }))} disabled={close.isPending} className="h-11 rounded-xl" /></label>
                  {confirmingClose === caja.turnoAbierto.id ? <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={close.isPending} onClick={() => setConfirmingClose(null)}>Volver</Button><Button type="button" disabled={close.isPending || !/^\d{1,10}(\.\d{1,2})?$/.test((efectivoContado[caja.turnoAbierto.id] ?? "").trim())} onClick={() => close.mutate({ turnoId: caja.turnoAbierto!.id, amount: efectivoContado[caja.turnoAbierto!.id].trim() })}>{close.isPending ? "Cerrando…" : "Confirmar cierre"}</Button></div> : <Button type="button" variant="outline" disabled={close.isPending} onClick={() => setConfirmingClose(caja.turnoAbierto!.id)}>Preparar cierre de tu turno</Button>}
                  <p className="text-xs text-muted-foreground">El cierre termina el turno y no muestra efectivo esperado ni diferencia.</p>
                </div>}
                {caja.turnoAbierto.responsableTipo === "EMPLEADO" && <OwnerCajaRecuperacion negocioId={negocioId} registerQueryKey={ownerRegisterQueryKey(negocioId)} caja={{ id: caja.id, nombre: caja.nombre }} turno={caja.turnoAbierto} onRecovered={setRecoveryNotice} />}
              </div>}
              {!ocupada && <div className="space-y-2 rounded-xl border p-3">
                <p className="text-sm font-semibold">Abrir mi turno</p>
                {caja.fondoTransferible && <>
                  <p className="text-sm">Fondo disponible del turno anterior: {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(caja.fondoTransferible.importe))}</p>
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={usarTransferencia[caja.id] === true} onChange={(event) => { setUsarTransferencia((current) => ({ ...current, [caja.id]: event.target.checked })); setConfirmarRecepcion((current) => ({ ...current, [caja.id]: false })) }} disabled={open.isPending || !caja.activa || ownerHasOpenShift} /><span>Recibir el remanente como fondo inicial</span></label>
                  {usarTransferencia[caja.id] !== true && <p className="text-xs text-muted-foreground">Si abrís manualmente, este remanente dejará de estar disponible para un traspaso posterior.</p>}
                  {usarTransferencia[caja.id] && <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" checked={confirmarRecepcion[caja.id] === true} onChange={(event) => setConfirmarRecepcion((current) => ({ ...current, [caja.id]: event.target.checked }))} disabled={open.isPending || !caja.activa || ownerHasOpenShift} /><span>Confirmo que recibí físicamente {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(caja.fondoTransferible.importe))} para comenzar mi turno</span></label>}
                </>}
                {!usarTransferencia[caja.id] && <label className="block space-y-1 text-sm font-medium" htmlFor={`fondo-inicial-dueno-${caja.id}`}><span>Fondo inicial manual</span><Input id={`fondo-inicial-dueno-${caja.id}`} inputMode="decimal" type="number" min="0" step="0.01" value={fondosIniciales[caja.id] ?? "0"} onChange={(event) => setFondosIniciales((current) => ({ ...current, [caja.id]: event.target.value }))} disabled={open.isPending || !caja.activa || ownerHasOpenShift} className="h-11 rounded-xl" /></label>}
                {ownerHasOpenShift && <p className="text-xs text-muted-foreground">Ya tenés un turno abierto en otra caja.</p>}
                <Button type="button" className="w-full" disabled={open.isPending || !caja.activa || ownerHasOpenShift || (usarTransferencia[caja.id] === true && confirmarRecepcion[caja.id] !== true)} onClick={() => open.mutate({ caja, fondo: fondosIniciales[caja.id] ?? "0", transferencia: usarTransferencia[caja.id] === true })}>{open.isPending ? "Abriendo…" : usarTransferencia[caja.id] ? "Abrir turno con fondo transferido" : "Abrir turno"}</Button>
              </div>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input aria-label={`Nombre de ${caja.nombre}`} value={nombreActual} onChange={(event) => setNombresEditados((current) => ({ ...current, [caja.id]: event.target.value }))} className="h-11 min-w-0 rounded-xl" />
                <Button variant="outline" className="h-11 rounded-xl" disabled={update.isPending || !nombreActual.trim() || nombreActual.trim() === caja.nombre} onClick={() => update.mutate({ caja, patch: { nombre: nombreActual.trim() } })}>Renombrar</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {!caja.esPredeterminada && <Button variant="outline" size="sm" className="min-h-10 rounded-xl" disabled={update.isPending || !caja.activa} onClick={() => update.mutate({ caja, patch: { esPredeterminada: true } })}><Star className="mr-1 h-4 w-4" />Predeterminada</Button>}
                {!caja.esPredeterminada && <Button variant="outline" size="sm" className="min-h-10 rounded-xl" disabled={update.isPending || ocupada} onClick={() => update.mutate({ caja, patch: { activa: !caja.activa } })}>{caja.activa ? <><CircleSlash className="mr-1 h-4 w-4" />Desactivar</> : <><BadgeCheck className="mr-1 h-4 w-4" />Activar</>}</Button>}
              </div>
            </article>
          )
        })}
      </div>
      <section className="space-y-2 rounded-2xl border bg-card p-4" aria-label="Historial de traspasos de fondos entre turnos">
        <h4 className="font-bold">Traspasos de fondo entre turnos</h4>
        {traspasos.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay fondos transferidos entre turnos.</p> : <ol className="space-y-2">{traspasos.map((traspaso) => <li key={traspaso.id} className="rounded-xl bg-muted/40 p-3 text-sm">
          <p className="font-semibold">{traspaso.caja.nombre} · {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(traspaso.importe))} · {traspaso.estado}</p>
          <p>Origen: turno de {traspaso.turnoOrigen.responsableNombre} ({traspaso.turnoOrigen.id})</p>
          <p>Recibió: {traspaso.turnoDestino.responsableNombre} ({traspaso.turnoDestino.id}) · {new Date(traspaso.confirmadoEn).toLocaleString("es-AR")}</p>
        </li>)}</ol>}
      </section>
      <form onSubmit={(event) => { event.preventDefault(); setMessage(null); create.mutate() }} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 sm:flex-row">
        <Input aria-label="Nombre de la nueva caja" value={nombre} onChange={(event) => setNombre(event.target.value)} maxLength={80} placeholder="Nombre de la caja adicional" className="h-11 min-w-0 rounded-xl" />
        <Button type="submit" disabled={!nombre.trim() || create.isPending} className="h-11 rounded-xl"><Plus className="mr-1 h-4 w-4" />{create.isPending ? "Creando…" : "Crear caja"}</Button>
      </form>
      {query.data?.modoTurnos === "OPCIONAL" && <p className="text-xs text-muted-foreground">Los turnos siguen en modo opcional. Las ventas sin turno mantienen el flujo actual.</p>}
      <OwnerCajaRevisiones negocioId={negocioId} />
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </section>
  )
}

