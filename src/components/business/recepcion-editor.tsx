"use client"

// ============================================
// F10-C2b — editor de una recepción de mercadería (cajero y dueño)
// ============================================
// Prepara un BORRADOR contra las rutas de F10-C2a (el negocio y el actor salen de la sesión en el
// servidor). Reglas de la pantalla:
//   - proveedor existente y, si corresponde, un pedido abierto de ese proveedor (precarga lo pendiente);
//   - productos por búsqueda o escáner (mismo componente que Caja); variante obligatoria si existe;
//   - recibido / aceptado (rechazado = la diferencia, con motivo obligatorio);
//   - enteros salvo unidades fraccionables (kg, g, litro, ml, metro) — el servidor lo repite;
//   - costo, descuento %, IVA %, comprobante, descuento del comprobante, percepciones y cargos;
//   - nunca muestra saldos del proveedor, anticipos, deuda ni el esperado de Caja.
// Guardar usa una Idempotency-Key estable por contenido (alta) o la versión (edición); ante un error
// de red lo cargado queda en este dispositivo y se reintenta sin duplicar. Los importes se calculan
// en centavos enteros (estimación; la cifra válida es la del servidor al aprobar).

import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, ScanBarcode, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { BarcodeScanner, type ScanFeedback } from "@/components/business/barcode-scanner"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { matchesCajaSearch } from "@/lib/product-variant-search"
import { cn } from "@/lib/utils"
import { formatoArs, parseImporteArs } from "@/components/business/caja-salidas-cajero"

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type ProductoCatalogo = {
  id: string; nombre: string; marca: string | null; sku: string | null; codigoBarras: string | null; categoria: string | null
  unidadMedida: string; fraccionable: boolean; controlStock: boolean
  variantes: Array<{ id: string; nombre: string; sku: string | null; codigoBarras: string | null; activo: boolean; controlStock: boolean }>
}
export type DatosRecepcion = {
  proveedores: Array<{ id: string; nombre: string }>
  comprasAbiertas: Array<{ id: string; numero: number; proveedorId: string; fechaPedido: string }>
}
export type CompraDetalle = {
  id: string; numero: number; proveedor: { id: string; nombre: string }
  lineas: Array<{ id: string; productoId: string | null; productoVarianteId: string | null; producto: string; variante: string | null; pedida: number; recibida: number; enRevision?: number; pendiente: number; costoUnitarioAcordado?: number | null }>
}
/** Avance del renglón del pedido (lo aceptado antes, lo enviado sin aprobar y lo que falta). */
export type InfoPedidoLinea = { pedida: number; aceptada: number; enRevision: number; pendiente: number }
export type RecepcionDetalle = {
  id: string; numero: number; estado: string; version: number
  proveedor: { id: string; nombre: string }; compra: { id: string; numero: number; estado: string } | null
  preparadaPor: { tipo: string; nombre: string }
  fechaRecepcion: string; comprobante: { tipo: string | null; numero: string | null; fecha: string | null }
  descuentoGlobal: number; percepciones: number; notas: string | null; motivoRechazo: string | null
  lineas: Array<{ id: string; orden: number; compraLineaId: string | null; productoId: string | null; productoVarianteId: string | null; producto: string; variante: string | null; unidadMedida: string; cantidadRecibida: number; cantidadAceptada: number; cantidadRechazada: number; motivoRechazo: string | null; detalleRechazo: string | null; costoUnitario: number; descuentoPct: number; alicuotaImpuestoPct: number; aprobacion: null | { controlStock: boolean | null; neto: number; impuestos: number; cargos: number; costoInventarioTotal: number; costoUnitarioInventario: number | null } }>
  cargos: Array<{ id: string; orden: number; tipo: "ATRIBUIBLE" | "NO_ATRIBUIBLE"; proveedorId: string; proveedor: string; concepto: string; importe: number; distribucion: "VALOR" | "CANTIDAD" | null; comprobanteTipo: string | null; comprobanteNumero: string | null }>
  totalesAprobacion: null | { tratamientoImpuestos: string; neto: number; descuentos: number; impuestos: number; cargos: number; totalObligacion: number }
  historial: Array<{ tipo: string; motivo: string | null; actorTipo: string; actorNombre: string; createdAt: string }>
  obligacionId?: string | null
}

export type LineaForm = {
  uid: string; productoId: string; productoVarianteId: string | null; compraLineaId: string | null; nombre: string; variante: string | null
  unidadMedida: string; fraccionable: boolean
  recibida: string; aceptada: string; motivoRechazo: string; detalleRechazo: string; costoUnitario: string; descuentoPct: string; alicuotaPct: string
  pendientePedido: number | null
  /** Renglón de un pedido: hay que confirmar cuánto llegó (0 = no llegó; ese renglón no se guarda). */
  infoPedido?: InfoPedidoLinea | null
}
export type CargoForm = { uid: string; tipo: "ATRIBUIBLE" | "NO_ATRIBUIBLE"; proveedorId: string; concepto: string; importe: string; distribucion: "VALOR" | "CANTIDAD" }
export type FormRecepcion = {
  proveedorId: string; compraId: string; fechaRecepcion: string; comprobanteTipo: string; comprobanteNumero: string; comprobanteFecha: string
  descuentoGlobal: string; percepciones: string; notas: string; lineas: LineaForm[]; cargos: CargoForm[]
}

export const MOTIVOS_RECHAZO: Record<string, string> = { DANADO: "Dañado", VENCIDO: "Vencido", NO_PEDIDO: "No pedido", ERROR_PROVEEDOR: "Error del proveedor", OTRO: "Otro" }
export const ALICUOTAS_IVA = ["0", "10.5", "21", "27"] as const
const SEL = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"

const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const uid = () => Math.random().toString(36).slice(2, 10)
const dia = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "")
const aTexto = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","))
const num = (n: number) => String(n).replace(".", ",")
const conParam = (url: string, k: string, v: string) => `${url}${url.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}`

/** Renglones de TODO el pedido, con lo recibido en blanco: el cajero confirma lo que llegó (nunca se supone). */
export function lineasDesdePedido(compra: CompraDetalle, catalogo: ReadonlyArray<ProductoCatalogo>): LineaForm[] {
  const porId = new Map(catalogo.map((p) => [p.id, p]))
  return compra.lineas.filter((l) => l.productoId).map((l) => {
    const p = porId.get(l.productoId!)
    return {
      uid: uid(), productoId: l.productoId!, productoVarianteId: l.productoVarianteId, compraLineaId: l.id, nombre: l.producto, variante: l.variante,
      unidadMedida: p?.unidadMedida ?? "unidad", fraccionable: p?.fraccionable ?? false, recibida: "", aceptada: "", motivoRechazo: "", detalleRechazo: "",
      costoUnitario: l.costoUnitarioAcordado ? aTexto(l.costoUnitarioAcordado) : "", descuentoPct: "", alicuotaPct: "21", pendientePedido: l.pendiente,
      infoPedido: { pedida: l.pedida, aceptada: l.recibida, enRevision: l.enRevision ?? 0, pendiente: l.pendiente },
    }
  })
}

