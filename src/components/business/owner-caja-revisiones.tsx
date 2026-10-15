"use client"

import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"

type Resultado = "COINCIDE" | "FALTANTE" | "SOBRANTE"
type TurnoCerrado = {
  id: string
  caja: { id: string; nombre: string }
  responsableNombre: string
  abiertoEn: string
  cerradoEn: string
  estado: "CERRADO_DECLARADO"
  fondoInicial: number
  efectivoEsperado: number
  efectivoContado: number
  efectivoContadoExacto: string
  diferencia: number
  resultado: Resultado
  estadoRevision: "PENDIENTE_REVISION" | "REVISADO"
  estadoEntrega: "PENDIENTE_ENTREGA" | "ENTREGA_CONFIRMADA"
  entregaActual: { efectivoEntregado: number; fondoRemanente: number; destinoTipo: "DUENO" | "RESGUARDO"; destinoNombre: string | null; actor: string; confirmadoEn: string; observacion: string | null } | null
}
type Revision = { id: string; actor: string; accion: string; observacion: string | null; efectivoEsperado: number; efectivoContado: number; diferencia: number; createdAt: string }
type CustodyEvent = { id: string; tipo: "ENTREGA_CONFIRMADA" | "RECTIFICACION"; estado: "CONFIRMADA"; actor: string; efectivoContado: number; efectivoEsperado: number; diferencia: number; efectivoEntregado: number; fondoRemanente: number; destinoTipo: "DUENO" | "RESGUARDO"; destinoNombre: string | null; confirmadoEn: string; observacion: string | null }

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
const closedShiftsKey = (negocioId: string) => ["caja-turnos-cerrados", negocioId] as const
const reviewHistoryKey = (negocioId: string, turnoId: string) => ["caja-turno-revisiones", negocioId, turnoId] as const
const custodyHistoryKey = (negocioId: string, turnoId: string) => ["caja-turno-entregas", negocioId, turnoId] as const

function remainingFrom(counted: string, delivered: string): string | null {
  const cents = (value: string) => {
    if (value.trim().length > 15) return null
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim())
    if (!match) return null
    return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"))
  }
  const total = cents(counted); const sent = cents(delivered)
  if (total === null || sent === null || sent > total) return null
  const left = total - sent
  return `${left / 100n}.${String(left % 100n).padStart(2, "0")}`
}

