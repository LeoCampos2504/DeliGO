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
// 2026-11-11 (operator): one primary action, «Gestionar venta»
// (caja-cambios.tsx), edits what the customer brings back and takes instead;
// the operation (return or exchange) is inferred. «Anular venta» stays an
// explicit, separate action and the owner's F4-B correction is a secondary
// «Corregir un error de registro». The linked additional sale is no longer
// offered (a new purchase is a normal sale); existing links stay visible.

import { useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftRight, History, Minus, PencilLine, Plus, RotateCcw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn, formatPrice } from "@/lib/utils"
import { leerIntento } from "@/lib/caja-intento-comercial"
import { importeEstimado } from "@/lib/caja-devolucion-estimado"
import { useIdempotentPost } from "@/components/business/caja-post-idempotente"
import { DestinoEfectivo, MedioReintegroSelector, type MedioReintegro } from "@/components/business/caja-medio-reintegro"
import { CadenaVenta, GestionarVenta, IntentosSinResolver, etiquetaMetodoVenta, type CajaComercialEndpoints } from "@/components/business/caja-cambios"

export { importeEstimado }

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
  /** F4-B, owner only: the owner's catalog, to offer products whose CURRENT price equals the charged price. */
  productosUrl?: string
  /** F4-C5: exchanges of this host (absent = «Gestionar venta» only registers returns). */
  comercial?: CajaComercialEndpoints
  /** Takes the operator to the normal selling view (a new purchase is a new sale). */
  irAVender?: () => void
}

export type EstadoDevolucionVenta = "VIGENTE" | "DEVOLUCION_PARCIAL" | "ANULADA" | "DEVUELTA_TOTAL"

export interface VentaDevolucionItem {
  id: string
  productoId?: string | null
  productoVarianteId?: string | null
  corregida?: boolean
  /** F4-B (2026-11-05): earlier-rule correction that named another product at this line's charged price. */
  precioHeredado?: boolean
  /** Justification recorded for the current line (null: own product, or earlier rule). */
  criterioPrecio?: string | null
  /** Original sale line (source of the replacements justified at this charged price). */
  original?: { productoId: string | null; productoVarianteId: string | null; nombre: string; varianteNombre: string | null }
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
  /** F4-C5: money actually refundable (returned − compensated by an exchange). */
  importeReintegrable?: number
  /** F4-C5: the exchange this return belongs to, if any. */
  cambioId?: string | null
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
  // F4-C5 (read only)
  vinculo?: { tipo: string; ventaOrigenId: string; ventaOrigenReferencia: string } | null
  cambiosComoOrigen?: Array<{ id: string; ventaNuevaId: string; ventaNuevaReferencia: string; createdAt: string; liquidacion: string }>
  cambioComoNueva?: { id: string; ventaOrigenId: string; ventaOrigenReferencia: string; createdAt: string } | null
  ventasAdicionales?: Array<{ id: string; referencia: string; createdAt: string; total: number; metodoPago: string }>
}

export interface CorreccionRegistrada {
  id: string
  secuencia: number
  motivo: string
  createdAt: string
  registradaPor: string
  total: number
  cambios: Array<{ ventaItemId: string; precio: number; criterioPrecio?: string | null; verificacionCatalogo?: { precio: number; consultadoEn: string } | null; antes: { nombre: string; cantidad: number }; despues: { nombre: string; cantidad: number } }>
}

// The refund method is always chosen explicitly (caja-medio-reintegro.tsx): never preselected.
type Medio = MedioReintegro
type ModoReintegro = "REALIZADO" | "PENDIENTE" | "NO_CORRESPONDE"

export const ESTADO_LABEL: Record<EstadoDevolucionVenta, string> = {
  VIGENTE: "Vigente",
  DEVOLUCION_PARCIAL: "Devolución parcial",
  ANULADA: "Anulada",
  DEVUELTA_TOTAL: "Devuelta por completo",
}
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