/** Al retomar un borrador de un pedido: completa el avance y vuelve a mostrar los renglones que quedaron en 0. */
export function completarConPedido(f: FormRecepcion, compra: CompraDetalle, catalogo: ReadonlyArray<ProductoCatalogo>): FormRecepcion {
  const info = new Map(compra.lineas.map((l) => [l.id, { pedida: l.pedida, aceptada: l.recibida, enRevision: l.enRevision ?? 0, pendiente: l.pendiente }]))
  const presentes = new Set(f.lineas.map((l) => l.compraLineaId).filter(Boolean))
  const faltantes = lineasDesdePedido(compra, catalogo).filter((l) => !presentes.has(l.compraLineaId)).map((l) => ({ ...l, recibida: "0", aceptada: "0" }))
  return { ...f, lineas: [...f.lineas.map((l) => (l.compraLineaId && info.has(l.compraLineaId) ? { ...l, infoPedido: info.get(l.compraLineaId)!, pendientePedido: info.get(l.compraLineaId)!.pendiente } : l)), ...faltantes] }
}

export const formularioVacio = (): FormRecepcion => ({ proveedorId: "", compraId: "", fechaRecepcion: hoy(), comprobanteTipo: "", comprobanteNumero: "", comprobanteFecha: "", descuentoGlobal: "", percepciones: "", notas: "", lineas: [], cargos: [] })

export function formularioDesdeDetalle(d: RecepcionDetalle, catalogo: ReadonlyArray<ProductoCatalogo>): FormRecepcion {
  const porId = new Map(catalogo.map((p) => [p.id, p]))
  return {
    proveedorId: d.proveedor.id, compraId: d.compra?.id ?? "", fechaRecepcion: dia(d.fechaRecepcion), comprobanteTipo: d.comprobante.tipo ?? "", comprobanteNumero: d.comprobante.numero ?? "",
    comprobanteFecha: dia(d.comprobante.fecha), descuentoGlobal: d.descuentoGlobal ? aTexto(d.descuentoGlobal) : "", percepciones: d.percepciones ? aTexto(d.percepciones) : "", notas: d.notas ?? "",
    lineas: d.lineas.map((l) => {
      const p = l.productoId ? porId.get(l.productoId) : undefined
      return {
        uid: uid(), productoId: l.productoId ?? "", productoVarianteId: l.productoVarianteId, compraLineaId: l.compraLineaId, nombre: l.producto, variante: l.variante,
        unidadMedida: p?.unidadMedida ?? l.unidadMedida, fraccionable: p?.fraccionable ?? esFraccionable(l.unidadMedida),
        recibida: aTexto(l.cantidadRecibida), aceptada: aTexto(l.cantidadAceptada), motivoRechazo: l.motivoRechazo ?? "", detalleRechazo: l.detalleRechazo ?? "",
        costoUnitario: aTexto(l.costoUnitario), descuentoPct: l.descuentoPct ? aTexto(l.descuentoPct) : "", alicuotaPct: String(l.alicuotaImpuestoPct ?? 0), pendientePedido: null,
      }
    }),
    cargos: d.cargos.map((k) => ({ uid: uid(), tipo: k.tipo, proveedorId: k.proveedorId, concepto: k.concepto, importe: aTexto(k.importe), distribucion: k.distribucion ?? "VALOR" })),
  }
}

// ---------------------------------------------------------------------------
// Validación pura (exportada para tests)
// ---------------------------------------------------------------------------

/** Renglón del pedido marcado con 0 recibido: queda como faltante y no se envía. */
export const noLlego = (l: Pick<LineaForm, "compraLineaId" | "recibida">) => Boolean(l.compraLineaId) && /^0+([.,]0*)?$/.test(l.recibida.trim())

export const esFraccionable = (unidad: string | null | undefined) => ["kg", "g", "litro", "ml", "metro"].includes((unidad ?? "unidad").toLowerCase())

/** "12" / "1,5" → "1.500" (3 decimales). Enteros obligatorios si la unidad no es fraccionable. */
export function parseCantidad(texto: string, fraccionable: boolean, permitirCero = false): { ok: true; valor: string; milesimas: number } | { ok: false; error: string } {
  const t = texto.trim().replace(",", ".")
  if (!t) return { ok: false, error: "Ingresá la cantidad." }
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(t)) return { ok: false, error: fraccionable ? "Hasta 3 decimales." : "Usá números enteros." }
  if (!fraccionable && t.includes(".") && !/\.0{1,3}$/.test(t)) return { ok: false, error: "Este producto se cuenta por unidad: usá números enteros." }
  const [e, d = ""] = t.split(".")
  const milesimas = Number(e) * 1000 + Number(d.padEnd(3, "0"))
  if (!permitirCero && milesimas === 0) return { ok: false, error: "Tiene que ser mayor a cero." }
  return { ok: true, valor: `${Number(e)}.${d.padEnd(3, "0")}`, milesimas }
}

function parseDecimalTexto(texto: string, decimales: number, max: number): string | null {
  const t = texto.trim().replace(/^\$\s*/, "").replace(",", ".")
  if (!t) return null
  const re = new RegExp(`^\\d{1,10}(\\.\\d{1,${decimales}})?$`)
  if (!re.test(t) || Number(t) > max) return null
  return t
}

export type Errores = Record<string, string>

