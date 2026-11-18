// ============================================
// F10-C1a — HTTP glue shared by the owner and cashier cash-outflow routes
// ============================================
// Each route authenticates first (owner session or personal cashier session)
// and passes the negocio + actor it DERIVED from that session; nothing in the
// body or URL can choose them. These helpers only parse, delegate to the single
// writer (caja-egresos-service.ts), audit INSIDE the same transaction (R1) and
// shape the response. A cashier response never carries expected cash, alerts
// or totals (blind close).

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLogWithClient } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import type { CajaActor } from "@/lib/caja-turnos-service"
import {
  actualizarUmbralEgresos,
  compensarEgresoCaja,
  confirmarRetiroEgresoCaja,
  contarPendientesSupervision,
  responsablesEgresos,
  detalleEgresoDueno,
  egresoParaCajero,
  egresosDelTurnoCajero,
  leerConfiguracionEgresos,
  listarEgresosDueno,
  parseEgresoBody,
  parseFiltroEgresos,
  registrarEgresoCaja,
  respuestaDueno,
  revisarEgresoCaja,
  type EgresoConDetalle,
} from "@/lib/caja-egresos-service"

const audit = (negocioId: string, actor: CajaActor) =>
  actor.tipo === "EMPLEADO" ? { userId: actor.empleadoId, userType: "empleado" } : { userId: negocioId, userType: "negocio" }

function readKey(req: NextRequest): string | null {
  const raw = req.headers.get("idempotency-key")?.trim() ?? ""
  return isValidVentaIdempotencyKey(raw) ? raw.toLowerCase() : null
}

const KEY_REQUIRED = () => NextResponse.json({ ok: false, error: "Falta una Idempotency-Key válida.", code: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 })
const NO_STORE = { "Cache-Control": "no-store" }

/** `detalle` (owner-only figures of JUSTIFICACION_REQUERIDA) is dropped for a cashier, who never gets that code anyway. */
function failure(r: { status: number; error: string; code?: string; detalle?: Record<string, unknown> }, actor: CajaActor) {
  const detalle = actor.tipo === "NEGOCIO" && r.detalle ? { detalle: r.detalle } : {}
  return NextResponse.json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}), ...detalle }, { status: r.status, headers: NO_STORE })
}

const ok = (body: Record<string, unknown>, replayed: boolean) =>
  NextResponse.json({ ok: true, replayed, ...body }, { status: replayed ? 200 : 201, headers: { ...NO_STORE, ...(replayed ? { "Idempotency-Replayed": "true" } : {}) } })

async function movimientosDeOperacion(client: Pick<typeof db, "movimientoFinanciero">, operacionId: string) {
  const movimientos = await client.movimientoFinanciero.findMany({
    where: { operacionId },
    select: { cuentaId: true, importeDecimal: true, cuenta: { select: { clave: true, cajaFisicaId: true } } },
  })
  return movimientos.map((m) => ({ cuentaFinancieraId: m.cuentaId, clave: m.cuenta.clave, cajaFisicaId: m.cuenta.cajaFisicaId, importe: m.importeDecimal?.toFixed(2) ?? null }))
}

export function detalleAuditoriaEgreso(negocioId: string, e: EgresoConDetalle, movimientos: Awaited<ReturnType<typeof movimientosDeOperacion>>) {
  return {
    negocioId,
    egresoId: e.id,
    operacionId: e.operacionId,
    naturaleza: e.naturaleza,
    categoria: e.categoria,
    medio: e.medio,
    importe: e.importeDecimal.toFixed(2),
    motivo: e.motivo,
    turnoCajaId: e.turnoCajaId,
    cajaFisicaId: e.cajaFisicaId,
    actorTipo: e.actorTipo,
    proveedorNombre: e.proveedorNombre,
    comprobanteReferencia: e.comprobanteReferencia,
    destinatarioTipo: e.destinatarioTipo,
    destinatarioNombre: e.destinatarioNombre,
    confirmacionRetiroEstado: e.confirmacionRetiroEstado,
    excedeEsperado: e.excedeEsperado,
    superaUmbral: e.superaUmbral,
    justificada: e.justificacion !== null,
    movimientos,
  }
}

// ---------------------------------------------------------------------------
// Registration (owner and cashier)
// ---------------------------------------------------------------------------

