// ============================================
// F10-C2a — HTTP glue de compras y recepciones
// ============================================
// Dueño: rutas /api/negocio/compras y /api/negocio/recepciones (requireNegocioCajaGenerico).
// Cajero (área caja): rutas /api/operativo/caja/[slug]/recepciones — prepara, edita, envía o
// descarta SUS borradores; nunca aprueba, rechaza ni ve la cuenta del proveedor. El negocio y el
// actor salen SIEMPRE de la sesión. Auditoría dentro de la misma transacción (R1).

import { NextRequest, NextResponse } from "next/server"
import { registrarPagoPedido } from "@/lib/pagos-pedido-service"
import { permisoAnticipoEmpleado } from "@/lib/anticipos-pedido-http"
import { db } from "@/lib/db"
import { auditLogWithClient } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  actualizarConfiguracionCompras,
  catalogoRecepcion,
  actualizarRecepcion,
  aprobarRecepcion,
  cerrarCompra,
  crearCompra,
  crearRecepcion,
  detalleCompra,
  detalleRecepcion,
  leerTratamientoImpuestos,
  listarCompras,
  listarRecepciones,
  pedidosParaRecibir,
  transicionarRecepcion,
  vistaPreviaAprobacion,
  type ActorCompra,
  type AuditoriaCompra,
  type CompraResult,
  type TransicionRecepcion,
} from "@/lib/compras-recepciones-service"
import type { AuditoriaEnTx } from "@/lib/cuenta-proveedor-service"
import { asociarProductos, clavesDeProveedor, desasociarProducto, listarProductosDeProveedor, proveedoresDeProducto, type AuditoriaAsociacion } from "@/lib/proveedor-productos-service"

const NO_STORE = { "Cache-Control": "no-store" }
const readKey = (req: NextRequest) => req.headers.get("idempotency-key")?.trim() ?? ""

async function readJson(req: NextRequest): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  try {
    const body = await req.json()
    return { ok: true, body: body && typeof body === "object" ? (body as Record<string, unknown>) : {} }
  } catch {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Cuerpo inválido.", code: "BODY_INVALIDO" }, { status: 400, headers: NO_STORE }) }
  }
}

const failure = (r: { status: number; error: string; code?: string; detalle?: Record<string, unknown> }) =>
  NextResponse.json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}), ...(r.detalle ? { detalle: r.detalle } : {}) }, { status: r.status, headers: NO_STORE })
const okLectura = (body: Record<string, unknown>) => NextResponse.json({ ok: true, ...body }, { headers: NO_STORE })
function okEscritura(body: Record<string, unknown>, replayed: boolean, creado = true) {
  return NextResponse.json({ ok: true, replayed, ...body }, { status: replayed || !creado ? 200 : 201, headers: { ...NO_STORE, ...(replayed ? { "Idempotency-Replayed": "true" } : {}) } })
}
function errorInterno(contexto: string, error: unknown) {
  console.error(`[F10-C2a] ${contexto}`, safeErrorForLog(error))
  return NextResponse.json({ ok: false, error: "No se pudo completar la operación. Probá de nuevo." }, { status: 500, headers: NO_STORE })
}

const usuario = (negocioId: string, actor: ActorCompra) => (actor.tipo === "NEGOCIO" ? { userId: negocioId, userType: "negocio" } : { userId: actor.empleadoId, userType: "empleado" })
const auditar = (negocioId: string, actor: ActorCompra): AuditoriaCompra => async (tx, e) => {
  await auditLogWithClient(tx, { ...usuario(negocioId, actor), accion: e.accion, recurso: e.recurso, recursoId: e.recursoId, detalle: e.detalle })
}
/** Auditoría de configuración del proveedor (productos que entrega). */
const auditarProveedor = (negocioId: string): AuditoriaAsociacion => async (tx, e) => {
  await auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: e.accion, recurso: e.recurso, recursoId: e.recursoId, detalle: e.detalle })
}
const auditarCuenta = (negocioId: string): AuditoriaEnTx => async (tx, e) => {
  await auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: e.accion, recurso: "cuenta_proveedor", recursoId: e.recursoId, detalle: e.detalle })
}

