// ============================================
// T7-F1 — capa HTTP de los retiros personales (rutas del dueño y del cajero)
// ============================================
// Las rutas sólo autentican (sesión del dueño con rubro genérico, o sesión operativa de Caja) y delegan acá. El
// negocio, el registrante y el turno salen SIEMPRE de la sesión; el cuerpo nunca elige negocio, actor, precios,
// costos ni importes de valor. La respuesta del cajero no incluye costos, decisiones ni resúmenes.

import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { isStockSerializationConflict, mapStockLifecycleError } from "@/lib/stock-lifecycle"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { noStore } from "@/lib/operativo-mozo"
import {
  anularDecisionRecupero,
  contextoRetiro,
  guardarPermisoRetiro,
  historialDecisiones,
  listarPermisosRetiro,
  listarRetirosPagina,
  parseDecisionBody,
  parseDevolucionBody,
  parseFiltroRetiros,
  parseRetiroBody,
  registrarDecisionRecupero,
  registrarDevolucionRetiro,
  registrarRetiroPersonal,
  resumenRetirosPeriodo,
  retiroParaCajero,
  retiroParaDueno,
  RETIRO_MOTIVO_MAX,
  type ActorRetiro,
} from "@/lib/retiros-personales-service"

const json = (body: unknown, status = 200, headers?: Record<string, string>) => noStore(NextResponse.json(body, { status, ...(headers ? { headers } : {}) }))
const fail = (r: { status: number; error: string; code?: string; familiar?: { id: string; nombre: string } }) =>
  json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}), ...(r.familiar ? { familiar: r.familiar } : {}) }, r.status)

export const RETIRO_CONFLICTO_CODE = "RETIRO_CONFLICTO_CONCURRENTE"

/** Errores esperables → respuesta controlada; el resto es 500 sin detalles internos. */
function errorHttp(error: unknown, contexto: string) {
  const stock = mapStockLifecycleError(error)
  if (stock) return json({ ok: false, ...stock.body }, stock.status)
  if (isStockSerializationConflict(error) || (error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01"))) {
    return json({ ok: false, error: "La operación coincidió con otra al mismo tiempo. No se registró nada: volvé a intentarlo.", code: RETIRO_CONFLICTO_CODE }, 409)
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return json({ ok: false, error: "Alguno de los retiros ya tiene una decisión vigente. Actualizá la pantalla.", code: "RETIRO_YA_DECIDIDO" }, 409)
  }
  if (String(error).includes("T7_F1_DEVOLUCION_EXCEDE_RETIRADO")) {
    return json({ ok: false, error: "La devolución supera lo retirado. Actualizá la pantalla.", code: "DEVOLUCION_EXCEDE_RETIRADO" }, 409)
  }
  console.error(`Error en retiros personales (${contexto}):`, safeErrorForLog(error))
  return json({ ok: false, error: "No se pudo completar la operación." }, 500)
}

function idempotencyKey(req: NextRequest): string | null {
  const raw = req.headers.get("idempotency-key")?.trim() ?? ""
  return isValidVentaIdempotencyKey(raw) ? raw.toLowerCase() : null
}
const SIN_CLAVE = { ok: false, error: "Falta una Idempotency-Key válida para registrar la operación.", code: "IDEMPOTENCY_KEY_REQUIRED" }

// --- Registro (dueño y cajero) ----------------------------------------------------

export async function crearRetiroHttp(req: NextRequest, params: { negocioId: string; actor: ActorRetiro; vista: "dueno" | "cajero" }) {
  try {
    const key = idempotencyKey(req)
    if (!key) return json(SIN_CLAVE, 400)
    const parsed = parseRetiroBody(await req.json().catch(() => null))
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400)
    const r = await registrarRetiroPersonal(db, { negocioId: params.negocioId, actor: params.actor, entrada: parsed.value, idempotencyKey: key })
    if (!r.ok) return fail(r)
    const body = { ok: true, retiro: params.vista === "dueno" ? retiroParaDueno(r.retiro) : retiroParaCajero(r.retiro) }
    return r.replayed ? json(body, 200, { "Idempotency-Replayed": "true" }) : json(body, 201)
  } catch (error) {
    return errorHttp(error, "registro")
  }
}

export async function contextoRetiroHttp(negocioId: string, actor: ActorRetiro) {
  try {
    return json({ ok: true, ...(await contextoRetiro(db, negocioId, actor)) })
  } catch (error) {
    return errorHttp(error, "contexto")
  }
}

// --- Dueño: listado, resumen, decisiones, devoluciones, permisos ------------------