export function validarFormulario(f: FormRecepcion): { ok: true; body: Record<string, unknown> } | { ok: false; errores: Errores } {
  const errores: Errores = {}
  if (!f.proveedorId) errores.proveedorId = "Elegí el proveedor."
  if (!f.fechaRecepcion) errores.fechaRecepcion = "Indicá la fecha."
  const lineas: Array<Record<string, unknown>> = []
  for (const l of f.lineas) {
    const k = (c: string) => `linea.${l.uid}.${c}`
    if (l.compraLineaId && l.recibida.trim() === "") { errores[k("recibida")] = "Indicá cuánto llegó (0 si no llegó)."; continue }
    if (noLlego(l)) continue
    const rec = parseCantidad(l.recibida, l.fraccionable)
    const ace = parseCantidad(l.aceptada === "" ? l.recibida : l.aceptada, l.fraccionable, true)
    if (!rec.ok) errores[k("recibida")] = rec.error
    if (!ace.ok) errores[k("aceptada")] = ace.error
    if (rec.ok && ace.ok && ace.milesimas > rec.milesimas) errores[k("aceptada")] = "No puede superar lo recibido."
    const rechazo = rec.ok && ace.ok ? rec.milesimas - ace.milesimas : 0
    if (rechazo > 0 && !l.motivoRechazo) errores[k("motivoRechazo")] = "Elegí por qué no se acepta."
    if (rechazo > 0 && l.motivoRechazo === "OTRO" && !l.detalleRechazo.trim()) errores[k("detalleRechazo")] = "Contá el motivo."
    const costo = parseDecimalTexto(l.costoUnitario, 4, 9_999_999_999)
    if (costo === null) errores[k("costoUnitario")] = "Costo unitario en pesos (hasta 4 decimales)."
    const desc = l.descuentoPct.trim() ? parseDecimalTexto(l.descuentoPct, 2, 100) : "0"
    if (desc === null) errores[k("descuentoPct")] = "De 0 a 100 %."
    const iva = parseDecimalTexto(l.alicuotaPct || "0", 2, 100)
    if (iva === null) errores[k("alicuotaPct")] = "De 0 a 100 %."
    if (rec.ok && ace.ok && costo !== null && desc !== null && iva !== null) {
      lineas.push({
        productoId: l.productoId, productoVarianteId: l.productoVarianteId, compraLineaId: l.compraLineaId,
        cantidadRecibida: rec.valor, cantidadAceptada: ace.valor, costoUnitario: costo, descuentoPct: desc, alicuotaImpuestoPct: iva,
        ...(rechazo > 0 ? { motivoRechazo: l.motivoRechazo, detalleRechazo: l.detalleRechazo.trim() || null } : {}),
      })
    }
  }
  if (f.lineas.length === 0) errores.lineas = "Agregá al menos un producto."
  else if (!Object.keys(errores).some((x) => x.startsWith("linea.")) && lineas.length === 0) errores.lineas = "No hay nada recibido: anotá lo que llegó (o cerrá sin guardar)."
  const cargos: Array<Record<string, unknown>> = []
  for (const c of f.cargos) {
    const imp = parseImporteArs(c.importe)
    if (!c.concepto.trim()) errores[`cargo.${c.uid}.concepto`] = "Escribí el concepto."
    if (!imp.ok) errores[`cargo.${c.uid}.importe`] = imp.error
    if (c.concepto.trim() && imp.ok) cargos.push({ tipo: c.tipo, concepto: c.concepto.trim(), importe: imp.valor, proveedorId: c.proveedorId || null, ...(c.tipo === "ATRIBUIBLE" ? { distribucion: c.distribucion } : {}) })
  }
  const dg = f.descuentoGlobal.trim() ? parseImporteArs(f.descuentoGlobal) : null
  const pe = f.percepciones.trim() ? parseImporteArs(f.percepciones) : null
  if (dg && !dg.ok) errores.descuentoGlobal = dg.error
  if (pe && !pe.ok) errores.percepciones = pe.error
  if (Object.keys(errores).length) return { ok: false, errores }
  return {
    ok: true,
    body: {
      proveedorId: f.proveedorId, compraId: f.compraId || null, fechaRecepcion: f.fechaRecepcion,
      comprobanteTipo: f.comprobanteTipo.trim() || null, comprobanteNumero: f.comprobanteNumero.trim() || null, comprobanteFecha: f.comprobanteFecha || null,
      descuentoGlobal: dg && dg.ok ? dg.valor : "0", percepciones: pe && pe.ok ? pe.valor : "0", notas: f.notas.trim() || null, lineas, cargos,
    },
  }
}

/** Estimación en centavos enteros (la cifra válida es la del servidor). */
export function estimarTotal(f: FormRecepcion): number | null {
  let centavos = 0
  for (const l of f.lineas) {
    if (noLlego(l) || (l.compraLineaId && l.recibida.trim() === "")) continue
    const ace = parseCantidad(l.aceptada === "" ? l.recibida : l.aceptada, l.fraccionable, true)
    const costo = parseDecimalTexto(l.costoUnitario, 4, 9_999_999_999)
    if (!ace.ok || costo === null) return null
    const subtotal = Math.round((ace.milesimas * Number(costo)) / 10) // centavos
    const neto = subtotal - Math.round((subtotal * Number(l.descuentoPct.replace(",", ".") || 0)) / 100)
    centavos += neto + Math.round((neto * Number((l.alicuotaPct || "0").replace(",", "."))) / 100)
  }
  const dg = f.descuentoGlobal.trim() ? parseImporteArs(f.descuentoGlobal) : null
  const pe = f.percepciones.trim() ? parseImporteArs(f.percepciones) : null
  if (dg?.ok) centavos -= Math.round(Number(dg.valor) * 100)
  if (pe?.ok) centavos += Math.round(Number(pe.valor) * 100)
  for (const c of f.cargos) {
    const imp = parseImporteArs(c.importe)
    if (imp.ok && c.tipo === "ATRIBUIBLE" && (!c.proveedorId || c.proveedorId === f.proveedorId)) centavos += Math.round(Number(imp.valor) * 100)
  }
  return centavos / 100
}

// ---------------------------------------------------------------------------
// Borrador local (sólo comodidad de este dispositivo: el servidor es la fuente)
// ---------------------------------------------------------------------------

export const claveBorradorLocal = (scope: string, recepcionId: string | null) => `deligo:recepcion:${scope}:${recepcionId ?? "nueva"}`
export function leerBorradorLocal(clave: string): FormRecepcion | null {
  try {
    const raw = window.localStorage.getItem(clave)
    return raw ? (JSON.parse(raw) as FormRecepcion) : null
  } catch {
    return null
  }
}
/**
 * Un respaldo local sólo vale para el MISMO modo en que se guardó: el borrador de esa recepción, ese pedido, o una
 * recepción sin pedido (que nunca puede traer un pedido ni renglones de pedido). Cualquier otro se descarta.
 */
export function borradorLocalCorresponde(local: FormRecepcion, modo: { compraId: string | null }): boolean {
  if (modo.compraId) return local.compraId === modo.compraId
  return !local.compraId && local.lineas.every((l) => !l.compraLineaId)
}

function escribirBorradorLocal(clave: string, f: FormRecepcion | null) {
  try {
    if (f) window.localStorage.setItem(clave, JSON.stringify(f))
    else window.localStorage.removeItem(clave)
  } catch {
    /* almacenamiento no disponible: el formulario sigue en memoria */
  }
}

// ---------------------------------------------------------------------------
// Red
// ---------------------------------------------------------------------------

export type RespuestaEnvio = { ok: true; json: Record<string, any> } | { ok: false; status: number; code?: string; error: string; detalle?: Record<string, unknown>; incierto: boolean }

export async function enviarJson(url: string, method: "POST" | "PUT", body: unknown, key?: string): Promise<RespuestaEnvio> {
  let res: Response
  try {
    res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) })
  } catch {
    return { ok: false, status: 0, error: "No pudimos confirmar por un problema de conexión. Lo cargado quedó guardado en este dispositivo: podés reintentar sin duplicar.", incierto: true }
  }
  let esJson = true
  const json = (await res.json().catch(() => { esJson = false; return {} })) as Record<string, any>
  if (res.ok && json.ok !== false && esJson) return { ok: true, json }
  if (!esJson) return { ok: false, status: res.status, error: "No pudimos confirmar el resultado (respuesta inesperada del servidor). Revisamos el estado antes de reintentar.", incierto: true }
  const incierto = res.status >= 500
  return { ok: false, status: res.status, code: typeof json.code === "string" ? json.code : undefined, error: incierto ? "No pudimos confirmar por un error del servidor. Lo cargado quedó guardado: podés reintentar sin duplicar." : String(json.error ?? "No se pudo completar."), detalle: json.detalle, incierto }
}