function ResultadoBadge({ resultado }: { resultado: Resultado }) {
  const label = resultado === "COINCIDE" ? "Coincide" : resultado === "FALTANTE" ? "Faltante" : "Sobrante"
  const style = resultado === "COINCIDE" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : resultado === "FALTANTE" ? "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200" : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${style}`}>{label}</span>
}

export function OwnerCajaRevisiones({ negocioId }: { negocioId: string }) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [deliveryAmounts, setDeliveryAmounts] = useState<Record<string, string>>({})
  const [custodyNotes, setCustodyNotes] = useState<Record<string, string>>({})
  const [destinations, setDestinations] = useState<Record<string, { type: "DUENO" | "RESGUARDO"; name: string }>>({})
  const [rectifying, setRectifying] = useState<Record<string, boolean>>({})
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [custodySuccess, setCustodySuccess] = useState<Record<string, string>>({})
  const attempts = useRef(new Map<string, string>())
  const query = useQuery<{ turnos: TurnoCerrado[] }>({
    queryKey: closedShiftsKey(negocioId),
    queryFn: async () => {
      const response = await fetch("/api/negocio/caja/turnos/cerrados", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudieron cargar los turnos cerrados.")
      return json
    },
  })
  const detail = useQuery<{ revisiones: Revision[] }>({
    queryKey: reviewHistoryKey(negocioId, selected ?? ""),
    enabled: Boolean(selected),
    queryFn: async () => {
      const response = await fetch(`/api/negocio/caja/turnos/${encodeURIComponent(selected!)}/revisiones`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudo cargar el detalle.")
      return json
    },
  })
  const custody = useQuery<{ entregas: CustodyEvent[] }>({
    queryKey: custodyHistoryKey(negocioId, selected ?? ""),
    enabled: Boolean(selected),
    queryFn: async () => {
      const response = await fetch(`/api/negocio/caja/turnos/${encodeURIComponent(selected!)}/entregas`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudo cargar el historial de entregas.")
      return json
    },
  })
  const review = useMutation({
    mutationFn: async ({ turno, observacion }: { turno: TurnoCerrado; observacion: string }) => {
      const canonical = `${turno.id}:${observacion.trim()}`
      let key = attempts.current.get(canonical)
      if (!key) { key = newIdempotencyKey(); attempts.current.set(canonical, key) }
      const response = await fetch(`/api/negocio/caja/turnos/${encodeURIComponent(turno.id)}/revisiones`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ observacion: observacion.trim() || null }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudo registrar la revisión.")
      attempts.current.delete(canonical)
      return turno.id
    },
    onSuccess: (turnoId) => {
      void queryClient.invalidateQueries({ queryKey: closedShiftsKey(negocioId) })
      void queryClient.invalidateQueries({ queryKey: reviewHistoryKey(negocioId, turnoId) })
    },
  })
  const deliver = useMutation({
    mutationFn: async ({ turno, tipo, entregado, remanente, destinoTipo, destinoNombre, observacion }: { turno: TurnoCerrado; tipo: "ENTREGA_CONFIRMADA" | "RECTIFICACION"; entregado: string; remanente: string; destinoTipo: "DUENO" | "RESGUARDO"; destinoNombre: string; observacion: string }) => {
      const canonical = [turno.id, tipo, entregado, remanente, destinoTipo, destinoNombre.trim(), observacion.trim()].join(":")
      let key = attempts.current.get(canonical)
      if (!key) { key = newIdempotencyKey(); attempts.current.set(canonical, key) }
      const response = await fetch(`/api/negocio/caja/turnos/${encodeURIComponent(turno.id)}/entregas`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ tipo, efectivoEntregado: entregado, fondoRemanente: remanente, destinoTipo, destinoNombre: destinoTipo === "RESGUARDO" ? destinoNombre.trim() : null, observacion: observacion.trim() || null, confirmar: true }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudo registrar la entrega.")
      attempts.current.delete(canonical)
      const entrega = json.entrega as Omit<CustodyEvent, "actor" | "efectivoEsperado" | "diferencia">
      return {
        turno,
        tipo,
        replayed: Boolean(json.replayed),
        entrega: {
          ...entrega,
          actor: "Dueño",
          efectivoEsperado: turno.efectivoEsperado,
          diferencia: turno.diferencia,
        } satisfies CustodyEvent,
      }
    },
    onSuccess: ({ turno, entrega, tipo }) => {
      queryClient.setQueryData<{ turnos: TurnoCerrado[] }>(closedShiftsKey(negocioId), (current) => current && ({
        ...current,
        turnos: current.turnos.map((item) => item.id === turno.id ? {
          ...item,
          estadoEntrega: "ENTREGA_CONFIRMADA",
          entregaActual: {
            efectivoEntregado: entrega.efectivoEntregado,
            fondoRemanente: entrega.fondoRemanente,
            destinoTipo: entrega.destinoTipo,
            destinoNombre: entrega.destinoNombre,
            actor: entrega.actor,
            confirmadoEn: entrega.confirmadoEn,
            observacion: entrega.observacion,
          },
        } : item),
      }))
      queryClient.setQueryData<{ entregas: CustodyEvent[] }>(custodyHistoryKey(negocioId, turno.id), (current) => {
        const events = current?.entregas ?? []
        return { entregas: [...events.filter((event) => event.id !== entrega.id), entrega].sort((a, b) => a.confirmadoEn.localeCompare(b.confirmadoEn)) }
      })
      setCustodySuccess((current) => ({ ...current, [turno.id]: tipo === "RECTIFICACION" ? "Rectificación registrada correctamente" : "Entrega registrada correctamente" }))
      setRectifying((current) => ({ ...current, [turno.id]: false }))
      setConfirmed((current) => ({ ...current, [turno.id]: false }))
      setDeliveryAmounts((current) => { const next = { ...current }; delete next[turno.id]; return next })
      setCustodyNotes((current) => { const next = { ...current }; delete next[turno.id]; return next })
      setDestinations((current) => { const next = { ...current }; delete next[turno.id]; return next })
      void queryClient.invalidateQueries({ queryKey: closedShiftsKey(negocioId) })
      void queryClient.invalidateQueries({ queryKey: custodyHistoryKey(negocioId, turno.id) })
    },
  })

  return <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="Turnos cerrados y revisiones de caja">
    <div className="flex items-start justify-between gap-3">
      <div><h3 className="text-base font-bold">Turnos cerrados / Revisiones de caja</h3><p className="text-sm text-muted-foreground">Revisá cada declaración sin alterar el cierre ni los movimientos de caja.</p></div>
      <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>Actualizar</Button>
    </div>
    {query.isLoading ? <p role="status" className="text-sm text-muted-foreground">Cargando turnos cerrados…</p>
      : query.isError ? <p role="alert" className="text-sm text-destructive">{query.error.message}</p>
      : !query.data?.turnos.length ? <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">Todavía no hay turnos cerrados para revisar.</p>
      : <div className="space-y-3">{query.data.turnos.map((turno) => {
        const open = selected === turno.id
        const note = notes[turno.id] ?? ""
        const requiresNote = turno.diferencia !== 0
        return <article key={turno.id} className="space-y-3 rounded-xl border p-3 sm:p-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{turno.caja.nombre}</h4><span className="rounded-full border px-2 py-1 text-xs font-medium">CERRADO_DECLARADO</span><ResultadoBadge resultado={turno.resultado} /><span className={`rounded-full px-2 py-1 text-xs font-semibold ${turno.estadoRevision === "REVISADO" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{turno.estadoRevision === "REVISADO" ? "Revisado" : "Pendiente de revisión"}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${turno.estadoEntrega === "ENTREGA_CONFIRMADA" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>{turno.estadoEntrega === "ENTREGA_CONFIRMADA" ? "Entrega confirmada" : "Entrega pendiente"}</span></div><p className="text-sm text-muted-foreground">Abrió y cerró: {turno.responsableNombre} · Apertura {new Date(turno.abiertoEn).toLocaleString("es-AR")} · Cierre {new Date(turno.cerradoEn).toLocaleString("es-AR")}</p></div>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(open ? null : turno.id)}>{open ? "Ocultar detalle" : "Ver detalle"}</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Money label="Fondo inicial" value={turno.fondoInicial} />
            <Money label="Efectivo esperado" value={turno.efectivoEsperado} />
            <Money label="Efectivo declarado" value={turno.efectivoContado} />
            <Money label="Diferencia" value={turno.diferencia} emphasize />
          </div>
          {turno.entregaActual && <p className="rounded-lg bg-muted/40 p-2 text-sm">Entrega actual: {money.format(turno.entregaActual.efectivoEntregado)} entregado · {money.format(turno.entregaActual.fondoRemanente)} permanece en caja · {turno.entregaActual.destinoTipo === "DUENO" ? "Dueño" : turno.entregaActual.destinoNombre} · confirmó {turno.entregaActual.actor} el {new Date(turno.entregaActual.confirmadoEn).toLocaleString("es-AR")}</p>}
          {open && <div className="space-y-3 border-t pt-3">
            <div><h5 className="text-sm font-semibold">Historial administrativo</h5>
              {detail.isLoading ? <p className="text-sm text-muted-foreground">Cargando historial…</p> : detail.isError ? <p role="alert" className="text-sm text-destructive">{detail.error.message}</p> : detail.data?.revisiones.length ? <ol className="mt-2 space-y-2">{detail.data.revisiones.map((item) => <li key={item.id} className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{item.actor} · {new Date(item.createdAt).toLocaleString("es-AR")}</p><p>Esperado {money.format(item.efectivoEsperado)} · Declarado {money.format(item.efectivoContado)} · Diferencia {money.format(item.diferencia)}</p>{item.observacion && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.observacion}</p>}</li>)}</ol> : <p className="mt-1 text-sm text-muted-foreground">Sin revisiones anteriores.</p>}</div>
            <form onSubmit={(event) => { event.preventDefault(); review.mutate({ turno, observacion: note }) }} className="space-y-2 rounded-lg border p-3">
              <label htmlFor={`revision-nota-${turno.id}`} className="block text-sm font-medium">Observación administrativa {requiresNote ? "(obligatoria para esta diferencia)" : "(opcional)"}</label>
              <Input id={`revision-nota-${turno.id}`} value={note} maxLength={1000} onChange={(event) => setNotes((current) => ({ ...current, [turno.id]: event.target.value }))} placeholder="Dejá constancia de la revisión" className="h-11 rounded-xl" />
              {review.isError && <p role="alert" className="text-sm text-destructive">{review.error.message}</p>}
              <Button type="submit" disabled={review.isPending || (requiresNote && !note.trim())}>{review.isPending ? "Registrando…" : "Registrar revisión administrativa"}</Button>
              <p className="text-xs text-muted-foreground">La revisión deja un registro inmutable. No modifica el efectivo declarado ni crea ingresos o egresos.</p>
            </form>
            <div className="space-y-3 rounded-lg border p-3" aria-label="Entrega de efectivo y fondo remanente">
              <div><h5 className="text-sm font-semibold">Entrega y fondo remanente</h5><p className="text-xs text-muted-foreground">Se divide el efectivo declarado ({money.format(turno.efectivoContado)}); no modifica la diferencia ni genera movimientos financieros.</p></div>
              <ol className="space-y-2">{custody.isLoading ? <li className="text-sm text-muted-foreground">Cargando historial de custodia…</li> : custody.isError ? <li role="alert" className="text-sm text-destructive">{custody.error.message}</li> : custody.data?.entregas.map((item) => <li key={item.id} className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{item.tipo === "RECTIFICACION" ? "Rectificación" : "Entrega confirmada"} · {new Date(item.confirmadoEn).toLocaleString("es-AR")}</p><p>{money.format(item.efectivoEntregado)} entregado · {money.format(item.fondoRemanente)} remanente · {item.destinoTipo === "DUENO" ? "Dueño" : item.destinoNombre}</p>{item.observacion && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.observacion}</p>}</li>)}</ol>
              {custodySuccess[turno.id] && <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-300">{custodySuccess[turno.id]}</p>}
              {turno.estadoEntrega === "ENTREGA_CONFIRMADA" && <Button type="button" variant="outline" size="sm" onClick={() => {
                const closing = Boolean(rectifying[turno.id])
                setConfirmed((current) => ({ ...current, [turno.id]: false }))
                setCustodySuccess((current) => { const next = { ...current }; delete next[turno.id]; return next })
                deliver.reset()
                if (closing) {
                  setRectifying((current) => ({ ...current, [turno.id]: false }))
                  setDeliveryAmounts((current) => { const next = { ...current }; delete next[turno.id]; return next })
                  setCustodyNotes((current) => { const next = { ...current }; delete next[turno.id]; return next })
                  setDestinations((current) => { const next = { ...current }; delete next[turno.id]; return next })
                } else {
                  const latest = custody.data?.entregas.at(-1)
                  setRectifying((current) => ({ ...current, [turno.id]: true }))
                  setDeliveryAmounts((current) => ({ ...current, [turno.id]: (latest?.efectivoEntregado ?? turno.entregaActual?.efectivoEntregado ?? turno.efectivoContado).toFixed(2) }))
                  setCustodyNotes((current) => ({ ...current, [turno.id]: "" }))
                  setDestinations((current) => ({ ...current, [turno.id]: { type: latest?.destinoTipo ?? turno.entregaActual?.destinoTipo ?? "DUENO", name: latest?.destinoNombre ?? turno.entregaActual?.destinoNombre ?? "" } }))
                }
              }}>{rectifying[turno.id] ? "Cancelar rectificación" : "Registrar rectificación"}</Button>}
              {(turno.estadoEntrega === "PENDIENTE_ENTREGA" || rectifying[turno.id]) && (() => {
                const delivered = deliveryAmounts[turno.id] ?? turno.efectivoContadoExacto
                const retained = remainingFrom(turno.efectivoContadoExacto, delivered) ?? ""
                const destination = destinations[turno.id] ?? { type: "DUENO" as const, name: "" }
                const needsNote = Boolean(rectifying[turno.id])
                return <form onSubmit={(event) => { event.preventDefault(); if (!confirmed[turno.id] || (destination.type === "RESGUARDO" && !destination.name.trim()) || !retained || (needsNote && !(custodyNotes[turno.id] ?? "").trim()) || deliver.isPending) return; deliver.mutate({ turno, tipo: needsNote ? "RECTIFICACION" : "ENTREGA_CONFIRMADA", entregado: delivered, remanente: retained, destinoTipo: destination.type, destinoNombre: destination.name, observacion: custodyNotes[turno.id] ?? "" }) }} className="space-y-2 rounded-lg bg-muted/30 p-3">
                  <div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 text-sm">Importe entregado<Input inputMode="decimal" value={delivered} onChange={(event) => setDeliveryAmounts((current) => ({ ...current, [turno.id]: event.target.value }))} aria-label={`Importe entregado ${turno.id}`} /></label><label className="space-y-1 text-sm">Fondo que permanece en caja<Input readOnly value={retained} aria-label={`Fondo remanente ${turno.id}`} /></label></div>
                  <label className="block space-y-1 text-sm">Destino<select className="h-11 w-full rounded-xl border bg-background px-3" value={destination.type} onChange={(event) => setDestinations((current) => ({ ...current, [turno.id]: { ...destination, type: event.target.value as "DUENO" | "RESGUARDO" } }))}><option value="DUENO">Dueño</option><option value="RESGUARDO">Lugar de resguardo</option></select></label>
                  {destination.type === "RESGUARDO" && <label className="block space-y-1 text-sm">Identificación del resguardo<Input value={destination.name} maxLength={120} onChange={(event) => setDestinations((current) => ({ ...current, [turno.id]: { ...destination, name: event.target.value } }))} placeholder="Ej.: caja fuerte de oficina" /></label>}
                  <label className="block space-y-1 text-sm">{needsNote ? "Motivo de rectificación (obligatorio)" : "Observación (opcional)"}<Input value={custodyNotes[turno.id] ?? ""} maxLength={1000} onChange={(event) => setCustodyNotes((current) => ({ ...current, [turno.id]: event.target.value }))} placeholder="Detalle de la recepción o el destino" /></label>
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={Boolean(confirmed[turno.id])} onChange={(event) => setConfirmed((current) => ({ ...current, [turno.id]: event.target.checked }))} /><span>Confirmo que registré la recepción física o el destino indicado y que ambos importes suman el efectivo declarado.</span></label>
                  {deliver.isError && <p role="alert" className="text-sm text-destructive">{deliver.error.message}</p>}
                  <Button type="submit" disabled={deliver.isPending || !confirmed[turno.id] || !retained || (destination.type === "RESGUARDO" && !destination.name.trim()) || (needsNote && !(custodyNotes[turno.id] ?? "").trim())}>{deliver.isPending ? "Registrando…" : needsNote ? "Confirmar rectificación" : "Confirmar entrega"}</Button>
                </form>
              })()}
            </div>
          </div>}
        </article>
      })}</div>}
  </section>
}

function Money({ label, value, emphasize = false }: { label: string; value: number; emphasize?: boolean }) {
  return <div className="min-w-0 rounded-lg bg-muted/40 p-2"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-0.5 break-words font-semibold ${emphasize && value < 0 ? "text-rose-700 dark:text-rose-300" : emphasize && value > 0 ? "text-amber-700 dark:text-amber-300" : ""}`}>{money.format(value)}</p></div>
}
