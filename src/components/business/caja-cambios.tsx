"use client"

// ============================================
// «Gestionar venta» — returns and commercial exchanges in ONE editor
// (owner + cashier, same UI)
// ============================================
// One component for both hosts: each passes its OWN endpoints (a cashier never
// calls an owner API) and its own catalog. The operator edits the sale the way
// it happened at the counter — lowers what the customer brings back, adds what
// the customer takes instead — and the operation is INFERRED (operator,
// 2026-11-11), never asked:
//   - something comes back, nothing is added → F4-A return (partial, or of
//     every remaining unit — never an automatic void);
//   - something comes back and something is added → F4-C exchange (one atomic
//     server operation: return + linked CAMBIO sale + settlement);
//   - only additions → nothing is registered here: a new purchase is a normal
//     sale («Vender»); the linked additional sale is no longer offered;
//   - no change → nothing can be confirmed.
// The server decides prices, amounts, stock, shifts and permissions; this UI
// only collects choices. Exchange rules kept from F4-C5 (operator, 2026-11-09):
//   - any change of what goes out or comes in invalidates the quote (the
//     quote is now requested automatically after each change instead of with
//     a button); the confirmation sends the quoted amounts (`esperado`)
//     EXACTLY as the server returned them (never recomputed);
//   - P1 warnings are informative, never block;
//   - every exchange confirmation is an attempt stored on this device BEFORE it
//     is sent (src/lib/caja-intento-comercial.ts). An uncertain attempt blocks a
//     new equivalent operation on that sale until «Verificar operación» (same
//     key, same body, never performs it) returns a SAFE result. Attempts of the
//     retired linked additional sale stored earlier are still verified.

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, History, Minus, Plus, RefreshCw, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { addCartLine, cartTotal, setCartLineQuantity, type CartLine } from "@/lib/caja-venta"
import { importeEstimado } from "@/lib/caja-devolucion-estimado"
import { cn, formatPrice } from "@/lib/utils"
import {
  clasificarConfirmacion,
  clasificarVerificacion,
  guardarIntento,
  intentoVencido,
  leerIntento,
  listarIntentos,
  retirarIntento,
  type ContextoIntentoComercial,
  type IntentoComercial,
  type TipoIntentoComercial,
} from "@/lib/caja-intento-comercial"
import { CatalogoCompacto, type CatalogoFuente } from "@/components/business/caja-catalogo-compacto"
import { useIdempotentPost } from "@/components/business/caja-post-idempotente"
import type { VentaConDevoluciones, VentaDevolucionItem } from "@/components/business/caja-devoluciones"

/** Props of the selling view in selection mode (caja-tab.tsx); kept for that view. */
export interface SelectorProductosProps {
  etiqueta: string
  inicial: CartLine[]
  onConfirmar: (cart: CartLine[]) => void
}

export interface CajaComercialEndpoints {
  contexto: ContextoIntentoComercial
  cambioUrl: (ventaId: string) => string
  cotizacionUrl: (ventaId: string) => string
  verificarCambioUrl: (ventaId: string) => string
  /** Retired linked additional sale: only verifies attempts stored earlier on this device. */
  verificarAdicionalUrl: (ventaId: string) => string
  cadenaUrl: (ventaId: string) => string
  /** Owner only: registers with an open shift (where cash comes in / goes out). */
  ownerRegistersUrl?: string
  /** The host's own catalog, for the replacement products (absent = returns only). */
  catalogo?: CatalogoFuente
}

type Medio = "EFECTIVO" | "TRANSFERENCIA" | "OTRO"
const MEDIOS: Array<[Medio, string]> = [["EFECTIVO", "Efectivo"], ["TRANSFERENCIA", "Transferencia"], ["OTRO", "Otro medio"]]

export function etiquetaMetodoVenta(metodo: string): string {
  return metodo === "EFECTIVO" ? "Efectivo" : metodo === "TRANSFERENCIA" ? "Transferencia" : metodo === "OTRO" ? "Otro medio" : metodo === "CAMBIO" ? "Cambio" : metodo
}

/** Display only: the server sends exact decimal strings ("2000.00"). */
const pesos = (value: string | number | undefined | null) => formatPrice(Number(value ?? 0))
const nombreLinea = (l: { nombre: string; varianteNombre?: string | null }) => (l.varianteNombre ? `${l.nombre} — ${l.varianteNombre}` : l.nombre)
const round2 = (value: number) => Math.round(value * 100) / 100

interface Cotizacion {
  importes: { salida: string; entrada: string; credito: string; diferenciaCobrada: string; diferenciaReintegro: string }
  liquidacion: "SIN_DIFERENCIA" | "COBRO" | "REINTEGRO"
  advertenciasTexto: string[]
  salen: Array<{ ventaItemId: string; nombre: string; cantidad: number; importe: string }>
  entran: Array<{ nombre: string; varianteNombre: string | null; cantidad: number; subtotal: string }>
}

type Resultado =
  | { tipo: "CAMBIO"; replayed: boolean; cambio: { ventaNuevaReferencia: string; ventaOrigenReferencia: string; importes: Cotizacion["importes"]; liquidacion: Cotizacion["liquidacion"]; advertenciasTexto: string[] } }
  | { tipo: "ADICIONAL"; replayed: boolean; venta: { referencia: string; total: number; metodoPago: string } }

function resultadoDe(tipo: TipoIntentoComercial, data: Record<string, unknown>, replayed: boolean): Resultado {
  return tipo === "CAMBIO"
    ? { tipo, replayed, cambio: data.cambio as Extract<Resultado, { tipo: "CAMBIO" }>["cambio"] }
    : { tipo, replayed, venta: data.venta as Extract<Resultado, { tipo: "ADICIONAL" }>["venta"] }
}

