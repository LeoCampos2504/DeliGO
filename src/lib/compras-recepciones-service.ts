// ============================================
// F10-C2a — compras y recepciones de mercadería (server only, ÚNICO escritor de C2a)
// ============================================
// Diseño v2 §4.4, §6, §7, §8. Reglas:
//   - Un BORRADOR (o una recepción PENDIENTE_APROBACION) no mueve stock ni genera deuda.
//   - Preparan dueño y cajeros (D-12); aprueba, rechaza o devuelve SÓLO el dueño.
//   - La aprobación es UNA transacción Serializable: CAS de estado + versión, costos congelados
//     por línea, entrada de stock por la autoridad R3A (registrarEntradaRecepcion), «último
//     costo» en orden real de recepciones, UNA obligación RECEPCION de F5 (más una por cargo con
//     obligación propia) y, si el dueño lo pide, aplicación de anticipos con el motor ÚNICO de F5.
//     Cualquier fallo después de la primera escritura aborta TODO (excepción → rollback).
//   - Nada cerrado se edita: aprobada / rechazada / descartada son terminales; las correcciones
//     son documentos nuevos (eventos append-only, ajustes de F5, devoluciones en C2c).
//   - Ninguna escritura toca el libro financiero ni los egresos de Caja (los pagos ya existentes
//     se aplican como créditos de F5, nunca como movimientos nuevos).
//   - Idempotency-Key + huella en cada acción; auditoría en la MISMA transacción (R1).

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { runSerializable } from "@/lib/caja-devoluciones-service"
import { registrarEntradaRecepcion, mapStockLifecycleError } from "@/lib/stock-lifecycle"
import { asociarProductosDeRecepcion } from "@/lib/proveedor-productos-service"
import { aplicarPreciosEnTx, parseSeleccionPrecios, propuestaParaRespuesta, proponerPreciosEnTx, type SeleccionPrecio } from "@/lib/precios-venta-service"
import { bloquearPagosEnTx, marcarAcreditadosEnTx, pagosDeRecepcion, pagosSugeridos, planificarPagosEnTx, resumenPagos } from "@/lib/recepcion-pagos-service"
import {
  anticiposDisponibles,
  bloquearProveedor,
  crearObligacionDeRecepcionEnTx,
  operarAsignacionesEnTx,
  type AuditoriaEnTx,
} from "@/lib/cuenta-proveedor-service"
import {
  CalculoCompraError,
  TRATAMIENTOS_IMPUESTOS,
  calcularRecepcion,
  claveComprobante,
  claveStock,
  diferenciaPct,
  esMasReciente,
  type ResultadoRecepcion,
  type TratamientoImpuestos,
} from "@/lib/compras-calculo"
import { moneyToNumber } from "@/lib/money"
import { anticiposPorPedido, pagosDePedido, pagosDePedidoParaRespuesta, planAnticiposPedido } from "@/lib/pagos-pedido-service"
import { mapaNombresVisibles } from "@/lib/empleado-identidad"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
const D = Prisma.Decimal
type Dec = Prisma.Decimal
const CERO = new D(0)

export type ActorCompra = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }

export type CompraResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string; code?: string; detalle?: Record<string, unknown> }

const fail = (status: 400 | 403 | 404 | 409, error: string, code?: string, detalle?: Record<string, unknown>) =>
  ({ ok: false as const, status, error, ...(code ? { code } : {}), ...(detalle ? { detalle } : {}) })

/** Fallo de dominio DESPUÉS de haber escrito: se lanza para que la transacción haga rollback. */
class AbortoTransaccion extends Error {
  constructor(readonly resultado: Extract<CompraResult<never>, { ok: false }>) {
    super(resultado.error)
  }
}

export const MOTIVOS_RECHAZO_LINEA = ["DANADO", "VENCIDO", "NO_PEDIDO", "ERROR_PROVEEDOR", "OTRO"] as const
export const UMBRAL_DIFERENCIA_COSTO_PCT = 20
/** Unidades de medida que admiten cantidades con decimales; el resto (unidad, caja, paquete, otro) sólo enteros. */
export const UNIDADES_FRACCIONABLES = ["kg", "g", "litro", "ml", "metro"] as const
export const esUnidadFraccionable = (unidad: string | null | undefined) => (UNIDADES_FRACCIONABLES as readonly string[]).includes((unidad ?? "unidad").toLowerCase())
const MAX_LINEAS = 200
const MAX_CARGOS = 20
const TEXTO_MAX = 500

const huella = (partes: unknown[]) => createHash("sha256").update(JSON.stringify(partes)).digest("hex")
const CLAVE_REQUERIDA = fail(400, "Falta una Idempotency-Key válida.", "IDEMPOTENCY_KEY_REQUIRED")
const CLAVE_REUSADA = fail(409, "Este intento ya se usó con otros datos.", "IDEMPOTENCY_KEY_REUSED")
const claveValida = (k: string) => (isValidVentaIdempotencyKey(k) ? k.toLowerCase() : null)
const n = (v: Dec | null | undefined) => (v == null ? null : moneyToNumber(v))
const q = (v: Dec | null | undefined) => (v == null ? null : Number(v.toString()))
const actorId = (negocioId: string, a: ActorCompra) => (a.tipo === "NEGOCIO" ? negocioId : a.empleadoId)

// ---------------------------------------------------------------------------
// Parseo (puro)
// ---------------------------------------------------------------------------

function decimal(v: unknown, escala: number, max: number): Dec | null {
  if (typeof v !== "string" && typeof v !== "number") return null
  const t = typeof v === "number" ? String(v) : v.trim().replace(",", ".")
  if (!/^\d{1,13}(\.\d+)?$/.test(t)) return null
  let d: Dec
  try { d = new D(t) } catch { return null }
  if (d.isNegative() || d.decimalPlaces() > escala || d.gt(max)) return null
  return d
}
function texto(v: unknown, max: number): { ok: true; value: string | null } | { ok: false } {
  if (v === undefined || v === null) return { ok: true, value: null }
  if (typeof v !== "string") return { ok: false }
  const t = v.trim().replace(/\s+/g, " ")
  if (!t) return { ok: true, value: null }
  return t.length <= max ? { ok: true, value: t } : { ok: false }
}
function fechaDia(v: unknown, porDefecto: Date | null): Date | null | false {
  if (v === undefined || v === null || v === "") return porDefecto
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000 || d.getUTCFullYear() < 2000) return false
  return d
}
const idTexto = (v: unknown) => (typeof v === "string" && v.trim() && v.length <= 64 ? v.trim() : null)

export interface LineaEntrada {
  compraLineaId: string | null
  productoId: string
  productoVarianteId: string | null
  recibida: Dec
  aceptada: Dec
  rechazada: Dec
  motivoRechazo: string | null
  detalleRechazo: string | null
  costoUnitario: Dec
  descuentoPct: Dec
  alicuotaPct: Dec
}
export interface CargoEntrada {
  tipo: "ATRIBUIBLE" | "NO_ATRIBUIBLE"
  proveedorId: string | null
  concepto: string
  importe: Dec
  distribucion: "VALOR" | "CANTIDAD" | null
  comprobanteTipo: string | null
  comprobanteNumero: string | null
}
export interface ContenidoRecepcion {
  proveedorId: string
  compraId: string | null
  fechaRecepcion: Date
  comprobanteTipo: string | null
  comprobanteNumero: string | null
  comprobanteFecha: Date | null
  descuentoGlobal: Dec
  percepciones: Dec
  notas: string | null
  lineas: LineaEntrada[]
  cargos: CargoEntrada[]
}

export function parseContenidoRecepcion(body: unknown): CompraResult<ContenidoRecepcion> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const proveedorId = idTexto(b.proveedorId)
  if (!proveedorId) return fail(400, "Elegí el proveedor.", "PROVEEDOR_REQUERIDO")
  const compraId = b.compraId === undefined || b.compraId === null || b.compraId === "" ? null : idTexto(b.compraId)
  if (b.compraId && !compraId) return fail(400, "Pedido inválido.", "COMPRA_INVALIDA")
  const fechaRecepcion = fechaDia(b.fechaRecepcion, new Date())
  if (!fechaRecepcion) return fail(400, "La fecha de recepción no es válida (no puede ser futura).", "FECHA_INVALIDA")
  const compTipo = texto(b.comprobanteTipo, 40), compNum = texto(b.comprobanteNumero, 60), notas = texto(b.notas, TEXTO_MAX)
  if (!compTipo.ok || !compNum.ok) return fail(400, "Revisá el tipo y número de comprobante.", "COMPROBANTE_INVALIDO")
  if (!notas.ok) return fail(400, "Las notas admiten hasta 500 caracteres.", "NOTAS_INVALIDAS")
  const compFecha = fechaDia(b.comprobanteFecha, null)
  if (compFecha === false) return fail(400, "La fecha del comprobante no es válida.", "COMPROBANTE_INVALIDO")
  const descuentoGlobal = b.descuentoGlobal === undefined || b.descuentoGlobal === "" ? CERO : decimal(b.descuentoGlobal, 2, 9_999_999_999)
  const percepciones = b.percepciones === undefined || b.percepciones === "" ? CERO : decimal(b.percepciones, 2, 9_999_999_999)
  if (!descuentoGlobal || !percepciones) return fail(400, "El descuento y las percepciones van en pesos, con hasta 2 decimales.", "IMPORTE_INVALIDO")
  const lineasRaw = Array.isArray(b.lineas) ? b.lineas : []
  if (lineasRaw.length === 0) return fail(400, "Agregá al menos un producto recibido.", "LINEAS_REQUERIDAS")
  if (lineasRaw.length > MAX_LINEAS) return fail(400, `Hasta ${MAX_LINEAS} renglones por recepción.`, "DEMASIADAS_LINEAS")
  const lineas: LineaEntrada[] = []
  for (const [i, raw] of lineasRaw.entries()) {
    const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const pos = `Renglón ${i + 1}`
    const productoId = idTexto(x.productoId)
    if (!productoId) return fail(400, `${pos}: elegí el producto.`, "LINEA_INVALIDA", { linea: i })
    const productoVarianteId = x.productoVarianteId ? idTexto(x.productoVarianteId) : null
    const compraLineaId = x.compraLineaId ? idTexto(x.compraLineaId) : null
    const recibida = decimal(x.cantidadRecibida, 3, 999_999_999)
    const aceptada = x.cantidadAceptada === undefined || x.cantidadAceptada === "" ? recibida : decimal(x.cantidadAceptada, 3, 999_999_999)
    if (!recibida || !recibida.gt(0) || !aceptada) return fail(400, `${pos}: la cantidad recibida tiene que ser mayor a cero (hasta 3 decimales).`, "CANTIDAD_INVALIDA", { linea: i })
    if (aceptada.gt(recibida)) return fail(400, `${pos}: no se puede aceptar más de lo recibido. Si llegó de más, cargalo como recibido.`, "CANTIDAD_INVALIDA", { linea: i })
    const rechazada = recibida.minus(aceptada)
    let motivoRechazo: string | null = null, detalleRechazo: string | null = null
    if (rechazada.gt(0)) {
      if (typeof x.motivoRechazo !== "string" || !(MOTIVOS_RECHAZO_LINEA as readonly string[]).includes(x.motivoRechazo)) {
        return fail(400, `${pos}: indicá por qué no aceptás ${rechazada.toString()} (dañado, vencido, no pedido, error del proveedor u otro).`, "MOTIVO_RECHAZO_REQUERIDO", { linea: i })
      }
      motivoRechazo = x.motivoRechazo
      const det = texto(x.detalleRechazo, 300)
      if (!det.ok) return fail(400, `${pos}: el detalle admite hasta 300 caracteres.`, "LINEA_INVALIDA", { linea: i })
      detalleRechazo = det.value
      if (motivoRechazo === "OTRO" && !detalleRechazo) return fail(400, `${pos}: contá el motivo del rechazo.`, "MOTIVO_RECHAZO_REQUERIDO", { linea: i })
    }
    const costoUnitario = decimal(x.costoUnitario, 4, 9_999_999_999)
    if (!costoUnitario) return fail(400, `${pos}: el costo unitario va en pesos, con hasta 4 decimales.`, "COSTO_INVALIDO", { linea: i })
    const descuentoPct = x.descuentoPct === undefined || x.descuentoPct === "" ? CERO : decimal(x.descuentoPct, 2, 100)
    const alicuotaPct = x.alicuotaImpuestoPct === undefined || x.alicuotaImpuestoPct === "" ? CERO : decimal(x.alicuotaImpuestoPct, 2, 100)
    if (!descuentoPct || !alicuotaPct) return fail(400, `${pos}: el descuento y el impuesto son porcentajes de 0 a 100.`, "PORCENTAJE_INVALIDO", { linea: i })
    lineas.push({ compraLineaId, productoId, productoVarianteId, recibida, aceptada, rechazada, motivoRechazo, detalleRechazo, costoUnitario, descuentoPct, alicuotaPct })
  }
  const cargosRaw = Array.isArray(b.cargos) ? b.cargos : []
  if (cargosRaw.length > MAX_CARGOS) return fail(400, `Hasta ${MAX_CARGOS} cargos por recepción.`, "DEMASIADOS_CARGOS")
  const cargos: CargoEntrada[] = []
  for (const [i, raw] of cargosRaw.entries()) {
    const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    if (x.tipo !== "ATRIBUIBLE" && x.tipo !== "NO_ATRIBUIBLE") return fail(400, `Cargo ${i + 1}: indicá si se suma al costo de la mercadería o es un gasto.`, "CARGO_INVALIDO", { cargo: i })
    const concepto = texto(x.concepto, 120)
    if (!concepto.ok || !concepto.value) return fail(400, `Cargo ${i + 1}: escribí el concepto (flete, seguro…).`, "CARGO_INVALIDO", { cargo: i })
    const importe = decimal(x.importe, 2, 9_999_999_999)
    if (!importe || !importe.gt(0)) return fail(400, `Cargo ${i + 1}: el importe tiene que ser mayor a cero.`, "CARGO_INVALIDO", { cargo: i })
    const distribucion = x.tipo === "ATRIBUIBLE" ? (x.distribucion === "CANTIDAD" ? "CANTIDAD" : "VALOR") : null
    const ct = texto(x.comprobanteTipo, 40), cn = texto(x.comprobanteNumero, 60)
    if (!ct.ok || !cn.ok) return fail(400, `Cargo ${i + 1}: revisá el comprobante.`, "CARGO_INVALIDO", { cargo: i })
    cargos.push({ tipo: x.tipo, proveedorId: x.proveedorId ? idTexto(x.proveedorId) : null, concepto: concepto.value, importe, distribucion, comprobanteTipo: ct.value, comprobanteNumero: cn.value })
  }
  return {
    ok: true,
    value: { proveedorId, compraId, fechaRecepcion, comprobanteTipo: compTipo.value, comprobanteNumero: compNum.value, comprobanteFecha: compFecha, descuentoGlobal, percepciones, notas: notas.value, lineas, cargos },
  }
}

