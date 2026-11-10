"use client"

// ============================================
// F4-C5 — commercial exchanges and linked additional sales (owner + cashier, same UI)
// ============================================
// One component for both hosts: each passes its OWN endpoints (a cashier never
// calls an owner API) and a product selector built from the existing Caja
// selling view. The server decides prices, amounts, stock, shifts and
// permissions; this UI only collects choices. Rules (operator, 2026-11-09):
//   - the quote is asked with an explicit button; any change of what goes out
//     or comes in invalidates it; the confirmation sends the quoted amounts
//     (`esperado`) EXACTLY as the server returned them (never recomputed);
//   - P1 warnings are informative, never block;
//   - every confirmation is an attempt stored on this device BEFORE it is sent
//     (src/lib/caja-intento-comercial.ts). An uncertain attempt blocks a new
//     equivalent operation on that sale until «Verificar operación» (same key,
//     same body, never performs it) returns a SAFE result; it is never
//     discarded by a simple warning.

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeftRight, History, Minus, Plus, RefreshCw, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { cartTotal, type CartLine } from "@/lib/caja-venta"
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
import type { VentaConDevoluciones, VentaDevolucionItem } from "@/components/business/caja-devoluciones"

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
  adicionalUrl: (ventaId: string) => string
  verificarAdicionalUrl: (ventaId: string) => string
  cadenaUrl: (ventaId: string) => string
  /** Owner only: registers with an open shift (where cash comes in / goes out). */
  ownerRegistersUrl?: string
  /** Product picker of the host (the Caja selling view in selection mode). */
  Selector: ComponentType<SelectorProductosProps>
}

type Medio = "EFECTIVO" | "TRANSFERENCIA" | "OTRO"
const MEDIOS: Array<[Medio, string]> = [["EFECTIVO", "Efectivo"], ["TRANSFERENCIA", "Transferencia"], ["OTRO", "Otro medio"]]

export function etiquetaMetodoVenta(metodo: string): string {
  return metodo === "EFECTIVO" ? "Efectivo" : metodo === "TRANSFERENCIA" ? "Transferencia" : metodo === "OTRO" ? "Otro medio" : metodo === "CAMBIO" ? "Cambio" : metodo
}

/** Display only: the server sends exact decimal strings ("2000.00"). */
const pesos = (value: string | number | undefined | null) => formatPrice(Number(value ?? 0))
const nombreLinea = (l: { nombre: string; varianteNombre?: string | null }) => (l.varianteNombre ? `${l.nombre} — ${l.varianteNombre}` : l.nombre)

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
        ? "Verificado: la operación NO se registró y ese intento quedó cerrado. Podés pedir una nueva cotización y confirmar de nuevo."
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
        <p className="break-words text-xs">Mientras no se verifique, no se puede registrar otra operación de cambio o venta vinculada sobre esta venta desde este dispositivo, para no duplicarla.</p>
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
// Result
// ---------------------------------------------------------------------------