export function CajaVentasHistorial({ endpoints, titulo = "Ventas anteriores: gestionar, devolver o anular" }: { endpoints: CajaDevolucionesEndpoints; titulo?: string }) {
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
      {endpoints.comercial && <IntentosSinResolver key={ventaId ?? ""} contexto={endpoints.comercial.contexto} onRevisar={setVentaId} />}
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
                        <VinculoBadge venta={venta} />
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        #{venta.referencia} · {etiquetaMetodoVenta(venta.metodoPago)}{venta.totalDevuelto > 0 ? ` · neto ${formatPrice(venta.totalNeto)}` : ""}
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

/**
 * The ONE sale detail, used by the owner's «Ventas recientes» and «Ventas
 * anteriores» and by the cashier's history: it always opens on the detail;
 * «Gestionar venta» opens the editor and «Volver» comes back to this detail.
 */
export function VentaDevolucionesDialog({ ventaId, endpoints, onClose }: { ventaId: string; endpoints: CajaDevolucionesEndpoints; onClose: () => void }) {
  const [modo, setModo] = useState<"detalle" | "GESTIONAR" | "ANULACION" | "CORRECCION">("detalle")
  const [verCadena, setVerCadena] = useState(false)
  const invalidar = useInvalidate(endpoints)
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
  const comercial = endpoints.comercial
  // F4-C5: an attempt of THIS context on this sale without a safe result blocks a new equivalent operation.
  const intentoPendiente = comercial && venta ? leerIntento(comercial.contexto, venta.id) : null
  const irAVender = endpoints.irAVender ? () => { onClose(); endpoints.irAVender!() } : undefined

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        // Width relative to the viewport (containing block of the fixed dialog), never 100vw (scrollbars, zoom).
        "max-h-[92dvh] w-[calc(100%-1rem)] gap-3 overflow-y-auto rounded-2xl p-4 sm:p-5",
        modo === "GESTIONAR" ? "max-w-xl sm:max-w-xl" : "max-w-md sm:max-w-md"
      )}>
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>{modo === "ANULACION" ? "Anular venta" : modo === "GESTIONAR" ? "Gestionar venta" : modo === "CORRECCION" ? "Corregir un error de registro" : "Detalle de venta"}{venta ? ` #${venta.referencia}` : ""}</DialogTitle>
          {modo === "GESTIONAR" && venta && <p className="text-xs text-muted-foreground">{new Date(venta.createdAt).toLocaleString("es-AR")} · {etiquetaMetodoVenta(venta.metodoPago)} · total {formatPrice(venta.total)}</p>}
          <DialogDescription className="sr-only">Detalle de la venta, devoluciones realizadas y acciones disponibles.</DialogDescription>
        </DialogHeader>
        {query.isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
          : query.isError || !venta ? <p role="alert" className="break-words text-sm text-destructive">{(query.error as Error | null)?.message ?? "No se pudo cargar la venta."}</p>
            : modo === "detalle" ? (
              <div className="min-w-0 space-y-3">
                {aviso && <p role="status" className="break-words rounded-xl bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{aviso}</p>}
                {intentoPendiente && (
                  <div role="alert" className="min-w-0 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                    <p className="font-semibold">Hay un {intentoPendiente.tipo === "CAMBIO" ? "cambio" : "registro de venta vinculada"} de esta venta sin resultado confirmado.</p>
                    <Button type="button" size="sm" className="rounded-xl" onClick={() => { setAviso(null); setModo("GESTIONAR") }}>Verificar operación</Button>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{new Date(venta.createdAt).toLocaleString("es-AR")} · {etiquetaMetodoVenta(venta.metodoPago)}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <EstadoDevolucionBadge estado={venta.estadoDevolucion} />
                    {venta.corregida && <CorregidaBadge />}
                    <VinculoBadge venta={venta} />
                  </span>
                </div>
                <VinculosVenta venta={venta} />
                <div className="space-y-2">
                  {venta.items.filter((item) => item.cantidad > 0).map((item) => (
                    <div key={item.id} className="flex min-w-0 items-start justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{nombreItem(item)}</p>
                        <p className="text-xs text-muted-foreground">{item.cantidad} × {formatPrice(item.precio)}</p>
                        {item.cantidadDevuelta > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">Devueltas: {item.cantidadDevuelta} ({formatPrice(item.importeDevuelto)})</p>}
                        {item.precioHeredado && <p className="break-words text-xs font-medium text-amber-700 dark:text-amber-300">Precio heredado de {item.original ? nombreItem(item.original) : "otro producto"} (corrección con la regla anterior): no corresponde a este producto. Revisalo antes de devolver.</p>}
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
                {comercial && tieneVinculos(venta) && (
                  <div className="space-y-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setVerCadena((v) => !v)}><History className="mr-1 h-4 w-4" />{verCadena ? "Ocultar historial vinculado" : "Ver historial vinculado"}</Button>
                    {verCadena && <CadenaVenta url={comercial.cadenaUrl(venta.id)} />}
                  </div>
                )}
                {(venta.correcciones ?? []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Correcciones del dueño</p>
                    {venta.correcciones!.map((correccion) => <CorreccionCard key={correccion.id} correccion={correccion} />)}
                  </div>
                )}
                {quedan ? (
                  <div className="flex flex-col gap-2" data-testid="venta-acciones">
                    <Button type="button" className="h-auto min-h-11 w-full whitespace-normal rounded-xl font-bold" onClick={() => { setAviso(null); setModo("GESTIONAR") }}><ArrowLeftRight className="mr-1 h-4 w-4 shrink-0" />Gestionar venta</Button>
                    <p className="text-center text-[11px] text-muted-foreground">Devoluciones y cambios de productos</p>
                    <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => { setAviso(null); setModo("ANULACION") }}><RotateCcw className="mr-1 h-4 w-4 shrink-0" />Anular venta</Button>
                  </div>
                ) : <p className="text-xs text-muted-foreground">No quedan productos por devolver en esta venta. Para vender algo más, registrá una venta nueva desde «Vender».</p>}
                {corregible && (
                  <button type="button" className="mx-auto flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => { setAviso(null); setModo("CORRECCION") }}><PencilLine className="h-3.5 w-3.5 shrink-0" />Corregir un error de registro</button>
                )}
                <Button type="button" variant="secondary" className="min-h-11 w-full rounded-xl" onClick={onClose}>Cerrar</Button>
              </div>
            ) : modo === "GESTIONAR" ? (
              <GestionarVenta
                venta={venta}
                devolucionUrl={endpoints.ventaUrl(venta.id)}
                ownerRegistersUrl={endpoints.ownerRegistersUrl}
                comercial={comercial}
                irAVender={irAVender}
                onCerrar={() => { setModo("detalle"); invalidar() }}
                onActualizar={invalidar}
                onDevuelto={(message) => { setAviso(message); setModo("detalle") }}
              />
            ) : modo === "CORRECCION" ? (
              <CorreccionForm
                venta={venta}
                endpoints={endpoints}
                onCancel={() => setModo("detalle")}
                onDone={(message) => { setAviso(message); setModo("detalle") }}
              />
            ) : modo === "ANULACION" ? (
              <DevolucionForm
                key={modo}
                venta={venta}
                tipo={modo}
                endpoints={endpoints}
                onCancel={() => setModo("detalle")}
                onDone={(message) => { setAviso(message); setModo("detalle") }}
              />
            ) : null}
      </DialogContent>
    </Dialog>
  )
}

function tieneVinculos(venta: VentaConDevoluciones) {
  return Boolean(venta.vinculo) || (venta.cambiosComoOrigen ?? []).length > 0 || (venta.ventasAdicionales ?? []).length > 0
}

export function VinculoBadge({ venta }: { venta: Pick<VentaConDevoluciones, "vinculo" | "cambiosComoOrigen"> }) {
  if (venta.vinculo?.tipo === "CAMBIO") return <span className="inline-flex shrink-0 items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900 dark:bg-violet-950/50 dark:text-violet-200">Por cambio</span>
  if (venta.vinculo?.tipo === "ADICIONAL") return <span className="inline-flex shrink-0 items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900 dark:bg-violet-950/50 dark:text-violet-200">Venta vinculada</span>
  if ((venta.cambiosComoOrigen ?? []).length > 0) return <span className="inline-flex shrink-0 items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900 dark:bg-violet-950/50 dark:text-violet-200">Cambiada</span>
  return null
}

function VinculosVenta({ venta }: { venta: VentaConDevoluciones }) {
  if (!tieneVinculos(venta)) return null
  return (
    <div className="min-w-0 space-y-0.5 rounded-xl bg-muted/40 p-2 text-xs" data-testid="vinculos-venta">
      {venta.vinculo && <p className="break-words">{venta.vinculo.tipo === "CAMBIO" ? `Viene del cambio de la venta #${venta.vinculo.ventaOrigenReferencia}.` : `Venta adicional vinculada a #${venta.vinculo.ventaOrigenReferencia}.`}</p>}
      {(venta.cambiosComoOrigen ?? []).map((c) => <p key={c.id} className="break-words">Se cambió por la venta #{c.ventaNuevaReferencia} ({new Date(c.createdAt).toLocaleString("es-AR")}).</p>)}
      {(venta.ventasAdicionales ?? []).map((v) => <p key={v.id} className="break-words">Venta adicional #{v.referencia}: {formatPrice(v.total)} ({etiquetaMetodoVenta(v.metodoPago)}).</p>)}
    </div>
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
          {cambio.antes.cantidad} × {cambio.antes.nombre} → {cambio.despues.cantidad} × {cambio.despues.nombre} ({formatPrice(cambio.precio)} c/u, precio cobrado){!cambio.criterioPrecio && cambio.antes.nombre !== cambio.despues.nombre ? " · precio heredado (regla anterior)" : ""}{cambio.verificacionCatalogo ? ` · precio de catálogo al corregir: ${formatPrice(cambio.verificacionCatalogo.precio)} (comprobado ${new Date(cambio.verificacionCatalogo.consultadoEn).toLocaleString("es-AR")}); coincidencia en ese momento, no prueba el precio al vender` : ""}
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
        <span>{devolucion.cambioId ? `Devolución por cambio · valor devuelto ${formatPrice(devolucion.importe)}` : `${devolucion.tipo === "ANULACION" ? "Anulación" : "Devolución parcial"} · ${formatPrice(devolucion.importe)}`}</span>
        <span className="font-normal text-muted-foreground">{new Date(devolucion.createdAt).toLocaleString("es-AR")}</span>
      </p>
      <p className="break-words">{devolucion.items.map((item) => `${item.cantidad} × ${item.nombre} (${STOCK_LABEL[item.stockResultado] ?? item.stockResultado})`).join(", ")}</p>
      <p className="break-words text-muted-foreground">Motivo: {devolucion.motivo}{devolucion.registradaPor ? ` · Registró: ${devolucion.registradaPor}` : ""}</p>
      <p className={cn("break-words", devolucion.reintegroEstado === "PENDIENTE" && "font-semibold text-amber-700 dark:text-amber-300")}>
        {devolucion.cambioId && devolucion.importeReintegrable !== undefined && devolucion.importeReintegrable !== devolucion.importe ? `Compensado con lo que se llevó (crédito interno, no es dinero): ${formatPrice(devolucion.importe - devolucion.importeReintegrable)}. A reintegrar en dinero: ${formatPrice(devolucion.importeReintegrable)}. ` : ""}Dinero{devolucion.cambioId ? " (diferencia del cambio)" : ""}: {devolucion.reintegroDescripcion}{devolucion.reintegroRegistradoPor && devolucion.reintegroEstado === "REALIZADO" ? ` (${devolucion.reintegroRegistradoPor})` : ""}
      </p>
      {devolucion.reintegroEstado === "PENDIENTE" && <ReintegroPendienteForm devolucion={devolucion} endpoints={endpoints} />}
    </div>
  )
}

// Shared submit helper (one key per canonical body, kept for 5xx / network):
// src/components/business/caja-post-idempotente.ts

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
  if (registers.length <= 1) return null // named (or "no register") by DestinoEfectivo
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
  const [medio, setMedio] = useState<Medio | null>(null) // explicit choice: never the sale's method by default
  const [caja, setCaja] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const post = useIdempotentPost()
  const invalidate = useInvalidate(endpoints)
  const registers = useOpenRegisters(endpoints.ownerRegistersUrl, abierto && medio === "EFECTIVO")
  const necesitaCaja = medio === "EFECTIVO" && (registers.data?.length ?? 0) > 1
  const listo = medio !== null && confirmo && !(necesitaCaja && !caja)
  const mutation = useMutation({
    mutationFn: async () => {
      if (medio === null) throw new Error("Elegí cómo devolvés el dinero.")
      const result = await post(endpoints.reintegroUrl(devolucion.id), { medio, confirmo: true, ...(endpoints.ownerRegistersUrl && caja && medio === "EFECTIVO" ? { cajaFisicaId: caja } : {}) })
      if (!result.ok) throw new Error(result.message)
    },
    onMutate: () => setError(null),
    onSettled: () => { inFlight.current = false },
    onSuccess: () => { setAbierto(false); invalidate() },
    onError: (failure: Error) => { setError(failure.message); invalidate() },
  })
  // F4-C5: the money to hand back is the refundable amount (an exchange compensates part of it).
  const aReintegrar = devolucion.importeReintegrable ?? devolucion.importe
  if (!abierto) return <Button type="button" variant="outline" className="h-auto min-h-10 w-full whitespace-normal rounded-xl text-xs" onClick={() => setAbierto(true)}>Registrar reintegro ({formatPrice(aReintegrar)})</Button>
  return (
    <form
      className="min-w-0 space-y-2 border-t pt-2"
      onSubmit={(event) => { event.preventDefault(); if (!listo || inFlight.current) return; inFlight.current = true; mutation.mutate() }}
    >
      <MedioReintegroSelector
        value={medio}
        onChange={setMedio}
        disabled={mutation.isPending}
        metodoVenta={devolucion.metodoPagoVenta}
        destinoEfectivo={<DestinoEfectivo owner={Boolean(endpoints.ownerRegistersUrl)} registros={registers.data} />}
      />
      {medio === "EFECTIVO" && endpoints.ownerRegistersUrl && registers.data && <RegisterChoice registers={registers.data} value={caja} onChange={setCaja} disabled={mutation.isPending} />}
      <label className="flex min-w-0 items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={confirmo} onChange={(event) => setConfirmo(event.target.checked)} disabled={mutation.isPending} /><span className="min-w-0 break-words">Confirmo que devolví {formatPrice(aReintegrar)} al cliente.</span></label>
      {error && <p role="alert" className="break-words text-xs text-destructive">{error}</p>}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={!listo || mutation.isPending} className="h-auto min-h-10 w-full whitespace-normal rounded-xl">{mutation.isPending ? "Registrando…" : "Confirmar reintegro"}</Button>
        <Button type="button" variant="outline" disabled={mutation.isPending} className="min-h-10 w-full rounded-xl" onClick={() => { setAbierto(false); setError(null) }}>Cancelar</Button>
      </div>
    </form>
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
  const [medio, setMedio] = useState<Medio | null>(null) // explicit choice: never the sale's method by default
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
  const faltaMedio = modoReintegro === "REALIZADO" && medio === null
  const listo = seleccionadas.length > 0 && !faltaStock && motivo.trim().length > 0 && modoReintegro !== null && !faltaMedio && confirmo && !(necesitaCaja && !caja)

  const mutation = useMutation({
    mutationFn: async () => {
      if (modoReintegro === "REALIZADO" && medio === null) throw new Error("Elegí cómo devolvés el dinero.")
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
          <MedioReintegroSelector
            value={medio}
            onChange={setMedio}
            disabled={pending}
            metodoVenta={venta.metodoPago}
            destinoEfectivo={<DestinoEfectivo owner={Boolean(endpoints.ownerRegistersUrl)} registros={registers.data} />}
          />
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

type LineaEditable = { ventaItemId: string; productoId: string; varianteId: string; cantidad: number }

/** Product key as the server compares it (product + variant; "" = none). */
export function claveProducto(productoId: string | null | undefined, varianteId: string | null | undefined): string {
  return `${productoId ?? ""}|${varianteId ?? ""}`
}

/** A sellable catalog entry (product without active variants, or one active variant) with its CURRENT price. */
export interface EntradaCatalogo { key: string; nombre: string; varianteNombre: string | null; precio: number }

export interface ProductoCatalogoCorreccion {
  id: string
  nombre: string
  precio: number
  eliminado?: boolean
  variantes?: Array<{ id: string; nombre: string; precio: number; activo?: boolean }>
}

/** Owner catalog → entries enabled for Caja (not deleted; active variants only, like a Caja sale). */
export function entradasCatalogo(productos: ReadonlyArray<ProductoCatalogoCorreccion>): EntradaCatalogo[] {
  const entradas: EntradaCatalogo[] = []
  for (const p of productos) {
    if (p.eliminado) continue
    const activas = (p.variantes ?? []).filter((v) => v.activo !== false)
    if (activas.length > 0) {
      for (const v of activas) entradas.push({ key: claveProducto(p.id, v.id), nombre: p.nombre, varianteNombre: v.nombre, precio: v.precio })
    } else {
      entradas.push({ key: claveProducto(p.id, null), nombre: p.nombre, varianteNombre: null, precio: p.precio })
    }
  }
  return entradas.sort((a, b) => nombreItem(a).localeCompare(nombreItem(b), "es"))
}

export type FuenteOpcion = "VENTA" | "CATALOGO" | "VERIFICADO"

/**
 * F4-B — products a line may name at ITS charged price (same rule the server and
 * SQL enforce): its own original product; another original product of the same
 * sale charged at exactly that unit price; a product/variant whose CURRENT
 * catalog price equals the charged price exactly (operator decision 2026-11-04);
 * or the line's current product when an earlier correction already verified it
 * against the catalog. The server re-checks everything.
 */
export function opcionesCorreccion(items: ReadonlyArray<VentaDevolucionItem>, item: VentaDevolucionItem, catalogo: ReadonlyArray<EntradaCatalogo> = []) {
  const vistas = new Map<string, { key: string; etiqueta: string; fuente: FuenteOpcion }>()
  const fuentes = [item, ...items.filter((otro) => otro.id !== item.id && otro.precio === item.precio)]
  for (const fuente of fuentes) {
    const original = fuente.original ?? { productoId: fuente.productoId ?? null, productoVarianteId: fuente.productoVarianteId ?? null, nombre: fuente.nombre, varianteNombre: fuente.varianteNombre }
    const key = claveProducto(original.productoId, original.productoVarianteId)
    if (!vistas.has(key)) vistas.set(key, { key, etiqueta: nombreItem(original), fuente: "VENTA" })
  }
  if (item.criterioPrecio === "PRECIO_CATALOGO_ACTUAL") {
    const key = claveProducto(item.productoId, item.productoVarianteId)
    if (!vistas.has(key)) vistas.set(key, { key, etiqueta: `${nombreItem(item)} (verificado con el catálogo al corregir)`, fuente: "VERIFICADO" })
  }
  for (const entrada of catalogo) {
    if (entrada.precio !== item.precio || vistas.has(entrada.key)) continue
    vistas.set(entrada.key, { key: entrada.key, etiqueta: `${nombreItem(entrada)} (catálogo actual ${formatPrice(entrada.precio)})`, fuente: "CATALOGO" })
  }
  return [...vistas.values()]
}

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
  const itemPorId = new Map(venta.items.map((item) => [item.id, item]))
  const catalogoQuery = useQuery<EntradaCatalogo[]>({
    queryKey: [...endpoints.queryScope, "catalogo-correccion"],
    enabled: Boolean(endpoints.productosUrl),
    queryFn: async () => {
      const response = await fetch(endpoints.productosUrl!, { cache: "no-store" })
      const json = await response.json().catch(() => [])
      if (!response.ok) throw new Error("No se pudo cargar el catálogo.")
      return entradasCatalogo(Array.isArray(json) ? json : (json.productos ?? []))
    },
  })
  const catalogo = catalogoQuery.data ?? []

  const corregido = Math.round(lineas.reduce((acc, l) => acc + subtotalCorreccion(itemPorId.get(l.ventaItemId)!.precio, l.cantidad), 0) * 100) / 100
  const totalOk = Math.abs(corregido - venta.total) < 0.005
  const hayCambios = lineas.some((l) => {
    const item = itemPorId.get(l.ventaItemId)!
    return l.productoId !== (item.productoId ?? "") || l.varianteId !== (item.productoVarianteId ?? "") || l.cantidad !== item.cantidad
  })
  const faltaJustificar = lineas.some((l) => !opcionesCorreccion(venta.items, itemPorId.get(l.ventaItemId)!, catalogo).some((o) => o.key === claveProducto(l.productoId, l.varianteId)))
  const listo = hayCambios && totalOk && !faltaJustificar && motivo.trim().length > 0 && confirmo

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
        Sólo para errores de registro: la venta se cargó mal, pero lo que el cliente se llevó y pagó no cambió. Si el cliente devolvió o cambió productos, usá «Gestionar venta». Corregí el producto, la variante o la cantidad que realmente se entregó. Cada línea conserva el precio que se cobró y sólo puede tomar un producto justificado a ese precio: otro de esta venta cobrado igual, o uno cuyo precio de catálogo actual sea exactamente el cobrado. El total debe seguir siendo {formatPrice(venta.total)}: no se mueve dinero. Un cambio real de productos con diferencia de precio, o una combinación de productos, no es una corrección.
      </p>
      {catalogoQuery.isError && <p role="alert" className="break-words text-sm text-destructive">No se pudo cargar el catálogo: sólo se ofrecen productos de esta venta.</p>}
      <div className="space-y-2">
        {lineas.map((linea) => {
          const item = itemPorId.get(linea.ventaItemId)!
          const opciones = opcionesCorreccion(venta.items, item, catalogo)
          const actual = claveProducto(linea.productoId, linea.varianteId)
          const elegida = opciones.find((o) => o.key === actual)
          const justificada = Boolean(elegida)
          return (
            <div key={linea.ventaItemId} className="min-w-0 space-y-2 rounded-xl border p-2" data-testid="correccion-linea">
              <p className="break-words text-xs text-muted-foreground">Registrado: {item.cantidad} × {nombreItem(item)} · {formatPrice(item.precio)} c/u cobrado</p>
              <label className="block min-w-0 space-y-1 text-sm font-medium">
                <span>Producto entregado</span>
                <select
                  value={actual}
                  disabled={pending}
                  onChange={(event) => { const [productoId, varianteId] = event.target.value.split("|"); set(linea.ventaItemId, { productoId, varianteId }) }}
                  className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm"
                  aria-label={`Producto entregado en lugar de ${nombreItem(item)}`}
                >
                  {!justificada && <option value={actual}>{nombreItem(item)} (precio heredado: elegí otro)</option>}
                  {opciones.map((o) => <option key={o.key} value={o.key}>{o.etiqueta}</option>)}
                </select>
              </label>
              {!justificada && <p role="alert" className="break-words text-xs text-destructive">Esta línea quedó con un producto que no corresponde a su precio cobrado (regla anterior). Elegí un producto de esta venta cobrado a {formatPrice(item.precio)} o uno cuyo precio de catálogo actual sea {formatPrice(item.precio)}.</p>}
              {elegida?.fuente === "CATALOGO" && <p className="break-words text-xs text-amber-700 dark:text-amber-300">Su precio de catálogo actual coincide con el cobrado ({formatPrice(item.precio)}). Se registrará el precio consultado y el momento de la comprobación; esto no demuestra el precio que tenía al momento de la venta.</p>}
              {opciones.length === 1 && justificada && !catalogoQuery.isLoading && <p className="break-words text-xs text-muted-foreground">Sólo se puede corregir la cantidad: ningún otro producto de esta venta ni del catálogo tiene hoy el precio {formatPrice(item.precio)}.</p>}
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
      {!totalOk && <p role="status" className="break-words text-xs text-destructive">El total corregido debe ser igual al cobrado. Si el cliente devolvió o cambió productos, usá «Gestionar venta».</p>}
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