export function huellaContenido(c: ContenidoRecepcion): string {
  return huella([
    c.proveedorId, c.compraId, c.fechaRecepcion.toISOString(), c.comprobanteTipo, c.comprobanteNumero, c.comprobanteFecha?.toISOString() ?? null,
    c.descuentoGlobal.toFixed(2), c.percepciones.toFixed(2), c.notas,
    c.lineas.map((l) => [l.compraLineaId, l.productoId, l.productoVarianteId, l.recibida.toFixed(3), l.aceptada.toFixed(3), l.motivoRechazo, l.detalleRechazo, l.costoUnitario.toFixed(4), l.descuentoPct.toFixed(2), l.alicuotaPct.toFixed(2)]),
    c.cargos.map((k) => [k.tipo, k.proveedorId, k.concepto, k.importe.toFixed(2), k.distribucion, k.comprobanteTipo, k.comprobanteNumero]),
  ])
}

// ---------------------------------------------------------------------------
// Validación contra la base (dentro de la transacción)
// ---------------------------------------------------------------------------

type LineaResuelta = LineaEntrada & { productoNombre: string; varianteNombre: string | null }
type CargoResuelto = Omit<CargoEntrada, "proveedorId"> & { proveedorId: string }

async function resolverContenido(tx: Tx, negocioId: string, c: ContenidoRecepcion): Promise<CompraResult<{ lineas: LineaResuelta[]; cargos: CargoResuelto[] }>> {
  const prov = await tx.proveedor.findFirst({ where: { id: c.proveedorId, negocioId }, select: { activo: true } })
  if (!prov) return fail(404, "Proveedor no encontrado.", "PROVEEDOR_NO_ENCONTRADO")
  if (!prov.activo) return fail(409, "El proveedor está inactivo.", "PROVEEDOR_INACTIVO")
  let lineasCompra = new Map<string, { productoId: string | null; productoVarianteId: string | null }>()
  if (c.compraId) {
    const compra = await tx.compra.findFirst({ where: { id: c.compraId, negocioId }, select: { proveedorId: true, estado: true, lineas: { select: { id: true, productoId: true, productoVarianteId: true } } } })
    if (!compra) return fail(404, "Pedido no encontrado.", "COMPRA_NO_ENCONTRADA")
    if (compra.proveedorId !== c.proveedorId) return fail(409, "Ese pedido es de otro proveedor.", "COMPRA_DE_OTRO_PROVEEDOR")
    if (compra.estado !== "ABIERTA") return fail(409, "Ese pedido ya está cerrado o anulado.", "COMPRA_CERRADA")
    lineasCompra = new Map(compra.lineas.map((l) => [l.id, l]))
  }
  const productos = await tx.producto.findMany({
    where: { id: { in: [...new Set(c.lineas.map((l) => l.productoId))] }, negocioId, eliminado: false },
    select: { id: true, nombre: true, unidadMedida: true, variantes: { select: { id: true, nombre: true, activo: true } } },
  })
  const porId = new Map(productos.map((p) => [p.id, p]))
  const lineas: LineaResuelta[] = []
  for (const [i, l] of c.lineas.entries()) {
    const p = porId.get(l.productoId)
    if (!p) return fail(404, `Renglón ${i + 1}: producto no encontrado.`, "PRODUCTO_NO_ENCONTRADO", { linea: i })
    if (!esUnidadFraccionable(p.unidadMedida) && (!l.recibida.isInteger() || !l.aceptada.isInteger())) {
      return fail(400, `Renglón ${i + 1}: «${p.nombre}» se cuenta por ${p.unidadMedida || "unidad"}: usá cantidades enteras.`, "CANTIDAD_ENTERA_REQUERIDA", { linea: i })
    }
    const activas = p.variantes.filter((v) => v.activo)
    let varianteNombre: string | null = null
    if (activas.length > 0) {
      const v = activas.find((x) => x.id === l.productoVarianteId)
      if (!v) return fail(400, `Renglón ${i + 1}: «${p.nombre}» tiene variantes: elegí cuál recibiste.`, "VARIANTE_REQUERIDA", { linea: i })
      varianteNombre = v.nombre
    } else if (l.productoVarianteId) {
      return fail(400, `Renglón ${i + 1}: «${p.nombre}» no tiene esa variante.`, "VARIANTE_INVALIDA", { linea: i })
    }
    if (l.compraLineaId) {
      if (!c.compraId) return fail(400, `Renglón ${i + 1}: el renglón de pedido requiere elegir el pedido.`, "COMPRA_REQUERIDA", { linea: i })
      const cl = lineasCompra.get(l.compraLineaId)
      if (!cl) return fail(400, `Renglón ${i + 1}: ese renglón no es del pedido elegido.`, "LINEA_DE_OTRA_COMPRA", { linea: i })
      if (cl.productoId !== l.productoId || (cl.productoVarianteId ?? null) !== (l.productoVarianteId ?? null)) {
        return fail(400, `Renglón ${i + 1}: el producto no coincide con el renglón del pedido.`, "LINEA_NO_COINCIDE", { linea: i })
      }
    }
    lineas.push({ ...l, productoNombre: p.nombre, varianteNombre })
  }
  const cargos: CargoResuelto[] = []
  for (const [i, k] of c.cargos.entries()) {
    const proveedorId = k.proveedorId ?? c.proveedorId
    if (proveedorId !== c.proveedorId) {
      const otro = await tx.proveedor.findFirst({ where: { id: proveedorId, negocioId }, select: { activo: true } })
      if (!otro) return fail(404, `Cargo ${i + 1}: proveedor no encontrado.`, "PROVEEDOR_NO_ENCONTRADO", { cargo: i })
      if (!otro.activo) return fail(409, `Cargo ${i + 1}: ese proveedor está inactivo.`, "PROVEEDOR_INACTIVO", { cargo: i })
    }
    cargos.push({ ...k, proveedorId })
  }
  return { ok: true, value: { lineas, cargos } }
}

async function bloquearRecepcion(tx: Tx, negocioId: string, recepcionId: string) {
  const filas = await tx.$queryRaw<Array<{ id: string; estado: string; version: number; preparadaPorTipo: string; preparadaPorEmpleadoId: string | null; proveedorId: string; compraId: string | null }>>`
    SELECT "id", "estado", "version", "preparadaPorTipo", "preparadaPorEmpleadoId", "proveedorId", "compraId" FROM "recepciones" WHERE "id" = ${recepcionId} AND "negocioId" = ${negocioId} FOR UPDATE`
  return filas[0] ?? null
}

const RECEPCION_NO_ENCONTRADA = fail(404, "Recepción no encontrada.", "RECEPCION_NO_ENCONTRADA")
const VERSION_CAMBIADA = fail(409, "La recepción cambió mientras la mirabas. Actualizá la pantalla y revisala de nuevo.", "VERSION_CAMBIADA")

function puedeTocar(actor: ActorCompra, r: { preparadaPorTipo: string; preparadaPorEmpleadoId: string | null }) {
  return actor.tipo === "NEGOCIO" || (r.preparadaPorTipo === "EMPLEADO" && r.preparadaPorEmpleadoId === actor.empleadoId)
}

async function escribirContenido(tx: Tx, negocioId: string, recepcionId: string, lineas: LineaResuelta[], cargos: CargoResuelto[]) {
  for (const [orden, l] of lineas.entries()) {
    await tx.recepcionLinea.create({
      data: {
        negocioId, recepcionId, orden: orden + 1, compraLineaId: l.compraLineaId, productoId: l.productoId, productoVarianteId: l.productoVarianteId,
        productoNombre: l.productoNombre.slice(0, 200), varianteNombre: l.varianteNombre?.slice(0, 200) ?? null,
        cantidadRecibidaDecimal: l.recibida, cantidadAceptadaDecimal: l.aceptada, cantidadRechazadaDecimal: l.rechazada,
        motivoRechazo: l.motivoRechazo, detalleRechazo: l.detalleRechazo, costoUnitarioDecimal: l.costoUnitario,
        descuentoPctDecimal: l.descuentoPct, alicuotaImpuestoPctDecimal: l.alicuotaPct,
      },
    })
  }
  for (const [orden, k] of cargos.entries()) {
    await tx.recepcionCargo.create({
      data: { negocioId, recepcionId, orden: orden + 1, tipo: k.tipo, proveedorId: k.proveedorId, concepto: k.concepto, importeDecimal: k.importe, distribucion: k.distribucion, comprobanteTipo: k.comprobanteTipo, comprobanteNumero: k.comprobanteNumero },
    })
  }
}

export type AuditoriaCompra = (tx: Tx, evento: { accion: string; recurso: "recepcion" | "compra" | "configuracion_compras"; recursoId: string; detalle: Record<string, unknown> }) => Promise<void>

async function conErrores<T>(fn: () => Promise<CompraResult<T>>, alDuplicar?: () => Promise<CompraResult<T> | null>): Promise<CompraResult<T>> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof AbortoTransaccion) return error.resultado
    if (error instanceof CalculoCompraError) return fail(409, error.message, error.code)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && alDuplicar) {
      const r = await alDuplicar()
      if (r) return r
    }
    const stock = mapStockLifecycleError(error)
    if (stock) return fail(409, stock.body.error, stock.body.code)
    const t = error instanceof Error ? error.message : String(error)
    if (t.includes("recepciones_comprobante_aprobado_unico")) return fail(409, "Ese comprobante ya está en otra recepción aprobada de este proveedor.", "COMPROBANTE_DUPLICADO")
    if (t.includes("purchase order has receptions pending approval")) return fail(409, "El pedido tiene recepciones esperando aprobación: aprobalas o rechazalas antes.", "COMPRA_CON_RECEPCIONES_PENDIENTES")
    if (t.includes("a purchase order with approved receptions cannot be cancelled")) return fail(409, "El pedido ya tiene mercadería recibida: no se anula, se cierra con faltante.", "COMPRA_CON_RECEPCIONES")
    if (t.includes("a closed reception is immutable") || t.includes("only a draft reception can be edited")) return fail(409, "La recepción ya no se puede modificar.", "RECEPCION_CERRADA")
    throw error
  }
}

// ---------------------------------------------------------------------------
// Recepción: crear / editar borrador
// ---------------------------------------------------------------------------

export async function crearRecepcion(
  db: Db,
  input: { negocioId: string; actor: ActorCompra; body: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaCompra } = {}
): Promise<CompraResult<{ recepcionId: string; numero: number; version: number; replayed: boolean }>> {
  const { negocioId, actor } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  const parsed = parseContenidoRecepcion(input.body)
  if (!parsed.ok) return parsed
  const contenido = parsed.value
  const contenidoHuella = huellaContenido(contenido)
  const fp = huella([negocioId, actor, contenidoHuella])
  const replay = async (client: Pick<Tx, "recepcion">) => {
    const previa = await client.recepcion.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: { id: true, numero: true, idempotencyFingerprint: true } })
    if (!previa) return null
    return previa.idempotencyFingerprint === fp ? { ok: true as const, value: { recepcionId: previa.id, numero: previa.numero, version: 1, replayed: true } } : CLAVE_REUSADA
  }
  return conErrores(() => runSerializable(db, async (tx) => {
    const previa = await replay(tx)
    if (previa) return previa
    // Un empleado tiene a lo sumo UN borrador por pedido: si ya lo empezó, se retoma (nunca otro por accidente).
    if (actor.tipo === "EMPLEADO" && contenido.compraId) {
      const abierto = await tx.recepcion.findFirst({ where: { negocioId, compraId: contenido.compraId, estado: "BORRADOR", preparadaPorTipo: "EMPLEADO", preparadaPorEmpleadoId: actor.empleadoId }, select: { id: true, numero: true } })
      if (abierto) return fail(409, `Ya tenés un borrador para este pedido (recepción N° ${abierto.numero}). Retomalo desde «Recibir mercadería».`, "BORRADOR_EXISTENTE", { recepcionId: abierto.id, numero: abierto.numero })
    }
    const resuelto = await resolverContenido(tx, negocioId, contenido)
    if (!resuelto.ok) return resuelto
    const max = await tx.recepcion.aggregate({ where: { negocioId }, _max: { numero: true } })
    const numero = (max._max.numero ?? 0) + 1
    const r = await tx.recepcion.create({
      data: {
        negocioId, proveedorId: contenido.proveedorId, compraId: contenido.compraId, numero, preparadaPorTipo: actor.tipo,
        preparadaPorEmpleadoId: actor.tipo === "EMPLEADO" ? actor.empleadoId : null, fechaRecepcion: contenido.fechaRecepcion,
        comprobanteTipo: contenido.comprobanteTipo, comprobanteNumero: contenido.comprobanteNumero, comprobanteFecha: contenido.comprobanteFecha,
        comprobanteClave: claveComprobante(contenido.comprobanteTipo, contenido.comprobanteNumero), descuentoGlobalDecimal: contenido.descuentoGlobal,
        percepcionesDecimal: contenido.percepciones, notas: contenido.notas, contenidoHuella, idempotencyKey: key, idempotencyFingerprint: fp,
      },
      select: { id: true },
    })
    await escribirContenido(tx, negocioId, r.id, resuelto.value.lineas, resuelto.value.cargos)
    if (opciones.auditar) await opciones.auditar(tx, { accion: "recepcion.creada", recurso: "recepcion", recursoId: r.id, detalle: { negocioId, recepcionId: r.id, numero, proveedorId: contenido.proveedorId, compraId: contenido.compraId, actor, lineas: contenido.lineas.length, cargos: contenido.cargos.length } })
    return { ok: true as const, value: { recepcionId: r.id, numero, version: 1, replayed: false } }
  }), () => replay(db))
}