export async function registrarEgresoHttp(req: NextRequest, negocioId: string, actor: CajaActor): Promise<NextResponse> {
  try {
    const key = readKey(req)
    if (!key) return KEY_REQUIRED()
    const parsed = parseEgresoBody(await req.json().catch(() => null), actor.tipo)
    if (!parsed.ok) return failure(parsed, actor)
    // R1: the audit is written INSIDE the outflow's transaction (only for a new
    // outflow; a replay writes nothing). A failed audit rolls the whole outflow
    // back (no operation, leg, outflow row or notice) and the client gets a 500
    // whose retry with the same key starts clean.
    const result = await registrarEgresoCaja(db, { negocioId, actor, solicitud: parsed.value, idempotencyKey: key }, {
      auditar: async (tx, egreso) => {
        await auditLogWithClient(tx, {
          ...audit(negocioId, actor),
          accion: "caja.egreso_registrado",
          recurso: "egreso_caja",
          recursoId: egreso.id,
          detalle: detalleAuditoriaEgreso(negocioId, egreso, await movimientosDeOperacion(tx, egreso.operacionId)),
        })
      },
    })
    if (!result.ok) return failure(result, actor)
    const { egreso, replayed } = result.value
    if (actor.tipo === "EMPLEADO") return ok({ egreso: egresoParaCajero(egreso, actor.empleadoId) }, replayed)
    return ok({ egreso: await respuestaDueno(db, negocioId, egreso) }, replayed)
  } catch (error) {
    console.error("Error registering egreso de caja:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No pudimos registrar la salida de efectivo por un error del servidor. Podés reintentar sin duplicarla." }, { status: 500, headers: NO_STORE })
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listarEgresosDuenoHttp(req: NextRequest, negocioId: string): Promise<NextResponse> {
  try {
    const filtro = parseFiltroEgresos(new URL(req.url).searchParams)
    if (!filtro.ok) return failure(filtro, { tipo: "NEGOCIO" })
    const [egresos, pendientes, responsables] = await Promise.all([listarEgresosDueno(db, negocioId, filtro.value), contarPendientesSupervision(db, negocioId), responsablesEgresos(db, negocioId)])
    return NextResponse.json({ ok: true, egresos, pendientes, responsables }, { headers: NO_STORE })
  } catch (error) {
    console.error("Error listing egresos de caja:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No se pudieron cargar las salidas de efectivo." }, { status: 500, headers: NO_STORE })
  }
}

export async function detalleEgresoDuenoHttp(negocioId: string, egresoId: string): Promise<NextResponse> {
  try {
    const egreso = await detalleEgresoDueno(db, negocioId, egresoId)
    if (!egreso) return NextResponse.json({ ok: false, error: "Egreso no encontrado.", code: "EGRESO_NO_ENCONTRADO" }, { status: 404, headers: NO_STORE })
    return NextResponse.json({ ok: true, egreso }, { headers: NO_STORE })
  } catch (error) {
    console.error("Error reading egreso de caja:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No se pudo cargar la salida de efectivo." }, { status: 500, headers: NO_STORE })
  }
}

export async function egresosCajeroHttp(negocioId: string, empleadoId: string): Promise<NextResponse> {
  try {
    return NextResponse.json({ ok: true, ...(await egresosDelTurnoCajero(db, negocioId, empleadoId)) }, { headers: NO_STORE })
  } catch (error) {
    console.error("Error listing egresos del cajero:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No se pudieron cargar las salidas de efectivo." }, { status: 500, headers: NO_STORE })
  }
}

// ---------------------------------------------------------------------------
// Owner decisions (never move money)
// ---------------------------------------------------------------------------

async function decisionHttp(req: NextRequest, negocioId: string, egresoId: string, tipo: "REVISION" | "CONFIRMACION_RETIRO"): Promise<NextResponse> {
  const owner: CajaActor = { tipo: "NEGOCIO" }
  try {
    const key = readKey(req)
    if (!key) return KEY_REQUIRED()
    const body = (await req.json().catch(() => null)) as { resultado?: unknown; observacion?: unknown } | null
    const input = { negocioId, egresoId, resultado: body?.resultado, observacion: body?.observacion, idempotencyKey: key }
    const auditar = async (tx: Parameters<typeof auditLogWithClient>[0], egreso: EgresoConDetalle) => {
      const ultima = egreso.revisiones[egreso.revisiones.length - 1]
      await auditLogWithClient(tx, {
        ...audit(negocioId, owner),
        accion: tipo === "REVISION" ? "caja.egreso_revisado" : "caja.egreso_retiro_confirmado",
        recurso: "egreso_caja",
        recursoId: egreso.id,
        detalle: {
          negocioId,
          egresoId: egreso.id,
          naturaleza: egreso.naturaleza,
          importe: egreso.importeDecimal.toFixed(2),
          resultado: ultima?.resultado ?? null,
          observacion: ultima?.observacion ?? null,
          revisionId: ultima?.id ?? null,
        },
      })
    }
    const result = tipo === "REVISION" ? await revisarEgresoCaja(db, input, { auditar }) : await confirmarRetiroEgresoCaja(db, input, { auditar })
    if (!result.ok) return failure(result, owner)
    return ok({ egreso: await respuestaDueno(db, negocioId, result.value.egreso) }, result.value.replayed)
  } catch (error) {
    console.error("Error registering decision de egreso:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No pudimos guardar la revisión por un error del servidor. Podés reintentar sin duplicarla." }, { status: 500, headers: NO_STORE })
  }
}

