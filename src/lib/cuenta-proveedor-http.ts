// ============================================
// F5-A — HTTP glue de proveedores y cuenta corriente (solo DUEÑO)
// ============================================
// Cada ruta autentica primero con requireNegocioCajaGenerico (sesión de dueño, negocio
// genérico) y pasa el negocio DERIVADO de la sesión; nada del cuerpo ni de la URL lo elige.
// Ningún cajero ni sesión operativa llega acá. Estas funciones sólo parsean, delegan al
// único escritor (proveedores-service / cuenta-proveedor-service), auditan DENTRO de la
// misma transacción (R1) y dan forma a la respuesta. Toda operación económica exige
// Idempotency-Key (replay 200 + Idempotency-Replayed; clave reutilizada 409).

import { NextRequest, NextResponse } from "next/server"
import { cuentaPorPedidos, pagarDeudasSeleccionadas } from "@/lib/cuenta-proveedor-vista-service"
import { db } from "@/lib/db"
import { auditLogWithClient } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { formatearCuit } from "@/lib/cuit"
import {
  actualizarProveedor,
  crearProveedor,
  historialProveedor,
  PROVEEDOR_SELECT,
  type ProveedorFicha,
} from "@/lib/proveedores-service"
import {
  anularObligacion,
  estadoCuenta,
  operarAsignaciones,
  pagosCajaSinVincular,
  registrarCredito,
  registrarObligacion,
  resumenProveedores,
  sugerenciaAsignacion,
  transicionarCredito,
  vincularPagoCaja,
  type AuditoriaEnTx,
  type CuentaResult,
  type TransicionCredito,
} from "@/lib/cuenta-proveedor-service"

const NO_STORE = { "Cache-Control": "no-store" }
const RECURSO = "cuenta_proveedor"

const readKey = (req: NextRequest) => req.headers.get("idempotency-key")?.trim() ?? ""

async function readJson(req: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, body: await req.json() }
  } catch {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Cuerpo inválido.", code: "BODY_INVALIDO" }, { status: 400, headers: NO_STORE }) }
  }
}

function failure(r: { status: number; error: string; code?: string; detalle?: Record<string, unknown> }) {
  return NextResponse.json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}), ...(r.detalle ? { detalle: r.detalle } : {}) }, { status: r.status, headers: NO_STORE })
}

const okEscritura = (body: Record<string, unknown>, replayed: boolean) =>
  NextResponse.json({ ok: true, replayed, ...body }, { status: replayed ? 200 : 201, headers: { ...NO_STORE, ...(replayed ? { "Idempotency-Replayed": "true" } : {}) } })

const okLectura = (body: Record<string, unknown>) => NextResponse.json({ ok: true, ...body }, { headers: NO_STORE })

function errorInterno(contexto: string, error: unknown) {
  console.error(`[F5-A] ${contexto}`, safeErrorForLog(error))
  return NextResponse.json({ ok: false, error: "No se pudo completar la operación. Probá de nuevo." }, { status: 500, headers: NO_STORE })
}

/** Auditoría del dueño en la MISMA transacción que la escritura. */
const auditarDueno = (negocioId: string): AuditoriaEnTx => async (tx, e) => {
  await auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: e.accion, recurso: RECURSO, recursoId: e.recursoId, detalle: e.detalle })
}

const fichaParaRespuesta = (p: ProveedorFicha) => ({ ...p, cuitFormateado: p.cuit ? formatearCuit(p.cuit) : null })

// ---------------------------------------------------------------------------
// Proveedores
// ---------------------------------------------------------------------------

export async function listarProveedoresHttp(req: NextRequest, negocioId: string) {
  try {
    const incluirInactivos = req.nextUrl.searchParams.get("inactivos") === "1"
    const proveedores = await db.proveedor.findMany({
      where: { negocioId, ...(incluirInactivos ? {} : { activo: true }) },
      orderBy: [{ activo: "desc" }, { nombreNormalizado: "asc" }],
      take: 500,
      select: PROVEEDOR_SELECT,
    })
    const totales = await resumenProveedores(db, negocioId, proveedores.map((p) => p.id))
    const pendientesDeVincular = (await pagosCajaSinVincular(db, negocioId)).length
    return okLectura({ proveedores: proveedores.map((p) => ({ ...fichaParaRespuesta(p), totales: totales.get(p.id) ?? null })), pagosCajaSinVincular: pendientesDeVincular })
  } catch (error) {
    return errorInterno("listar proveedores", error)
  }
}