/** Reemplaza el contenido de un BORRADOR. CAS por versión; un reenvío idéntico responde como replay. */
export async function actualizarRecepcion(
  db: Db,
  input: { negocioId: string; actor: ActorCompra; recepcionId: string; version: unknown; body: unknown },
  opciones: { auditar?: AuditoriaCompra } = {}
): Promise<CompraResult<{ recepcionId: string; version: number; replayed: boolean }>> {
  const { negocioId, actor, recepcionId } = input
  if (typeof input.version !== "number" || !Number.isInteger(input.version)) return fail(400, "Falta la versión de la recepción.", "VERSION_REQUERIDA")
  const parsed = parseContenidoRecepcion(input.body)
  if (!parsed.ok) return parsed
  const contenido = parsed.value
  const contenidoHuella = huellaContenido(contenido)
  return conErrores<{ recepcionId: string; version: number; replayed: boolean }>(() => runSerializable(db, async (tx) => {
    const r = await bloquearRecepcion(tx, negocioId, recepcionId)
    if (!r || !puedeTocar(actor, r)) return RECEPCION_NO_ENCONTRADA
    const actual = await tx.recepcion.findUniqueOrThrow({ where: { id: recepcionId }, select: { contenidoHuella: true } })
    if (r.estado !== "BORRADOR") return fail(409, "Sólo se modifica una recepción en borrador.", "RECEPCION_NO_EDITABLE", { estado: r.estado })
    if (r.version !== input.version) {
      if (actual.contenidoHuella === contenidoHuella) return { ok: true as const, value: { recepcionId, version: r.version, replayed: true } }
      return VERSION_CAMBIADA
    }
    const resuelto = await resolverContenido(tx, negocioId, contenido)
    if (!resuelto.ok) return resuelto
    await tx.recepcionLinea.deleteMany({ where: { recepcionId, negocioId } })
    await tx.recepcionCargo.deleteMany({ where: { recepcionId, negocioId } })
    await tx.recepcion.update({
      where: { id: recepcionId },
      data: {
        proveedorId: contenido.proveedorId, compraId: contenido.compraId, fechaRecepcion: contenido.fechaRecepcion, comprobanteTipo: contenido.comprobanteTipo,
        comprobanteNumero: contenido.comprobanteNumero, comprobanteFecha: contenido.comprobanteFecha, comprobanteClave: claveComprobante(contenido.comprobanteTipo, contenido.comprobanteNumero),
        descuentoGlobalDecimal: contenido.descuentoGlobal, percepcionesDecimal: contenido.percepciones, notas: contenido.notas, contenidoHuella, version: r.version + 1,
      },
    })
    await escribirContenido(tx, negocioId, recepcionId, resuelto.value.lineas, resuelto.value.cargos)
    if (opciones.auditar) await opciones.auditar(tx, { accion: "recepcion.editada", recurso: "recepcion", recursoId: recepcionId, detalle: { negocioId, recepcionId, actor, version: r.version + 1 } })
    return { ok: true as const, value: { recepcionId, version: r.version + 1, replayed: false } }
  }))
}

// ---------------------------------------------------------------------------
// Recepción: transiciones simples (envío, devolución, rechazo, descarte)
// ---------------------------------------------------------------------------

const TRANSICIONES = {
  ENVIO: { desde: ["BORRADOR"], hacia: "PENDIENTE_APROBACION", soloDueno: false, motivo: false, marca: "enviadaEn", accion: "recepcion.enviada" },
  DEVOLUCION_A_BORRADOR: { desde: ["PENDIENTE_APROBACION"], hacia: "BORRADOR", soloDueno: true, motivo: true, marca: null, accion: "recepcion.devuelta" },
  RECHAZO: { desde: ["BORRADOR", "PENDIENTE_APROBACION"], hacia: "RECHAZADA", soloDueno: true, motivo: true, marca: "rechazadaEn", accion: "recepcion.rechazada" },
  DESCARTE: { desde: ["BORRADOR"], hacia: "DESCARTADA", soloDueno: false, motivo: false, marca: "descartadaEn", accion: "recepcion.descartada" },
} as const
export type TransicionRecepcion = keyof typeof TRANSICIONES

async function replayEvento(client: Pick<Tx, "eventoCompraRecepcion">, negocioId: string, key: string, fp: string, objetivo: { recepcionId?: string; compraId?: string }) {
  const e = await client.eventoCompraRecepcion.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: { idempotencyFingerprint: true, recepcionId: true, compraId: true } })
  if (!e) return null
  const mismo = e.idempotencyFingerprint === fp && (objetivo.recepcionId ? e.recepcionId === objetivo.recepcionId : e.compraId === objetivo.compraId)
  return mismo ? ({ ok: true as const, value: { replayed: true } }) : CLAVE_REUSADA
}

export async function transicionarRecepcion(
  db: Db,
  tipo: TransicionRecepcion,
  input: { negocioId: string; actor: ActorCompra; recepcionId: string; version: unknown; motivo: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaCompra } = {}
): Promise<CompraResult<{ replayed: boolean }>> {
  const regla = TRANSICIONES[tipo]
  const { negocioId, actor, recepcionId } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  if (regla.soloDueno && actor.tipo !== "NEGOCIO") return fail(403, "Sólo el dueño puede hacer esto.", "SOLO_DUENO")
  if (typeof input.version !== "number" || !Number.isInteger(input.version)) return fail(400, "Falta la versión de la recepción.", "VERSION_REQUERIDA")
  const motivo = texto(input.motivo, TEXTO_MAX)
  if (!motivo.ok) return fail(400, "El motivo admite hasta 500 caracteres.", "MOTIVO_INVALIDO")
  if (regla.motivo && !motivo.value) return fail(400, "Escribí el motivo.", "MOTIVO_REQUERIDO")
  const fp = huella([negocioId, recepcionId, tipo, input.version, motivo.value])
  return conErrores(() => runSerializable(db, async (tx) => {
    const previo = await replayEvento(tx, negocioId, key, fp, { recepcionId })
    if (previo) return previo
    const r = await bloquearRecepcion(tx, negocioId, recepcionId)
    if (!r || !puedeTocar(actor, r)) return RECEPCION_NO_ENCONTRADA
    if (!(regla.desde as readonly string[]).includes(r.estado)) return fail(409, "Esa acción no corresponde al estado actual de la recepción.", "TRANSICION_NO_PERMITIDA", { estado: r.estado })
    if (r.version !== input.version) return VERSION_CAMBIADA
    if (tipo === "ENVIO") {
      // El contenido se revalida (productos borrados, proveedor inactivo, pedido cerrado…) y el comprobante no puede repetir uno aprobado.
      const det = await tx.recepcion.findUniqueOrThrow({ where: { id: recepcionId }, select: { comprobanteClave: true, compraId: true } })
      const prov = await tx.proveedor.findFirst({ where: { id: r.proveedorId, negocioId }, select: { activo: true } })
      if (!prov?.activo) return fail(409, "El proveedor está inactivo.", "PROVEEDOR_INACTIVO")
      if (det.compraId) {
        const c = await tx.compra.findFirst({ where: { id: det.compraId, negocioId }, select: { estado: true } })
        if (c?.estado !== "ABIERTA") return fail(409, "Ese pedido ya está cerrado o anulado.", "COMPRA_CERRADA")
      }
      if (det.comprobanteClave && (await tx.recepcion.findFirst({ where: { negocioId, proveedorId: r.proveedorId, comprobanteClave: det.comprobanteClave, estado: "APROBADA" }, select: { id: true } }))) {
        return fail(409, "Ese comprobante ya está en otra recepción aprobada de este proveedor.", "COMPROBANTE_DUPLICADO")
      }
    }
    const ahora = new Date()
    await tx.eventoCompraRecepcion.create({ data: { negocioId, recepcionId, tipo, motivo: motivo.value, actorTipo: actor.tipo, actorId: actorId(negocioId, actor), idempotencyKey: key, idempotencyFingerprint: fp, createdAt: ahora } })
    await tx.recepcion.update({
      where: { id: recepcionId },
      data: {
        estado: regla.hacia, version: r.version + 1,
        ...(regla.marca ? { [regla.marca]: ahora } : {}),
        ...(tipo === "RECHAZO" ? { motivoRechazo: motivo.value } : {}),
      },
    })
    if (opciones.auditar) await opciones.auditar(tx, { accion: regla.accion, recurso: "recepcion", recursoId: recepcionId, detalle: { negocioId, recepcionId, actor, de: r.estado, a: regla.hacia, motivo: motivo.value } })
    return { ok: true as const, value: { replayed: false } }
  }), () => replayEvento(db, negocioId, key, fp, { recepcionId }))
}

// ---------------------------------------------------------------------------
// Aprobación (dueño): vista previa + aprobación atómica
// ---------------------------------------------------------------------------

export interface OpcionesAprobacion {
  version: number
  tratamientoImpuestos: TratamientoImpuestos | null
  confirmoExcedentes: boolean
  confirmoDiferenciasCosto: boolean
  /** D-7 v2: el pago de Caja asociado se parece a un pago declarado: el dueño confirmó que son distintos. */
  confirmoNoDuplicado: boolean
  /** Lo facturado (acumulado del pedido) supera el total informado al pedir: el dueño lo revisó. */
  confirmoTotalPedido: boolean
  /** Precios de venta que el dueño eligió actualizar (clave de stock + el precio propuesto que vio). Opcional. */
  actualizarPrecios: SeleccionPrecio[]
  aplicarAnticipos: Array<{ creditoId: string; importe: Dec }>
  /** Pagos E1: lo que la vista previa mostró que se aplica de los anticipos del pedido (si cambió, se exige revisar). */
  anticipoPedidoEsperado: Dec
}

export function parseOpcionesAprobacion(body: unknown): CompraResult<OpcionesAprobacion> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  if (typeof b.version !== "number" || !Number.isInteger(b.version)) return fail(400, "Falta la versión de la recepción.", "VERSION_REQUERIDA")
  let tratamiento: TratamientoImpuestos | null = null
  if (b.tratamientoImpuestos !== undefined && b.tratamientoImpuestos !== null) {
    if (!(TRATAMIENTOS_IMPUESTOS as readonly unknown[]).includes(b.tratamientoImpuestos)) return fail(400, "Tratamiento de impuestos inválido.", "TRATAMIENTO_INVALIDO")
    tratamiento = b.tratamientoImpuestos as TratamientoImpuestos
  }
  const anticipos: OpcionesAprobacion["aplicarAnticipos"] = []
  for (const raw of Array.isArray(b.aplicarAnticipos) ? b.aplicarAnticipos : []) {
    const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const creditoId = idTexto(x.creditoId)
    const importe = decimal(x.importe, 2, 9_999_999_999)
    if (!creditoId || !importe || !importe.gt(0)) return fail(400, "Cada anticipo a aplicar necesita el pago y un importe mayor a cero.", "ANTICIPO_INVALIDO")
    if (anticipos.some((a) => a.creditoId === creditoId)) return fail(400, "El mismo anticipo aparece dos veces.", "ANTICIPO_INVALIDO")
    anticipos.push({ creditoId, importe })
  }
  if (anticipos.length > 20) return fail(400, "Hasta 20 anticipos por aprobación.", "ANTICIPO_INVALIDO")
  const actualizarPrecios = parseSeleccionPrecios(b.actualizarPrecios)
  if (!actualizarPrecios) return fail(400, "La selección de precios a actualizar no es válida.", "PRECIOS_INVALIDOS")
  const anticipoPedidoEsperado = b.anticipoPedidoEsperado === undefined || b.anticipoPedidoEsperado === null ? CERO : decimal(b.anticipoPedidoEsperado, 2, 9_999_999_999)
  if (!anticipoPedidoEsperado || anticipoPedidoEsperado.lt(0)) return fail(400, "El anticipo del pedido informado no es válido.", "ANTICIPO_INVALIDO")
  return { ok: true, value: { version: b.version, tratamientoImpuestos: tratamiento, confirmoExcedentes: b.confirmoExcedentes === true, confirmoDiferenciasCosto: b.confirmoDiferenciasCosto === true, confirmoNoDuplicado: b.confirmoNoDuplicado === true, confirmoTotalPedido: b.confirmoTotalPedido === true, actualizarPrecios, aplicarAnticipos: anticipos, anticipoPedidoEsperado } }
}

export async function leerTratamientoImpuestos(client: Pick<Tx, "configuracionCompras">, negocioId: string): Promise<TratamientoImpuestos> {
  const c = await client.configuracionCompras.findUnique({ where: { negocioId }, select: { tratamientoImpuestos: true } })
  return (c?.tratamientoImpuestos as TratamientoImpuestos | undefined) ?? "IMPUESTOS_INTEGRAN_COSTO"
}

const RECEPCION_INCLUDE = {
  lineas: { orderBy: { orden: "asc" as const } },
  cargos: { orderBy: { orden: "asc" as const }, include: { proveedor: { select: { nombre: true } } } },
  proveedor: { select: { id: true, nombre: true, activo: true } },
  compra: { select: { id: true, numero: true, estado: true } },
} satisfies Prisma.RecepcionInclude
type RecepcionCompleta = Prisma.RecepcionGetPayload<{ include: typeof RECEPCION_INCLUDE }>

export interface Analisis {
  calculo: ResultadoRecepcion
  tratamiento: TratamientoImpuestos
  excedentes: Array<{ orden: number; producto: string; compraLineaId: string | null; pedido: number | null; yaRecibido: number | null; pendiente: number | null; aceptadaAhora: number; excedente: number }>
  diferenciasCosto: Array<{ orden: number; producto: string; costoNeto: number; referencia: number; origenReferencia: "PEDIDO" | "ULTIMA_RECEPCION" | "PRODUCTO"; diferenciaPct: number }>
  controlStock: Map<string, boolean>
  problemas: Array<{ code: string; error: string }>
  /** Pedido con total informado: referencia comercial (nunca deuda). Se compara en la misma base (con o sin IVA). */
  totalPedido: null | {
    numero: number; totalInformado: number; iva: string; base: "CON_IVA" | "SIN_IVA"
    estaRecepcion: number; aprobadasAntes: number; recepcionesAprobadas: number; acumulado: number; diferencia: number; excede: boolean; entregaCompleta: boolean
  }
}