function useOpenRegisters(url: string | undefined, enabled: boolean) {
  return useQuery<Array<{ id: string; nombre: string; responsable: string }>>({
    queryKey: ["caja-comercial-registros", url],
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

function CajaElegida({ url, enabled, value, onChange, disabled }: { url?: string; enabled: boolean; value: string; onChange: (id: string) => void; disabled: boolean }) {
  const registers = useOpenRegisters(url, enabled)
  if (!url || !enabled || !registers.data || registers.data.length <= 1) return null
  return (
    <label className="block min-w-0 space-y-1 text-sm font-medium">
      <span>¿En qué caja se mueve el efectivo?</span>
      <select aria-label="Caja del efectivo" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm">
        <option value="">Seleccioná una caja…</option>
        {registers.data.map((r) => <option key={r.id} value={r.id}>{r.nombre} — {r.responsable}</option>)}
      </select>
    </label>
  )
}

const necesitaCaja = (url: string | undefined, registros: number | undefined) => Boolean(url) && (registros ?? 0) > 1

function MedioBotones({ value, onChange, disabled, label }: { value: Medio | null; onChange: (m: Medio) => void; disabled: boolean; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-2">
      {MEDIOS.map(([m, texto]) => (
        <button key={m} type="button" aria-pressed={value === m} disabled={disabled} onClick={() => onChange(m)}
          className={cn("min-h-10 min-w-0 whitespace-normal rounded-xl border px-2 py-1.5 text-xs font-semibold", value === m ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
          {texto}
        </button>
      ))}
    </div>
  )
}

function Cantidad({ valor, max, onChange, etiqueta, disabled }: { valor: number; max?: number; onChange: (n: number) => void; etiqueta: string; disabled?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl" aria-label={`Restar una unidad de ${etiqueta}`} disabled={disabled || valor <= 0} onClick={() => onChange(valor - 1)}><Minus className="h-4 w-4" /></Button>
      <Input
        inputMode="decimal"
        aria-label={`Cantidad de ${etiqueta}`}
        value={String(valor)}
        disabled={disabled}
        onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); if (Number.isFinite(n)) onChange(n) }}
        className="h-9 w-14 min-w-0 rounded-xl px-1 text-center"
      />
      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl" aria-label={`Sumar una unidad de ${etiqueta}`} disabled={disabled || (max !== undefined && valor + 1 > max)} onClick={() => onChange(valor + 1)}><Plus className="h-4 w-4" /></Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Unresolved attempts
// ---------------------------------------------------------------------------

/** Banner of the sale history: every unresolved attempt of THIS context on this device. */
export function IntentosSinResolver({ contexto, onRevisar }: { contexto: ContextoIntentoComercial; onRevisar: (ventaId: string) => void }) {
  // Read after mount (device storage; never during server rendering).
  const [intentos, setIntentos] = useState<IntentoComercial[]>([])
  useEffect(() => { setIntentos(listarIntentos(contexto)) }, [contexto])
  if (intentos.length === 0) return null
  return (
    <div role="status" className="min-w-0 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0" />{intentos.length === 1 ? "Hay una operación sin resultado confirmado" : `Hay ${intentos.length} operaciones sin resultado confirmado`}</p>
      {intentos.map((i) => (
        <div key={i.ventaOrigenId} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 break-words">{i.tipo === "CAMBIO" ? "Cambio" : "Venta vinculada"} de la venta #{i.ventaOrigenReferencia}{intentoVencido(i) ? " · más de 7 días sin resolver" : ""}</span>
          <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => onRevisar(i.ventaOrigenId)}>Revisar</Button>
        </div>
      ))}
    </div>
  )
}

function IntentoPendiente({ intento, endpoints, onResultado, onNoRegistrado }: {
  intento: IntentoComercial
  endpoints: CajaComercialEndpoints
  onResultado: (r: Resultado) => void
  onNoRegistrado: (texto: string) => void
}) {
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [verificando, setVerificando] = useState(false)
  const [verHistorial, setVerHistorial] = useState(false)
  const enCurso = useRef(false)
  const vencido = intentoVencido(intento)

  async function verificar() {
    if (enCurso.current) return
    enCurso.current = true
    setVerificando(true)
    setMensaje(null)
    const url = intento.tipo === "CAMBIO" ? endpoints.verificarCambioUrl(intento.ventaOrigenId) : endpoints.verificarAdicionalUrl(intento.ventaOrigenId)
    let status: number | null = null
    let data: Record<string, unknown> = {}
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": intento.key }, body: intento.cuerpo })
      status = res.status
      data = await res.json().catch(() => ({}))
    } catch {
      status = null
    }
    const r = clasificarVerificacion(status, data)
    if (r === "registrado") {
      retirarIntento(endpoints.contexto, intento.ventaOrigenId)
      onResultado(resultadoDe(intento.tipo, data, true))
    } else if (r === "no_registrado" || r === "clave_usada") {
      retirarIntento(endpoints.contexto, intento.ventaOrigenId)
      onNoRegistrado(r === "no_registrado"
        ? "Verificado: la operación NO se registró y ese intento quedó cerrado. Podés gestionar la venta de nuevo."
        : "Verificado: esa clave pertenece a otra operación, así que este intento NO se registró. Podés intentarlo de nuevo.")
    } else {
      guardarIntento({ ...intento, estado: "INCIERTO", updatedAt: Date.now() })
      setMensaje(`${typeof data.error === "string" ? `${data.error} ` : ""}Todavía no se conoce el resultado: el intento se conserva. Volvé a verificar en unos segundos o revisá el historial de la venta.`)
    }
    enCurso.current = false
    setVerificando(false)
  }

  return (
    <div className="min-w-0 space-y-3" data-testid="intento-pendiente">
      <div role="alert" className="min-w-0 space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0" />Todavía no se conoce el resultado de este {intento.tipo === "CAMBIO" ? "cambio" : "registro de venta vinculada"}.</p>
        <p className="break-words text-xs">Mientras no se verifique, no se puede registrar otro cambio sobre esta venta desde este dispositivo, para no duplicarlo.</p>
        <p className="text-xs">Iniciado: {new Date(intento.createdAt).toLocaleString("es-AR")}</p>
        {vencido && <p className="text-xs font-semibold">Este intento lleva más de 7 días sin resolver: verificalo.</p>}
      </div>
      {intento.resumen.lineas.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">{intento.resumen.lineas.map((l, i) => <li key={i} className="break-words">{l}</li>)}</ul>
      )}
      {mensaje && <p role="status" className="break-words text-sm text-amber-800 dark:text-amber-200">{mensaje}</p>}
      <div className="flex flex-col gap-2">
        <Button type="button" className="h-auto min-h-11 w-full whitespace-normal rounded-xl font-bold" disabled={verificando} onClick={() => void verificar()}>
          <RefreshCw className={cn("mr-1 h-4 w-4 shrink-0", verificando && "animate-spin")} />{verificando ? "Verificando…" : "Verificar operación"}
        </Button>
        <Button type="button" variant="outline" className="min-h-11 w-full rounded-xl" onClick={() => setVerHistorial((v) => !v)}><History className="mr-1 h-4 w-4" />{verHistorial ? "Ocultar historial" : "Ver historial de la venta"}</Button>
      </div>
      {verHistorial && <CadenaVenta url={endpoints.cadenaUrl(intento.ventaOrigenId)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Money summary (what the customer brings back / takes / pays or receives)
// ---------------------------------------------------------------------------

/**
 * The internal compensation is computed by the server and kept in the history,
 * the audit and the owner's reports; here it is only an optional detail and is
 * never shown as money that comes in or goes out.
 */
function ResumenDinero({ importes, liquidacion }: { importes: Cotizacion["importes"]; liquidacion: Cotizacion["liquidacion"] }) {
  return (
    <div className="min-w-0 space-y-1" data-testid="importes-cambio">
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-2"><dt>Devuelve el cliente</dt><dd className="font-semibold">{pesos(importes.salida)}</dd></div>
        <div className="flex justify-between gap-2"><dt>Se lleva</dt><dd className="font-semibold">{pesos(importes.entrada)}</dd></div>
        <div className={cn("flex justify-between gap-2 border-t pt-1.5 text-base font-bold", liquidacion === "COBRO" && "text-emerald-700 dark:text-emerald-300", liquidacion === "REINTEGRO" && "text-amber-700 dark:text-amber-300")}>
          <dt>{liquidacion === "COBRO" ? "Cobrar al cliente" : liquidacion === "REINTEGRO" ? "Devolver al cliente" : "Sin diferencia de dinero"}</dt>
          <dd>{liquidacion === "COBRO" ? pesos(importes.diferenciaCobrada) : liquidacion === "REINTEGRO" ? pesos(importes.diferenciaReintegro) : pesos(0)}</dd>
        </div>
      </dl>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">Ver detalle</summary>
        <p className="mt-1 break-words">Se compensan {pesos(importes.credito)} entre lo que devuelve y lo que se lleva. Es una compensación interna: no es dinero que entra ni que sale de la caja.</p>
      </details>
    </div>
  )
}

function ResultadoOperacion({ resultado, onCerrar }: { resultado: Resultado; onCerrar: () => void }) {
  return (
    <div className="min-w-0 space-y-3" data-testid="resultado-operacion">
      <div role="status" className="space-y-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
        {resultado.replayed && <p className="font-semibold">Esta operación ya estaba registrada: no se aplicó dos veces.</p>}
        {resultado.tipo === "CAMBIO" ? (
          <>
            <p className="font-semibold">Cambio registrado: #{resultado.cambio.ventaOrigenReferencia} → #{resultado.cambio.ventaNuevaReferencia}</p>
            <ResumenDinero importes={resultado.cambio.importes} liquidacion={resultado.cambio.liquidacion} />
            {resultado.cambio.advertenciasTexto.length > 0 && <p className="text-xs">Para tu información: {resultado.cambio.advertenciasTexto.join(" · ")}</p>}
          </>
        ) : (
          <p className="font-semibold">Venta vinculada registrada #{resultado.venta.referencia}: {pesos(resultado.venta.total)} ({etiquetaMetodoVenta(resultado.venta.metodoPago)})</p>
        )}
      </div>
      <Button type="button" className="min-h-11 w-full rounded-xl" onClick={onCerrar}>Listo</Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chain (read only)
// ---------------------------------------------------------------------------

interface CadenaRespuesta {
  ventas: Array<{ id: string; referencia: string; createdAt: string; total: number; metodoPago: string; vinculoTipo: string | null; ventaOrigenId: string | null; anulada: boolean }>
  cambios: Array<{ id: string; ventaOrigenReferencia: string; ventaNuevaReferencia: string; createdAt: string; registradoPor: string; importes: Cotizacion["importes"]; liquidacion: Cotizacion["liquidacion"]; advertenciasTexto: string[] }>
}

export function CadenaVenta({ url }: { url: string }) {
  const query = useQuery<CadenaRespuesta>({
    queryKey: ["caja-cadena-venta", url],
    queryFn: async () => {
      const response = await fetch(url, { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error ?? "No pudimos leer el historial vinculado.")
      return json
    },
  })
  if (query.isLoading) return <p className="py-3 text-center text-sm text-muted-foreground">Cargando historial…</p>
  if (query.isError || !query.data) return <p role="alert" className="break-words text-sm text-destructive">{(query.error as Error | null)?.message ?? "No pudimos leer el historial vinculado."}</p>
  const { ventas, cambios } = query.data
  return (
    <div className="min-w-0 space-y-2 rounded-xl border p-2 text-xs" data-testid="cadena-venta">
      <p className="font-semibold text-muted-foreground">Ventas vinculadas</p>
      <ol className="space-y-1">
        {ventas.map((v) => (
          <li key={v.id} className="flex min-w-0 flex-wrap items-center justify-between gap-1">
            <span className="min-w-0 break-words">#{v.referencia} · {v.vinculoTipo === "CAMBIO" ? "por cambio" : v.vinculoTipo === "ADICIONAL" ? "venta adicional" : "venta original"}{v.anulada ? " · anulada" : ""}</span>
            <span className="text-muted-foreground">{pesos(v.total)} · {etiquetaMetodoVenta(v.metodoPago)} · {new Date(v.createdAt).toLocaleDateString("es-AR")}</span>
          </li>
        ))}
      </ol>
      {cambios.length > 0 && <>
        <p className="font-semibold text-muted-foreground">Cambios</p>
        <ol className="space-y-1">
          {cambios.map((c) => (
            <li key={c.id} className="break-words">
              #{c.ventaOrigenReferencia} → #{c.ventaNuevaReferencia} · {new Date(c.createdAt).toLocaleString("es-AR")} · {c.registradoPor} ·{" "}
              {c.liquidacion === "COBRO" ? `cobró ${pesos(c.importes.diferenciaCobrada)}` : c.liquidacion === "REINTEGRO" ? `devolvió ${pesos(c.importes.diferenciaReintegro)}` : "sin diferencia"} · compensado {pesos(c.importes.credito)} (no es dinero)
            </li>
          ))}
        </ol>
      </>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// «Gestionar venta»
// ---------------------------------------------------------------------------

export type OperacionInferida = "VACIA" | "SOLO_AGREGA" | "DEVOLUCION" | "DEVOLUCION_TOTAL" | "CAMBIO"

/** The operation follows from what the operator edited — never asked. */
export function inferirOperacion(items: ReadonlyArray<Pick<VentaDevolucionItem, "id" | "cantidadRestante">>, devuelve: Readonly<Record<string, number>>, lineasNuevas: number): OperacionInferida {
  const vuelven = items.filter((i) => (devuelve[i.id] ?? 0) > 0)
  if (vuelven.length === 0) return lineasNuevas > 0 ? "SOLO_AGREGA" : "VACIA"
  if (lineasNuevas > 0) return "CAMBIO"
  return items.every((i) => (devuelve[i.id] ?? 0) >= i.cantidadRestante) ? "DEVOLUCION_TOTAL" : "DEVOLUCION"
}

export interface GestionarVentaProps {
  venta: VentaConDevoluciones
  /** F4-A endpoint of this host: POST a return of this sale. */
  devolucionUrl: string
  /** Owner only: registers with an open shift (where cash comes in / goes out). */
  ownerRegistersUrl?: string
  /** Exchanges of this host (absent = returns only). */
  comercial?: CajaComercialEndpoints
  /** Takes the operator to the normal selling view (a new, independent sale). */
  irAVender?: () => void
  /** Back to the sale detail. */
  onCerrar: () => void
  /** Refresh the host queries after an operation (or a refusal). */
  onActualizar: () => void
  /** A return was registered: back to the detail with this message. */
  onDevuelto: (mensaje: string) => void
}

export function GestionarVenta(props: GestionarVentaProps) {
  const { venta, comercial } = props
  const [intento, setIntento] = useState<IntentoComercial | null>(() => (comercial ? leerIntento(comercial.contexto, venta.id) : null))
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(0)

  if (resultado) return <ResultadoOperacion resultado={resultado} onCerrar={props.onCerrar} />
  if (intento && comercial) {
    return (
      <IntentoPendiente
        intento={intento}
        endpoints={comercial}
        onResultado={(r) => { setIntento(null); setResultado(r); props.onActualizar() }}
        onNoRegistrado={(texto) => { setIntento(null); setAviso(texto); setNuevo((n) => n + 1); props.onActualizar() }}
      />
    )
  }
  return (
    <GestionarVentaForm
      key={nuevo}
      {...props}
      aviso={aviso}
      onIncierto={() => setIntento(comercial ? leerIntento(comercial.contexto, venta.id) : null)}
      onCambioRegistrado={(r) => { setResultado(r); props.onActualizar() }}
    />
  )
}

/** Stores the attempt, sends it once, classifies the answer. */
function useConfirmar(venta: VentaConDevoluciones, endpoints: CajaComercialEndpoints | undefined, p: { onIncierto: () => void; onRegistrado: (r: Resultado) => void }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enCurso = useRef(false)
  async function confirmar(tipo: TipoIntentoComercial, url: string, body: unknown, resumen: IntentoComercial["resumen"]): Promise<{ code?: string } | null> {
    if (!endpoints || enCurso.current) return null
    enCurso.current = true
    setError(null)
    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setError("Sin conexión a internet: no se envió nada. Cuando vuelva la conexión, confirmá de nuevo.")
        return null
      }
      const ahora = Date.now()
      const intento: IntentoComercial = { v: 1, tipo, ...endpoints.contexto, ventaOrigenId: venta.id, ventaOrigenReferencia: venta.referencia, key: newIdempotencyKey(), cuerpo: JSON.stringify(body), resumen, estado: "ENVIANDO", createdAt: ahora, updatedAt: ahora }
      // BEFORE sending: if the attempt cannot be kept, nothing is sent.
      if (!guardarIntento(intento)) {
        setError("No pudimos guardar el intento en este dispositivo, así que NO se envió nada. Habilitá el almacenamiento del navegador e intentá de nuevo.")
        return null
      }
      setEnviando(true)
      let status: number | null = null
      let replayed = false
      let data: Record<string, unknown> = {}
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": intento.key }, body: intento.cuerpo })
        status = res.status
        replayed = res.headers?.get?.("Idempotency-Replayed") === "true"
        data = await res.json().catch(() => ({}))
      } catch {
        status = null
      }
      const r = clasificarConfirmacion(status)
      if (r === "registrado") {
        retirarIntento(endpoints.contexto, venta.id)
        p.onRegistrado(resultadoDe(tipo, data, replayed || data.replayed === true))
        return null
      }
      if (r === "rechazado") {
        retirarIntento(endpoints.contexto, venta.id) // nothing was written: a new attempt may be created
        setError(typeof data.error === "string" ? data.error : "No se pudo registrar la operación. No se registró nada.")
        return { code: typeof data.code === "string" ? data.code : undefined }
      }
      guardarIntento({ ...intento, estado: "INCIERTO", updatedAt: Date.now() })
      p.onIncierto()
      return null
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }
  return { confirmar, enviando, error, setError }
}

type DineroDevolucion = "REALIZADO" | "PENDIENTE" | "NO_CORRESPONDE"
type ReintegroDiferencia = { modo: "REALIZADO"; medio: Medio } | { modo: "PENDIENTE" }

const TITULO_OPERACION: Record<Exclude<OperacionInferida, "VACIA">, string> = {
  SOLO_AGREGA: "Compra adicional",
  DEVOLUCION: "Devolución",
  DEVOLUCION_TOTAL: "Devolución total",
  CAMBIO: "Cambio de productos",
}

const STOCK_BOTONES: Array<[boolean, string]> = [[true, "Vuelve al stock"], [false, "No vuelve (dañado, abierto…)"]]

function GestionarVentaForm({ venta, devolucionUrl, ownerRegistersUrl, comercial, irAVender, onCerrar, onActualizar, onDevuelto, aviso, onIncierto, onCambioRegistrado }: GestionarVentaProps & {
  aviso: string | null
  onIncierto: () => void
  onCambioRegistrado: (r: Resultado) => void
}) {
  const disponibles = venta.items.filter((item) => item.cantidadRestante > 0)
  const [devuelve, setDevuelve] = useState<Record<string, number>>({})
  const [stock, setStock] = useState<Record<string, boolean | undefined>>({})
  const [entran, setEntran] = useState<CartLine[]>([])
  const [motivo, setMotivo] = useState("")
  const [dinero, setDinero] = useState<DineroDevolucion | null>(null)
  const metodoVenta = (["EFECTIVO", "TRANSFERENCIA", "OTRO"].includes(venta.metodoPago) ? venta.metodoPago : "EFECTIVO") as Medio
  const [medioDevolucion, setMedioDevolucion] = useState<Medio>(metodoVenta)
  const [medioDiferencia, setMedioDiferencia] = useState<Medio | null>(null)
  const [reintegro, setReintegro] = useState<ReintegroDiferencia | null>(null)
  const [caja, setCaja] = useState("")
  const [cotizacion, setCotizacion] = useState<{ firma: string; datos: Cotizacion } | null>(null)
  const [errorCotizacion, setErrorCotizacion] = useState<{ firma: string; texto: string; code?: string } | null>(null)
  const [devolviendo, setDevolviendo] = useState(false)
  const [errorDevolucion, setErrorDevolucion] = useState<string | null>(null)
  const enCursoDevolucion = useRef(false)
  const post = useIdempotentPost()
  const { confirmar, enviando, error, setError } = useConfirmar(venta, comercial, { onIncierto, onRegistrado: onCambioRegistrado })
  const ocupado = enviando || devolviendo

  const operacion = inferirOperacion(disponibles, devuelve, entran.length)
  const esDevolucion = operacion === "DEVOLUCION" || operacion === "DEVOLUCION_TOTAL"
  const salen = disponibles.filter((i) => (devuelve[i.id] ?? 0) > 0).map((i) => ({ ventaItemId: i.id, cantidad: devuelve[i.id], reingresaStock: stock[i.id] === true }))
  const entranBody = entran.map((l) => ({ productoId: l.productoId, ...(l.varianteId ? { varianteId: l.varianteId } : {}), cantidad: l.cantidad }))
  const faltaStock = disponibles.some((i) => (devuelve[i.id] ?? 0) > 0 && stock[i.id] === undefined)
  // The amounts never depend on the stock decision: an undecided line is quoted as returning to stock.
  const salenCotizacion = salen.map((s) => ({ ...s, reingresaStock: stock[s.ventaItemId] ?? true }))
  const cajaCotizacion = comercial?.ownerRegistersUrl && caja ? caja : ""
  const firma = JSON.stringify({ salen: salenCotizacion, entranBody, caja: cajaCotizacion })
  const vigente = operacion === "CAMBIO" && cotizacion?.firma === firma ? cotizacion.datos : null
  const errorVigente = operacion === "CAMBIO" && errorCotizacion?.firma === firma ? errorCotizacion : null
  const calculando = operacion === "CAMBIO" && !vigente && !errorVigente

  // Exchange: quote automatically after each change (debounced). A quote computes
  // everything with the real engines and rolls back: it never registers anything.
  useEffect(() => {
    if (operacion !== "CAMBIO" || !comercial) return
    if (cotizacion?.firma === firma || errorCotizacion?.firma === firma) return
    let actual = true
    const pedida = firma
    const temporizador = setTimeout(async () => {
      try {
        const res = await fetch(comercial.cotizacionUrl(venta.id), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ salen: salenCotizacion, entran: entranBody, ...(cajaCotizacion ? { cajaFisicaId: cajaCotizacion } : {}) }),
        })
        const json = await res.json().catch(() => ({}))
        if (!actual) return
        if (!res.ok || !json.ok) {
          setErrorCotizacion({ firma: pedida, texto: json.error ?? "No pudimos calcular el cambio.", code: typeof json.code === "string" ? json.code : undefined })
          return
        }
        setCotizacion({ firma: pedida, datos: json.cotizacion })
      } catch {
        if (actual) setErrorCotizacion({ firma: pedida, texto: "Sin conexión: no pudimos calcular el cambio. No se registró nada." })
      }
    }, 350)
    return () => { actual = false; clearTimeout(temporizador) }
    // `firma` encodes every input of the quote (what goes out, what comes in, the register).
  }, [operacion, firma, cotizacion, errorCotizacion, comercial, venta.id])

  const importeDevolucion = round2(disponibles.reduce((acc, item) => acc + importeEstimado(item, devuelve[item.id] ?? 0), 0))
  const efectivoDevolucion = esDevolucion && dinero === "REALIZADO" && medioDevolucion === "EFECTIVO"
  const efectivoCambio = vigente ? (vigente.liquidacion === "COBRO" && medioDiferencia === "EFECTIVO") || (vigente.liquidacion === "REINTEGRO" && reintegro?.modo === "REALIZADO" && reintegro.medio === "EFECTIVO") : false
  // Several open registers: the owner chooses where cash moves (or where the exchange is attributed).
  const forzarCaja = errorVigente?.code === "CAJA_SELECCION_REQUERIDA"
  const conCaja = efectivoDevolucion || efectivoCambio || forzarCaja
  const registros = useOpenRegisters(ownerRegistersUrl, conCaja)
  const faltaCaja = conCaja && necesitaCaja(ownerRegistersUrl, registros.data?.length) && !caja
  const motivoOk = motivo.trim().length > 0
  const liquidacionLista = vigente ? (vigente.liquidacion === "COBRO" ? medioDiferencia !== null : vigente.liquidacion === "REINTEGRO" ? reintegro !== null : true) : false
  const listoDevolucion = esDevolucion && !faltaStock && motivoOk && dinero !== null && !faltaCaja && !ocupado
  const listoCambio = operacion === "CAMBIO" && Boolean(vigente) && liquidacionLista && !faltaStock && motivoOk && !faltaCaja && !ocupado
  const listo = listoDevolucion || listoCambio

  const setQueda = (item: VentaDevolucionItem, queda: number) => {
    const q = Math.max(0, Math.min(item.cantidadRestante, Math.round(queda * 1000) / 1000))
    setDevuelve((prev) => ({ ...prev, [item.id]: Math.round((item.cantidadRestante - q) * 1000) / 1000 }))
  }

  async function enviarDevolucion() {
    if (!listoDevolucion || enCursoDevolucion.current) return
    enCursoDevolucion.current = true
    setDevolviendo(true)
    setErrorDevolucion(null)
    try {
      const body = {
        tipo: "DEVOLUCION_PARCIAL",
        motivo: motivo.trim(),
        confirmo: true,
        reintegro: dinero === "REALIZADO" ? { modo: "REALIZADO", medio: medioDevolucion } : { modo: dinero },
        items: salen,
        ...(ownerRegistersUrl && caja && efectivoDevolucion ? { cajaFisicaId: caja } : {}),
      }
      const result = await post(devolucionUrl, body)
      onActualizar()
      if (!result.ok) { setErrorDevolucion(result.message); return }
      const devolucion = result.json.devolucion as { importe?: number; reintegroDescripcion?: string } | undefined
      onDevuelto(`${operacion === "DEVOLUCION_TOTAL" ? "Devolución total registrada" : "Devolución registrada"} por ${formatPrice(devolucion?.importe ?? importeDevolucion)}. Dinero: ${devolucion?.reintegroDescripcion ?? "registrado"}.`)
    } finally {
      enCursoDevolucion.current = false
      setDevolviendo(false)
    }
  }

  async function enviarCambio() {
    if (!vigente || !listoCambio || !comercial) return
    // EXACTLY the quoted strings (H1): the server compares them with Decimal.equals.
    const cotizados = { salida: vigente.importes.salida, entrada: vigente.importes.entrada }
    const body = {
      motivo: motivo.trim(),
      salen,
      entran: entranBody,
      // F4-C5: the ONE quote-amount exception of the blind-close contract (f10-b2-1): not expected cash.
      esperado: cotizados,
      confirmo: true,
      ...(vigente.liquidacion === "COBRO" ? { medioDiferencia } : {}),
      ...(vigente.liquidacion === "REINTEGRO" ? { reintegro } : {}),
      ...(comercial.ownerRegistersUrl && caja ? { cajaFisicaId: caja } : {}),
    }
    const lineas = [
      `Vuelve: ${vigente.salen.map((l) => `${l.cantidad} × ${l.nombre}`).join(", ")}`,
      `Se lleva: ${vigente.entran.map((l) => `${l.cantidad} × ${nombreLinea(l)}`).join(", ")}`,
    ]
    const rechazo = await confirmar("CAMBIO", comercial.cambioUrl(venta.id), body, { lineas, importes: vigente.importes })
    if (rechazo) onActualizar()
    if (rechazo?.code === "IMPORTES_CAMBIARON" || rechazo?.code === "INTENTO_CERRADO") setCotizacion(null) // a new quote is required
  }

  const totalNuevos = useMemo(() => cartTotal(entran), [entran])
  const errorEnvio = errorDevolucion ?? error

  return (
    <form
      aria-label="Gestionar venta"
      className="min-w-0 space-y-4"
      onSubmit={(event) => { event.preventDefault(); setError(null); if (esDevolucion) void enviarDevolucion(); else if (operacion === "CAMBIO") void enviarCambio() }}
    >
      {aviso && <p role="status" className="break-words rounded-xl bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{aviso}</p>}

      <fieldset disabled={ocupado} className="min-w-0 space-y-4">
        <section className="min-w-0 space-y-2" aria-label="Productos de la venta">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Productos de la venta</h3>
            <span className="text-[11px] text-muted-foreground">Bajá lo que devuelve el cliente</span>
          </div>
          {disponibles.map((item) => {
            const vuelve = devuelve[item.id] ?? 0
            const queda = Math.round((item.cantidadRestante - vuelve) * 1000) / 1000
            const nombre = nombreLinea(item)
            return (
              <div key={item.id} className={cn("min-w-0 space-y-2 rounded-xl border p-2.5", vuelve > 0 && "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20")} data-testid="linea-venta">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{nombre}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(item.precio)} c/u cobrado{item.cantidadDevuelta > 0 ? ` · ya devueltas ${item.cantidadDevuelta}` : ""}</p>
                  </div>
                  <Cantidad valor={queda} max={item.cantidadRestante} onChange={(n) => setQueda(item, n)} etiqueta={nombre} />
                </div>
                {item.precioHeredado && <p className="break-words text-xs font-medium text-amber-700 dark:text-amber-300">Precio heredado de una corrección anterior: revisalo antes de continuar.</p>}
                {vuelve > 0 && (
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Devuelve {vuelve} · {formatPrice(importeEstimado(item, vuelve))}</p>
                    <div role="group" aria-label={`¿${nombre} vuelve al stock?`} className="grid grid-cols-2 gap-2">
                      {STOCK_BOTONES.map(([valor, texto]) => (
                        <button key={String(valor)} type="button" aria-pressed={stock[item.id] === valor} onClick={() => setStock((prev) => ({ ...prev, [item.id]: valor }))}
                          className={cn("min-h-9 min-w-0 whitespace-normal rounded-xl border px-2 py-1 text-xs font-semibold", stock[item.id] === valor ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground")}>
                          {texto}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </section>

        {comercial?.catalogo && (
          <section className="min-w-0 space-y-2" aria-label="Productos que se lleva">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Se lleva en su lugar</h3>
              {entran.length > 0 && <span className="text-xs font-semibold">{formatPrice(totalNuevos)}</span>}
            </div>
            {entran.map((linea) => {
              const nombre = nombreLinea(linea)
              return (
                <div key={`${linea.productoId}|${linea.varianteId ?? ""}`} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50/60 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/20" data-testid="linea-nueva">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{nombre}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(linea.precio)} c/u · precio actual</p>
                  </div>
                  <Cantidad valor={linea.cantidad} onChange={(n) => setEntran((prev) => setCartLineQuantity(prev, linea.productoId, Math.max(0, Math.round(n * 1000) / 1000), linea.varianteId))} etiqueta={`${nombre} (nuevo)`} />
                </div>
              )
            })}
            <CatalogoCompacto fuente={comercial.catalogo} disabled={ocupado} onAgregar={(l) => setEntran((prev) => addCartLine(prev, l))} />
          </section>
        )}
      </fieldset>

      {operacion === "VACIA" && (
        <p className="break-words rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          {comercial?.catalogo ? "Bajá la cantidad de lo que devuelve el cliente y, si se lleva otra cosa, agregala." : "Bajá la cantidad de lo que devuelve el cliente."}
        </p>
      )}

      {operacion === "SOLO_AGREGA" && (
        <div role="status" className="min-w-0 space-y-2 rounded-xl border border-sky-300 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
          <p className="break-words">El cliente no devuelve nada: si compra algo más, es una <strong>venta nueva</strong>. Registrala en «Vender». Esta venta no se modifica.</p>
          {irAVender && <Button type="button" variant="outline" className="min-h-10 w-full rounded-xl bg-background" onClick={irAVender}><ShoppingCart className="mr-1 h-4 w-4" />Ir a Vender</Button>}
        </div>
      )}

      {(esDevolucion || operacion === "CAMBIO") && (
        <section className="min-w-0 space-y-3 rounded-xl border bg-muted/30 p-3" aria-label="Resumen de la operación">
          <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
            <span>{TITULO_OPERACION[operacion]}</span>
            {operacion === "CAMBIO" && calculando && <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Calculando…</span>}
          </p>

          {esDevolucion && <>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-2 text-base font-bold"><dt>Valor de lo que devuelve</dt><dd>{formatPrice(importeDevolucion)}</dd></div>
            </dl>
            <p className="text-xs text-muted-foreground">Según lo que se cobró. El importe final lo confirma el sistema.{operacion === "DEVOLUCION_TOTAL" ? " Devuelve todo: la venta queda «Devuelta por completo» (no es una anulación)." : ""}</p>
            <fieldset className="min-w-0 space-y-2" disabled={ocupado}>
              <legend className="text-sm font-medium">¿Qué pasa con el dinero?</legend>
              {([
                ["REALIZADO", "Lo devuelvo ahora"],
                ["PENDIENTE", "Queda pendiente de devolver"],
                ["NO_CORRESPONDE", "No corresponde devolver dinero"],
              ] as Array<[DineroDevolucion, string]>).map(([valor, texto]) => (
                <label key={valor} className="flex min-w-0 items-center gap-2 text-sm">
                  <input type="radio" name={`dinero-${venta.id}`} className="h-4 w-4 shrink-0" checked={dinero === valor} onChange={() => setDinero(valor)} />
                  <span className="min-w-0 break-words">{texto}</span>
                </label>
              ))}
              {dinero === "REALIZADO" && <>
                <MedioBotones label="Medio de devolución" value={medioDevolucion} onChange={setMedioDevolucion} disabled={ocupado} />
                <p className="break-words text-xs text-muted-foreground">{medioDevolucion === "EFECTIVO" ? "Se registra la salida de efectivo de la caja del turno actual. Los cierres anteriores no cambian." : "DeliGO no realiza transferencias: sólo registra que devolviste el dinero por ese medio."}</p>
              </>}
            </fieldset>
          </>}

          {operacion === "CAMBIO" && <>
            {vigente && <ResumenDinero importes={vigente.importes} liquidacion={vigente.liquidacion} />}
            {errorVigente && (
              <div className="min-w-0 space-y-2">
                <p role="alert" className="break-words text-sm text-destructive">{errorVigente.texto}</p>
                {!forzarCaja && <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setErrorCotizacion(null)}><RefreshCw className="mr-1 h-4 w-4" />Volver a calcular</Button>}
              </div>
            )}
            {vigente && vigente.advertenciasTexto.length > 0 && (
              <p className="break-words rounded-lg bg-sky-50 p-2 text-xs text-sky-950 dark:bg-sky-950/40 dark:text-sky-100" data-testid="advertencias">Para tu información (no impide el cambio): {vigente.advertenciasTexto.join(" · ")}</p>
            )}
            {vigente?.liquidacion === "COBRO" && (
              <div className="min-w-0 space-y-1.5">
                <p className="text-sm font-medium">¿Cómo paga la diferencia?</p>
                <MedioBotones label="Medio de cobro de la diferencia" value={medioDiferencia} onChange={setMedioDiferencia} disabled={ocupado} />
              </div>
            )}
            {vigente?.liquidacion === "REINTEGRO" && (
              <fieldset className="min-w-0 space-y-2" disabled={ocupado}>
                <legend className="text-sm font-medium">¿Qué pasa con la diferencia a favor del cliente?</legend>
                <label className="flex items-center gap-2 text-sm"><input type="radio" name={`dif-${venta.id}`} className="h-4 w-4" checked={reintegro?.modo === "REALIZADO"} onChange={() => setReintegro({ modo: "REALIZADO", medio: "EFECTIVO" })} />La devuelvo ahora</label>
                {reintegro?.modo === "REALIZADO" && <MedioBotones label="Medio de devolución de la diferencia" value={reintegro.medio} onChange={(m) => setReintegro({ modo: "REALIZADO", medio: m })} disabled={ocupado} />}
                <label className="flex items-center gap-2 text-sm"><input type="radio" name={`dif-${venta.id}`} className="h-4 w-4" checked={reintegro?.modo === "PENDIENTE"} onChange={() => setReintegro({ modo: "PENDIENTE" })} />Queda pendiente</label>
              </fieldset>
            )}
          </>}

          <CajaElegida url={ownerRegistersUrl} enabled={conCaja} value={caja} onChange={setCaja} disabled={ocupado} />

          {faltaStock && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Indicá si cada producto devuelto vuelve al stock.</p>}

          <label className="block min-w-0 space-y-1 text-sm font-medium">
            <span>Motivo</span>
            <Input aria-label="Motivo" value={motivo} maxLength={500} disabled={ocupado} onChange={(e) => setMotivo(e.target.value)} placeholder={operacion === "CAMBIO" ? "Ej.: prefiere otro talle" : "Ej.: el cliente cambió de opinión"} className="h-11 w-full min-w-0 rounded-xl bg-background" />
          </label>
        </section>
      )}

      {errorEnvio && <p role="alert" className="break-words text-sm text-destructive">{errorEnvio}</p>}

      <div className="sticky bottom-0 -mx-1 flex flex-col gap-2 bg-background px-1 pb-1 pt-2 sm:flex-row-reverse" data-testid="gestionar-acciones">
        <Button type="submit" disabled={!listo} className="h-auto min-h-11 w-full whitespace-normal rounded-xl px-4 py-2 font-bold leading-snug sm:flex-1">
          {ocupado ? "Registrando…" : operacion === "CAMBIO" ? "Confirmar cambio" : esDevolucion ? "Confirmar devolución" : "Confirmar"}
        </Button>
        <Button type="button" variant="outline" disabled={ocupado} className="min-h-11 w-full rounded-xl sm:w-auto sm:px-6" onClick={onCerrar}>Volver</Button>
      </div>
    </form>
  )
}