async function escribir<T extends Record<string, unknown> & { replayed: boolean }>(contexto: string, fn: () => Promise<CompraResult<T>>, creado = true) {
  try {
    const r = await fn()
    if (!r.ok) return failure(r)
    const { replayed, ...resto } = r.value
    return okEscritura(resto, replayed, creado)
  } catch (error) {
    return errorInterno(contexto, error)
  }
}

// ---------------------------------------------------------------------------
// Recepciones (dueño y cajero)
// ---------------------------------------------------------------------------

export async function listarRecepcionesHttp(req: NextRequest, negocioId: string, actor: ActorCompra) {
  try {
    const sp = req.nextUrl.searchParams
    return okLectura({ recepciones: await listarRecepciones(db, negocioId, { estado: sp.get("estado"), proveedorId: actor.tipo === "NEGOCIO" ? sp.get("proveedorId") : null, empleadoId: actor.tipo === "EMPLEADO" ? actor.empleadoId : null }) })
  } catch (error) {
    return errorInterno("listar recepciones", error)
  }
}

export async function crearRecepcionHttp(req: NextRequest, negocioId: string, actor: ActorCompra) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir("crear recepción", () => crearRecepcion(db, { negocioId, actor, body: json.body, idempotencyKey: readKey(req) }, { auditar: auditar(negocioId, actor) }))
}

export async function detalleRecepcionHttp(negocioId: string, actor: ActorCompra, recepcionId: string) {
  try {
    const r = await detalleRecepcion(db, negocioId, recepcionId, actor.tipo === "EMPLEADO" ? actor.empleadoId : null)
    if (!r) return failure({ status: 404, error: "Recepción no encontrada.", code: "RECEPCION_NO_ENCONTRADA" })
    return okLectura({ recepcion: r })
  } catch (error) {
    return errorInterno("detalle recepción", error)
  }
}

export async function actualizarRecepcionHttp(req: NextRequest, negocioId: string, actor: ActorCompra, recepcionId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir("editar recepción", () => actualizarRecepcion(db, { negocioId, actor, recepcionId, version: json.body.version, body: json.body }, { auditar: auditar(negocioId, actor) }), false)
}

const ACCIONES: Record<string, TransicionRecepcion> = { envio: "ENVIO", devolucion: "DEVOLUCION_A_BORRADOR", rechazo: "RECHAZO", descarte: "DESCARTE" }

export async function transicionRecepcionHttp(req: NextRequest, negocioId: string, actor: ActorCompra, recepcionId: string, accion: string) {
  const tipo = ACCIONES[accion]
  if (!tipo) return failure({ status: 404, error: "Acción no encontrada.", code: "ACCION_INVALIDA" })
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir(`recepción ${accion}`, () => transicionarRecepcion(db, tipo, { negocioId, actor, recepcionId, version: json.body.version, motivo: json.body.motivo, idempotencyKey: readKey(req) }, { auditar: auditar(negocioId, actor) }))
}

// --- sólo dueño ---

export async function vistaPreviaHttp(req: NextRequest, negocioId: string, recepcionId: string) {
  try {
    const r = await vistaPreviaAprobacion(db, negocioId, recepcionId, req.nextUrl.searchParams.get("tratamientoImpuestos"))
    if (!r.ok) return failure(r)
    return okLectura({ vistaPrevia: r.value })
  } catch (error) {
    return errorInterno("vista previa", error)
  }
}

export async function aprobarRecepcionHttp(req: NextRequest, negocioId: string, recepcionId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir("aprobar recepción", () => aprobarRecepcion(db, { negocioId, recepcionId, body: json.body, idempotencyKey: readKey(req) }, { auditar: auditar(negocioId, { tipo: "NEGOCIO" }), auditarCuenta: auditarCuenta(negocioId) }))
}

// ---------------------------------------------------------------------------
// Compras (pedidos)
// ---------------------------------------------------------------------------

export async function listarComprasHttp(req: NextRequest, negocioId: string) {
  try {
    const sp = req.nextUrl.searchParams
    return okLectura({ compras: await listarCompras(db, negocioId, { estado: sp.get("estado"), proveedorId: sp.get("proveedorId") }) })
  } catch (error) {
    return errorInterno("listar compras", error)
  }
}