/** Analiza una recepción con el estado ACTUAL (dentro de la transacción): costos, excedentes, diferencias y bloqueos. */
async function analizar(tx: Tx, negocioId: string, r: RecepcionCompleta, tratamiento: TratamientoImpuestos): Promise<Analisis> {
  const problemas: Analisis["problemas"] = []
  if (!r.proveedor.activo) problemas.push({ code: "PROVEEDOR_INACTIVO", error: "El proveedor está inactivo." })
  if (r.compra && r.compra.estado !== "ABIERTA") problemas.push({ code: "COMPRA_CERRADA", error: "El pedido ya está cerrado o anulado." })
  for (const k of r.cargos) {
    if (k.proveedorId !== r.proveedorId) {
      const p = await tx.proveedor.findFirst({ where: { id: k.proveedorId, negocioId }, select: { activo: true } })
      if (!p?.activo) problemas.push({ code: "PROVEEDOR_INACTIVO", error: `El proveedor del cargo «${k.concepto}» está inactivo.` })
    }
  }
  const controlStock = new Map<string, boolean>()
  for (const l of r.lineas) {
    if (!l.productoId || (l.varianteNombre && !l.productoVarianteId)) {
      problemas.push({ code: "PRODUCTO_ELIMINADO", error: `El producto del renglón ${l.orden} («${l.productoNombre}») fue eliminado: quitá el renglón.` })
      continue
    }
    const autoridad = l.productoVarianteId
      ? await tx.productoVariante.findFirst({ where: { id: l.productoVarianteId, productoId: l.productoId, producto: { negocioId, eliminado: false } }, select: { controlStock: true } })
      : await tx.producto.findFirst({ where: { id: l.productoId, negocioId, eliminado: false }, select: { controlStock: true } })
    if (!autoridad) { problemas.push({ code: "PRODUCTO_ELIMINADO", error: `El producto del renglón ${l.orden} ya no está disponible.` }); continue }
    controlStock.set(l.id, autoridad.controlStock)
  }
  if (r.comprobanteClave && (await tx.recepcion.findFirst({ where: { negocioId, proveedorId: r.proveedorId, comprobanteClave: r.comprobanteClave, estado: "APROBADA", NOT: { id: r.id } }, select: { id: true } }))) {
    problemas.push({ code: "COMPROBANTE_DUPLICADO", error: "Ese comprobante ya está en otra recepción aprobada de este proveedor." })
  }
  const calculo = calcularRecepcion({
    lineas: r.lineas.map((l) => ({ id: l.id, aceptada: l.cantidadAceptadaDecimal, costoUnitario: l.costoUnitarioDecimal, descuentoPct: l.descuentoPctDecimal, alicuotaPct: l.alicuotaImpuestoPctDecimal })),
    descuentoGlobal: r.descuentoGlobalDecimal,
    percepciones: r.percepcionesDecimal,
    cargos: r.cargos.map((k) => ({ id: k.id, tipo: k.tipo as "ATRIBUIBLE" | "NO_ATRIBUIBLE", mismoProveedor: k.proveedorId === r.proveedorId, importe: k.importeDecimal, distribucion: (k.distribucion as "VALOR" | "CANTIDAD" | null) ?? null })),
    tratamientoImpuestos: tratamiento,
  })
  // Excedentes sobre lo pedido (nunca bloquean la recepción de lo que llegó: se confirman).
  const excedentes: Analisis["excedentes"] = []
  if (r.compraId) {
    const lineasCompra = await tx.compraLinea.findMany({ where: { compraId: r.compraId, negocioId }, select: { id: true, cantidadPedidaDecimal: true } })
    const recibidoAprobado = await tx.recepcionLinea.groupBy({ by: ["compraLineaId"], where: { negocioId, compraLineaId: { in: lineasCompra.map((x) => x.id) }, recepcion: { estado: "APROBADA" } }, _sum: { cantidadAceptadaDecimal: true } })
    const ya = new Map(recibidoAprobado.map((x) => [x.compraLineaId!, x._sum.cantidadAceptadaDecimal ?? CERO]))
    const ahora = new Map<string, Dec>()
    for (const l of r.lineas) if (l.compraLineaId) ahora.set(l.compraLineaId, (ahora.get(l.compraLineaId) ?? CERO).plus(l.cantidadAceptadaDecimal))
    for (const cl of lineasCompra) {
      const aceptadaAhora = ahora.get(cl.id) ?? CERO
      const yaRecibido = ya.get(cl.id) ?? CERO
      const pendiente = D.max(cl.cantidadPedidaDecimal.minus(yaRecibido), CERO)
      if (aceptadaAhora.gt(pendiente)) {
        const l = r.lineas.find((x) => x.compraLineaId === cl.id)!
        excedentes.push({ orden: l.orden, producto: l.productoNombre, compraLineaId: cl.id, pedido: q(cl.cantidadPedidaDecimal), yaRecibido: q(yaRecibido), pendiente: q(pendiente), aceptadaAhora: q(aceptadaAhora)!, excedente: q(aceptadaAhora.minus(pendiente))! })
      }
    }
    for (const l of r.lineas) {
      if (!l.compraLineaId && l.cantidadAceptadaDecimal.gt(0)) excedentes.push({ orden: l.orden, producto: l.productoNombre, compraLineaId: null, pedido: null, yaRecibido: null, pendiente: null, aceptadaAhora: q(l.cantidadAceptadaDecimal)!, excedente: q(l.cantidadAceptadaDecimal)! })
    }
  }
  // Diferencias de costo contra lo acordado en el pedido, el último costo por recepción o el costo del producto.
  const diferenciasCosto: Analisis["diferenciasCosto"] = []
  const acordados = r.compraId ? new Map((await tx.compraLinea.findMany({ where: { compraId: r.compraId, negocioId }, select: { id: true, costoUnitarioAcordadoDecimal: true } })).map((x) => [x.id, x.costoUnitarioAcordadoDecimal])) : new Map<string, Dec | null>()
  for (const l of r.lineas) {
    if (!l.productoId || !l.cantidadAceptadaDecimal.gt(0)) continue
    const costoNeto = l.costoUnitarioDecimal.times(new D(100).minus(l.descuentoPctDecimal)).dividedBy(100)
    let referencia: Dec | null = null
    let origen: "PEDIDO" | "ULTIMA_RECEPCION" | "PRODUCTO" = "PEDIDO"
    if (l.compraLineaId && acordados.get(l.compraLineaId)) referencia = acordados.get(l.compraLineaId)!
    if (!referencia) {
      const cv = await tx.costoVigente.findUnique({ where: { negocioId_stockKey: { negocioId, stockKey: claveStock(l.productoId, l.productoVarianteId) } }, select: { costoUnitarioDecimal: true } })
      if (cv) { referencia = cv.costoUnitarioDecimal; origen = "ULTIMA_RECEPCION" }
    }
    if (!referencia) {
      const c = l.productoVarianteId
        ? (await tx.productoVariante.findFirst({ where: { id: l.productoVarianteId }, select: { costo: true } }))?.costo
        : (await tx.producto.findFirst({ where: { id: l.productoId }, select: { costo: true } }))?.costo
      if (typeof c === "number" && c > 0) { referencia = new D(c.toFixed(4)); origen = "PRODUCTO" }
    }
    const pct = diferenciaPct(costoNeto, referencia)
    if (pct && pct.gt(UMBRAL_DIFERENCIA_COSTO_PCT)) diferenciasCosto.push({ orden: l.orden, producto: l.productoNombre, costoNeto: Number(costoNeto.toFixed(4)), referencia: Number(referencia!.toFixed(4)), origenReferencia: origen, diferenciaPct: Number(pct.toString()) })
  }
  // Total informado del pedido (si lo hay): lo de esta recepción + lo ya aprobado del mismo pedido, en la misma base.
  let totalPedido: Analisis["totalPedido"] = null
  if (r.compraId) {
    const c = await tx.compra.findFirst({ where: { id: r.compraId, negocioId }, select: { numero: true, totalInformadoDecimal: true, totalInformadoIva: true, lineas: { select: { id: true, cantidadPedidaDecimal: true } } } })
    if (c?.totalInformadoDecimal && c.totalInformadoIva) {
      const conIva = c.totalInformadoIva === "INCLUYE_IVA"
      const previas = await tx.recepcion.findMany({ where: { negocioId, compraId: r.compraId, estado: "APROBADA", id: { not: r.id } }, select: { netoDecimal: true, totalObligacionDecimal: true } })
      const estaRecepcion = conIva ? calculo.totalObligacion : calculo.neto
      const aprobadasAntes = previas.reduce((t, x) => t.plus((conIva ? x.totalObligacionDecimal : x.netoDecimal) ?? CERO), CERO)
      const acumulado = aprobadasAntes.plus(estaRecepcion)
      // ¿Con esta recepción se completa lo pedido? Si no, una diferencia hacia abajo NO es un incumplimiento.
      const ya = new Map((await tx.recepcionLinea.groupBy({ by: ["compraLineaId"], where: { negocioId, compraLineaId: { in: c.lineas.map((x) => x.id) }, recepcion: { estado: "APROBADA" } }, _sum: { cantidadAceptadaDecimal: true } })).map((x) => [x.compraLineaId!, x._sum.cantidadAceptadaDecimal ?? CERO]))
      for (const l of r.lineas) if (l.compraLineaId) ya.set(l.compraLineaId, (ya.get(l.compraLineaId) ?? CERO).plus(l.cantidadAceptadaDecimal))
      const entregaCompleta = c.lineas.every((x) => (ya.get(x.id) ?? CERO).gte(x.cantidadPedidaDecimal))
      totalPedido = {
        numero: c.numero, totalInformado: n(c.totalInformadoDecimal)!, iva: c.totalInformadoIva, base: conIva ? "CON_IVA" : "SIN_IVA",
        estaRecepcion: n(estaRecepcion)!, aprobadasAntes: n(aprobadasAntes)!, recepcionesAprobadas: previas.length, acumulado: n(acumulado)!,
        diferencia: n(acumulado.minus(c.totalInformadoDecimal))!, excede: acumulado.gt(c.totalInformadoDecimal), entregaCompleta,
      }
    }
  }
  return { calculo, tratamiento, excedentes, diferenciasCosto, controlStock, problemas, totalPedido }
}

function analisisParaRespuesta(r: RecepcionCompleta, a: Analisis) {
  const porLinea = new Map(a.calculo.lineas.map((x) => [x.id, x]))
  return {
    tratamientoImpuestos: a.tratamiento,
    lineas: r.lineas.map((l) => {
      const c = porLinea.get(l.id)!
      return {
        id: l.id, orden: l.orden, producto: l.productoNombre, variante: l.varianteNombre, aceptada: q(l.cantidadAceptadaDecimal), rechazada: q(l.cantidadRechazadaDecimal),
        controlStock: a.controlStock.get(l.id) ?? null, subtotal: n(c.subtotal), descuentoLinea: n(c.descuentoLinea), descuentoGlobal: n(c.descuentoGlobal), neto: n(c.neto),
        impuestos: n(c.impuestos), percepcion: n(c.percepcion), cargos: n(c.cargos), costoInventarioTotal: n(c.costoInventarioTotal),
        costoUnitarioInventario: c.costoUnitarioInventario ? Number(c.costoUnitarioInventario.toString()) : null,
      }
    }),
    totales: {
      neto: n(a.calculo.neto), descuentos: n(a.calculo.descuentos), impuestos: n(a.calculo.impuestos), percepciones: n(a.calculo.percepciones),
      cargosMismoProveedor: n(a.calculo.cargosMismoProveedor), cargosInventario: n(a.calculo.cargosInventario), totalObligacion: n(a.calculo.totalObligacion),
      costoInventarioTotal: n(a.calculo.costoInventarioTotal),
    },
    cargosConObligacionPropia: a.calculo.cargosConObligacionPropia.map((k) => {
      const cargo = r.cargos.find((x) => x.id === k.id)!
      return { id: k.id, concepto: cargo.concepto, proveedorId: cargo.proveedorId, proveedor: cargo.proveedor.nombre, importe: n(k.importe), gasto: k.gasto }
    }),
    excedentes: a.excedentes,
    diferenciasCosto: a.diferenciasCosto,
    umbralDiferenciaCostoPct: UMBRAL_DIFERENCIA_COSTO_PCT,
    problemas: a.problemas,
    totalPedido: a.totalPedido,
  }
}