export async function leerJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.ok === false) throw Object.assign(new Error(String(json.error ?? "No se pudo cargar.")), { status: res.status, estado: json.estado })
  return json as T
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export interface RecepcionEditorProps {
  scope: string
  detalle: RecepcionDetalle | null
  catalogoUrl: string
  cargarDatos: () => Promise<DatosRecepcion>
  compraUrl: (compraId: string) => string
  crearUrl: string
  recepcionUrl: (id: string) => string
  accionUrl: (id: string, accion: string) => string
  /** Cajero: «Enviar recepción». Dueño: sólo guardar (aprueba desde la bandeja). */
  permiteEnviar: boolean
  /** Recibir un pedido: proveedor y pedido ya elegidos y todos sus renglones cargados (sin elegir nada). */
  compraInicial?: string | null
  /** «Llegó mercadería sin pedido»: empieza vacía y no se puede asociar a un pedido (compraId siempre null). */
  sinPedido?: boolean
  onGuardado: (r: { id: string; version: number; numero?: number }) => void
  onEnviado?: (id: string) => void
  onCancelar: () => void
}

export function RecepcionEditor(props: RecepcionEditorProps) {
  const { detalle } = props
  // Cada pedido tiene su propio respaldo local (nunca se mezcla con «sin pedido» ni con otro pedido).
  const clave = claveBorradorLocal(props.scope, detalle?.id ?? (props.compraInicial ? `pedido-${props.compraInicial}` : null))
  const [catalogo, setCatalogo] = useState<ProductoCatalogo[] | null>(null)
  const [datos, setDatos] = useState<DatosRecepcion | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [f, setF] = useState<FormRecepcion>(() => formularioVacio())
  const [listo, setListo] = useState(false)
  const [errores, setErrores] = useState<Errores>({})
  const [aviso, setAviso] = useState<{ tono: "error" | "info" | "ok"; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const enCurso = useRef(false)
  const claves = useRef(new Map<string, string>())
  const [version, setVersion] = useState<number>(detalle?.version ?? 0)
  const [recepcionId, setRecepcionId] = useState<string | null>(detalle?.id ?? null)
  const [busqueda, setBusqueda] = useState("")
  const [escaner, setEscaner] = useState(false)
  const [eligiendoVariante, setEligiendoVariante] = useState<ProductoCatalogo | null>(null)
  const [anuncio, setAnuncio] = useState<(ScanFeedback & { id: number }) | null>(null)
  const [pedido, setPedido] = useState<{ numero: number; proveedor: string } | null>(null)
  const [deProveedor, setDeProveedor] = useState<{ proveedorId: string; claves: Set<string> } | null>(null)
  const [todoElCatalogo, setTodoElCatalogo] = useState(false)
  const [recuperado, setRecuperado] = useState(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const [cat, d] = await Promise.all([leerJson<{ productos: ProductoCatalogo[] }>(props.catalogoUrl), props.cargarDatos()])
        if (cancelado) return
        setCatalogo(cat.productos)
        setDatos(d)
        const compraId = detalle?.compra?.id ?? props.compraInicial ?? null
        const compra = compraId ? (await leerJson<{ compra: CompraDetalle }>(props.compraUrl(compraId))).compra : null
        if (cancelado) return
        if (compra) setPedido({ numero: compra.numero, proveedor: compra.proveedor.nombre })
        const guardado = leerBorradorLocal(clave)
        // Nunca se hereda nada de otro pedido u otra recepción: si el respaldo no corresponde a este modo, se descarta.
        const local = guardado && borradorLocalCorresponde(guardado, { compraId: detalle ? detalle.compra?.id ?? null : props.sinPedido ? null : props.compraInicial ?? null }) ? guardado : null
        if (guardado && !local) escribirBorradorLocal(clave, null)
        if (local) { setF(local); setRecuperado(true); setAviso({ tono: "info", texto: "Recuperamos lo que habías cargado en este dispositivo y todavía no se había guardado." }) }
        else if (detalle) setF(compra ? completarConPedido(formularioDesdeDetalle(detalle, cat.productos), compra, cat.productos) : formularioDesdeDetalle(detalle, cat.productos))
        else if (compra) setF({ ...formularioVacio(), proveedorId: compra.proveedor.id, compraId: compra.id, lineas: lineasDesdePedido(compra, cat.productos) })
        setListo(true)
      } catch {
        if (!cancelado) setErrorCarga("No se pudieron cargar los productos o proveedores. Revisá la conexión y volvé a intentar.")
      }
    })()
    return () => { cancelado = true }
  }, [])

  // Cada cambio queda en este dispositivo hasta que el servidor lo confirme.
  useEffect(() => { if (listo) escribirBorradorLocal(clave, f) }, [f, listo, clave])

  // Lo que entrega el proveedor elegido aparece primero (configuración del dueño; sin precios).
  useEffect(() => {
    if (!f.proveedorId) return
    let cancelado = false
    leerJson<{ proveedorProductos?: string[] }>(conParam(props.catalogoUrl, "proveedorId", f.proveedorId))
      .then((r) => { if (!cancelado) setDeProveedor({ proveedorId: f.proveedorId, claves: new Set(r.proveedorProductos ?? []) }) })
      .catch(() => undefined)
    return () => { cancelado = true }
  }, [f.proveedorId, props.catalogoUrl])

  const set = <K extends keyof FormRecepcion>(k: K, v: FormRecepcion[K]) => { setF((x) => ({ ...x, [k]: v })); setErrores((e) => { const { [k as string]: _, ...resto } = e; return resto }) }
  const setLinea = (u: string, cambios: Partial<LineaForm>) => setF((x) => ({ ...x, lineas: x.lineas.map((l) => (l.uid === u ? { ...l, ...cambios } : l)) }))
  const setCargo = (u: string, cambios: Partial<CargoForm>) => setF((x) => ({ ...x, cargos: x.cargos.map((c) => (c.uid === u ? { ...c, ...cambios } : c)) }))

  const comprasDelProveedor = useMemo(() => (datos?.comprasAbiertas ?? []).filter((c) => c.proveedorId === f.proveedorId), [datos, f.proveedorId])
  const clavesProv = deProveedor && deProveedor.proveedorId === f.proveedorId ? deProveedor.claves : null
  const esDelProveedor = (p: ProductoCatalogo) => Boolean(clavesProv && (clavesProv.has(p.id) || p.variantes.some((v) => clavesProv.has(`${p.id}:${v.id}`))))
  const hayDelProveedor = Boolean(clavesProv && clavesProv.size > 0)
  const resultados = useMemo(() => {
    if (!catalogo) return []
    const filtroProveedor = hayDelProveedor && !todoElCatalogo
    if (!busqueda.trim()) return filtroProveedor ? catalogo.filter(esDelProveedor).slice(0, 12) : []
    const encontrados = catalogo.filter((p) => matchesCajaSearch(p, busqueda) && (!filtroProveedor || esDelProveedor(p)))
    return [...encontrados.filter(esDelProveedor), ...encontrados.filter((p) => !esDelProveedor(p))].slice(0, 8)
  }, [catalogo, busqueda, clavesProv, todoElCatalogo, hayDelProveedor])
  const total = estimarTotal(f)

  function agregar(p: ProductoCatalogo, varianteId: string | null, cantidad = "") {
    const v = varianteId ? p.variantes.find((x) => x.id === varianteId) ?? null : null
    setF((x) => {
      const existente = x.lineas.find((l) => l.productoId === p.id && l.productoVarianteId === varianteId && !l.compraLineaId)
      if (existente && cantidad) {
        const actual = parseCantidad(existente.recibida || "0", existente.fraccionable, true)
        const suma = actual.ok ? actual.milesimas + 1000 : 1000
        const texto = String(suma / 1000).replace(".", ",")
        return { ...x, lineas: x.lineas.map((l) => (l.uid === existente.uid ? { ...l, recibida: texto, aceptada: l.aceptada === l.recibida ? texto : l.aceptada } : l)) }
      }
      return { ...x, lineas: [...x.lineas, { uid: uid(), productoId: p.id, productoVarianteId: varianteId, compraLineaId: null, nombre: p.nombre, variante: v?.nombre ?? null, unidadMedida: p.unidadMedida, fraccionable: p.fraccionable, recibida: cantidad, aceptada: cantidad, motivoRechazo: "", detalleRechazo: "", costoUnitario: "", descuentoPct: "", alicuotaPct: "21", pendientePedido: null }] }
    })
    setBusqueda("")
    setErrores((e) => { const { lineas: _, ...resto } = e; return resto })
  }

  function elegirProducto(p: ProductoCatalogo) {
    if (p.variantes.length > 0) setEligiendoVariante(p)
    else agregar(p, null)
  }

  function codigoEscaneado(code: string): ScanFeedback {
    const c = code.trim().toLowerCase()
    if (!catalogo) return { tone: "error", title: "Catálogo no disponible" }
    for (const p of catalogo) {
      const v = p.variantes.find((x) => (x.codigoBarras ?? "").toLowerCase() === c || (x.sku ?? "").toLowerCase() === c)
      if (v) { agregar(p, v.id, "1"); return { tone: "success", title: `${p.nombre} — ${v.nombre}`, detail: "+1 recibido" } }
      if ((p.codigoBarras ?? "").toLowerCase() === c || (p.sku ?? "").toLowerCase() === c) {
        if (p.variantes.length > 0) { setEligiendoVariante(p); setEscaner(false); return { tone: "warning", title: p.nombre, detail: "Elegí la variante" } }
        agregar(p, null, "1")
        return { tone: "success", title: p.nombre, detail: "+1 recibido" }
      }
    }
    return { tone: "error", title: "Código no encontrado", detail: code }
  }

  async function elegirCompra(compraId: string) {
    set("compraId", compraId)
    if (!compraId) return
    try {
      const { compra } = await leerJson<{ compra: CompraDetalle }>(props.compraUrl(compraId))
      setF((x) => ({ ...x, compraId, lineas: [...x.lineas.filter((l) => !l.compraLineaId), ...lineasDesdePedido(compra, catalogo ?? [])] }))
    } catch {
      setAviso({ tono: "error", texto: "No se pudo cargar el pedido." })
    }
  }

  async function guardar(): Promise<{ id: string; version: number } | null> {
    // Sin pedido: nunca viaja un pedido ni un renglón de pedido (aunque algo quedara en memoria).
    const v = validarFormulario(props.sinPedido && !detalle ? { ...f, compraId: "", lineas: f.lineas.filter((l) => !l.compraLineaId) } : f)
    if (!v.ok) { setErrores(v.errores); setAviso({ tono: "error", texto: "Revisá los campos marcados." }); return null }
    if (enCurso.current) return null
    enCurso.current = true
    setEnviando(true)
    setAviso(null)
    try {
      if (!recepcionId) {
        const canonico = JSON.stringify(v.body)
        let key = claves.current.get(canonico)
        if (!key) { key = newIdempotencyKey(); claves.current.set(canonico, key) }
        const r = await enviarJson(props.crearUrl, "POST", v.body, key)
        if (!r.ok && r.code === "BORRADOR_EXISTENTE" && typeof r.detalle?.recepcionId === "string") {
          claves.current.delete(canonico)
          escribirBorradorLocal(clave, null)
          props.onGuardado({ id: r.detalle.recepcionId, version: 0, numero: Number(r.detalle.numero) })
          return null
        }
        if (!r.ok) { if (!r.incierto) claves.current.delete(canonico); setAviso({ tono: "error", texto: r.error }); return null }
        claves.current.delete(canonico)
        const nuevo = { id: String(r.json.recepcionId), version: Number(r.json.version ?? 1) }
        escribirBorradorLocal(clave, null)
        setRecepcionId(nuevo.id)
        setVersion(nuevo.version)
        props.onGuardado({ ...nuevo, numero: r.json.numero })
        setAviso({ tono: "ok", texto: `Borrador guardado (recepción N° ${r.json.numero}).` })
        return nuevo
      }
      const r = await enviarJson(props.recepcionUrl(recepcionId), "PUT", { ...v.body, version })
      if (!r.ok && (r.code === "RECEPCION_CERRADA" || r.code === "VERSION_CAMBIADA" || r.incierto)) {
        // ¿Ya se envió (por ejemplo, desde otra pestaña o un intento anterior)? Se muestra el estado real.
        const real = await leerJson<{ recepcion: RecepcionDetalle }>(props.recepcionUrl(recepcionId)).then((x) => x.recepcion).catch(() => null)
        if (real?.estado === "PENDIENTE_APROBACION") { escribirBorradorLocal(clave, null); props.onEnviado?.(recepcionId); return null }
        if (real && real.estado !== "BORRADOR") { setAviso({ tono: "info", texto: `Esta recepción ya no es un borrador (${ESTADO_RECEPCION[real.estado]?.texto ?? real.estado}). Cerrala para ver cómo quedó.` }); return null }
      }
      if (!r.ok) {
        setAviso({ tono: "error", texto: r.code === "VERSION_CAMBIADA" ? "Otra persona cambió esta recepción. Cerrala y abrila de nuevo para ver la versión actual (lo tuyo queda guardado en este dispositivo)." : r.error })
        return null
      }
      const nuevo = { id: recepcionId, version: Number(r.json.version) }
      escribirBorradorLocal(clave, null)
      escribirBorradorLocal(claveBorradorLocal(props.scope, null), null)
      setVersion(nuevo.version)
      props.onGuardado(nuevo)
      setAviso({ tono: "ok", texto: "Cambios guardados." })
      return nuevo
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  async function guardarYEnviar() {
    const g = await guardar()
    if (!g) return
    enCurso.current = true
    setEnviando(true)
    try {
      const k = `envio:${g.id}:${g.version}`
      let key = claves.current.get(k)
      if (!key) { key = newIdempotencyKey(); claves.current.set(k, key) }
      const r = await enviarJson(props.accionUrl(g.id, "envio"), "POST", { version: g.version }, key)
      if (r.ok) { props.onEnviado?.(g.id); return }
      // Antes de mostrar un error, se mira el estado real: si ya quedó enviada, eso es lo que se muestra.
      const real = await leerJson<{ recepcion: RecepcionDetalle }>(props.recepcionUrl(g.id)).then((x) => x.recepcion).catch(() => null)
      if (real && real.estado !== "BORRADOR") { props.onEnviado?.(g.id); return }
      setAviso({ tono: "error", texto: real ? `${r.error} La recepción sigue como borrador: podés volver a enviarla.` : r.error })
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  if (errorCarga) return <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{errorCarga}</p>
  if (!listo || !catalogo || !datos) return <p className="text-sm text-muted-foreground">Cargando productos y proveedores…</p>

  const err = (k: string) => (errores[k] ? <span className="block text-xs font-normal text-rose-700 dark:text-rose-300">{errores[k]}</span> : null)
  const titulo = recepcionId ? `Recepción N° ${detalle?.numero ?? ""}`.trim() : pedido && f.compraId ? `Recibir pedido N° ${pedido.numero}` : "Nueva recepción"

  return (
    <div className="space-y-4" aria-label="Editor de recepción">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{titulo}</h3>
        <span className="text-xs text-muted-foreground">Borrador: no mueve stock ni genera deuda hasta que el dueño lo apruebe.</span>
      </div>
      {detalle?.estado === "BORRADOR" && detalle.historial.some((h) => h.tipo === "DEVOLUCION_A_BORRADOR") && (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" data-testid="devuelta">
          El dueño la devolvió para corregir: «{[...detalle.historial].reverse().find((h) => h.tipo === "DEVOLUCION_A_BORRADOR")?.motivo}».
        </p>
      )}

      <fieldset className="grid gap-3 rounded-2xl border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">{pedido ? "Pedido y comprobante" : "Proveedor y comprobante"}</legend>
        {pedido && f.compraId ? (
          <div className="rounded-xl bg-muted/50 p-2 text-sm sm:col-span-2" data-testid="pedido-fijo">
            <p className="font-semibold">Pedido N° {pedido.numero} · {pedido.proveedor}</p>
            <p className="text-xs text-muted-foreground">Anotá en cada producto lo que llegó. Si algo no vino, tocá «No llegó».</p>
          </div>
        ) : (<>
        <label className="block space-y-1 text-sm font-medium" htmlFor="rec-proveedor"><span>Proveedor</span>
          <select id="rec-proveedor" className={SEL} value={f.proveedorId} onChange={(e) => { set("proveedorId", e.target.value); set("compraId", "") }}>
            <option value="">Elegí…</option>
            {datos.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>{err("proveedorId")}
        </label>
        {!props.sinPedido && <label className="block space-y-1 text-sm font-medium" htmlFor="rec-compra"><span>Pedido (opcional)</span>
          <select id="rec-compra" className={SEL} value={f.compraId} disabled={!f.proveedorId} onChange={(e) => void elegirCompra(e.target.value)}>
            <option value="">Sin pedido (compra directa)</option>
            {comprasDelProveedor.map((c) => <option key={c.id} value={c.id}>Pedido N° {c.numero}</option>)}
          </select>
        </label>}
        {props.sinPedido && <p className="self-end pb-2 text-xs text-muted-foreground">Mercadería sin pedido: no se descuenta de ningún pedido.</p>}
        </>)}
        <label className="block space-y-1 text-sm font-medium" htmlFor="rec-fecha"><span>Fecha de recepción</span><Input id="rec-fecha" type="date" max={hoy()} value={f.fechaRecepcion} onChange={(e) => set("fechaRecepcion", e.target.value)} className="h-11 rounded-xl" />{err("fechaRecepcion")}</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1 text-sm font-medium" htmlFor="rec-comp-tipo"><span>Comprobante</span><Input id="rec-comp-tipo" placeholder="Factura A, remito…" maxLength={40} value={f.comprobanteTipo} onChange={(e) => set("comprobanteTipo", e.target.value)} className="h-11 rounded-xl" /></label>
          <label className="block space-y-1 text-sm font-medium" htmlFor="rec-comp-num"><span>Número</span><Input id="rec-comp-num" maxLength={60} value={f.comprobanteNumero} onChange={(e) => set("comprobanteNumero", e.target.value)} className="h-11 rounded-xl" /></label>
        </div>
      </fieldset>

      <section className="space-y-2 rounded-2xl border p-3" aria-label="Productos recibidos">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Productos recibidos ({f.lineas.length})</h4>
          <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={() => setEscaner(true)}><ScanBarcode className="mr-1 h-4 w-4" />Escanear</Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar producto para recibir" placeholder={f.compraId ? "Agregar un producto que no estaba en el pedido" : "Buscar por nombre, marca, SKU o código"} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="h-11 rounded-xl pl-9" />
        </div>
        {hayDelProveedor && (
          <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="h-4 w-4" checked={todoElCatalogo} onChange={(e) => setTodoElCatalogo(e.target.checked)} />Buscar en todo el catálogo (no sólo lo que entrega este proveedor)</label>
        )}
        {hayDelProveedor && !todoElCatalogo && !busqueda.trim() && resultados.length > 0 && !f.compraId && <p className="text-xs font-medium">Lo que entrega este proveedor</p>}
        {resultados.length > 0 && (busqueda.trim() || !f.compraId) && (
          <ul className="space-y-1" aria-label="Resultados">
            {resultados.map((p) => (
              <li key={p.id}><button type="button" onClick={() => elegirProducto(p)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm hover:bg-muted/50">
                <span className="min-w-0 break-words">{p.nombre}{p.marca ? ` · ${p.marca}` : ""}{hayDelProveedor && todoElCatalogo && esDelProveedor(p) ? <span className="ml-1 text-xs text-emerald-700 dark:text-emerald-300">· de este proveedor</span> : null}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.variantes.length ? `${p.variantes.length} variantes` : p.unidadMedida}</span>
              </button></li>
            ))}
          </ul>
        )}
        {eligiendoVariante && (
          <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-2" role="dialog" aria-label="Elegir variante">
            <p className="text-sm font-medium">{eligiendoVariante.nombre}: elegí la variante</p>
            <div className="flex flex-wrap gap-2">
              {eligiendoVariante.variantes.map((v) => <Button key={v.id} type="button" variant="outline" className="min-h-11 rounded-xl" onClick={() => { agregar(eligiendoVariante, v.id); setEligiendoVariante(null); setAnuncio({ id: Date.now(), tone: "success", title: `${eligiendoVariante.nombre} — ${v.nombre}` }) }}>{v.nombre}</Button>)}
              <Button type="button" variant="ghost" className="min-h-11 rounded-xl" onClick={() => setEligiendoVariante(null)}>Cancelar</Button>
            </div>
          </div>
        )}
        {err("lineas")}
        <ul className="space-y-2" aria-label="Renglones">
          {f.lineas.map((l) => {
            const rec = parseCantidad(l.recibida, l.fraccionable, true)
            const ace = parseCantidad(l.aceptada === "" ? l.recibida : l.aceptada, l.fraccionable, true)
            const rechazo = rec.ok && ace.ok ? Math.max(rec.milesimas - ace.milesimas, 0) / 1000 : 0
            const k = (c: string) => `linea.${l.uid}.${c}`
            const unidad = l.fraccionable ? l.unidadMedida : "u."
            const ip = l.infoPedido ?? null
            const faltante = noLlego(l)
            return (
              <li key={l.uid} className={cn("space-y-2 rounded-xl border p-2", faltante && "bg-muted/40", l.compraLineaId && l.recibida.trim() === "" && "border-amber-300")} data-testid="renglon">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{l.nombre}{l.variante ? ` — ${l.variante}` : ""}{!l.compraLineaId && f.compraId ? <span className="ml-1 text-xs font-normal text-amber-700 dark:text-amber-300">(no estaba en el pedido)</span> : null}</p>
                    {ip && (
                      <p className="text-xs text-muted-foreground" data-testid="avance-renglon">Pedido {num(ip.pedida)} · aceptado antes {num(ip.aceptada)}{ip.enRevision > 0 ? ` · enviado sin aprobar ${num(ip.enRevision)}` : ""} · <strong className={cn(ip.pendiente > 0 && "text-foreground")}>pendiente {num(ip.pendiente)}</strong></p>
                    )}
                    {!ip && l.pendientePedido !== null && <p className="text-xs text-muted-foreground">Pendiente del pedido: {num(l.pendientePedido)}</p>}
                    {faltante && <p className="text-xs font-medium text-muted-foreground">No llegó: queda pendiente en el pedido.</p>}
                  </div>
                  {l.compraLineaId
                    ? <Button type="button" variant="outline" className="min-h-11 shrink-0 rounded-xl text-xs" aria-label={`${l.nombre}: no llegó`} onClick={() => setLinea(l.uid, faltante ? { recibida: "", aceptada: "" } : { recibida: "0", aceptada: "0", motivoRechazo: "", detalleRechazo: "" })}>{faltante ? "Sí llegó" : "No llegó"}</Button>
                    : <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label={`Quitar ${l.nombre}`} onClick={() => setF((x) => ({ ...x, lineas: x.lineas.filter((y) => y.uid !== l.uid) }))}><Trash2 className="h-4 w-4" /></Button>}
                </div>
                {!faltante && <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="block space-y-1 text-xs font-medium" htmlFor={k("recibida")}><span>Llegó ({unidad})</span><Input id={k("recibida")} inputMode={l.fraccionable ? "decimal" : "numeric"} placeholder={l.compraLineaId ? "¿Cuánto?" : undefined} value={l.recibida} onChange={(e) => setLinea(l.uid, { recibida: e.target.value, ...(l.aceptada === l.recibida ? { aceptada: e.target.value } : {}) })} className="h-11 rounded-xl" />{err(k("recibida"))}</label>
                  <label className="block space-y-1 text-xs font-medium" htmlFor={k("aceptada")}><span>Aceptado (en buen estado)</span><Input id={k("aceptada")} inputMode={l.fraccionable ? "decimal" : "numeric"} value={l.aceptada} onChange={(e) => setLinea(l.uid, { aceptada: e.target.value })} className="h-11 rounded-xl" />{err(k("aceptada"))}</label>
                  <label className="block space-y-1 text-xs font-medium" htmlFor={k("costoUnitario")}><span>Costo unitario sin IVA</span><Input id={k("costoUnitario")} inputMode="decimal" placeholder="0,00" value={l.costoUnitario} onChange={(e) => setLinea(l.uid, { costoUnitario: e.target.value })} className="h-11 rounded-xl" />{err(k("costoUnitario"))}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1 text-xs font-medium" htmlFor={k("descuentoPct")}><span>Desc. %</span><Input id={k("descuentoPct")} inputMode="decimal" placeholder="0" value={l.descuentoPct} onChange={(e) => setLinea(l.uid, { descuentoPct: e.target.value })} className="h-11 rounded-xl" />{err(k("descuentoPct"))}</label>
                    <label className="block space-y-1 text-xs font-medium" htmlFor={k("alicuotaPct")}><span>IVA %</span>
                      <select id={k("alicuotaPct")} className={SEL} value={l.alicuotaPct} onChange={(e) => setLinea(l.uid, { alicuotaPct: e.target.value })}>{ALICUOTAS_IVA.map((a) => <option key={a} value={a}>{a.replace(".", ",")}</option>)}</select>
                    </label>
                  </div>
                </div>
                {rechazo > 0 && (
                  <div className="grid gap-2 rounded-lg bg-amber-50 p-2 sm:grid-cols-2 dark:bg-amber-950/30">
                    <label className="block space-y-1 text-xs font-medium" htmlFor={k("motivoRechazo")}><span>No se aceptan {String(rechazo).replace(".", ",")}: motivo</span>
                      <select id={k("motivoRechazo")} className={SEL} value={l.motivoRechazo} onChange={(e) => setLinea(l.uid, { motivoRechazo: e.target.value })}><option value="">Elegí…</option>{Object.entries(MOTIVOS_RECHAZO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>{err(k("motivoRechazo"))}
                    </label>
                    <label className="block space-y-1 text-xs font-medium" htmlFor={k("detalleRechazo")}><span>Detalle {l.motivoRechazo === "OTRO" ? "" : "(opcional)"}</span><Input id={k("detalleRechazo")} maxLength={300} value={l.detalleRechazo} onChange={(e) => setLinea(l.uid, { detalleRechazo: e.target.value })} className="h-11 rounded-xl" />{err(k("detalleRechazo"))}</label>
                  </div>
                )}
                </>}
              </li>
            )
          })}
        </ul>
      </section>

      <details className="rounded-2xl border p-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Descuentos, percepciones y cargos ({f.cargos.length})</summary>
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1 text-xs font-medium" htmlFor="rec-desc-global"><span>Descuento del comprobante ($)</span><Input id="rec-desc-global" inputMode="decimal" value={f.descuentoGlobal} onChange={(e) => set("descuentoGlobal", e.target.value)} className="h-11 rounded-xl" />{err("descuentoGlobal")}</label>
            <label className="block space-y-1 text-xs font-medium" htmlFor="rec-percepciones"><span>Percepciones ($)</span><Input id="rec-percepciones" inputMode="decimal" value={f.percepciones} onChange={(e) => set("percepciones", e.target.value)} className="h-11 rounded-xl" />{err("percepciones")}</label>
          </div>
          {f.cargos.map((c) => (
            <div key={c.uid} className="space-y-2 rounded-xl border p-2" data-testid="cargo">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block space-y-1 text-xs font-medium" htmlFor={`cargo-${c.uid}-concepto`}><span>Concepto</span><Input id={`cargo-${c.uid}-concepto`} maxLength={120} placeholder="Flete, seguro…" value={c.concepto} onChange={(e) => setCargo(c.uid, { concepto: e.target.value })} className="h-11 rounded-xl" />{err(`cargo.${c.uid}.concepto`)}</label>
                <label className="block space-y-1 text-xs font-medium" htmlFor={`cargo-${c.uid}-importe`}><span>Importe</span><Input id={`cargo-${c.uid}-importe`} inputMode="decimal" value={c.importe} onChange={(e) => setCargo(c.uid, { importe: e.target.value })} className="h-11 rounded-xl" />{err(`cargo.${c.uid}.importe`)}</label>
                <label className="block space-y-1 text-xs font-medium" htmlFor={`cargo-${c.uid}-tipo`}><span>Tratamiento</span>
                  <select id={`cargo-${c.uid}-tipo`} className={SEL} value={c.tipo} onChange={(e) => setCargo(c.uid, { tipo: e.target.value as CargoForm["tipo"] })}><option value="ATRIBUIBLE">Se suma al costo de esta mercadería</option><option value="NO_ATRIBUIBLE">Es un gasto (no va al costo)</option></select>
                </label>
                <label className="block space-y-1 text-xs font-medium" htmlFor={`cargo-${c.uid}-prov`}><span>Lo cobra</span>
                  <select id={`cargo-${c.uid}-prov`} className={SEL} value={c.proveedorId} onChange={(e) => setCargo(c.uid, { proveedorId: e.target.value })}><option value="">El mismo proveedor</option>{datos.proveedores.filter((p) => p.id !== f.proveedorId).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
                </label>
                {c.tipo === "ATRIBUIBLE" && (
                  <label className="block space-y-1 text-xs font-medium" htmlFor={`cargo-${c.uid}-dist`}><span>Se reparte</span>
                    <select id={`cargo-${c.uid}-dist`} className={SEL} value={c.distribucion} onChange={(e) => setCargo(c.uid, { distribucion: e.target.value as CargoForm["distribucion"] })}><option value="VALOR">Según el valor de cada producto</option><option value="CANTIDAD">Según la cantidad</option></select>
                  </label>
                )}
              </div>
              <Button type="button" variant="ghost" className="min-h-11 rounded-xl text-rose-700" onClick={() => setF((x) => ({ ...x, cargos: x.cargos.filter((y) => y.uid !== c.uid) }))}>Quitar cargo</Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={() => setF((x) => ({ ...x, cargos: [...x.cargos, { uid: uid(), tipo: "ATRIBUIBLE", proveedorId: "", concepto: "", importe: "", distribucion: "VALOR" }] }))}><Plus className="mr-1 h-4 w-4" />Agregar cargo</Button>
          <label className="block space-y-1 text-xs font-medium" htmlFor="rec-notas"><span>Notas (opcional)</span><Textarea id="rec-notas" maxLength={500} value={f.notas} onChange={(e) => set("notas", e.target.value)} className="rounded-xl" /></label>
        </div>
      </details>

      <div className="space-y-2 rounded-2xl border p-3">
        <p className="text-sm">Total estimado del comprobante: <strong className="tabular-nums" data-testid="total-estimado">{total === null ? "—" : formatoArs(total)}</strong></p>
        <p className="text-xs text-muted-foreground">Es una estimación: el importe exacto lo calcula el sistema cuando el dueño aprueba.</p>
        {recuperado && aviso?.tono === "info" && (
          <Button type="button" variant="ghost" className="min-h-11 rounded-xl text-xs" onClick={() => {
            escribirBorradorLocal(clave, null)
            setRecuperado(false)
            setAviso(null)
            setErrores({})
            setF(detalle && catalogo ? formularioDesdeDetalle(detalle, catalogo) : { ...formularioVacio(), proveedorId: props.sinPedido ? "" : f.proveedorId })
          }}>Descartar lo recuperado y empezar de nuevo</Button>
        )}
        {aviso && <p role={aviso.tono === "error" ? "alert" : "status"} className={cn("rounded-lg p-2 text-sm", aviso.tono === "error" && "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100", aviso.tono === "ok" && "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100", aviso.tono === "info" && "bg-muted text-foreground")}>{aviso.texto}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={props.permiteEnviar ? "outline" : "default"} className="min-h-11 rounded-xl" disabled={enviando} onClick={() => void guardar()}>{enviando ? "Guardando…" : "Guardar borrador"}</Button>
          {props.permiteEnviar && <Button type="button" className="min-h-11 rounded-xl" disabled={enviando} onClick={() => void guardarYEnviar()}>{enviando ? "Enviando…" : "Enviar recepción"}</Button>}
          <Button type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={enviando} onClick={() => { escribirBorradorLocal(clave, null); props.onCancelar() }}>Cerrar</Button>
        </div>
      </div>

      {escaner && (
        <BarcodeScanner mode="continuous" title="Escanear mercadería" onClose={() => setEscaner(false)} onCode={codigoEscaneado} paused={eligiendoVariante !== null} announcement={anuncio}
          footer={<p className="text-sm">{f.lineas.length} renglones cargados</p>} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Listas (cajero y dueño)
// ---------------------------------------------------------------------------

export type FilaRecepcion = {
  id: string; numero: number; estado: string; version: number; fechaRecepcion: string; comprobante: string | null
  proveedor: { id: string; nombre: string }; compra: { id: string; numero: number } | null; lineas: number
  ultimaObservacion: { tipo: string; motivo: string | null; createdAt: string } | null; updatedAt: string
}

export const ESTADO_RECEPCION: Record<string, { texto: string; clase: string }> = {
  BORRADOR: { texto: "Borrador", clase: "bg-muted text-foreground" },
  PENDIENTE_APROBACION: { texto: "Enviada · Pendiente de aprobación", clase: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100" },
  APROBADA: { texto: "Aprobada", clase: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100" },
  RECHAZADA: { texto: "Rechazada", clase: "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-100" },
  DESCARTADA: { texto: "Descartada", clase: "bg-muted text-muted-foreground" },
}

/** Una recepción del cajero necesita su atención si es un borrador devuelto por el dueño. */
export const fueDevuelta = (r: Pick<FilaRecepcion, "estado" | "ultimaObservacion">) => r.estado === "BORRADOR" && r.ultimaObservacion?.tipo === "DEVOLUCION_A_BORRADOR"