export async function crearCompraHttp(req: NextRequest, negocioId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir("crear compra", () => crearCompra(db, { negocioId, body: json.body, idempotencyKey: readKey(req) }, { auditar: auditar(negocioId, { tipo: "NEGOCIO" }) }))
}

export async function detalleCompraHttp(negocioId: string, compraId: string, sinCostos = false) {
  try {
    const c = await detalleCompra(db, negocioId, compraId, sinCostos)
    if (!c) return failure({ status: 404, error: "Pedido no encontrado.", code: "COMPRA_NO_ENCONTRADA" })
    return okLectura({ compra: c })
  } catch (error) {
    return errorInterno("detalle compra", error)
  }
}

/** Pagos E1 — transferencia del pedido (realizada: confirmada en el acto; programada: pendiente). Sólo DUEÑO. */
export async function registrarPagoPedidoHttp(req: NextRequest, negocioId: string, compraId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir("pago del pedido", () => registrarPagoPedido(db, { negocioId, compraId, body: json.body, idempotencyKey: readKey(req) }, { auditar: auditarCuenta(negocioId) }))
}

export async function cerrarCompraHttp(req: NextRequest, negocioId: string, compraId: string, accion: string) {
  const tipo = accion === "cierre" ? "CIERRE_COMPRA" : accion === "anulacion" ? "ANULACION_COMPRA" : null
  if (!tipo) return failure({ status: 404, error: "Acción no encontrada.", code: "ACCION_INVALIDA" })
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir(`compra ${accion}`, () => cerrarCompra(db, tipo, { negocioId, compraId, motivo: json.body.motivo, motivoTipo: json.body.motivoTipo, confirmo: json.body.confirmo, idempotencyKey: readKey(req) }, { auditar: auditar(negocioId, { tipo: "NEGOCIO" }) }))
}

export async function configuracionComprasHttp(negocioId: string) {
  try {
    return okLectura({ tratamientoImpuestos: await leerTratamientoImpuestos(db, negocioId) })
  } catch (error) {
    return errorInterno("configuración compras", error)
  }
}

export async function actualizarConfiguracionComprasHttp(req: NextRequest, negocioId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  try {
    const r = await actualizarConfiguracionCompras(db, negocioId, json.body, { auditar: auditar(negocioId, { tipo: "NEGOCIO" }) })
    if (!r.ok) return failure(r)
    return okLectura(r.value)
  } catch (error) {
    return errorInterno("actualizar configuración compras", error)
  }
}

// ---------------------------------------------------------------------------
// Cajero: lecturas mínimas para preparar (sin saldos ni costos acordados)
// ---------------------------------------------------------------------------

export async function proveedoresParaCajeroHttp(negocioId: string) {
  try {
    const proveedores = await db.proveedor.findMany({ where: { negocioId, activo: true }, orderBy: { nombreNormalizado: "asc" }, take: 500, select: { id: true, nombre: true } })
    const compras = await db.compra.findMany({ where: { negocioId, estado: "ABIERTA" }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, numero: true, proveedorId: true, fechaPedido: true } })
    return okLectura({ proveedores, comprasAbiertas: compras })
  } catch (error) {
    return errorInterno("proveedores para cajero", error)
  }
}

/** Catálogo para recibir (dueño y cajero): identificación, unidad y variantes; sin precios ni costos.
 *  Con `proveedorId`: además las claves de lo que entrega ese proveedor (para mostrarlo primero). */
export async function catalogoRecepcionHttp(negocioId: string, proveedorId?: string | null) {
  try {
    const [productos, claves] = await Promise.all([catalogoRecepcion(db, negocioId), proveedorId ? clavesDeProveedor(db, negocioId, proveedorId) : Promise.resolve(null)])
    return okLectura({ productos, ...(claves ? { proveedorProductos: claves } : {}) })
  } catch (error) {
    return errorInterno("catálogo de recepción", error)
  }
}