export async function vistaPreviaAprobacion(db: Db, negocioId: string, recepcionId: string, tratamiento: unknown): Promise<CompraResult<Record<string, unknown>>> {
  try {
    return await db.$transaction(async (tx) => {
      const r = await tx.recepcion.findFirst({ where: { id: recepcionId, negocioId }, include: RECEPCION_INCLUDE })
      if (!r) return RECEPCION_NO_ENCONTRADA
      if (r.estado !== "BORRADOR" && r.estado !== "PENDIENTE_APROBACION") return fail(409, "La recepción ya está cerrada.", "RECEPCION_CERRADA", { estado: r.estado })
      const t = (TRATAMIENTOS_IMPUESTOS as readonly unknown[]).includes(tratamiento) ? (tratamiento as TratamientoImpuestos) : await leerTratamientoImpuestos(tx, negocioId)
      const a = await analizar(tx, negocioId, r, t)
      const anticipos = await anticiposDisponibles(tx, negocioId, r.proveedorId)
      // D-7 v2: pagos en efectivo asociados (se aplican solos al aprobar) y pagos viejos sólo con la referencia.
      const pagos = await pagosDeRecepcion(tx, negocioId, recepcionId, r.proveedorId)
      const resumen = resumenPagos(a.calculo.totalObligacion, pagos)
      // Pagos E1: lo que se aplicaría de los pagos anticipados del pedido (después del efectivo al recibir).
      const pedidoPagos = r.compraId ? await pagosDePedido(tx, negocioId, r.proveedorId, r.compraId) : null
      const planPedido = r.compraId ? await planAnticiposPedido(tx, { negocioId, proveedorId: r.proveedorId, compraId: r.compraId, tope: D.max(a.calculo.totalObligacion.minus(resumen.seAplica), CERO) }) : []
      const deEstaRecepcion = new Set(pagos.map((p) => p.creditoId).filter(Boolean))
      const sugeridos = await pagosSugeridos(db, negocioId, { id: r.id, numero: r.numero, proveedorNombre: r.proveedor.nombre })
      // Precios de venta (opcional): misma regla que al aprobar, con el orden real de esta recepción si se aprobara ahora.
      const porLineaCalc = new Map(a.calculo.lineas.map((x) => [x.id, x.costoUnitarioInventario]))
      const preciosVenta = await proponerPreciosEnTx(tx, negocioId, r.lineas.map((l) => ({ id: l.id, orden: l.orden, productoId: l.productoId, productoVarianteId: l.productoVarianteId, productoNombre: l.productoNombre, varianteNombre: l.varianteNombre, costoNuevo: porLineaCalc.get(l.id) ?? null })), { fechaRecepcion: r.fechaRecepcion, aprobadaEn: new Date() })
      return {
        ok: true as const,
        value: {
          recepcionId, version: r.version, estado: r.estado, ...analisisParaRespuesta(r, a),
          // Casos especiales (asignación manual): sólo los créditos que NO son pagos de esta recepción.
          anticiposDisponibles: anticipos.filter((x) => !deEstaRecepcion.has(x.id)).map((x) => ({ creditoId: x.id, origen: x.origen, medio: x.medio, referencia: x.referencia, fecha: x.fecha, importe: n(x.importe), disponible: n(x.disponible) })),
          pagosRecepcion: pagos.map((p) => ({ ...p, importe: n(p.importe), disponible: n(p.disponible), importeAplicado: n(p.importeAplicado) })),
          resumenPagos: (() => {
            const pedido = planPedido.reduce((t, x) => t.plus(x.importe), CERO)
            return {
              totalMercaderia: n(resumen.totalMercaderia), pagado: n(resumen.pagado), seAplica: n(resumen.seAplica), anticiposPedido: n(pedido),
              // Saldo estimado después de aprobar (antes de «otros pagos» manuales, que suma la pantalla).
              saldoPendiente: n(D.max(resumen.totalMercaderia.minus(resumen.seAplica).minus(pedido), CERO)), anticipo: n(resumen.anticipo),
            }
          })(),
          pagosSugeridos: sugeridos.map((x) => ({ ...x, importe: n(x.importe) })),
          preciosVenta: preciosVenta.map(propuestaParaRespuesta),
          anticiposPedido: pedidoPagos && (pedidoPagos.pagos.length > 0) ? {
            ...pagosDePedidoParaRespuesta(pedidoPagos),
            seAplica: n(planPedido.reduce((t, x) => t.plus(x.importe), CERO)),
          } : null,
        },
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  } catch (error) {
    if (error instanceof CalculoCompraError) return fail(409, error.message, error.code)
    throw error
  }
}

export async function aprobarRecepcion(
  db: Db,
  input: { negocioId: string; recepcionId: string; body: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaCompra; auditarCuenta?: AuditoriaEnTx } = {}
): Promise<CompraResult<{ recepcionId: string; obligacionId: string | null; obligacionesCargos: string[]; movimientosInventario: string[]; operacionAnticiposId: string | null; replayed: boolean }>> {
  const { negocioId, recepcionId } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  const parsed = parseOpcionesAprobacion(input.body)
  if (!parsed.ok) return parsed
  const o = parsed.value
  const fp = huella([negocioId, recepcionId, "APROBACION", o.version, o.tratamientoImpuestos, o.confirmoExcedentes, o.confirmoDiferenciasCosto, o.aplicarAnticipos.map((a) => [a.creditoId, a.importe.toFixed(2)]), ...(o.confirmoNoDuplicado ? ["noDuplicado"] : []), ...(o.confirmoTotalPedido ? ["totalPedido"] : []), ...(o.anticipoPedidoEsperado.gt(0) ? [["anticipoPedido", o.anticipoPedidoEsperado.toFixed(2)]] : []), ...(o.actualizarPrecios.length ? [["precios", o.actualizarPrecios.map((x) => [x.clave, x.precioPropuesto, ...(x.modo === "SIN_ETIQUETA" ? [x.modo] : [])])]] : [])])
  const replay = async (client: Db | Tx) => {
    const previo = await replayEvento(client, negocioId, key, fp, { recepcionId })
    if (!previo || !previo.ok) return previo
    return { ok: true as const, value: { ...(await resultadoAprobacion(client, negocioId, recepcionId)), replayed: true } }
  }
  type Aprobada = { recepcionId: string; obligacionId: string | null; obligacionesCargos: string[]; movimientosInventario: string[]; operacionAnticiposId: string | null; replayed: boolean }
  return conErrores<Aprobada>(() => runSerializable(db, async (tx): Promise<CompraResult<Aprobada>> => {
    const previo = await replay(tx)
    if (previo) return previo
    const bloqueo = await bloquearRecepcion(tx, negocioId, recepcionId)
    if (!bloqueo) return RECEPCION_NO_ENCONTRADA
    if (bloqueo.estado === "APROBADA") return fail(409, "Esta recepción ya fue aprobada.", "RECEPCION_YA_APROBADA")
    if (bloqueo.estado !== "BORRADOR" && bloqueo.estado !== "PENDIENTE_APROBACION") return fail(409, "La recepción ya está cerrada.", "RECEPCION_CERRADA", { estado: bloqueo.estado })
    // Un borrador del cajero todavía no fue enviado: el dueño aprueba lo que el cajero envió (o sus propios borradores).
    if (bloqueo.estado === "BORRADOR" && bloqueo.preparadaPorTipo === "EMPLEADO") return fail(409, "El cajero todavía no envió esta recepción: puede seguir cargándola.", "RECEPCION_NO_ENVIADA")
    if (bloqueo.version !== o.version) return VERSION_CAMBIADA
    if (bloqueo.compraId) await tx.$queryRaw`SELECT "id" FROM "compras" WHERE "id" = ${bloqueo.compraId} AND "negocioId" = ${negocioId} FOR UPDATE`
    // D-7 v2: candados de caja → salida de los pagos asociados ANTES que los proveedores (orden de F5 y F10-C1).
    await bloquearPagosEnTx(tx, negocioId, recepcionId)
    const r = await tx.recepcion.findUniqueOrThrow({ where: { id: recepcionId }, include: RECEPCION_INCLUDE })
    // Candados de proveedores en orden fijo (sin interbloqueos con el motor de asignaciones).
    for (const pid of [...new Set([r.proveedorId, ...r.cargos.map((k) => k.proveedorId)])].sort()) await bloquearProveedor(tx, negocioId, pid)
    const tratamiento = o.tratamientoImpuestos ?? (await leerTratamientoImpuestos(tx, negocioId))
    const a = await analizar(tx, negocioId, r, tratamiento)
    if (a.problemas.length) return fail(409, a.problemas[0].error, a.problemas[0].code, { problemas: a.problemas })
    if (a.excedentes.length && !o.confirmoExcedentes) {
      return fail(409, "Se aceptó más de lo pendiente del pedido (o productos que no estaban pedidos). Revisalo y confirmá para aprobar.", "EXCEDENTE_SOBRE_PEDIDO", { excedentes: a.excedentes })
    }
    if (a.diferenciasCosto.length && !o.confirmoDiferenciasCosto) {
      return fail(409, `Hay costos que difieren más de ${UMBRAL_DIFERENCIA_COSTO_PCT}% de la referencia. Revisalos y confirmá para aprobar.`, "DIFERENCIA_DE_COSTO", { diferenciasCosto: a.diferenciasCosto })
    }
    if (a.totalPedido?.excede && !o.confirmoTotalPedido) {
      return fail(409, `Lo facturado supera el total informado en el pedido N° ${a.totalPedido.numero}. Revisalo y confirmá para aprobar.`, "TOTAL_PEDIDO_SUPERADO", { totalPedido: a.totalPedido })
    }
    const totalAnticipos = o.aplicarAnticipos.reduce((s, x) => s.plus(x.importe), CERO)
    if (totalAnticipos.gt(a.calculo.totalObligacion)) return fail(409, "Los anticipos a aplicar superan la deuda de esta recepción.", "ANTICIPOS_EXCEDEN_OBLIGACION")

    // ---- desde acá se escribe: cualquier fallo de dominio aborta TODO ----
    const ahora = new Date()
    const porLinea = new Map(a.calculo.lineas.map((x) => [x.id, x]))
    for (const l of r.lineas) {
      const c = porLinea.get(l.id)!
      await tx.recepcionLinea.update({
        where: { id: l.id },
        data: {
          controlStockAlAprobar: a.controlStock.get(l.id) ?? false, subtotalDecimal: c.subtotal, descuentoLineaDecimal: c.descuentoLinea, descuentoGlobalDecimal: c.descuentoGlobal,
          netoDecimal: c.neto, impuestosDecimal: c.impuestos, percepcionDecimal: c.percepcion, cargosDecimal: c.cargos, costoInventarioTotalDecimal: c.costoInventarioTotal,
          costoUnitarioInventarioDecimal: c.costoUnitarioInventario,
        },
      })
    }
    await tx.eventoCompraRecepcion.create({ data: { negocioId, recepcionId, tipo: "APROBACION", motivo: null, actorTipo: "NEGOCIO", actorId: negocioId, idempotencyKey: key, idempotencyFingerprint: fp, createdAt: ahora } })
    await tx.recepcion.update({
      where: { id: recepcionId },
      data: {
        estado: "APROBADA", aprobadaEn: ahora, version: r.version + 1, tratamientoImpuestos: tratamiento, netoDecimal: a.calculo.neto, descuentosDecimal: a.calculo.descuentos,
        impuestosDecimal: a.calculo.impuestos.plus(a.calculo.percepciones), cargosDecimal: a.calculo.cargosMismoProveedor, totalObligacionDecimal: a.calculo.totalObligacion,
      },
    })
    // Stock: sólo por la autoridad R3A, una entrada por línea aceptada.
    const entradas = await registrarEntradaRecepcion(tx, {
      negocioId,
      lineas: r.lineas.filter((l) => l.cantidadAceptadaDecimal.gt(0)).map((l) => ({ recepcionLineaId: l.id, key: { productoId: l.productoId!, productoVarianteId: l.productoVarianteId }, cantidad: Number(l.cantidadAceptadaDecimal.toString()) })),
    })
    // Precios de venta (opcional): propuestas con el costo y el precio ANTERIORES (antes de tocar el costo).
    const propuestasPrecio = await proponerPreciosEnTx(tx, negocioId, r.lineas.map((l) => ({ id: l.id, orden: l.orden, productoId: l.productoId, productoVarianteId: l.productoVarianteId, productoNombre: l.productoNombre, varianteNombre: l.varianteNombre, costoNuevo: porLinea.get(l.id)!.costoUnitarioInventario })), { fechaRecepcion: r.fechaRecepcion, aprobadaEn: ahora })
    // «Último costo»: sólo si esta recepción es la más reciente para esa clave (orden real).
    const costosActualizados: Array<{ stockKey: string; costo: string }> = []
    for (const l of r.lineas) {
      const c = porLinea.get(l.id)!
      if (!c.costoUnitarioInventario || !l.productoId) continue
      const stockKey = claveStock(l.productoId, l.productoVarianteId)
      const actual = await tx.costoVigente.findUnique({ where: { negocioId_stockKey: { negocioId, stockKey } } })
      const candidato = { fechaRecepcion: r.fechaRecepcion, aprobadaEn: ahora, recepcionLineaId: l.id }
      if (actual && !esMasReciente(candidato, actual)) continue
      await tx.costoVigente.upsert({
        where: { negocioId_stockKey: { negocioId, stockKey } },
        create: { negocioId, stockKey, productoId: l.productoId, productoVarianteId: l.productoVarianteId, recepcionLineaId: l.id, fechaRecepcion: r.fechaRecepcion, aprobadaEn: ahora, costoUnitarioDecimal: c.costoUnitarioInventario },
        update: { recepcionLineaId: l.id, fechaRecepcion: r.fechaRecepcion, aprobadaEn: ahora, costoUnitarioDecimal: c.costoUnitarioInventario },
      })
      const costo = Number(c.costoUnitarioInventario.toString())
      if (l.productoVarianteId) await tx.productoVariante.update({ where: { id: l.productoVarianteId }, data: { costo } })
      else await tx.producto.update({ where: { id: l.productoId }, data: { costo } })
      costosActualizados.push({ stockKey, costo: c.costoUnitarioInventario.toString() })
    }
    // Sólo los precios que el dueño eligió y vio; si algo cambió en el medio, se aborta TODA la aprobación.
    const precios = await aplicarPreciosEnTx(tx, { negocioId, recepcionId, propuestas: propuestasPrecio, seleccion: o.actualizarPrecios, ahora })
    if (!precios.ok) throw new AbortoTransaccion(precios)
    // Productos que entrega este proveedor: se suman los aceptados (configuración; nunca duplica productos ni stock).
    await asociarProductosDeRecepcion(tx, negocioId, r.proveedorId, r.lineas.filter((l) => l.cantidadAceptadaDecimal.gt(0)))
    // Deuda: UNA obligación por la recepción (si hay importe) + una por cargo con obligación propia. Todo por el motor de F5.
    const comprobante = [r.comprobanteTipo, r.comprobanteNumero].filter(Boolean).join(" ")
    let obligacionId: string | null = null
    if (a.calculo.totalObligacion.gt(0)) {
      obligacionId = (await crearObligacionDeRecepcionEnTx(tx, {
        negocioId, proveedorId: r.proveedorId, origen: "RECEPCION", recepcionId, importe: a.calculo.totalObligacion, fecha: r.fechaRecepcion,
        descripcion: `Recepción N° ${r.numero}${comprobante ? ` · ${comprobante}` : ""}`, comprobanteTipo: r.comprobanteTipo, comprobanteNumero: r.comprobanteNumero,
        comprobanteFecha: r.comprobanteFecha, idempotencyKey: `${key}:obligacion`,
      }, { auditar: opciones.auditarCuenta })).obligacionId
    }
    const obligacionesCargos: string[] = []
    for (const k of a.calculo.cargosConObligacionPropia) {
      const cargo = r.cargos.find((x) => x.id === k.id)!
      obligacionesCargos.push((await crearObligacionDeRecepcionEnTx(tx, {
        negocioId, proveedorId: cargo.proveedorId, origen: "CARGO_ACCESORIO", recepcionCargoId: cargo.id, importe: cargo.importeDecimal, fecha: r.fechaRecepcion,
        descripcion: `${k.gasto ? "Gasto" : "Cargo"} «${cargo.concepto}» · Recepción N° ${r.numero}`, comprobanteTipo: cargo.comprobanteTipo, comprobanteNumero: cargo.comprobanteNumero,
        idempotencyKey: `${key}:cargo:${cargo.orden}`,
      }, { auditar: opciones.auditarCuenta })).obligacionId)
    }
    // D-7 v2: los pagos en efectivo hechos al recibir se vinculan como crédito de F5 (si no lo estaban) y se
    // aplican solos a esta deuda hasta lo adeudado; lo que sobra queda como anticipo del proveedor.
    const pagos = await planificarPagosEnTx(tx, { negocioId, recepcionId, proveedorId: r.proveedorId, tope: obligacionId ? a.calculo.totalObligacion : CERO, clave: key, confirmoNoDuplicado: o.confirmoNoDuplicado }, { auditarCuenta: opciones.auditarCuenta })
    if (!pagos.ok) throw new AbortoTransaccion(pagos)
    const aplicadoPagosRecepcion = pagos.value.plan.reduce((s, x) => s.plus(x.importe), CERO)
    // Pagos E1: pagos confirmados ligados a ESTE pedido → sólo a la obligación de esta recepción, después del efectivo
    // al recibir y hasta lo adeudado; el sobrante sigue ligado al pedido para las próximas recepciones.
    const anticiposPedido = obligacionId && r.compraId
      ? await planAnticiposPedido(tx, { negocioId, proveedorId: r.proveedorId, compraId: r.compraId, tope: a.calculo.totalObligacion.minus(aplicadoPagosRecepcion) })
      : []
    const aplicadoPedido = anticiposPedido.reduce((s, x) => s.plus(x.importe), CERO)
    if (!aplicadoPedido.eq(o.anticipoPedidoEsperado)) {
      throw new AbortoTransaccion(fail(409, "Los pagos anticipados del pedido cambiaron desde que abriste la revisión. Revisá de nuevo los importes antes de aprobar.", "PAGOS_PEDIDO_CAMBIARON", { seAplica: aplicadoPedido.toFixed(2), visto: o.anticipoPedidoEsperado.toFixed(2) }))
    }
    const aplicadoPagos = aplicadoPagosRecepcion.plus(aplicadoPedido)
    // Un pago ligado a un pedido nunca se aplica a mano desde otra recepción.
    if (o.aplicarAnticipos.length) {
      const ligados = await tx.creditoProveedor.findMany({ where: { negocioId, id: { in: o.aplicarAnticipos.map((x) => x.creditoId) }, compraReferenciaId: { not: null } }, select: { id: true } })
      if (ligados.length) throw new AbortoTransaccion(fail(409, "Ese pago está ligado a un pedido: se aplica solo al aprobar las recepciones de ese pedido.", "PAGO_LIGADO_A_PEDIDO"))
    }
    // Anticipos manuales (casos especiales): mismo motor, sobre lo que quede de la deuda.
    if (o.aplicarAnticipos.some((x) => pagos.value.acreditados.some((p) => p.creditoId === x.creditoId))) {
      throw new AbortoTransaccion(fail(409, "Ese pago ya se aplica solo con esta recepción: no lo cargues a mano.", "ANTICIPO_DUPLICADO"))
    }
    if (totalAnticipos.gt(a.calculo.totalObligacion.minus(aplicadoPagos))) throw new AbortoTransaccion(fail(409, "Los anticipos a aplicar superan lo que queda de la deuda después del pago en efectivo.", "ANTICIPOS_EXCEDEN_OBLIGACION"))
    let operacionAnticiposId: string | null = null
    const asignar = [
      ...pagos.value.plan.map((x) => ({ creditoId: x.creditoId, obligacionId: obligacionId!, importe: x.importe })),
      ...anticiposPedido.map((x) => ({ creditoId: x.creditoId, obligacionId: obligacionId!, importe: x.importe })),
      ...o.aplicarAnticipos.map((x) => ({ creditoId: x.creditoId, obligacionId: obligacionId!, importe: x.importe })),
    ]
    if (asignar.length) {
      if (!obligacionId) throw new AbortoTransaccion(fail(409, "Esta recepción no genera deuda: no hay a qué aplicar anticipos.", "SIN_OBLIGACION"))
      const motivo = pagos.value.plan.length ? `Pago en efectivo al recibir aplicado al aprobar la recepción N° ${r.numero}` : anticiposPedido.length ? `Pago anticipado del pedido aplicado al aprobar la recepción N° ${r.numero}` : `Anticipo aplicado al aprobar la recepción N° ${r.numero}`
      const solicitud = { tipo: "ASIGNAR" as const, desafectar: [], asignar, motivo }
      const res = await operarAsignacionesEnTx(tx, { negocioId, proveedorId: r.proveedorId, solicitud, idempotencyKey: `${key}:anticipos`, fingerprint: huella([fp, "anticipos"]) }, { auditar: opciones.auditarCuenta })
      if (!res.ok) throw new AbortoTransaccion(fail(res.status, res.error, res.code, res.detalle))
      operacionAnticiposId = res.value.operacionId
    }
    await marcarAcreditadosEnTx(tx, pagos.value.acreditados, pagos.value.plan)
    if (opciones.auditar) {
      await opciones.auditar(tx, {
        accion: "recepcion.aprobada", recurso: "recepcion", recursoId: recepcionId,
        detalle: {
          negocioId, recepcionId, numero: r.numero, proveedorId: r.proveedorId, compraId: r.compraId, tratamientoImpuestos: tratamiento,
          totalObligacion: a.calculo.totalObligacion.toFixed(2), neto: a.calculo.neto.toFixed(2), impuestos: a.calculo.impuestos.toFixed(2), percepciones: a.calculo.percepciones.toFixed(2),
          lineas: r.lineas.map((l) => ({ recepcionLineaId: l.id, aceptada: l.cantidadAceptadaDecimal.toFixed(3), rechazada: l.cantidadRechazadaDecimal.toFixed(3), costoUnitarioInventario: porLinea.get(l.id)!.costoUnitarioInventario?.toString() ?? null })),
          entradasStock: entradas.filter((e) => e.movimientoInventarioId).map((e) => ({ recepcionLineaId: e.recepcionLineaId, movimientoInventarioId: e.movimientoInventarioId, stockAntes: e.stockAntes, stockDespues: e.stockDespues })),
          costosActualizados, obligacionId, obligacionesCargos, operacionAnticiposId, excedentesConfirmados: a.excedentes.length, diferenciasConfirmadas: a.diferenciasCosto.length,
          preciosVentaActualizados: precios.aplicados,
          anticiposPedido: anticiposPedido.map((x) => ({ creditoId: x.creditoId, aplicado: x.importe.toFixed(2) })),
          ...(a.totalPedido ? { totalPedido: { informado: a.totalPedido.totalInformado, acumulado: a.totalPedido.acumulado, excede: a.totalPedido.excede, confirmadoPorDueno: a.totalPedido.excede ? o.confirmoTotalPedido : null } } : {}),
          pagosAlRecibir: pagos.value.acreditados.map((x) => ({ pagoRecepcionId: x.pagoId, creditoId: x.creditoId, aplicado: pagos.value.plan.filter((y) => y.pagoId === x.pagoId).reduce((t, y) => t.plus(y.importe), CERO).toFixed(2) })),
        },
      })
    }
    return {
      ok: true as const,
      value: { recepcionId, obligacionId, obligacionesCargos, movimientosInventario: entradas.flatMap((e) => (e.movimientoInventarioId ? [e.movimientoInventarioId] : [])), operacionAnticiposId, replayed: false },
    }
  }), () => replay(db))
}

async function resultadoAprobacion(client: Db | Tx, negocioId: string, recepcionId: string) {
  const r = await client.recepcion.findFirstOrThrow({
    where: { id: recepcionId, negocioId },
    select: { obligaciones: { select: { id: true } }, cargos: { select: { obligaciones: { select: { id: true } } } }, lineas: { select: { movimientoInventario: { select: { id: true } } } }, eventos: { where: { tipo: "APROBACION" }, select: { idempotencyKey: true } } },
  })
  const key = r.eventos[0]?.idempotencyKey ?? ""
  const op = key ? await client.operacionAsignacion.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: `${key}:anticipos` } }, select: { id: true } }) : null
  return {
    recepcionId,
    obligacionId: r.obligaciones[0]?.id ?? null,
    obligacionesCargos: r.cargos.flatMap((k) => k.obligaciones.map((x) => x.id)),
    movimientosInventario: r.lineas.flatMap((l) => (l.movimientoInventario ? [l.movimientoInventario.id] : [])),
    operacionAnticiposId: op?.id ?? null,
  }
}

