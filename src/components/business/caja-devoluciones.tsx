"use client"

// ============================================
// F4-A — anulación completa y devolución parcial (owner + cashier, same UI)
// ============================================
// One component for both hosts: the owner's Caja (Resumen) and the cashier PWA
// pass their OWN endpoints, so a cashier never calls an owner API. The server
// decides amounts (price actually charged), quantities left, permissions and
// where refunded cash leaves from; this UI only collects the operator's
// choices: which lines and how many, what happens to each product, the reason
// and the refund. A failed attempt keeps every field and a retry of the same
// data reuses the same Idempotency-Key, so it can never be applied twice.

import { useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { History, Minus, PencilLine, Plus, RotateCcw, Search, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { cn, formatPrice } from "@/lib/utils"

export interface CajaDevolucionesEndpoints {
  /** GET ?desde&hasta | ?ref — sales with their returns. */
  historialUrl: string
  /** GET detail / POST a return of one sale. */
  ventaUrl: (ventaId: string) => string
  /** POST: register a pending refund. */
  reintegroUrl: (devolucionId: string) => string
  /** Prefix of every query key of this host (scoped per business/person). */
  queryScope: readonly unknown[]
  /** Other queries to refresh after an operation (e.g. the owner's daily summary). */
  invalidateAlso?: ReadonlyArray<readonly unknown[]>
  /** Owner only: registers with an open shift, to choose where cash leaves from. */
  ownerRegistersUrl?: string
  /** F4-B, owner only: POST a correction of one sale. Absent for the cashier (no correction UI at all). */
  correccionUrl?: (ventaId: string) => string
  /** F4-B, owner only: the owner's catalog, to pick the product actually delivered. */
  productosUrl?: string
}

export type EstadoDevolucionVenta = "VIGENTE" | "DEVOLUCION_PARCIAL" | "ANULADA" | "DEVUELTA_TOTAL"

export interface VentaDevolucionItem {
  id: string
  productoId?: string | null
  productoVarianteId?: string | null
  corregida?: boolean
  nombre: string
  varianteNombre: string | null
  precio: number
  cantidad: number
  subtotal: number
  cantidadDevuelta: number
  cantidadRestante: number
  importeDevuelto: number
}

export interface DevolucionRegistrada {
  id: string
  ventaId: string
  ventaReferencia: string
  tipo: "ANULACION" | "DEVOLUCION_PARCIAL"
  motivo: string
  createdAt: string
  importe: number
  registradaPor: string | null
  metodoPagoVenta: string
  reintegroEstado: "NO_CORRESPONDE" | "PENDIENTE" | "REALIZADO"
  reintegroMedio: string | null
  reintegroRegistradoEn: string | null
  reintegroRegistradoPor: string | null
  reintegroDescripcion: string
  items: Array<{ ventaItemId: string; nombre: string; cantidad: number; importe: number; stockResultado: string }>
}

export interface VentaConDevoluciones {
  id: string
  referencia: string
  createdAt: string
  metodoPago: string
  total: number
  totalDevuelto: number
  totalNeto: number
  estadoDevolucion: EstadoDevolucionVenta
  items: VentaDevolucionItem[]
  devoluciones: DevolucionRegistrada[]
  // F4-B
  corregida?: boolean
  correccionSecuencia?: number
  correcciones?: CorreccionRegistrada[]
}

export interface CorreccionRegistrada {
  id: string
  secuencia: number
  motivo: string
  createdAt: string
  registradaPor: string
  total: number
  cambios: Array<{ ventaItemId: string; precio: number; antes: { nombre: string; cantidad: number }; despues: { nombre: string; cantidad: number } }>
}

type Medio = "EFECTIVO" | "TRANSFERENCIA" | "OTRO"
type ModoReintegro = "REALIZADO" | "PENDIENTE" | "NO_CORRESPONDE"

export const ESTADO_LABEL: Record<EstadoDevolucionVenta, string> = {
  VIGENTE: "Vigente",
  DEVOLUCION_PARCIAL: "Devolución parcial",
  ANULADA: "Anulada",
  DEVUELTA_TOTAL: "Devuelta por completo",
}
const MEDIO_LABEL: Record<Medio, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", OTRO: "Otro medio" }
const STOCK_LABEL: Record<string, string> = {
  REINGRESADO: "volvió al stock",
  NO_REINGRESA: "no vuelve al stock",
  SIN_CONTROL_STOCK: "producto sin control de stock",
  PRODUCTO_NO_DISPONIBLE: "producto ya no disponible: no se reingresó",
}

export function nombreItem(item: { nombre: string; varianteNombre: string | null }) {
  return item.varianteNombre ? `${item.nombre} — ${item.varianteNombre}` : item.nombre
}

const round2 = (value: number) => Math.round(value * 100) / 100
/** Display-only preview of the server rule (cumulative, proportional to what was charged). */
export function importeEstimado(item: VentaDevolucionItem, cantidad: number): number {
  if (cantidad <= 0) return 0
  const acumulada = item.cantidadDevuelta + cantidad
  const objetivo = acumulada >= item.cantidad ? item.subtotal : round2((item.subtotal * acumulada) / item.cantidad)
  return Math.max(0, round2(objetivo - item.importeDevuelto))
}

function localDayRange(day: string): { desde: string; hasta: string } {
  const [y, m, d] = day.split("-").map(Number)
  const desde = new Date(y, m - 1, d, 0, 0, 0, 0)
  const hasta = new Date(y, m - 1, d + 1, 0, 0, 0, 0)
  return { desde: desde.toISOString(), hasta: hasta.toISOString() }
}

function todayInput(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function EstadoDevolucionBadge({ estado }: { estado: EstadoDevolucionVenta }) {
  if (estado === "VIGENTE") return null
  return (
    <span className={cn(
      "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
      estado === "DEVOLUCION_PARCIAL" ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
    )}>
      {ESTADO_LABEL[estado]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Search + list
// ---------------------------------------------------------------------------

export function CajaVentasHistorial({ endpoints, titulo = "Ventas anteriores y devoluciones" }: { endpoints: CajaDevolucionesEndpoints; titulo?: string }) {
  const [dia, setDia] = useState(todayInput)
  const [refInput, setRefInput] = useState("")
  const [filtro, setFiltro] = useState<{ dia: string; ref: string }>({ dia: todayInput(), ref: "" })
  const [ventaId, setVentaId] = useState<string | null>(null)

  const query = useQuery<VentaConDevoluciones[]>({
    queryKey: [...endpoints.queryScope, "historial", filtro],
    queryFn: async () => {
      const params = filtro.ref ? new URLSearchParams({ ref: filtro.ref }) : new URLSearchParams(localDayRange(filtro.dia))
      const response = await fetch(`${endpoints.historialUrl}?${params}`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error ?? "No se pudieron cargar las ventas.")
      return json.ventas
    },
  })

  return (
    <div className="min-w-0 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><History className="h-3.5 w-3.5" />{titulo}</p>
      <form
        className="grid min-w-0 gap-2 sm:grid-cols-[auto_1fr_auto]"
        onSubmit={(event) => { event.preventDefault(); setFiltro({ dia, ref: refInput.trim() }) }}
      >
        <label className="min-w-0 text-xs font-medium">
          <span className="sr-only">Día de la venta</span>
          <Input type="date" value={dia} max={todayInput()} onChange={(event) => setDia(event.target.value)} className="h-11 w-full min-w-0 rounded-xl" aria-label="Día de la venta" />
        </label>
        <label className="min-w-0 text-xs font-medium">
          <span className="sr-only">Referencia de la venta</span>
          <Input value={refInput} onChange={(event) => setRefInput(event.target.value)} placeholder="Referencia (#a1b2c3d4), opcional" className="h-11 w-full min-w-0 rounded-xl" aria-label="Referencia de la venta" />
        </label>
        <Button type="submit" variant="outline" className="min-h-11 w-full rounded-xl sm:w-auto"><Search className="mr-1 h-4 w-4" />Buscar</Button>
      </form>
      {query.isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
        : query.isError ? <p role="alert" className="break-words text-sm text-destructive">{(query.error as Error).message}</p>
          : (query.data ?? []).length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No hay ventas para esa búsqueda.</p>
            : (
              <div className="space-y-1.5">
                {query.data!.map((venta) => (
                  <button
                    key={venta.id}
                    type="button"
                    onClick={() => setVentaId(venta.id)}
                    className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                        {formatPrice(venta.total)}
                        <EstadoDevolucionBadge estado={venta.estadoDevolucion} />
                        {venta.corregida && <CorregidaBadge />}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        #{venta.referencia} · {venta.metodoPago}{venta.totalDevuelto > 0 ? ` · neto ${formatPrice(venta.totalNeto)}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(venta.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  </button>
                ))}
              </div>
            )}
      {ventaId && <VentaDevolucionesDialog ventaId={ventaId} endpoints={endpoints} onClose={() => setVentaId(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sale detail + actions
// ---------------------------------------------------------------------------

export function VentaDevolucionesDialog({ ventaId, endpoints, onClose }: { ventaId: string; endpoints: CajaDevolucionesEndpoints; onClose: () => void }) {
  const [modo, setModo] = useState<"detalle" | "ANULACION" | "DEVOLUCION_PARCIAL" | "CORRECCION">("detalle")
  const [aviso, setAviso] = useState<string | null>(null)
  const query = useQuery<VentaConDevoluciones>({
    queryKey: [...endpoints.queryScope, "venta", ventaId],
    queryFn: async () => {
      const response = await fetch(endpoints.ventaUrl(ventaId), { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error ?? "No se pudo cargar la venta.")
      return json.venta
    },
  })
  const venta = query.data
  const quedan = venta?.items.some((item) => item.cantidadRestante > 0) ?? false
  // F4-B: only the owner host passes a correction endpoint; never after returns/voids.
  const corregible = Boolean(endpoints.correccionUrl) && venta !== undefined && venta.devoluciones.length === 0

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{modo === "ANULACION" ? "Anular venta" : modo === "DEVOLUCION_PARCIAL" ? "Devolver productos" : modo === "CORRECCION" ? "Corregir venta" : "Detalle de venta"}{venta ? ` #${venta.referencia}` : ""}</DialogTitle>
          <DialogDescription className="sr-only">Detalle de la venta, devoluciones realizadas y acciones disponibles.</DialogDescription>
        </DialogHeader>
        {query.isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
          : query.isError || !venta ? <p role="alert" className="break-words text-sm text-destructive">{(query.error as Error | null)?.message ?? "No se pudo cargar la venta."}</p>
            : modo === "detalle" ? (
              <div className="min-w-0 space-y-3">
                {aviso && <p role="status" className="break-words rounded-xl bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{aviso}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{new Date(venta.createdAt).toLocaleString("es-AR")} · {venta.metodoPago}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <EstadoDevolucionBadge estado={venta.estadoDevolucion} />
                    {venta.corregida && <CorregidaBadge />}
                  </span>
                </div>
                <div className="space-y-2">
                  {venta.items.filter((item) => item.cantidad > 0).map((item) => (
                    <div key={item.id} className="flex min-w-0 items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{nombreItem(item)}</p>
                        <p className="text-xs text-muted-foreground">{item.cantidad} × {formatPrice(item.precio)}</p>
                        {item.cantidadDevuelta > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">Devueltas: {item.cantidadDevuelta} ({formatPrice(item.importeDevuelto)})</p>}
                      </div>
                      <span className="shrink-0 font-semibold">{formatPrice(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <dl className="space-y-1 border-t pt-2 text-sm">
                  <div className="flex justify-between gap-2"><dt>Total original</dt><dd className="font-semibold">{formatPrice(venta.total)}</dd></div>
                  {venta.totalDevuelto > 0 && <>
                    <div className="flex justify-between gap-2"><dt>Devuelto</dt><dd className="font-semibold">− {formatPrice(venta.totalDevuelto)}</dd></div>
                    <div className="flex justify-between gap-2"><dt>Venta neta</dt><dd className="text-base font-bold">{formatPrice(venta.totalNeto)}</dd></div>
                  </>}
                </dl>
                {venta.devoluciones.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Operaciones registradas</p>
                    {venta.devoluciones.map((devolucion) => <DevolucionCard key={devolucion.id} devolucion={devolucion} endpoints={endpoints} />)}
                  </div>
                )}
                {(venta.correcciones ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Correcciones del dueño</p>
                    {venta.correcciones!.map((correccion) => <CorreccionCard key={correccion.id} correccion={correccion} />)}
                  </div>
                )}
                {corregible && (
                  <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal rounded-xl" onClick={() => { setAviso(null); setModo("CORRECCION") }}><PencilLine className="mr-1 h-4 w-4 shrink-0" />Corregir venta</Button>
                )}
                {quedan ? (
                  <div className="flex flex-col gap-2" data-testid="venta-acciones">
                    <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal rounded-xl" onClick={() => { setAviso(null); setModo("DEVOLUCION_PARCIAL") }}><Undo2 className="mr-1 h-4 w-4 shrink-0" />Devolver productos</Button>
                    <Button type="button" variant="destructive" className="h-auto min-h-11 w-full whitespace-normal rounded-xl" onClick={() => { setAviso(null); setModo("ANULACION") }}><RotateCcw className="mr-1 h-4 w-4 shrink-0" />Anular venta</Button>
                  </div>
                ) : <p className="text-xs text-muted-foreground">No quedan productos por devolver en esta venta.</p>}
                <Button type="button" variant="secondary" className="min-h-11 w-full rounded-xl" onClick={onClose}>Cerrar</Button>
              </div>
            ) : modo === "CORRECCION" ? (
              <CorreccionForm
                venta={venta}
                endpoints={endpoints}
                onCancel={() => setModo("detalle")}
                onDone={(message) => { setAviso(message); setModo("detalle") }}
              />
            ) : (
              <DevolucionForm
                key={modo}
                venta={venta}
                tipo={modo}
                endpoints={endpoints}
                onCancel={() => setModo("detalle")}
                onDone={(message) => { setAviso(message); setModo("detalle") }}
              />
            )}
      </DialogContent>
    </Dialog>
  )
}

export function CorregidaBadge() {
  return <span className="inline-flex shrink-0 items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900 dark:bg-sky-950/50 dark:text-sky-200">Corregida</span>
}

function CorreccionCard({ correccion }: { correccion: CorreccionRegistrada }) {
  return (
    <div className="min-w-0 space-y-1 rounded-xl border p-2 text-xs">
      <p className="flex flex-wrap items-center justify-between gap-1 font-semibold">
        <span>Corrección {correccion.secuencia} · total sin cambios {formatPrice(correccion.total)}</span>
        <span className="font-normal text-muted-foreground">{new Date(correccion.createdAt).toLocaleString("es-AR")}</span>
      </p>
      {correccion.cambios.map((cambio) => (
        <p key={cambio.ventaItemId} className="break-words">
          {cambio.antes.cantidad} × {cambio.antes.nombre} → {cambio.despues.cantidad} × {cambio.despues.nombre} ({formatPrice(cambio.precio)} c/u, precio cobrado)
        </p>
      ))}
      <p className="break-words text-muted-foreground">Motivo: {correccion.motivo} · Registró: {correccion.registradaPor}</p>
    </div>
  )
}

function DevolucionCard({ devolucion, endpoints }: { devolucion: DevolucionRegistrada; endpoints: CajaDevolucionesEndpoints }) {
  return (
    <div className="min-w-0 space-y-1 rounded-xl border p-2 text-xs">
      <p className="flex flex-wrap items-center justify-between gap-1 font-semibold">
        <span>{devolucion.tipo === "ANULACION" ? "Anulación" : "Devolución parcial"} · {formatPrice(devolucion.importe)}</span>
        <span className="font-normal text-muted-foreground">{new Date(devolucion.createdAt).toLocaleString("es-AR")}</span>
      </p>
      <p className="break-words">{devolucion.items.map((item) => `${item.cantidad} × ${item.nombre} (${STOCK_LABEL[item.stockResultado] ?? item.stockResultado})`).join(", ")}</p>
      <p className="break-words text-muted-foreground">Motivo: {devolucion.motivo}{devolucion.registradaPor ? ` · Registró: ${devolucion.registradaPor}` : ""}</p>
      <p className={cn("break-words", devolucion.reintegroEstado === "PENDIENTE" && "font-semibold text-amber-700 dark:text-amber-300")}>
        Dinero: {devolucion.reintegroDescripcion}{devolucion.reintegroRegistradoPor && devolucion.reintegroEstado === "REALIZADO" ? ` (${devolucion.reintegroRegistradoPor})` : ""}
      </p>
      {devolucion.reintegroEstado === "PENDIENTE" && <ReintegroPendienteForm devolucion={devolucion} endpoints={endpoints} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared submit helper: one key per canonical body, kept for 5xx / network
// ---------------------------------------------------------------------------

function useIdempotentPost() {
  const keys = useRef(new Map<string, string>())
  return async (url: string, body: unknown): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; message: string }> => {
    const canonical = JSON.stringify(body)
    let key = keys.current.get(canonical)
    if (!key) { key = newIdempotencyKey(); keys.current.set(canonical, key) }
    let response: Response
    try {
      response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: canonical })
    } catch {
      return { ok: false, message: "No pudimos confirmar la operación por un problema de conexión. Podés reintentar sin duplicarla." }
    }
    const json = await response.json().catch(() => ({}))
    if (response.ok && json.ok) { keys.current.clear(); return { ok: true, json } }
    if (response.status < 500) keys.current.delete(canonical)
    return {
      ok: false,
      message: response.status >= 500 ? "No pudimos registrar la operación por un error del servidor. Podés reintentar sin duplicarla." : (json.error ?? "No pudimos registrar la operación."),
    }
  }
}

function useInvalidate(endpoints: CajaDevolucionesEndpoints) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: [...endpoints.queryScope] })
    for (const key of endpoints.invalidateAlso ?? []) void queryClient.invalidateQueries({ queryKey: [...key] })
  }
}

function useOpenRegisters(url: string | undefined, enabled: boolean) {
  return useQuery<Array<{ id: string; nombre: string; responsable: string }>>({
    queryKey: ["caja-devolucion-registros", url],
    enabled: Boolean(url) && enabled,
    queryFn: async () => {
      const response = await fetch(url!, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error ?? "No se pudieron cargar las cajas.")
      return (json.cajas ?? [])
        .filter((caja: { turnoAbierto?: unknown }) => Boolean(caja.turnoAbierto))
        .map((caja: { id: string; nombre: string; turnoAbierto: { responsableNombre?: string } }) => ({ id: caja.id, nombre: caja.nombre, responsable: caja.turnoAbierto.responsableNombre ?? "" }))
    },
  })
}

function RegisterChoice({ registers, value, onChange, disabled }: { registers: Array<{ id: string; nombre: string; responsable: string }>; value: string; onChange: (id: string) => void; disabled: boolean }) {
  if (registers.length <= 1) {
    return <p className="break-words text-xs text-muted-foreground">{registers.length === 1 ? `El efectivo sale de ${registers[0].nombre} (turno de ${registers[0].responsable}).` : "No hay turnos abiertos: la salida queda en el efectivo sin caja asignada (modo opcional)."}</p>
  }
  return (
    <label className="block min-w-0 space-y-1 text-sm font-medium">
      <span>¿De qué caja sale el efectivo?</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm">
        <option value="">Seleccioná una caja…</option>
        {registers.map((register) => <option key={register.id} value={register.id}>{register.nombre} — {register.responsable}</option>)}
      </select>
    </label>
  )
}

function ReintegroPendienteForm({ devolucion, endpoints }: { devolucion: DevolucionRegistrada; endpoints: CajaDevolucionesEndpoints }) {
  const [abierto, setAbierto] = useState(false)
  const [medio, setMedio] = useState<Medio>((["EFECTIVO", "TRANSFERENCIA", "OTRO"].includes(devolucion.metodoPagoVenta) ? devolucion.metodoPagoVenta : "EFECTIVO") as Medio)
  const [caja, setCaja] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const post = useIdempotentPost()
  const invalidate = useInvalidate(endpoints)
  const registers = useOpenRegisters(endpoints.ownerRegistersUrl, abierto && medio === "EFECTIVO")
  const necesitaCaja = medio === "EFECTIVO" && (registers.data?.length ?? 0) > 1
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await post(endpoints.reintegroUrl(devolucion.id), { medio, confirmo: true, ...(endpoints.ownerRegistersUrl && caja ? { cajaFisicaId: caja } : {}) })
      if (!result.ok) throw new Error(result.message)
    },
    onMutate: () => setError(null),
    onSettled: () => { inFlight.current = false },
    onSuccess: () => { setAbierto(false); invalidate() },
    onError: (failure: Error) => { setError(failure.message); invalidate() },
  })
  if (!abierto) return <Button type="button" variant="outline" className="h-auto min-h-10 w-full whitespace-normal rounded-xl text-xs" onClick={() => setAbierto(true)}>Registrar reintegro ({formatPrice(devolucion.importe)})</Button>
  return (
    <form
      className="min-w-0 space-y-2 border-t pt-2"
      onSubmit={(event) => { event.preventDefault(); if (!confirmo || (necesitaCaja && !caja) || inFlight.current) return; inFlight.current = true; mutation.mutate() }}
    >
      <MedioSelect value={medio} onChange={setMedio} disabled={mutation.isPending} />
      {medio !== "EFECTIVO" && <p className="break-words text-xs text-muted-foreground">DeliGO no realiza transferencias: sólo registra que devolviste el dinero por ese medio.</p>}
      {medio === "EFECTIVO" && endpoints.ownerRegistersUrl && registers.data && <RegisterChoice registers={registers.data} value={caja} onChange={setCaja} disabled={mutation.isPending} />}
      <label className="flex min-w-0 items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={confirmo} onChange={(event) => setConfirmo(event.target.checked)} disabled={mutation.isPending} /><span className="min-w-0 break-words">Confirmo que devolví {formatPrice(devolucion.importe)} al cliente.</span></label>
      {error && <p role="alert" className="break-words text-xs text-destructive">{error}</p>}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={!confirmo || (necesitaCaja && !caja) || mutation.isPending} className="h-auto min-h-10 w-full whitespace-normal rounded-xl">{mutation.isPending ? "Registrando…" : "Confirmar reintegro"}</Button>
        <Button type="button" variant="outline" disabled={mutation.isPending} className="min-h-10 w-full rounded-xl" onClick={() => { setAbierto(false); setError(null) }}>Cancelar</Button>
      </div>
    </form>
  )
}

function MedioSelect({ value, onChange, disabled }: { value: Medio; onChange: (medio: Medio) => void; disabled: boolean }) {
  return (
    <label className="block min-w-0 space-y-1 text-sm font-medium">
      <span>Medio de devolución</span>
      <select value={value} onChange={(event) => onChange(event.target.value as Medio)} disabled={disabled} className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm" aria-label="Medio de devolución">
        {(Object.keys(MEDIO_LABEL) as Medio[]).map((medio) => <option key={medio} value={medio}>{MEDIO_LABEL[medio]}</option>)}
      </select>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Void / partial return form
// ---------------------------------------------------------------------------

export function DevolucionForm({ venta, tipo, endpoints, onCancel, onDone }: {
  venta: VentaConDevoluciones
  tipo: "ANULACION" | "DEVOLUCION_PARCIAL"
  endpoints: CajaDevolucionesEndpoints
  onCancel: () => void
  onDone: (message: string) => void
}) {
  const disponibles = venta.items.filter((item) => item.cantidadRestante > 0)
  const [cantidades, setCantidades] = useState<Record<string, number>>(() => Object.fromEntries(disponibles.map((item) => [item.id, tipo === "ANULACION" ? item.cantidadRestante : 0])))
  const [stock, setStock] = useState<Record<string, boolean | undefined>>({})
  const [motivo, setMotivo] = useState("")
  const [modoReintegro, setModoReintegro] = useState<ModoReintegro | null>(null)
  const metodoVenta = (["EFECTIVO", "TRANSFERENCIA", "OTRO"].includes(venta.metodoPago) ? venta.metodoPago : "EFECTIVO") as Medio
  const [medio, setMedio] = useState<Medio>(metodoVenta)
  const [caja, setCaja] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const post = useIdempotentPost()
  const invalidate = useInvalidate(endpoints)
  const registers = useOpenRegisters(endpoints.ownerRegistersUrl, modoReintegro === "REALIZADO" && medio === "EFECTIVO")

  const seleccionadas = disponibles.filter((item) => (cantidades[item.id] ?? 0) > 0)
  const importe = useMemo(() => round2(seleccionadas.reduce((acc, item) => acc + importeEstimado(item, cantidades[item.id] ?? 0), 0)), [seleccionadas, cantidades])
  const necesitaCaja = modoReintegro === "REALIZADO" && medio === "EFECTIVO" && (registers.data?.length ?? 0) > 1
  const faltaStock = seleccionadas.some((item) => stock[item.id] === undefined)
  const listo = seleccionadas.length > 0 && !faltaStock && motivo.trim().length > 0 && modoReintegro !== null && confirmo && !(necesitaCaja && !caja)

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        tipo,
        motivo: motivo.trim(),
        confirmo: true,
        reintegro: modoReintegro === "REALIZADO" ? { modo: "REALIZADO", medio } : { modo: modoReintegro },
        items: seleccionadas.map((item) => tipo === "ANULACION"
          ? { ventaItemId: item.id, reingresaStock: stock[item.id] === true }
          : { ventaItemId: item.id, cantidad: cantidades[item.id], reingresaStock: stock[item.id] === true }),
        ...(endpoints.ownerRegistersUrl && caja && modoReintegro === "REALIZADO" && medio === "EFECTIVO" ? { cajaFisicaId: caja } : {}),
      }
      const result = await post(endpoints.ventaUrl(venta.id), body)
      if (!result.ok) throw new Error(result.message)
      return result.json as { devolucion?: { importe?: number; reintegroDescripcion?: string } }
    },
    onMutate: () => setError(null),
    onSettled: () => { inFlight.current = false },
    onSuccess: (json) => {
      invalidate()
      const monto = formatPrice(json.devolucion?.importe ?? importe)
      onDone(`${tipo === "ANULACION" ? "Venta anulada" : "Devolución registrada"} por ${monto}. Dinero: ${json.devolucion?.reintegroDescripcion ?? "registrado"}.`)
    },
    onError: (failure: Error) => { setError(failure.message); invalidate() },
  })

  const setCantidad = (item: VentaDevolucionItem, next: number) => {
    const value = Math.max(0, Math.min(item.cantidadRestante, Math.round(next * 1000) / 1000))
    setCantidades((prev) => ({ ...prev, [item.id]: value }))
  }
  const pending = mutation.isPending

  return (
    <form
      aria-label={tipo === "ANULACION" ? "Anular venta" : "Devolver productos"}
      className="min-w-0 space-y-3"
      onSubmit={(event) => { event.preventDefault(); if (!listo || inFlight.current) return; inFlight.current = true; mutation.mutate() }}
    >
      <p className="break-words text-sm text-muted-foreground">
        {tipo === "ANULACION"
          ? "Se devuelven todas las unidades que todavía no fueron devueltas. La venta original queda registrada."
          : "Elegí qué productos y cuántas unidades devuelve el cliente. El resto de la venta sigue vigente."}
      </p>
      <div className="space-y-2">
        {disponibles.map((item) => {
          const cantidad = cantidades[item.id] ?? 0
          return (
            <div key={item.id} className="min-w-0 space-y-2 rounded-xl border p-2">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{nombreItem(item)}</p>
                  <p className="text-xs text-muted-foreground">Vendidas {item.cantidad} · disponibles para devolver {item.cantidadRestante}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold">{formatPrice(importeEstimado(item, cantidad))}</span>
              </div>
              {tipo === "DEVOLUCION_PARCIAL" ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" aria-label={`Restar una unidad de ${nombreItem(item)}`} disabled={pending || cantidad <= 0} onClick={() => setCantidad(item, cantidad - 1)}><Minus className="h-4 w-4" /></Button>
                  <Input
                    inputMode="decimal"
                    aria-label={`Unidades a devolver de ${nombreItem(item)}`}
                    value={String(cantidad)}
                    disabled={pending}
                    onChange={(event) => { const n = Number(event.target.value.replace(",", ".")); if (Number.isFinite(n)) setCantidad(item, n) }}
                    className="h-10 w-20 min-w-0 rounded-xl text-center"
                  />
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" aria-label={`Sumar una unidad de ${nombreItem(item)}`} disabled={pending || cantidad + 1 > item.cantidadRestante} onClick={() => setCantidad(item, cantidad + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
              ) : <p className="text-xs">Unidades: {cantidad}</p>}
              {cantidad > 0 && (
                <div role="group" aria-label={`¿${nombreItem(item)} vuelve al stock?`} className="grid grid-cols-2 gap-2">
                  {[true, false].map((vuelve) => (
                    <button
                      key={String(vuelve)}
                      type="button"
                      aria-pressed={stock[item.id] === vuelve}
                      disabled={pending}
                      onClick={() => setStock((prev) => ({ ...prev, [item.id]: vuelve }))}
                      className={cn(
                        "min-h-10 min-w-0 whitespace-normal rounded-xl border px-2 py-1.5 text-xs font-semibold",
                        stock[item.id] === vuelve ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                      )}
                    >
                      {vuelve ? "Vuelve al stock" : "No vuelve (dañado, abierto…)"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <label className="block min-w-0 space-y-1 text-sm font-medium" htmlFor={`devolucion-motivo-${venta.id}`}>
        <span>Motivo (obligatorio)</span>
        <Input id={`devolucion-motivo-${venta.id}`} value={motivo} maxLength={500} disabled={pending} onChange={(event) => setMotivo(event.target.value)} placeholder="Ej.: el cliente cambió de opinión" className="h-11 w-full min-w-0 rounded-xl" />
      </label>

      <fieldset className="min-w-0 space-y-2" disabled={pending}>
        <legend className="text-sm font-medium">Dinero ({formatPrice(importe)})</legend>
        {([
          ["REALIZADO", "Devolví el dinero ahora"],
          ["PENDIENTE", "El reintegro queda pendiente"],
          ["NO_CORRESPONDE", "No corresponde devolver dinero"],
        ] as Array<[ModoReintegro, string]>).map(([value, label]) => (
          <label key={value} className="flex min-w-0 items-center gap-2 text-sm">
            <input type="radio" name={`reintegro-${venta.id}`} className="h-4 w-4 shrink-0" checked={modoReintegro === value} onChange={() => setModoReintegro(value)} />
            <span className="min-w-0 break-words">{label}</span>
          </label>
        ))}
        {modoReintegro === "REALIZADO" && <>
          <MedioSelect value={medio} onChange={setMedio} disabled={pending} />
          {medio === "EFECTIVO"
            ? <p className="break-words text-xs text-muted-foreground">Se registra la salida de efectivo de la caja en tu turno actual. Los cierres anteriores no cambian.</p>
            : <p className="break-words text-xs text-muted-foreground">DeliGO no realiza transferencias: sólo registra que devolviste el dinero por ese medio.</p>}
          {medio === "EFECTIVO" && endpoints.ownerRegistersUrl && registers.data && <RegisterChoice registers={registers.data} value={caja} onChange={setCaja} disabled={pending} />}
        </>}
      </fieldset>

      <label className="flex min-w-0 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={confirmo} disabled={pending} onChange={(event) => setConfirmo(event.target.checked)} />
        <span className="min-w-0 break-words">{tipo === "ANULACION" ? "Confirmo que quiero anular esta venta." : "Confirmo la devolución de los productos seleccionados."}</span>
      </label>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-2" data-testid="devolucion-acciones">
        <Button type="submit" variant={tipo === "ANULACION" ? "destructive" : "default"} disabled={!listo || pending} className="h-auto min-h-11 w-full whitespace-normal rounded-xl px-4 py-2 font-bold leading-snug">
          {pending ? "Registrando…" : tipo === "ANULACION" ? "Confirmar anulación" : "Confirmar devolución"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} className="min-h-11 w-full rounded-xl" onClick={onCancel}>Volver</Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// F4-B — owner correction form (product / variant / quantity; same total)
// ---------------------------------------------------------------------------

interface ProductoCatalogo {
  id: string
  nombre: string
  eliminado?: boolean
  variantes?: Array<{ id: string; nombre: string; activo?: boolean }>
}

type LineaEditable = { ventaItemId: string; productoId: string; varianteId: string; cantidad: number }

/** Display-only preview of the server's line rule (price actually charged × quantity). */
export function subtotalCorreccion(precio: number, cantidad: number): number {
  return Math.round(precio * cantidad * 100) / 100
}

export function CorreccionForm({ venta, endpoints, onCancel, onDone }: {
  venta: VentaConDevoluciones
  endpoints: CajaDevolucionesEndpoints
  onCancel: () => void
  onDone: (message: string) => void
}) {
  const [lineas, setLineas] = useState<LineaEditable[]>(() => venta.items.map((item) => ({
    ventaItemId: item.id,
    productoId: item.productoId ?? "",
    varianteId: item.productoVarianteId ?? "",
    cantidad: item.cantidad,
  })))
  const [motivo, setMotivo] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const post = useIdempotentPost()
  const invalidate = useInvalidate(endpoints)
  const catalogo = useQuery<ProductoCatalogo[]>({
    queryKey: [...endpoints.queryScope, "catalogo-correccion"],
    enabled: Boolean(endpoints.productosUrl),
    queryFn: async () => {
      const response = await fetch(endpoints.productosUrl!, { cache: "no-store" })
      const json = await response.json().catch(() => [])
      if (!response.ok) throw new Error("No se pudo cargar el catálogo.")
      const lista: ProductoCatalogo[] = Array.isArray(json) ? json : (json.productos ?? [])
      return lista.filter((p) => !p.eliminado).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    },
  })
  const productos = catalogo.data ?? []
  const porId = new Map(productos.map((p) => [p.id, p]))
  const itemPorId = new Map(venta.items.map((item) => [item.id, item]))

  const corregido = Math.round(lineas.reduce((acc, l) => acc + subtotalCorreccion(itemPorId.get(l.ventaItemId)!.precio, l.cantidad), 0) * 100) / 100
  const totalOk = Math.abs(corregido - venta.total) < 0.005
  const hayCambios = lineas.some((l) => {
    const item = itemPorId.get(l.ventaItemId)!
    return l.productoId !== (item.productoId ?? "") || l.varianteId !== (item.productoVarianteId ?? "") || l.cantidad !== item.cantidad
  })
  const variantesDe = (productoId: string) => (porId.get(productoId)?.variantes ?? []).filter((v) => v.activo !== false)
  const faltaVariante = lineas.some((l) => l.productoId && variantesDe(l.productoId).length > 0 && !l.varianteId)
  const listo = hayCambios && totalOk && !faltaVariante && motivo.trim().length > 0 && confirmo

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await post(endpoints.correccionUrl!(venta.id), {
        motivo: motivo.trim(),
        confirmo: true,
        secuenciaEsperada: venta.correccionSecuencia ?? 0,
        lineas: lineas.map((l) => ({ ventaItemId: l.ventaItemId, productoId: l.productoId || null, varianteId: l.varianteId || null, cantidad: l.cantidad })),
      })
      if (!result.ok) throw new Error(result.message)
    },
    onMutate: () => setError(null),
    onSettled: () => { inFlight.current = false },
    onSuccess: () => {
      invalidate()
      onDone(`Venta corregida. El total cobrado no cambió (${formatPrice(venta.total)}) y el stock se ajustó.`)
    },
    onError: (failure: Error) => { setError(failure.message); invalidate() },
  })
  const pending = mutation.isPending
  const set = (ventaItemId: string, patch: Partial<LineaEditable>) => setLineas((prev) => prev.map((l) => (l.ventaItemId === ventaItemId ? { ...l, ...patch } : l)))

  return (
    <form
      aria-label="Corregir venta"
      className="min-w-0 space-y-3"
      onSubmit={(event) => { event.preventDefault(); if (!listo || inFlight.current) return; inFlight.current = true; mutation.mutate() }}
    >
      <p className="break-words text-sm text-muted-foreground">
        Corregí el producto, la variante o la cantidad que realmente se entregó. Cada línea conserva el precio que se cobró y el total debe seguir siendo {formatPrice(venta.total)}: no se mueve dinero.
      </p>
      {catalogo.isError && <p role="alert" className="text-sm text-destructive">No se pudo cargar el catálogo.</p>}
      <div className="space-y-2">
        {lineas.map((linea) => {
          const item = itemPorId.get(linea.ventaItemId)!
          const variantes = linea.productoId ? variantesDe(linea.productoId) : []
          return (
            <div key={linea.ventaItemId} className="min-w-0 space-y-2 rounded-xl border p-2" data-testid="correccion-linea">
              <p className="break-words text-xs text-muted-foreground">Registrado: {item.cantidad} × {nombreItem(item)} · {formatPrice(item.precio)} c/u cobrado</p>
              <label className="block min-w-0 space-y-1 text-sm font-medium">
                <span>Producto entregado</span>
                <select
                  value={linea.productoId}
                  disabled={pending || catalogo.isLoading}
                  onChange={(event) => set(linea.ventaItemId, { productoId: event.target.value, varianteId: "" })}
                  className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm"
                  aria-label={`Producto entregado en lugar de ${nombreItem(item)}`}
                >
                  {!linea.productoId && <option value="">{item.productoId ? "Seleccioná un producto…" : `${nombreItem(item)} (ya no está en el catálogo)`}</option>}
                  {item.productoId && !porId.has(item.productoId) && <option value={item.productoId}>{item.nombre}</option>}
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              {variantes.length > 0 && (
                <label className="block min-w-0 space-y-1 text-sm font-medium">
                  <span>Variante</span>
                  <select
                    value={linea.varianteId}
                    disabled={pending}
                    onChange={(event) => set(linea.ventaItemId, { varianteId: event.target.value })}
                    className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm"
                    aria-label={`Variante entregada en lugar de ${nombreItem(item)}`}
                  >
                    <option value="">Seleccioná una variante…</option>
                    {variantes.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                  </select>
                </label>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" aria-label={`Restar una unidad (${nombreItem(item)})`} disabled={pending || linea.cantidad <= 0} onClick={() => set(linea.ventaItemId, { cantidad: Math.max(0, linea.cantidad - 1) })}><Minus className="h-4 w-4" /></Button>
                <span className="min-w-10 text-center text-sm font-semibold" aria-label={`Cantidad corregida (${nombreItem(item)})`}>{linea.cantidad}</span>
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" aria-label={`Sumar una unidad (${nombreItem(item)})`} disabled={pending} onClick={() => set(linea.ventaItemId, { cantidad: linea.cantidad + 1 })}><Plus className="h-4 w-4" /></Button>
                <span className="ml-auto shrink-0 text-sm font-semibold">{formatPrice(subtotalCorreccion(item.precio, linea.cantidad))}</span>
              </div>
            </div>
          )
        })}
      </div>
      <dl className="space-y-1 border-t pt-2 text-sm">
        <div className="flex justify-between gap-2"><dt>Total cobrado</dt><dd className="font-semibold">{formatPrice(venta.total)}</dd></div>
        <div className="flex justify-between gap-2"><dt>Total corregido</dt><dd className={cn("font-semibold", !totalOk && "text-destructive")}>{formatPrice(corregido)}</dd></div>
      </dl>
      {!totalOk && <p role="status" className="break-words text-xs text-destructive">El total corregido debe ser igual al cobrado. Para devolver dinero usá «Devolver productos».</p>}
      <label className="block min-w-0 space-y-1 text-sm font-medium" htmlFor={`correccion-motivo-${venta.id}`}>
        <span>Motivo (obligatorio)</span>
        <Input id={`correccion-motivo-${venta.id}`} value={motivo} maxLength={500} disabled={pending} onChange={(event) => setMotivo(event.target.value)} placeholder="Ej.: se escaneó el sabor equivocado" className="h-11 w-full min-w-0 rounded-xl" />
      </label>
      <label className="flex min-w-0 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={confirmo} disabled={pending} onChange={(event) => setConfirmo(event.target.checked)} />
        <span className="min-w-0 break-words">Confirmo la corrección. La venta original y su cobro quedan registrados.</span>
      </label>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-2" data-testid="correccion-acciones">
        <Button type="submit" disabled={!listo || pending} className="h-auto min-h-11 w-full whitespace-normal rounded-xl px-4 py-2 font-bold leading-snug">{pending ? "Guardando…" : "Confirmar corrección"}</Button>
        <Button type="button" variant="outline" disabled={pending} className="min-h-11 w-full rounded-xl" onClick={onCancel}>Volver</Button>
      </div>
    </form>
  )
}


// ---------------------------------------------------------------------------
// Owner: operations history
// ---------------------------------------------------------------------------

export function OwnerDevolucionesHistorial({ url, queryKey }: { url: string; queryKey: readonly unknown[] }) {
  const [dias, setDias] = useState(7)
  const query = useQuery<DevolucionRegistrada[]>({
    queryKey: [...queryKey, dias],
    queryFn: async () => {
      const hasta = new Date()
      hasta.setHours(24, 0, 0, 0)
      const desde = new Date(hasta.getTime() - dias * 86_400_000)
      const response = await fetch(`${url}?${new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() })}`, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error ?? "No se pudieron cargar las devoluciones.")
      return json.devoluciones
    },
  })
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Anulaciones y devoluciones</p>
        <select value={dias} onChange={(event) => setDias(Number(event.target.value))} className="h-9 rounded-lg border border-input bg-background px-2 text-xs" aria-label="Período">
          <option value={1}>Hoy</option>
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
        </select>
      </div>
      {query.isLoading ? <p className="py-4 text-center text-sm text-muted-foreground">Cargando…</p>
        : query.isError ? <p role="alert" className="text-sm text-destructive">{(query.error as Error).message}</p>
          : (query.data ?? []).length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Sin anulaciones ni devoluciones en el período.</p>
            : <div className="space-y-1.5">{query.data!.map((d) => (
              <div key={d.id} className="min-w-0 space-y-0.5 rounded-xl border p-2 text-xs">
                <p className="flex flex-wrap items-center justify-between gap-1 font-semibold">
                  <span>{d.tipo === "ANULACION" ? "Anulación" : "Devolución parcial"} · #{d.ventaReferencia} · {formatPrice(d.importe)}</span>
                  <span className="font-normal text-muted-foreground">{new Date(d.createdAt).toLocaleString("es-AR")}</span>
                </p>
                <p className="break-words">{d.items.map((item) => `${item.cantidad} × ${item.nombre}`).join(", ")}</p>
                <p className="break-words text-muted-foreground">Registró: {d.registradaPor ?? "—"} · Motivo: {d.motivo}</p>
                <p className={cn("break-words", d.reintegroEstado === "PENDIENTE" && "font-semibold text-amber-700 dark:text-amber-300")}>Dinero: {d.reintegroDescripcion}</p>
              </div>
            ))}</div>}
    </div>
  )
}