/** Cajero: pedidos para recibir con avance y su borrador propio (sin costos ni saldos). */
export async function pedidosParaRecibirHttp(negocioId: string, empleadoId: string) {
  try {
    return okLectura({ pedidos: await pedidosParaRecibir(db, negocioId, empleadoId), permisoAnticipo: await permisoAnticipoEmpleado(negocioId, empleadoId) })
  } catch (error) {
    return errorInterno("pedidos para recibir", error)
  }
}

// ---------------------------------------------------------------------------
// Dueño: productos que entrega cada proveedor
// ---------------------------------------------------------------------------

export async function productosDeProveedorHttp(negocioId: string, proveedorId: string) {
  try {
    return okLectura({ asociaciones: await listarProductosDeProveedor(db, negocioId, proveedorId) })
  } catch (error) {
    return errorInterno("productos del proveedor", error)
  }
}

export async function asociarProductosHttp(req: NextRequest, negocioId: string, proveedorId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  try {
    const r = await asociarProductos(db, { negocioId, proveedorId, body: json.body }, { auditar: auditarProveedor(negocioId) })
    if (!r.ok) return failure(r)
    return okLectura(r.value)
  } catch (error) {
    return errorInterno("asociar productos", error)
  }
}

export async function desasociarProductoHttp(req: NextRequest, negocioId: string, proveedorId: string) {
  try {
    const r = await desasociarProducto(db, { negocioId, proveedorId, asociacionId: req.nextUrl.searchParams.get("asociacionId") ?? "" }, { auditar: auditarProveedor(negocioId) })
    if (!r.ok) return failure(r)
    return okLectura(r.value)
  } catch (error) {
    return errorInterno("desasociar producto", error)
  }
}

// ---------------------------------------------------------------------------
// Catálogo — proveedores desde la ficha del PRODUCTO (misma relación proveedor_productos y mismos servicios)
// ---------------------------------------------------------------------------

export async function proveedoresDeProductoHttp(negocioId: string, productoId: string) {
  try {
    const r = await proveedoresDeProducto(db, negocioId, productoId)
    if (!r) return failure({ status: 404, error: "Producto no encontrado.", code: "PRODUCTO_NO_ENCONTRADO" })
    return okLectura(r)
  } catch (error) {
    return errorInterno("proveedores del producto", error)
  }
}

/** body: { proveedorId, productoVarianteId? } — asociar desde el producto = asociar desde el proveedor (idempotente, auditado). */
export async function asociarProveedorAProductoHttp(req: NextRequest, negocioId: string, productoId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  const b = json.body as { proveedorId?: unknown; productoVarianteId?: unknown }
  if (typeof b.proveedorId !== "string" || !b.proveedorId) return failure({ status: 400, error: "Elegí el proveedor.", code: "PROVEEDOR_REQUERIDO" })
  try {
    const r = await asociarProductos(db, { negocioId, proveedorId: b.proveedorId, body: { items: [{ productoId, productoVarianteId: typeof b.productoVarianteId === "string" ? b.productoVarianteId : null }] } }, { auditar: auditarProveedor(negocioId) })
    if (!r.ok) return failure(r)
    return okLectura(r.value)
  } catch (error) {
    return errorInterno("asociar proveedor al producto", error)
  }
}

export async function desasociarProveedorDeProductoHttp(req: NextRequest, negocioId: string, productoId: string) {
  const sp = req.nextUrl.searchParams
  const asociacionId = sp.get("asociacionId") ?? ""
  try {
    // La asociación tiene que ser de ESTE producto (y del negocio); quitarla no toca el producto, su stock ni sus precios.
    const fila = asociacionId ? await db.proveedorProducto.findFirst({ where: { id: asociacionId, negocioId, productoId }, select: { proveedorId: true } }) : null
    if (!fila) return okLectura({ borradas: 0 })
    const r = await desasociarProducto(db, { negocioId, proveedorId: fila.proveedorId, asociacionId }, { auditar: auditarProveedor(negocioId) })
    if (!r.ok) return failure(r)
    return okLectura(r.value)
  } catch (error) {
    return errorInterno("desasociar proveedor del producto", error)
  }
}