// ---------------------------------------------------------------------------
// Compras (pedidos)
// ---------------------------------------------------------------------------

export async function crearCompra(
  db: Db,
  input: { negocioId: string; body: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaCompra } = {}
): Promise<CompraResult<{ compraId: string; numero: number; replayed: boolean }>> {
  const { negocioId } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>
  const proveedorId = idTexto(b.proveedorId)
  if (!proveedorId) return fail(400, "Elegí el proveedor.", "PROVEEDOR_REQUERIDO")
  const fechaPedido = fechaDia(b.fechaPedido, new Date())
  if (!fechaPedido) return fail(400, "La fecha del pedido no es válida.", "FECHA_INVALIDA")
  const notas = texto(b.notas, TEXTO_MAX)
  if (!notas.ok) return fail(400, "Las notas admiten hasta 500 caracteres.", "NOTAS_INVALIDAS")
  const raw = Array.isArray(b.lineas) ? b.lineas : []
  if (!raw.length || raw.length > MAX_LINEAS) return fail(400, "Agregá entre 1 y 200 productos al pedido.", "LINEAS_REQUERIDAS")
  // Modalidad «sólo sé el total»: total informado por el proveedor + si incluye IVA; los costos unitarios quedan
  // pendientes (NULL) hasta la recepción. Nunca se inventan ni se reparte el total entre los productos.
  const conTotal = b.totalInformado !== undefined && b.totalInformado !== null && b.totalInformado !== ""
  const totalInformado = conTotal ? decimal(b.totalInformado, 2, 9_999_999_999) : null
  if (conTotal && (!totalInformado || !totalInformado.gt(0))) return fail(400, "El total informado tiene que ser un importe mayor a cero.", "TOTAL_INVALIDO")
  const totalInformadoIva = conTotal ? (TOTAL_INFORMADO_IVA as readonly unknown[]).includes(b.totalInformadoIva) ? (b.totalInformadoIva as string) : null : null
  if (conTotal && !totalInformadoIva) return fail(400, "Indicá si el total incluye IVA, no lo incluye o todavía no se sabe.", "TOTAL_IVA_REQUERIDO")
  const lineas: Array<{ productoId: string; productoVarianteId: string | null; cantidad: Dec; costo: Dec | null }> = []
  for (const [i, r0] of raw.entries()) {
    const x = (r0 && typeof r0 === "object" ? r0 : {}) as Record<string, unknown>
    const productoId = idTexto(x.productoId)
    const cantidad = decimal(x.cantidadPedida, 3, 999_999_999)
    const costo = x.costoUnitarioAcordado === undefined || x.costoUnitarioAcordado === null || x.costoUnitarioAcordado === "" ? null : decimal(x.costoUnitarioAcordado, 4, 9_999_999_999)
    if (!productoId || !cantidad || !cantidad.gt(0)) return fail(400, `Renglón ${i + 1}: producto y cantidad (mayor a cero) son obligatorios.`, "LINEA_INVALIDA", { linea: i })
    if (x.costoUnitarioAcordado !== undefined && x.costoUnitarioAcordado !== null && x.costoUnitarioAcordado !== "" && !costo) return fail(400, `Renglón ${i + 1}: costo acordado inválido.`, "COSTO_INVALIDO", { linea: i })
    if (conTotal && costo) return fail(400, `Renglón ${i + 1}: en un pedido con total informado los costos unitarios se completan al recibir.`, "COSTO_CON_TOTAL", { linea: i })
    lineas.push({ productoId, productoVarianteId: x.productoVarianteId ? idTexto(x.productoVarianteId) : null, cantidad, costo })
  }
  const fp = huella([negocioId, proveedorId, fechaPedido.toISOString(), notas.value, lineas.map((l) => [l.productoId, l.productoVarianteId, l.cantidad.toFixed(3), l.costo?.toFixed(4) ?? null]), ...(totalInformado ? [["total", totalInformado.toFixed(2), totalInformadoIva]] : [])])
  const replay = async (client: Pick<Tx, "compra">) => {
    const p = await client.compra.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: { id: true, numero: true, idempotencyFingerprint: true } })
    if (!p) return null
    return p.idempotencyFingerprint === fp ? { ok: true as const, value: { compraId: p.id, numero: p.numero, replayed: true } } : CLAVE_REUSADA
  }
  return conErrores(() => runSerializable(db, async (tx) => {
    const previa = await replay(tx)
    if (previa) return previa
    const prov = await tx.proveedor.findFirst({ where: { id: proveedorId, negocioId }, select: { activo: true } })
    if (!prov) return fail(404, "Proveedor no encontrado.", "PROVEEDOR_NO_ENCONTRADO")
    if (!prov.activo) return fail(409, "El proveedor está inactivo.", "PROVEEDOR_INACTIVO")
    const productos = await tx.producto.findMany({ where: { id: { in: [...new Set(lineas.map((l) => l.productoId))] }, negocioId, eliminado: false }, select: { id: true, nombre: true, unidadMedida: true, variantes: { select: { id: true, nombre: true, activo: true } } } })
    const porId = new Map(productos.map((p) => [p.id, p]))
    const resueltas: Array<(typeof lineas)[number] & { productoNombre: string; varianteNombre: string | null }> = []
    for (const [i, l] of lineas.entries()) {
      const p = porId.get(l.productoId)
      if (!p) return fail(404, `Renglón ${i + 1}: producto no encontrado.`, "PRODUCTO_NO_ENCONTRADO", { linea: i })
      if (!esUnidadFraccionable(p.unidadMedida) && !l.cantidad.isInteger()) return fail(400, `Renglón ${i + 1}: «${p.nombre}» se cuenta por ${p.unidadMedida || "unidad"}: usá cantidades enteras.`, "CANTIDAD_ENTERA_REQUERIDA", { linea: i })
      const activas = p.variantes.filter((v) => v.activo)
      const v = activas.find((x) => x.id === l.productoVarianteId)
      if (activas.length > 0 && !v) return fail(400, `Renglón ${i + 1}: «${p.nombre}» tiene variantes: elegí cuál pedís.`, "VARIANTE_REQUERIDA", { linea: i })
      if (activas.length === 0 && l.productoVarianteId) return fail(400, `Renglón ${i + 1}: «${p.nombre}» no tiene esa variante.`, "VARIANTE_INVALIDA", { linea: i })
      resueltas.push({ ...l, productoNombre: p.nombre, varianteNombre: v?.nombre ?? null })
    }
    const max = await tx.compra.aggregate({ where: { negocioId }, _max: { numero: true } })
    const numero = (max._max.numero ?? 0) + 1
    const c = await tx.compra.create({ data: { negocioId, proveedorId, numero, fechaPedido, notas: notas.value, totalInformadoDecimal: totalInformado, totalInformadoIva, actorId: negocioId, idempotencyKey: key, idempotencyFingerprint: fp }, select: { id: true } })
    for (const [i, l] of resueltas.entries()) {
      await tx.compraLinea.create({ data: { negocioId, compraId: c.id, orden: i + 1, productoId: l.productoId, productoVarianteId: l.productoVarianteId, productoNombre: l.productoNombre.slice(0, 200), varianteNombre: l.varianteNombre?.slice(0, 200) ?? null, cantidadPedidaDecimal: l.cantidad, costoUnitarioAcordadoDecimal: l.costo } })
    }
    if (opciones.auditar) await opciones.auditar(tx, { accion: "compra.creada", recurso: "compra", recursoId: c.id, detalle: { negocioId, compraId: c.id, numero, proveedorId, lineas: resueltas.length, totalInformado: totalInformado?.toFixed(2) ?? null, totalInformadoIva } })
    return { ok: true as const, value: { compraId: c.id, numero, replayed: false } }
  }), () => replay(db))
}