function ResultadoOperacion({ resultado, onCerrar }: { resultado: Resultado; onCerrar: () => void }) {
  return (
    <div className="min-w-0 space-y-3" data-testid="resultado-operacion">
      <div role="status" className="space-y-1 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
        {resultado.replayed && <p className="font-semibold">Esta operación ya estaba registrada: no se aplicó dos veces.</p>}
        {resultado.tipo === "CAMBIO" ? (
          <>
            <p className="font-semibold">Cambio registrado: #{resultado.cambio.ventaOrigenReferencia} → #{resultado.cambio.ventaNuevaReferencia}</p>
            <ImportesCambio importes={resultado.cambio.importes} liquidacion={resultado.cambio.liquidacion} />
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

function ImportesCambio({ importes, liquidacion }: { importes: Cotizacion["importes"]; liquidacion: Cotizacion["liquidacion"] }) {
  return (
    <dl className="space-y-1 text-sm" data-testid="importes-cambio">
      <div className="flex justify-between gap-2"><dt>Vuelve (lo que devuelve el cliente)</dt><dd className="font-semibold">{pesos(importes.salida)}</dd></div>
      <div className="flex justify-between gap-2"><dt>Se lleva</dt><dd className="font-semibold">{pesos(importes.entrada)}</dd></div>
      <div className="flex justify-between gap-2"><dt>Crédito interno (no es dinero)</dt><dd>{pesos(importes.credito)}</dd></div>
      <div className="flex justify-between gap-2 border-t pt-1 font-bold">
        <dt>{liquidacion === "COBRO" ? "Diferencia a cobrar" : liquidacion === "REINTEGRO" ? "Diferencia a devolver al cliente" : "Sin diferencia de dinero"}</dt>
        <dd>{liquidacion === "COBRO" ? pesos(importes.diferenciaCobrada) : liquidacion === "REINTEGRO" ? pesos(importes.diferenciaReintegro) : pesos(0)}</dd>
      </div>
    </dl>
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
              {c.liquidacion === "COBRO" ? `cobró ${pesos(c.importes.diferenciaCobrada)}` : c.liquidacion === "REINTEGRO" ? `devolvió ${pesos(c.importes.diferenciaReintegro)}` : "sin diferencia"} · crédito interno {pesos(c.importes.credito)}
            </li>
          ))}
        </ol>
      </>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The operation (exchange or linked additional sale) of one origin sale
// ---------------------------------------------------------------------------

export function OperacionComercial({ tipo, venta, endpoints, onCerrar, onCambio }: {
  tipo: TipoIntentoComercial
  venta: VentaConDevoluciones
  endpoints: CajaComercialEndpoints
  onCerrar: () => void
  /** Refresh the host queries after a registered operation. */
  onCambio: () => void
}) {
  const [intento, setIntento] = useState<IntentoComercial | null>(() => leerIntento(endpoints.contexto, venta.id))
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(0)

  if (resultado) return <ResultadoOperacion resultado={resultado} onCerrar={onCerrar} />
  if (intento) {
    return (
      <IntentoPendiente
        intento={intento}
        endpoints={endpoints}
        onResultado={(r) => { setIntento(null); setResultado(r); onCambio() }}
        onNoRegistrado={(texto) => { setIntento(null); setAviso(texto); setNuevo((n) => n + 1) }}
      />
    )
  }
  const comun = {
    venta,
    endpoints,
    aviso,
    onCancelar: onCerrar,
    onIncierto: () => setIntento(leerIntento(endpoints.contexto, venta.id)),
    onRegistrado: (r: Resultado) => { setResultado(r); onCambio() },
  }
  return tipo === "CAMBIO" ? <CambioForm key={nuevo} {...comun} /> : <AdicionalForm key={nuevo} {...comun} />
}

interface FormProps {
  venta: VentaConDevoluciones
  endpoints: CajaComercialEndpoints
  aviso: string | null
  onCancelar: () => void
  onIncierto: () => void
  onRegistrado: (r: Resultado) => void
}

/** Stores the attempt, sends it once, classifies the answer (shared by both forms). */
function useConfirmar(venta: VentaConDevoluciones, endpoints: CajaComercialEndpoints, p: { onIncierto: () => void; onRegistrado: (r: Resultado) => void }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enCurso = useRef(false)
  async function confirmar(tipo: TipoIntentoComercial, url: string, body: unknown, resumen: IntentoComercial["resumen"]): Promise<{ code?: string } | null> {
    if (enCurso.current) return null
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

function CambioForm({ venta, endpoints, aviso, onCancelar, onIncierto, onRegistrado }: FormProps) {
  const disponibles = venta.items.filter((item) => item.cantidadRestante > 0)
  const [paso, setPaso] = useState<"salen" | "entran" | "resumen">("salen")
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [stock, setStock] = useState<Record<string, boolean | undefined>>({})
  const [entran, setEntran] = useState<CartLine[]>([])
  const [motivo, setMotivo] = useState("")
  const [cotizacion, setCotizacion] = useState<{ firma: string; datos: Cotizacion } | null>(null)
  const [cotizando, setCotizando] = useState(false)
  const [errorCotizacion, setErrorCotizacion] = useState<string | null>(null)
  const [medioDiferencia, setMedioDiferencia] = useState<Medio | null>(null)
  const [reintegro, setReintegro] = useState<{ modo: "REALIZADO"; medio: Medio } | { modo: "PENDIENTE" } | null>(null)
  const [caja, setCaja] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const { confirmar, enviando, error, setError } = useConfirmar(venta, endpoints, { onIncierto, onRegistrado })
  const Selector = endpoints.Selector

  const salen = disponibles.filter((i) => (cantidades[i.id] ?? 0) > 0).map((i) => ({ ventaItemId: i.id, cantidad: cantidades[i.id], reingresaStock: stock[i.id] === true }))
  const entranBody = entran.map((l) => ({ productoId: l.productoId, ...(l.varianteId ? { varianteId: l.varianteId } : {}), cantidad: l.cantidad }))
  const firma = JSON.stringify({ salen, entranBody })
  const vigente = cotizacion && cotizacion.firma === firma ? cotizacion.datos : null
  const faltaStock = disponibles.some((i) => (cantidades[i.id] ?? 0) > 0 && stock[i.id] === undefined)
  const efectivo = vigente ? (vigente.liquidacion === "COBRO" && medioDiferencia === "EFECTIVO") || (vigente.liquidacion === "REINTEGRO" && reintegro?.modo === "REALIZADO" && reintegro.medio === "EFECTIVO") : false
  const registros = useOpenRegisters(endpoints.ownerRegistersUrl, efectivo)
  const faltaCaja = efectivo && necesitaCaja(endpoints.ownerRegistersUrl, registros.data?.length) && !caja
  const liquidacionLista = vigente ? (vigente.liquidacion === "COBRO" ? medioDiferencia !== null : vigente.liquidacion === "REINTEGRO" ? reintegro !== null : true) : false
  const listo = Boolean(vigente) && liquidacionLista && motivo.trim().length > 0 && confirmo && !faltaCaja && !enviando

  const setCantidad = (item: VentaDevolucionItem, n: number) => setCantidades((prev) => ({ ...prev, [item.id]: Math.max(0, Math.min(item.cantidadRestante, Math.round(n * 1000) / 1000)) }))

  async function cotizar() {
    if (cotizando) return
    setCotizando(true)
    setErrorCotizacion(null)
    setError(null)
    const firmaPedida = firma
    try {
      const res = await fetch(endpoints.cotizacionUrl(venta.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salen, entran: entranBody, ...(motivo.trim() ? { motivo: motivo.trim() } : {}), ...(endpoints.ownerRegistersUrl && caja ? { cajaFisicaId: caja } : {}) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setCotizacion(null)
        setErrorCotizacion(json.error ?? "No pudimos calcular el cambio.")
        return
      }
      setCotizacion({ firma: firmaPedida, datos: json.cotizacion })
      setConfirmo(false)
    } catch {
      setCotizacion(null)
      setErrorCotizacion("Sin conexión: no pudimos calcular el cambio. No se registró nada.")
    } finally {
      setCotizando(false)
    }
  }

  async function enviar() {
    if (!vigente || !listo) return
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
      ...(endpoints.ownerRegistersUrl && caja ? { cajaFisicaId: caja } : {}),
    }
    const lineas = [
      `Vuelve: ${vigente.salen.map((l) => `${l.cantidad} × ${l.nombre}`).join(", ")}`,
      `Se lleva: ${vigente.entran.map((l) => `${l.cantidad} × ${nombreLinea(l)}`).join(", ")}`,
    ]
    const rechazo = await confirmar("CAMBIO", endpoints.cambioUrl(venta.id), body, { lineas, importes: vigente.importes })
    if (rechazo?.code === "IMPORTES_CAMBIARON" || rechazo?.code === "INTENTO_CERRADO") setCotizacion(null) // a new quote is required
  }

  if (paso === "entran") {
    return (
      <div className="min-w-0 space-y-3">
        <p className="text-sm font-semibold">Paso 2 de 3 · ¿Qué se lleva el cliente?</p>
        <Selector etiqueta="Usar estos productos" inicial={entran} onConfirmar={(cart) => { setEntran(cart); setPaso("resumen") }} />
        <Button type="button" variant="outline" className="min-h-11 w-full rounded-xl" onClick={() => setPaso("salen")}>Volver</Button>
      </div>
    )
  }

  if (paso === "salen") {
    const listoSalen = salen.length > 0 && !faltaStock
    return (
      <div className="min-w-0 space-y-3" aria-label="Productos que devuelve el cliente">
        {aviso && <p role="status" className="break-words rounded-xl bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{aviso}</p>}
        <p className="text-sm font-semibold">Paso 1 de 3 · ¿Qué devuelve el cliente?</p>
        {disponibles.map((item) => {
          const cantidad = cantidades[item.id] ?? 0
          return (
            <div key={item.id} className="min-w-0 space-y-2 rounded-xl border p-2">
              <p className="break-words text-sm font-medium">{nombreLinea(item)}</p>
              <p className="text-xs text-muted-foreground">Vendidas {item.cantidad} · disponibles {item.cantidadRestante}</p>
              {item.precioHeredado && <p className="break-words text-xs font-medium text-amber-700 dark:text-amber-300">Precio heredado de una corrección anterior: revisalo antes de cambiar.</p>}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" aria-label={`Restar una unidad de ${nombreLinea(item)}`} disabled={cantidad <= 0} onClick={() => setCantidad(item, cantidad - 1)}><Minus className="h-4 w-4" /></Button>
                <Input inputMode="decimal" aria-label={`Unidades que vuelven de ${nombreLinea(item)}`} value={String(cantidad)} onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); if (Number.isFinite(n)) setCantidad(item, n) }} className="h-10 w-20 min-w-0 rounded-xl text-center" />
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" aria-label={`Sumar una unidad de ${nombreLinea(item)}`} disabled={cantidad + 1 > item.cantidadRestante} onClick={() => setCantidad(item, cantidad + 1)}><Plus className="h-4 w-4" /></Button>
              </div>
              {cantidad > 0 && (
                <div role="group" aria-label={`¿${nombreLinea(item)} vuelve al stock?`} className="grid grid-cols-2 gap-2">
                  {[true, false].map((vuelve) => (
                    <button key={String(vuelve)} type="button" aria-pressed={stock[item.id] === vuelve} onClick={() => setStock((prev) => ({ ...prev, [item.id]: vuelve }))}
                      className={cn("min-h-10 min-w-0 whitespace-normal rounded-xl border px-2 py-1.5 text-xs font-semibold", stock[item.id] === vuelve ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
                      {vuelve ? "Vuelve al stock" : "No vuelve (dañado, abierto…)"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div className="flex flex-col gap-2">
          <Button type="button" className="h-auto min-h-11 w-full whitespace-normal rounded-xl font-bold" disabled={!listoSalen} onClick={() => setPaso("entran")}>Elegir lo que se lleva</Button>
          <Button type="button" variant="outline" className="min-h-11 w-full rounded-xl" onClick={onCancelar}>Cancelar</Button>
        </div>
      </div>
    )
  }

  return (
    <form className="min-w-0 space-y-3" aria-label="Confirmar cambio" onSubmit={(event) => { event.preventDefault(); void enviar() }}>
      <p className="text-sm font-semibold">Paso 3 de 3 · Cotización y confirmación</p>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="break-words">Vuelve: {salen.map((s) => `${s.cantidad} × ${nombreLinea(disponibles.find((i) => i.id === s.ventaItemId)!)}`).join(", ")}</p>
        <p className="break-words">Se lleva: {entran.map((l) => `${l.cantidad} × ${nombreLinea(l)}`).join(", ")}</p>
        <div className="flex gap-2">
          <Button type="button" variant="link" className="h-auto p-0 text-xs" disabled={enviando} onClick={() => setPaso("salen")}>Cambiar lo que vuelve</Button>
          <Button type="button" variant="link" className="h-auto p-0 text-xs" disabled={enviando} onClick={() => setPaso("entran")}>Cambiar lo que se lleva</Button>
        </div>
      </div>
      <Button type="button" variant={vigente ? "outline" : "default"} className="h-auto min-h-11 w-full whitespace-normal rounded-xl font-bold" disabled={cotizando || enviando} onClick={() => void cotizar()}>
        <ArrowLeftRight className="mr-1 h-4 w-4 shrink-0" />{cotizando ? "Calculando…" : vigente ? "Volver a calcular" : "Calcular cambio"}
      </Button>
      {errorCotizacion && <p role="alert" className="break-words text-sm text-destructive">{errorCotizacion}</p>}
      {cotizacion && !vigente && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">Cambiaste los productos: pedí una nueva cotización.</p>}
      {vigente && (
        <div className="min-w-0 space-y-3 rounded-xl border p-3">
          <ImportesCambio importes={vigente.importes} liquidacion={vigente.liquidacion} />
          {vigente.advertenciasTexto.length > 0 && (
            <p className="break-words rounded-lg bg-sky-50 p-2 text-xs text-sky-950 dark:bg-sky-950/40 dark:text-sky-100" data-testid="advertencias">Para tu información (no impide el cambio): {vigente.advertenciasTexto.join(" · ")}</p>
          )}
          {vigente.liquidacion === "COBRO" && <MedioBotones label="Medio de cobro de la diferencia" value={medioDiferencia} onChange={setMedioDiferencia} disabled={enviando} />}
          {vigente.liquidacion === "REINTEGRO" && (
            <fieldset className="min-w-0 space-y-2" disabled={enviando}>
              <legend className="text-sm font-medium">¿Qué pasa con la diferencia a favor del cliente?</legend>
              <label className="flex items-center gap-2 text-sm"><input type="radio" name={`dif-${venta.id}`} className="h-4 w-4" checked={reintegro?.modo === "REALIZADO"} onChange={() => setReintegro({ modo: "REALIZADO", medio: "EFECTIVO" })} />La devuelvo ahora</label>
              {reintegro?.modo === "REALIZADO" && <MedioBotones label="Medio de devolución de la diferencia" value={reintegro.medio} onChange={(m) => setReintegro({ modo: "REALIZADO", medio: m })} disabled={enviando} />}
              <label className="flex items-center gap-2 text-sm"><input type="radio" name={`dif-${venta.id}`} className="h-4 w-4" checked={reintegro?.modo === "PENDIENTE"} onChange={() => setReintegro({ modo: "PENDIENTE" })} />Queda pendiente</label>
            </fieldset>
          )}
          <CajaElegida url={endpoints.ownerRegistersUrl} enabled={efectivo} value={caja} onChange={setCaja} disabled={enviando} />
        </div>
      )}
      <label className="block min-w-0 space-y-1 text-sm font-medium">
        <span>Motivo (obligatorio)</span>
        <Input aria-label="Motivo del cambio" value={motivo} maxLength={500} disabled={enviando} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: prefiere otro modelo" className="h-11 w-full min-w-0 rounded-xl" />
      </label>
      <label className="flex min-w-0 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={confirmo} disabled={enviando || !vigente} onChange={(e) => setConfirmo(e.target.checked)} />
        <span className="min-w-0 break-words">Confirmo el cambio con estos importes.</span>
      </label>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={!listo} className="h-auto min-h-11 w-full whitespace-normal rounded-xl font-bold">{enviando ? "Registrando…" : "Confirmar cambio"}</Button>
        <Button type="button" variant="outline" disabled={enviando} className="min-h-11 w-full rounded-xl" onClick={onCancelar}>Cancelar</Button>
      </div>
    </form>
  )
}

function AdicionalForm({ venta, endpoints, aviso, onCancelar, onIncierto, onRegistrado }: FormProps) {
  const [paso, setPaso] = useState<"entran" | "resumen">("entran")
  const [cart, setCart] = useState<CartLine[]>([])
  const [metodo, setMetodo] = useState<Medio | null>(null)
  const [caja, setCaja] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const { confirmar, enviando, error } = useConfirmar(venta, endpoints, { onIncierto, onRegistrado })
  const Selector = endpoints.Selector
  const total = useMemo(() => cartTotal(cart), [cart])
  const efectivo = metodo === "EFECTIVO"
  const registros = useOpenRegisters(endpoints.ownerRegistersUrl, efectivo)
  const faltaCaja = efectivo && necesitaCaja(endpoints.ownerRegistersUrl, registros.data?.length) && !caja
  const listo = cart.length > 0 && metodo !== null && confirmo && !faltaCaja && !enviando

  if (paso === "entran") {
    return (
      <div className="min-w-0 space-y-3">
        {aviso && <p role="status" className="break-words rounded-xl bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{aviso}</p>}
        <p className="text-sm font-semibold">Venta vinculada a #{venta.referencia} · ¿Qué agrega el cliente?</p>
        <Selector etiqueta="Continuar" inicial={cart} onConfirmar={(c) => { setCart(c); setPaso("resumen") }} />
        <Button type="button" variant="outline" className="min-h-11 w-full rounded-xl" onClick={onCancelar}>Cancelar</Button>
      </div>
    )
  }
  return (
    <form className="min-w-0 space-y-3" aria-label="Confirmar venta vinculada" onSubmit={(event) => {
      event.preventDefault()
      if (!listo) return
      void confirmar("ADICIONAL", endpoints.adicionalUrl(venta.id), {
        metodoPago: metodo,
        items: cart.map((l) => ({ productoId: l.productoId, ...(l.varianteId ? { varianteId: l.varianteId } : {}), cantidad: l.cantidad })),
        ...(endpoints.ownerRegistersUrl && caja ? { cajaFisicaId: caja } : {}),
      }, { lineas: [`Agrega: ${cart.map((l) => `${l.cantidad} × ${nombreLinea(l)}`).join(", ")}`] })
    }}>
      <p className="flex items-center gap-1.5 text-sm font-semibold"><ShoppingBag className="h-4 w-4" />Venta vinculada a #{venta.referencia}</p>
      <ul className="space-y-0.5 text-sm">{cart.map((l) => <li key={`${l.productoId}-${l.varianteId ?? ""}`} className="flex justify-between gap-2"><span className="min-w-0 break-words">{l.cantidad} × {nombreLinea(l)}</span><span>{formatPrice(l.precio * l.cantidad)}</span></li>)}</ul>
      <p className="flex justify-between border-t pt-1 text-sm font-bold"><span>Total estimado</span><span>{formatPrice(total)}</span></p>
      <p className="text-xs text-muted-foreground">El total exacto lo confirma el servidor con los precios vigentes.</p>
      <Button type="button" variant="link" className="h-auto p-0 text-xs" disabled={enviando} onClick={() => setPaso("entran")}>Cambiar productos</Button>
      <MedioBotones label="Medio de cobro" value={metodo} onChange={setMetodo} disabled={enviando} />
      <CajaElegida url={endpoints.ownerRegistersUrl} enabled={efectivo} value={caja} onChange={setCaja} disabled={enviando} />
      <label className="flex min-w-0 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={confirmo} disabled={enviando} onChange={(e) => setConfirmo(e.target.checked)} />
        <span className="min-w-0 break-words">Confirmo esta venta vinculada.</span>
      </label>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={!listo} className="h-auto min-h-11 w-full whitespace-normal rounded-xl font-bold">{enviando ? "Registrando…" : "Confirmar venta vinculada"}</Button>
        <Button type="button" variant="outline" disabled={enviando} className="min-h-11 w-full rounded-xl" onClick={onCancelar}>Cancelar</Button>
      </div>
    </form>
  )
}