export async function crearProveedorHttp(req: NextRequest, negocioId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  try {
    const r = await crearProveedor(db, { negocioId, body: json.body, idempotencyKey: readKey(req) }, {
      auditar: async (tx, p) => auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: "proveedor.creado", recurso: "proveedor", recursoId: p.id, detalle: { negocioId, proveedorId: p.id, nombre: p.nombre, cuit: p.cuit } }),
    })
    if (!r.ok) return failure(r)
    return okEscritura({ proveedor: fichaParaRespuesta(r.value.proveedor) }, r.value.replayed)
  } catch (error) {
    return errorInterno("crear proveedor", error)
  }
}

export async function fichaProveedorHttp(negocioId: string, proveedorId: string) {
  try {
    const proveedor = await db.proveedor.findFirst({ where: { id: proveedorId, negocioId }, select: PROVEEDOR_SELECT })
    if (!proveedor) return failure({ status: 404, error: "Proveedor no encontrado.", code: "PROVEEDOR_NO_ENCONTRADO" })
    return okLectura({ proveedor: fichaParaRespuesta(proveedor), historial: await historialProveedor(db, negocioId, proveedorId) })
  } catch (error) {
    return errorInterno("ficha proveedor", error)
  }
}

export async function actualizarProveedorHttp(req: NextRequest, negocioId: string, proveedorId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  try {
    const r = await actualizarProveedor(db, { negocioId, proveedorId, body: json.body }, {
      auditar: async (tx, v) => auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: "proveedor.actualizado", recurso: "proveedor", recursoId: proveedorId, detalle: { negocioId, proveedorId, campos: v.campos } }),
    })
    if (!r.ok) return failure(r)
    return okLectura({ proveedor: fichaParaRespuesta(r.value.proveedor), campos: r.value.campos })
  } catch (error) {
    return errorInterno("actualizar proveedor", error)
  }
}

// ---------------------------------------------------------------------------
// Cuenta corriente: lecturas
// ---------------------------------------------------------------------------

export async function estadoCuentaHttp(negocioId: string, proveedorId: string) {
  try {
    const cuenta = await estadoCuenta(db, negocioId, proveedorId)
    if (!cuenta) return failure({ status: 404, error: "Proveedor no encontrado.", code: "PROVEEDOR_NO_ENCONTRADO" })
    if (!cuenta.totales.identidadOk) console.error("[F5-A] identidad de saldos no verificada", { negocioId, proveedorId })
    return okLectura({ cuenta })
  } catch (error) {
    return errorInterno("estado de cuenta", error)
  }
}

export async function sugerenciaHttp(req: NextRequest, negocioId: string, proveedorId: string) {
  const creditoId = req.nextUrl.searchParams.get("creditoId") ?? ""
  if (!creditoId) return failure({ status: 400, error: "Elegí el pago a asignar.", code: "CREDITO_REQUERIDO" })
  try {
    const r = await sugerenciaAsignacion(db, negocioId, proveedorId, creditoId)
    if (!r.ok) return failure(r)
    return okLectura({ sugerencia: r.value, esSugerencia: true })
  } catch (error) {
    return errorInterno("sugerencia FIFO", error)
  }
}

export async function pagosCajaSinVincularHttp(negocioId: string) {
  try {
    return okLectura({ pagos: await pagosCajaSinVincular(db, negocioId) })
  } catch (error) {
    return errorInterno("pagos de caja sin vincular", error)
  }
}

// ---------------------------------------------------------------------------
// Cuenta corriente: escrituras económicas (Idempotency-Key + auditoría en la transacción)
// ---------------------------------------------------------------------------