export const MOTIVOS_CIERRE_PEDIDO = {
  NO_REEMPLAZARA_DANADOS: "El proveedor no reemplazará la mercadería dañada",
  NO_ENTREGARA_FALTANTE: "El proveedor no entregará el faltante",
  CANCELADO_PARCIAL: "Pedido cancelado parcialmente",
  OTRO: "Otro",
} as const
export type MotivoCierrePedido = keyof typeof MOTIVOS_CIERRE_PEDIDO

export async function cerrarCompra(
  db: Db,
  tipo: "CIERRE_COMPRA" | "ANULACION_COMPRA",
  input: { negocioId: string; compraId: string; motivo: unknown; idempotencyKey: string; motivoTipo?: unknown; confirmo?: unknown },
  opciones: { auditar?: AuditoriaCompra } = {}
): Promise<CompraResult<{ replayed: boolean }>> {
  const { negocioId, compraId } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  const detalleTexto = texto(input.motivo, TEXTO_MAX)
  if (!detalleTexto.ok) return fail(400, "El motivo admite hasta 500 caracteres.", "MOTIVO_INVALIDO")
  // Cierre con pendientes: motivo elegido de la lista (con detalle opcional; obligatorio si es «Otro») y confirmación explícita.
  let motivoTipo: MotivoCierrePedido | null = null
  if (tipo === "CIERRE_COMPRA" && input.motivoTipo !== undefined && input.motivoTipo !== null) {
    if (typeof input.motivoTipo !== "string" || !(input.motivoTipo in MOTIVOS_CIERRE_PEDIDO)) return fail(400, "Elegí el motivo del cierre.", "MOTIVO_INVALIDO")
    motivoTipo = input.motivoTipo as MotivoCierrePedido
    if (input.confirmo !== true) return fail(400, "Confirmá que cerrás el pedido sin recibir lo pendiente.", "CONFIRMACION_REQUERIDA")
  }
  const motivoValor = motivoTipo && motivoTipo !== "OTRO" ? [MOTIVOS_CIERRE_PEDIDO[motivoTipo], detalleTexto.value].filter(Boolean).join(": ").slice(0, TEXTO_MAX) : detalleTexto.value
  if (!motivoValor) return fail(400, "Escribí el motivo.", "MOTIVO_REQUERIDO")
  const motivo = { value: motivoValor }
  const fp = huella([negocioId, compraId, tipo, motivo.value, ...(motivoTipo ? [motivoTipo] : [])])
  return conErrores(() => runSerializable(db, async (tx) => {
    const previo = await replayEvento(tx, negocioId, key, fp, { compraId })
    if (previo) return previo
    const filas = await tx.$queryRaw<Array<{ estado: string }>>`SELECT "estado" FROM "compras" WHERE "id" = ${compraId} AND "negocioId" = ${negocioId} FOR UPDATE`
    if (!filas[0]) return fail(404, "Pedido no encontrado.", "COMPRA_NO_ENCONTRADA")
    if (filas[0].estado !== "ABIERTA") return fail(409, "Ese pedido ya está cerrado o anulado.", "COMPRA_CERRADA")
    if (await tx.recepcion.findFirst({ where: { compraId, negocioId, estado: "PENDIENTE_APROBACION" }, select: { id: true } })) {
      return fail(409, "El pedido tiene recepciones esperando aprobación: aprobalas o rechazalas antes.", "COMPRA_CON_RECEPCIONES_PENDIENTES")
    }
    // Un borrador abierto de ese pedido (de cualquier persona) también impide cerrarlo: se resuelve antes.
    const borrador = await tx.recepcion.findFirst({ where: { compraId, negocioId, estado: "BORRADOR" }, select: { numero: true } })
    if (borrador) return fail(409, `La recepción N° ${borrador.numero} de este pedido está en borrador: enviala y resolvela, o descartala, antes de cerrar.`, "COMPRA_CON_BORRADORES", { recepcion: borrador.numero })
    // Lo que queda sin recibir al cerrar (foto inmutable en el evento): pedido, aceptado y pendiente por renglón.
    let detalleCierre: string | null = null
    if (tipo === "CIERRE_COMPRA") {
      const lineas = await tx.compraLinea.findMany({ where: { compraId, negocioId }, orderBy: { orden: "asc" }, select: { id: true, productoNombre: true, varianteNombre: true, cantidadPedidaDecimal: true } })
      const aceptado = new Map((await tx.recepcionLinea.groupBy({ by: ["compraLineaId"], where: { negocioId, compraLineaId: { in: lineas.map((l) => l.id) }, recepcion: { estado: "APROBADA" } }, _sum: { cantidadAceptadaDecimal: true } })).map((x) => [x.compraLineaId!, x._sum.cantidadAceptadaDecimal ?? CERO]))
      const foto = lineas.map((l) => {
        const a = aceptado.get(l.id) ?? CERO
        return { compraLineaId: l.id, producto: l.productoNombre, variante: l.varianteNombre, pedida: q(l.cantidadPedidaDecimal), aceptada: q(a), pendiente: q(D.max(l.cantidadPedidaDecimal.minus(a), CERO)) }
      })
      if (motivoTipo && !foto.some((x) => (x.pendiente ?? 0) > 0)) return fail(409, "El pedido no tiene nada pendiente: ya está completo.", "COMPRA_SIN_PENDIENTES")
      detalleCierre = JSON.stringify({ motivoTipo, lineas: foto })
    }
    if (tipo === "ANULACION_COMPRA" && (await tx.recepcion.findFirst({ where: { compraId, negocioId, estado: "APROBADA" }, select: { id: true } }))) {
      return fail(409, "El pedido ya tiene mercadería recibida: no se anula, se cierra con faltante.", "COMPRA_CON_RECEPCIONES")
    }
    const ahora = new Date()
    await tx.eventoCompraRecepcion.create({ data: { negocioId, compraId, tipo, motivo: motivo.value, detalle: detalleCierre, actorTipo: "NEGOCIO", actorId: negocioId, idempotencyKey: key, idempotencyFingerprint: fp, createdAt: ahora } })
    await tx.compra.update({ where: { id: compraId }, data: { estado: tipo === "ANULACION_COMPRA" ? "ANULADA" : "CERRADA_CON_FALTANTE", cerradaEn: ahora } })
    if (opciones.auditar) await opciones.auditar(tx, { accion: tipo === "ANULACION_COMPRA" ? "compra.anulada" : "compra.cerrada", recurso: "compra", recursoId: compraId, detalle: { negocioId, compraId, motivo: motivo.value, motivoTipo, pendientesAlCerrar: detalleCierre ? JSON.parse(detalleCierre).lineas : null } })
    return { ok: true as const, value: { replayed: false } }
  }), () => replayEvento(db, negocioId, key, fp, { compraId }))
}

// ---------------------------------------------------------------------------
// Configuración y lecturas
// ---------------------------------------------------------------------------

export async function actualizarConfiguracionCompras(db: Db, negocioId: string, body: unknown, opciones: { auditar?: AuditoriaCompra } = {}): Promise<CompraResult<{ tratamientoImpuestos: TratamientoImpuestos }>> {
  const t = (body as { tratamientoImpuestos?: unknown } | null)?.tratamientoImpuestos
  if (!(TRATAMIENTOS_IMPUESTOS as readonly unknown[]).includes(t)) return fail(400, "Tratamiento de impuestos inválido.", "TRATAMIENTO_INVALIDO")
  return db.$transaction(async (tx) => {
    const antes = await leerTratamientoImpuestos(tx, negocioId)
    await tx.configuracionCompras.upsert({ where: { negocioId }, create: { negocioId, tratamientoImpuestos: t as string }, update: { tratamientoImpuestos: t as string } })
    if (opciones.auditar && antes !== t) await opciones.auditar(tx, { accion: "compras.configuracion", recurso: "configuracion_compras", recursoId: negocioId, detalle: { negocioId, de: antes, a: t } })
    return { ok: true as const, value: { tratamientoImpuestos: t as TratamientoImpuestos } }
  })
}

/** Vista de una recepción. `paraEmpleado` limita a sus propias recepciones y omite los vínculos con la cuenta del proveedor. */
async function nombresEmpleados(db: Db, negocioId: string, ids: Array<string | null | undefined>) {
  // Regla única de identidad (empleado-identidad.ts): la cuenta operativa vinculada gana.
  return mapaNombresVisibles(db, negocioId, ids)
}

/** Catálogo para RECIBIR mercadería: identificación, unidad y variantes activas (sin precios ni costos). */
export async function catalogoRecepcion(db: Db, negocioId: string) {
  const productos = await db.producto.findMany({
    where: { negocioId, eliminado: false },
    orderBy: [{ nombre: "asc" }],
    take: 2000,
    select: { id: true, nombre: true, marca: true, sku: true, codigoBarras: true, categoria: true, unidadMedida: true, controlStock: true, variantes: { where: { activo: true }, orderBy: { createdAt: "asc" }, select: { id: true, nombre: true, sku: true, codigoBarras: true, activo: true, controlStock: true } } },
  })
  return productos.map((p) => ({ ...p, unidadMedida: p.unidadMedida || "unidad", fraccionable: esUnidadFraccionable(p.unidadMedida) }))
}