export const revisarEgresoHttp = (req: NextRequest, negocioId: string, egresoId: string) => decisionHttp(req, negocioId, egresoId, "REVISION")

// ---------------------------------------------------------------------------
// F10-C1c — owner compensation (the only correction that moves money)
// ---------------------------------------------------------------------------

export async function compensarEgresoHttp(req: NextRequest, negocioId: string, egresoId: string): Promise<NextResponse> {
  const owner: CajaActor = { tipo: "NEGOCIO" }
  try {
    const key = readKey(req)
    if (!key) return KEY_REQUIRED()
    const body = (await req.json().catch(() => null)) as { motivo?: unknown; confirmoEfectivoEnCaja?: unknown } | null
    // R1: the audit is written INSIDE the compensation's transaction; a failed
    // audit rolls back the REVERSION operation, its leg and the compensation row.
    const result = await compensarEgresoCaja(db, { negocioId, egresoId, motivo: body?.motivo, confirmoEfectivoEnCaja: body?.confirmoEfectivoEnCaja, idempotencyKey: key }, {
      auditar: async (tx, { egreso, compensacion }) => {
        await auditLogWithClient(tx, {
          ...audit(negocioId, owner),
          accion: "caja.egreso_compensado",
          recurso: "egreso_caja",
          recursoId: egreso.id,
          detalle: {
            negocioId,
            egresoId: egreso.id,
            operacionOriginalId: egreso.operacionId,
            compensacionId: compensacion.id,
            operacionCompensacionId: compensacion.operacionId,
            momento: compensacion.momento,
            turnoCajaId: compensacion.turnoCajaId,
            cajaFisicaId: egreso.cajaFisicaId,
            naturaleza: egreso.naturaleza,
            importe: compensacion.importeDecimal.toFixed(2),
            motivo: compensacion.motivo,
            movimientos: await movimientosDeOperacion(tx, compensacion.operacionId),
          },
        })
      },
    })
    if (!result.ok) return failure(result, owner)
    return ok({ egreso: await respuestaDueno(db, negocioId, result.value.egreso) }, result.value.replayed)
  } catch (error) {
    console.error("Error compensating egreso de caja:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No pudimos registrar la compensación por un error del servidor. Podés reintentar sin duplicarla." }, { status: 500, headers: NO_STORE })
  }
}
export const confirmarRetiroHttp = (req: NextRequest, negocioId: string, egresoId: string) => decisionHttp(req, negocioId, egresoId, "CONFIRMACION_RETIRO")

// ---------------------------------------------------------------------------
// Owner threshold (informative, never blocks)
// ---------------------------------------------------------------------------

export async function configuracionEgresosHttp(negocioId: string): Promise<NextResponse> {
  return NextResponse.json({ ok: true, ...(await leerConfiguracionEgresos(db, negocioId)) }, { headers: NO_STORE })
}

export async function actualizarConfiguracionEgresosHttp(req: NextRequest, negocioId: string): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => null)) as { umbralAviso?: unknown } | null
    if (!body || typeof body !== "object" || !("umbralAviso" in body)) return NextResponse.json({ ok: false, error: "No hay cambios para guardar." }, { status: 400, headers: NO_STORE })
    const result = await actualizarUmbralEgresos(db, negocioId, body.umbralAviso, {
      // Same rule as the business configuration: the audit records WHICH field changed, never its value.
      auditar: async (tx) => {
        await auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: "negocio.config_cambiada", recurso: "negocio", recursoId: negocioId, detalle: { camposActualizados: ["cajaEgresoAvisoUmbral"] } })
      },
    })
    if (!result.ok) return failure(result, { tipo: "NEGOCIO" })
    return NextResponse.json({ ok: true, ...result.value }, { headers: NO_STORE })
  } catch (error) {
    console.error("Error updating egresos threshold:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No pudimos guardar la configuración." }, { status: 500, headers: NO_STORE })
  }
}