async function escribir<T extends Record<string, unknown> & { replayed: boolean }>(contexto: string, fn: () => Promise<CuentaResult<T>>) {
  try {
    const r = await fn()
    if (!r.ok) return failure(r)
    const { replayed, ...resto } = r.value
    return okEscritura(resto, replayed)
  } catch (error) {
    return errorInterno(contexto, error)
  }
}

export async function registrarObligacionHttp(req: NextRequest, negocioId: string, proveedorId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir("registrar obligación", () => registrarObligacion(db, { negocioId, proveedorId, body: json.body, idempotencyKey: readKey(req) }, { auditar: auditarDueno(negocioId) }))
}

export async function anularObligacionHttp(req: NextRequest, negocioId: string, obligacionId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  const motivo = (json.body as { motivo?: unknown } | null)?.motivo
  return escribir("anular obligación", () => anularObligacion(db, { negocioId, obligacionId, motivo, idempotencyKey: readKey(req) }, { auditar: auditarDueno(negocioId) }))
}

export async function registrarCreditoHttp(req: NextRequest, negocioId: string, proveedorId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir("registrar crédito", () => registrarCredito(db, { negocioId, proveedorId, body: json.body, idempotencyKey: readKey(req) }, { auditar: auditarDueno(negocioId) }))
}

export async function vincularPagoCajaHttp(req: NextRequest, negocioId: string, proveedorId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  const body = (json.body ?? {}) as { egresoCajaId?: unknown; confirmoNoDuplicado?: unknown }
  return escribir("vincular pago de caja", () => vincularPagoCaja(db, { negocioId, proveedorId, egresoCajaId: body.egresoCajaId, confirmoNoDuplicado: body.confirmoNoDuplicado, idempotencyKey: readKey(req) }, { auditar: auditarDueno(negocioId) }))
}

const ACCIONES_CREDITO: Record<string, TransicionCredito> = {
  confirmacion: "CONFIRMACION",
  rechazo: "RECHAZO",
  anulacion: "ANULACION",
  desvinculacion: "DESVINCULACION",
}

export async function transicionCreditoHttp(req: NextRequest, negocioId: string, creditoId: string, accion: string) {
  const tipo = ACCIONES_CREDITO[accion]
  if (!tipo) return failure({ status: 404, error: "Acción no encontrada.", code: "ACCION_INVALIDA" })
  const json = await readJson(req)
  if (!json.ok) return json.response
  const motivo = (json.body as { motivo?: unknown } | null)?.motivo
  return escribir(`crédito ${accion}`, () => transicionarCredito(db, tipo, { negocioId, creditoId, motivo, idempotencyKey: readKey(req) }, { auditar: auditarDueno(negocioId) }))
}

export async function operarAsignacionesHttp(req: NextRequest, negocioId: string, proveedorId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir("operar asignaciones", () => operarAsignaciones(db, { negocioId, proveedorId, body: json.body, idempotencyKey: readKey(req) }, { auditar: auditarDueno(negocioId) }))
}

// ---------------------------------------------------------------------------
// Pagos E2 — cuenta por pedidos y facturas (lectura) y «Pagar deudas seleccionadas» (sólo dueño)
// ---------------------------------------------------------------------------

export async function cuentaPorPedidosHttp(negocioId: string, proveedorId: string) {
  try {
    const vista = await cuentaPorPedidos(db, negocioId, proveedorId)
    if (!vista) return failure({ status: 404, error: "Proveedor no encontrado.", code: "PROVEEDOR_NO_ENCONTRADO" })
    return okLectura({ vista })
  } catch (error) {
    return errorInterno("cuenta por pedidos", error)
  }
}

export async function pagarDeudasHttp(req: NextRequest, negocioId: string, proveedorId: string) {
  const json = await readJson(req)
  if (!json.ok) return json.response
  return escribir("pagar deudas seleccionadas", () => pagarDeudasSeleccionadas(db, { negocioId, proveedorId, body: json.body, idempotencyKey: readKey(req) }, { auditar: auditarDueno(negocioId) }))
}