export async function detalleRecepcion(db: Db, negocioId: string, recepcionId: string, paraEmpleado: string | null = null) {
  const r = await db.recepcion.findFirst({
    where: { id: recepcionId, negocioId, ...(paraEmpleado ? { preparadaPorTipo: "EMPLEADO", preparadaPorEmpleadoId: paraEmpleado } : {}) },
    include: { ...RECEPCION_INCLUDE, eventos: { orderBy: { createdAt: "asc" } }, obligaciones: { select: { id: true, importeDecimal: true } } },
  })
  if (!r) return null
  const nombres = await nombresEmpleados(db, negocioId, [r.preparadaPorEmpleadoId, ...r.eventos.map((e) => (e.actorTipo === "EMPLEADO" ? e.actorId : null))])
  const unidades = new Map((await db.producto.findMany({ where: { negocioId, id: { in: r.lineas.flatMap((l) => (l.productoId ? [l.productoId] : [])) } }, select: { id: true, unidadMedida: true } })).map((p) => [p.id, p.unidadMedida || "unidad"]))
  return {
    id: r.id, numero: r.numero, estado: r.estado, version: r.version, proveedor: { id: r.proveedor.id, nombre: r.proveedor.nombre }, compra: r.compra,
    preparadaPor: r.preparadaPorTipo === "NEGOCIO" ? { tipo: "NEGOCIO", nombre: "Dueño" } : { tipo: "EMPLEADO", empleadoId: r.preparadaPorEmpleadoId, nombre: nombres.get(r.preparadaPorEmpleadoId ?? "") ?? "Empleado" },
    fechaRecepcion: r.fechaRecepcion, comprobante: { tipo: r.comprobanteTipo, numero: r.comprobanteNumero, fecha: r.comprobanteFecha },
    descuentoGlobal: n(r.descuentoGlobalDecimal), percepciones: n(r.percepcionesDecimal), notas: r.notas, motivoRechazo: r.motivoRechazo,
    enviadaEn: r.enviadaEn, aprobadaEn: r.aprobadaEn, rechazadaEn: r.rechazadaEn, descartadaEn: r.descartadaEn,
    lineas: r.lineas.map((l) => ({
      id: l.id, orden: l.orden, compraLineaId: l.compraLineaId, productoId: l.productoId, productoVarianteId: l.productoVarianteId, producto: l.productoNombre, variante: l.varianteNombre,
      unidadMedida: (l.productoId && unidades.get(l.productoId)) || "unidad",
      cantidadRecibida: q(l.cantidadRecibidaDecimal), cantidadAceptada: q(l.cantidadAceptadaDecimal), cantidadRechazada: q(l.cantidadRechazadaDecimal), motivoRechazo: l.motivoRechazo, detalleRechazo: l.detalleRechazo,
      costoUnitario: q(l.costoUnitarioDecimal), descuentoPct: q(l.descuentoPctDecimal), alicuotaImpuestoPct: q(l.alicuotaImpuestoPctDecimal),
      aprobacion: l.costoInventarioTotalDecimal ? { controlStock: l.controlStockAlAprobar, neto: n(l.netoDecimal), impuestos: n(l.impuestosDecimal), cargos: n(l.cargosDecimal), costoInventarioTotal: n(l.costoInventarioTotalDecimal), costoUnitarioInventario: q(l.costoUnitarioInventarioDecimal) } : null,
    })),
    cargos: r.cargos.map((k) => ({ id: k.id, orden: k.orden, tipo: k.tipo, proveedorId: k.proveedorId, proveedor: k.proveedor.nombre, concepto: k.concepto, importe: n(k.importeDecimal), distribucion: k.distribucion, comprobanteTipo: k.comprobanteTipo, comprobanteNumero: k.comprobanteNumero })),
    // El cajero nunca recibe la deuda generada (sólo el dueño ve la cuenta del proveedor).
    totalesAprobacion: r.estado === "APROBADA" && !paraEmpleado ? { tratamientoImpuestos: r.tratamientoImpuestos, neto: n(r.netoDecimal), descuentos: n(r.descuentosDecimal), impuestos: n(r.impuestosDecimal), cargos: n(r.cargosDecimal), totalObligacion: n(r.totalObligacionDecimal) } : null,
    historial: r.eventos.map((e) => ({ tipo: e.tipo, motivo: e.motivo, actorTipo: e.actorTipo, actorNombre: e.actorTipo === "NEGOCIO" ? "Dueño" : nombres.get(e.actorId) ?? "Empleado", createdAt: e.createdAt })),
    ...(paraEmpleado ? {} : { obligacionId: r.obligaciones[0]?.id ?? null }),
  }
}

export async function listarRecepciones(db: Db, negocioId: string, filtro: { estado?: string | null; proveedorId?: string | null; empleadoId?: string | null }) {
  const filas = await db.recepcion.findMany({
    where: { negocioId, ...(filtro.estado ? { estado: filtro.estado } : {}), ...(filtro.proveedorId ? { proveedorId: filtro.proveedorId } : {}), ...(filtro.empleadoId ? { preparadaPorTipo: "EMPLEADO", preparadaPorEmpleadoId: filtro.empleadoId } : {}) },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: { id: true, numero: true, estado: true, version: true, fechaRecepcion: true, comprobanteTipo: true, comprobanteNumero: true, preparadaPorTipo: true, preparadaPorEmpleadoId: true, totalObligacionDecimal: true, enviadaEn: true, motivoRechazo: true, createdAt: true, updatedAt: true, proveedor: { select: { id: true, nombre: true } }, compra: { select: { id: true, numero: true } }, _count: { select: { lineas: true } }, eventos: { where: { tipo: { in: ["DEVOLUCION_A_BORRADOR", "RECHAZO"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { tipo: true, motivo: true, createdAt: true } } },
  })
  const nombres = await nombresEmpleados(db, negocioId, filas.map((r) => r.preparadaPorEmpleadoId))
  return filas.map((r) => ({
    id: r.id, numero: r.numero, estado: r.estado, version: r.version, fechaRecepcion: r.fechaRecepcion, comprobante: [r.comprobanteTipo, r.comprobanteNumero].filter(Boolean).join(" ") || null,
    preparadaPor: r.preparadaPorTipo, preparadaPorNombre: r.preparadaPorTipo === "NEGOCIO" ? "Dueño" : nombres.get(r.preparadaPorEmpleadoId ?? "") ?? "Empleado",
    proveedor: r.proveedor, compra: r.compra, lineas: r._count.lineas, totalObligacion: filtro.empleadoId ? undefined : n(r.totalObligacionDecimal),
    enviadaEn: r.enviadaEn, ultimaObservacion: r.eventos[0] ? { tipo: r.eventos[0].tipo, motivo: r.eventos[0].motivo, createdAt: r.eventos[0].createdAt } : null,
    createdAt: r.createdAt, updatedAt: r.updatedAt,
  }))
}

/** Pedido con lo recibido DERIVADO de las recepciones aprobadas. `sinCostos` para el cajero. */
export async function detalleCompra(db: Db, negocioId: string, compraId: string, sinCostos = false) {
  const c = await db.compra.findFirst({ where: { id: compraId, negocioId }, include: { lineas: { orderBy: { orden: "asc" } }, proveedor: { select: { id: true, nombre: true } }, recepciones: { orderBy: { createdAt: "asc" }, select: { id: true, numero: true, estado: true, fechaRecepcion: true } }, eventos: { orderBy: { createdAt: "asc" } } } })
  if (!c) return null
  const ids = c.lineas.map((l) => l.id)
  const [recibido, revision] = await Promise.all([
    db.recepcionLinea.groupBy({ by: ["compraLineaId"], where: { negocioId, compraLineaId: { in: ids }, recepcion: { estado: "APROBADA" } }, _sum: { cantidadAceptadaDecimal: true } }),
    // Enviadas y todavía sin aprobar: se muestran aparte para no contar dos veces lo mismo.
    db.recepcionLinea.groupBy({ by: ["compraLineaId"], where: { negocioId, compraLineaId: { in: ids }, recepcion: { estado: "PENDIENTE_APROBACION" } }, _sum: { cantidadAceptadaDecimal: true } }),
  ])
  const porLinea = new Map(recibido.map((x) => [x.compraLineaId!, x._sum.cantidadAceptadaDecimal ?? CERO]))
  const enRevisionPorLinea = new Map(revision.map((x) => [x.compraLineaId!, x._sum.cantidadAceptadaDecimal ?? CERO]))
  const lineas = c.lineas.map((l) => {
    const rec = porLinea.get(l.id) ?? CERO
    return { id: l.id, orden: l.orden, productoId: l.productoId, productoVarianteId: l.productoVarianteId, producto: l.productoNombre, variante: l.varianteNombre, pedida: q(l.cantidadPedidaDecimal), recibida: q(rec), enRevision: q(enRevisionPorLinea.get(l.id) ?? CERO), pendiente: q(D.max(l.cantidadPedidaDecimal.minus(rec), CERO)), ...(sinCostos ? {} : { costoUnitarioAcordado: q(l.costoUnitarioAcordadoDecimal) }) }
  })
  const completa = lineas.every((l) => (l.pendiente ?? 0) <= 0)
  const alguna = lineas.some((l) => (l.recibida ?? 0) > 0)
  return {
    id: c.id, numero: c.numero, estado: c.estado, estadoRecepcion: completa ? "COMPLETA" : alguna ? "PARCIAL" : "SIN_RECIBIR", proveedor: c.proveedor, fechaPedido: c.fechaPedido, notas: c.notas, cerradaEn: c.cerradaEn,
    ...(sinCostos ? {} : { totalInformado: n(c.totalInformadoDecimal), totalInformadoIva: c.totalInformadoIva }),
    // Pagos E1: el dueño ve los pagos del pedido; el cajero, sólo cuánto se pagó por adelantado (para no pagar dos veces).
    ...(sinCostos
      ? { pagoAnticipado: (await anticiposPorPedido(db, negocioId, [c.id])).get(c.id) ?? null }
      : { pagos: pagosDePedidoParaRespuesta(await pagosDePedido(db, negocioId, c.proveedor.id, c.id)) }),
    lineas, recepciones: c.recepciones,
    historial: c.eventos.map((e) => ({ tipo: e.tipo, motivo: e.motivo, createdAt: e.createdAt, actor: e.actorTipo === "NEGOCIO" ? "Dueño" : "Empleado", ...(e.detalle ? { cierre: JSON.parse(e.detalle) as { motivoTipo: string | null; lineas: Array<{ compraLineaId: string; producto: string; variante: string | null; pedida: number; aceptada: number; pendiente: number }> } } : {}) })),
  }
}

export async function listarCompras(db: Db, negocioId: string, filtro: { estado?: string | null; proveedorId?: string | null }) {
  const filas = await db.compra.findMany({ where: { negocioId, ...(filtro.estado ? { estado: filtro.estado } : {}), ...(filtro.proveedorId ? { proveedorId: filtro.proveedorId } : {}) }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true } })
  const out: Array<Awaited<ReturnType<typeof detalleCompra>>> = []
  for (const f of filas) out.push(await detalleCompra(db, negocioId, f.id, false))
  return out.filter(Boolean).map((c) => ({ id: c!.id, numero: c!.numero, estado: c!.estado, estadoRecepcion: c!.estadoRecepcion, proveedor: c!.proveedor, fechaPedido: c!.fechaPedido, lineas: c!.lineas.length, totalInformado: c!.totalInformado ?? null, totalInformadoIva: c!.totalInformadoIva ?? null }))
}

export const TOTAL_INFORMADO_IVA = ["INCLUYE_IVA", "SIN_IVA", "NO_SE_SABE"] as const

export type EstadoPedidoParaRecibir = "PENDIENTE" | "PARCIAL" | "PENDIENTE_APROBACION" | "COMPLETADO" | "CERRADO_CON_PENDIENTES"

/**
 * Cajero: pedidos del dueño para recibir, con avance por renglón (pedido / aceptado / en revisión / pendiente)
 * y el borrador PROPIO que ya tenga para cada pedido (para retomarlo y no crear otro). Sin costos ni saldos.
 * Abiertos todos; completados (cerrados o sin pendiente) sólo de los últimos 30 días, hasta 50.
 */
export async function pedidosParaRecibir(db: Db, negocioId: string, empleadoId: string) {
  const hace30 = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const compras = await db.compra.findMany({
    where: { negocioId, OR: [{ estado: "ABIERTA" }, { estado: "CERRADA_CON_FALTANTE", cerradaEn: { gte: hace30 } }] },
    orderBy: [{ fechaPedido: "asc" }, { numero: "asc" }],
    take: 300,
    select: { id: true, numero: true, estado: true, fechaPedido: true, createdAt: true, proveedor: { select: { id: true, nombre: true } }, lineas: { orderBy: { orden: "asc" }, select: { id: true, productoNombre: true, varianteNombre: true, cantidadPedidaDecimal: true } } },
  })
  const ids = compras.flatMap((c) => c.lineas.map((l) => l.id))
  const [aprobado, revision, recepciones] = await Promise.all([
    db.recepcionLinea.groupBy({ by: ["compraLineaId"], where: { negocioId, compraLineaId: { in: ids }, recepcion: { estado: "APROBADA" } }, _sum: { cantidadAceptadaDecimal: true } }),
    db.recepcionLinea.groupBy({ by: ["compraLineaId"], where: { negocioId, compraLineaId: { in: ids }, recepcion: { estado: "PENDIENTE_APROBACION" } }, _sum: { cantidadAceptadaDecimal: true } }),
    db.recepcion.findMany({ where: { negocioId, compraId: { in: compras.map((c) => c.id) }, estado: { in: ["BORRADOR", "PENDIENTE_APROBACION"] } }, orderBy: { createdAt: "desc" }, select: { id: true, numero: true, compraId: true, estado: true, preparadaPorTipo: true, preparadaPorEmpleadoId: true } }),
  ])
  const ac = new Map(aprobado.map((x) => [x.compraLineaId!, x._sum.cantidadAceptadaDecimal ?? CERO]))
  const rv = new Map(revision.map((x) => [x.compraLineaId!, x._sum.cantidadAceptadaDecimal ?? CERO]))
  const anticipos = await anticiposPorPedido(db, negocioId, compras.map((c) => c.id))
  const salida = compras.map((c) => {
    let pendienteTotal = CERO
    let aceptadoTotal = CERO
    let pedidoTotal = CERO
    const lineas = c.lineas.map((l) => {
      const a = ac.get(l.id) ?? CERO
      const pend = D.max(l.cantidadPedidaDecimal.minus(a), CERO)
      pendienteTotal = pendienteTotal.plus(pend)
      aceptadoTotal = aceptadoTotal.plus(D.min(a, l.cantidadPedidaDecimal))
      pedidoTotal = pedidoTotal.plus(l.cantidadPedidaDecimal)
      return { producto: l.productoNombre, variante: l.varianteNombre, pedida: q(l.cantidadPedidaDecimal), aceptada: q(a), enRevision: q(rv.get(l.id) ?? CERO), pendiente: q(pend) }
    })
    const propias = recepciones.filter((r) => r.compraId === c.id)
    const borrador = propias.find((r) => r.estado === "BORRADOR" && r.preparadaPorTipo === "EMPLEADO" && r.preparadaPorEmpleadoId === empleadoId) ?? null
    const enviadas = propias.filter((r) => r.estado === "PENDIENTE_APROBACION").length
    const estado: EstadoPedidoParaRecibir =
      c.estado === "CERRADA_CON_FALTANTE" ? (pendienteTotal.gt(0) ? "CERRADO_CON_PENDIENTES" : "COMPLETADO") : c.estado !== "ABIERTA" || pendienteTotal.lte(0) ? "COMPLETADO" : enviadas > 0 ? "PENDIENTE_APROBACION" : aceptadoTotal.gt(0) ? "PARCIAL" : "PENDIENTE"
    return {
      id: c.id, numero: c.numero, estadoCompra: c.estado, estado, proveedor: c.proveedor, fechaPedido: c.fechaPedido, productos: c.lineas.length,
      avance: { pedido: q(pedidoTotal), aceptado: q(aceptadoTotal), pendiente: q(pendienteTotal) }, recepcionesEnviadas: enviadas,
      borradorPropio: borrador ? { id: borrador.id, numero: borrador.numero } : null, lineas,
      pagoAnticipado: anticipos.get(c.id) ?? null,
    }
  })
  return salida
}