export async function listarRetirosHttp(req: NextRequest, negocioId: string) {
  try {
    const f = parseFiltroRetiros(req.nextUrl.searchParams)
    if (!f.ok) return json({ ok: false, error: f.error }, 400)
    const cursor = req.nextUrl.searchParams.get("cursor")
    if (cursor !== null && !/^[A-Za-z0-9_-]{1,64}$/.test(cursor)) return json({ ok: false, error: "Página inválida." }, 400)
    const pagina = await listarRetirosPagina(db, negocioId, f.value, cursor)
    // Detalle paginado y explícito: siguienteCursor != null significa que hay más retiros en el período.
    return json({ ok: true, retiros: pagina.retiros.map(retiroParaDueno), siguienteCursor: pagina.siguienteCursor })
  } catch (error) {
    return errorHttp(error, "listado")
  }
}

export async function resumenRetirosHttp(req: NextRequest, negocioId: string) {
  try {
    const f = parseFiltroRetiros(req.nextUrl.searchParams)
    if (!f.ok) return json({ ok: false, error: f.error }, 400)
    // Totales del período COMPLETO (sin límite de registros).
    return json({ ok: true, resumen: await resumenRetirosPeriodo(db, negocioId, f.value) })
  } catch (error) {
    return errorHttp(error, "resumen")
  }
}

export async function crearDecisionHttp(req: NextRequest, negocioId: string) {
  try {
    const parsed = parseDecisionBody(await req.json().catch(() => null))
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400)
    const r = await registrarDecisionRecupero(db, negocioId, parsed.value)
    if (!r.ok) return fail(r)
    return json({ ok: true, decisionId: r.decisionId }, 201)
  } catch (error) {
    return errorHttp(error, "decisión")
  }
}

export async function historialDecisionesHttp(req: NextRequest, negocioId: string) {
  try {
    const empleadoId = req.nextUrl.searchParams.get("empleadoId") ?? ""
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(empleadoId)) return json({ ok: false, error: "Indicá el empleado." }, 400)
    return json({ ok: true, decisiones: await historialDecisiones(db, negocioId, empleadoId) })
  } catch (error) {
    return errorHttp(error, "historial de decisiones")
  }
}

export async function anularDecisionHttp(req: NextRequest, negocioId: string, decisionId: string) {
  try {
    const b = ((await req.json().catch(() => null)) ?? {}) as { motivo?: unknown }
    if (b.motivo !== undefined && b.motivo !== null && (typeof b.motivo !== "string" || b.motivo.trim().length > RETIRO_MOTIVO_MAX)) return json({ ok: false, error: "Motivo inválido." }, 400)
    const r = await anularDecisionRecupero(db, negocioId, decisionId, typeof b.motivo === "string" ? b.motivo.trim() || null : null)
    if (!r.ok) return fail(r)
    return json({ ok: true })
  } catch (error) {
    return errorHttp(error, "anulación de decisión")
  }
}

export async function devolucionRetiroHttp(req: NextRequest, negocioId: string, retiroId: string) {
  try {
    const key = idempotencyKey(req)
    if (!key) return json(SIN_CLAVE, 400)
    const parsed = parseDevolucionBody(await req.json().catch(() => null))
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400)
    const r = await registrarDevolucionRetiro(db, { negocioId, retiroId, entrada: parsed.value, idempotencyKey: key })
    if (!r.ok) return fail(r)
    const body = { ok: true, retiro: retiroParaDueno(r.retiro) }
    return r.replayed ? json(body, 200, { "Idempotency-Replayed": "true" }) : json(body, 201)
  } catch (error) {
    return errorHttp(error, "devolución")
  }
}

export async function permisosRetiroHttp(negocioId: string) {
  try {
    return json({ ok: true, empleados: await listarPermisosRetiro(db, negocioId) })
  } catch (error) {
    return errorHttp(error, "permisos")
  }
}

export async function guardarPermisoRetiroHttp(req: NextRequest, negocioId: string) {
  try {
    const b = ((await req.json().catch(() => null)) ?? {}) as { empleadoId?: unknown; habilitado?: unknown }
    if (typeof b.empleadoId !== "string" || !b.empleadoId || typeof b.habilitado !== "boolean") return json({ ok: false, error: "Indicá el empleado y el permiso." }, 400)
    const r = await guardarPermisoRetiro(db, negocioId, { empleadoId: b.empleadoId, habilitado: b.habilitado })
    if (!r.ok) return fail(r)
    return json({ ok: true })
  } catch (error) {
    return errorHttp(error, "guardar permiso")
  }
}
