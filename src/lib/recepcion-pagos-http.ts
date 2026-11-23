// ============================================
// F10-C2b / D-7 v2 — HTTP de los pagos en efectivo hechos al recibir
// ============================================
// Cajero: paga desde SU recepción abierta. El dinero sale una sola vez por registrarEgresoCaja (F10-C1:
// turno propio, Idempotency-Key, auditoría R1) y, DENTRO de esa misma transacción, se asocia la salida a
// la recepción. Si la recepción se cerró en el medio, se revierte todo (no queda salida suelta).
// Dueño: asocia un pago de Caja viejo (sólo con la referencia en texto) u «observa» un pago para que no se
// aplique solo. Nada de esto mueve dinero ni deuda; la aplicación ocurre al aprobar la recepción.

import { NextRequest, NextResponse } from "next/server"
import { anticiposPorPedido } from "@/lib/pagos-pedido-service"
import { db } from "@/lib/db"
import { auditLogWithClient } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { registrarEgresoCaja } from "@/lib/caja-egresos-service"
import { detalleAuditoriaEgreso } from "@/lib/caja-egresos-http"
import { PagoRecepcionError, asociarPagoEnTx, asociarPagoExistente, cambiarEstadoPago, prepararPagoAlRecibir, type AuditoriaPagoRecepcion } from "@/lib/recepcion-pagos-service"

const NO_STORE = { "Cache-Control": "no-store" }
const failure = (r: { status: number; error: string; code?: string }) => NextResponse.json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}) }, { status: r.status, headers: NO_STORE })
const errorInterno = (contexto: string, error: unknown) => {
  console.error(`[D-7] ${contexto}`, safeErrorForLog(error))
  return NextResponse.json({ ok: false, error: "No pudimos confirmar el pago por un error del servidor. Podés reintentar: no se va a registrar dos veces." }, { status: 500, headers: NO_STORE })
}
const auditarDueno = (negocioId: string): AuditoriaPagoRecepcion => async (tx, e) => {
  await auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: e.accion, recurso: e.recurso, recursoId: e.recursoId, detalle: e.detalle })
}

// ---------------------------------------------------------------------------
// Cajero
// ---------------------------------------------------------------------------

/** Pagos de SU recepción: importe, fecha y caja (nunca créditos, deuda ni saldos). */
export async function pagosRecepcionCajeroHttp(negocioId: string, empleadoId: string, recepcionId: string) {
  try {
    const r = await db.recepcion.findFirst({ where: { id: recepcionId, negocioId, preparadaPorTipo: "EMPLEADO", preparadaPorEmpleadoId: empleadoId }, select: { id: true, compraId: true } })
    if (!r) return failure({ status: 404, error: "Recepción no encontrada.", code: "RECEPCION_NO_ENCONTRADA" })
    const filas = await db.pagoRecepcion.findMany({
      where: { negocioId, recepcionId },
      orderBy: { createdAt: "asc" },
      select: { id: true, estado: true, egreso: { select: { importeDecimal: true, createdAt: true, compensacion: { select: { id: true } }, turno: { select: { cajaFisica: { select: { nombre: true } } } } } } },
    })
    return NextResponse.json({
      ok: true,
      pagos: filas.map((f) => ({ id: f.id, importe: f.egreso.importeDecimal.toFixed(2), fecha: f.egreso.createdAt, caja: f.egreso.turno?.cajaFisica?.nombre ?? null, observado: f.estado === "OBSERVADO", anulado: Boolean(f.egreso.compensacion) })),
      // Pagos E1: lo que el dueño ya pagó por adelantado de ESTE pedido (sólo ese importe; nunca saldos del proveedor).
      anticipoPedido: r.compraId ? (await anticiposPorPedido(db, negocioId, [r.compraId])).get(r.compraId) ?? null : null,
    }, { headers: NO_STORE })
  } catch (error) {
    return errorInterno("pagos de la recepción (cajero)", error)
  }
}

export async function pagarAlRecibirHttp(req: NextRequest, negocioId: string, empleadoId: string, recepcionId: string) {
  try {
    const raw = req.headers.get("idempotency-key")?.trim() ?? ""
    if (!isValidVentaIdempotencyKey(raw)) return failure({ status: 400, error: "Falta una Idempotency-Key válida.", code: "IDEMPOTENCY_KEY_REQUIRED" })
    const body = await req.json().catch(() => null)
    const prep = await prepararPagoAlRecibir(db, { negocioId, empleadoId, recepcionId, body })
    if (!prep.ok) return failure(prep)
    const { solicitud, recepcion } = prep.value
    const result = await registrarEgresoCaja(db, { negocioId, actor: { tipo: "EMPLEADO", empleadoId }, solicitud, idempotencyKey: raw.toLowerCase() }, {
      // Corre DENTRO de la transacción de la salida (sólo para una salida nueva): auditoría + asociación.
      auditar: async (tx, egreso) => {
        const movimientos = await tx.movimientoFinanciero.findMany({ where: { operacionId: egreso.operacionId }, select: { cuentaId: true, importeDecimal: true, cuenta: { select: { clave: true, cajaFisicaId: true } } } })
        await auditLogWithClient(tx, {
          userId: empleadoId, userType: "empleado", accion: "caja.egreso_registrado", recurso: "egreso_caja", recursoId: egreso.id,
          detalle: detalleAuditoriaEgreso(negocioId, egreso, movimientos.map((m) => ({ cuentaFinancieraId: m.cuentaId, clave: m.cuenta.clave, cajaFisicaId: m.cuenta.cajaFisicaId, importe: m.importeDecimal?.toFixed(2) ?? null }))),
        })
        const p = await asociarPagoEnTx(tx, { negocioId, recepcionId, proveedorId: recepcion.proveedorId, egresoCajaId: egreso.id, origen: "CAJERO_AL_RECIBIR", actorTipo: "EMPLEADO", actorId: empleadoId })
        await auditLogWithClient(tx, { userId: empleadoId, userType: "empleado", accion: "recepcion.pago_al_recibir", recurso: "recepcion", recursoId: recepcionId, detalle: { negocioId, recepcionId, numero: recepcion.numero, pagoRecepcionId: p.id, egresoCajaId: egreso.id, importe: egreso.importeDecimal.toFixed(2) } })
      },
    })
    if (!result.ok) return failure(result)
    const { egreso, replayed } = result.value
    return NextResponse.json({ ok: true, replayed, pago: { egresoId: egreso.id, importe: egreso.importeDecimal.toFixed(2), fecha: egreso.createdAt } }, { status: replayed ? 200 : 201, headers: { ...NO_STORE, ...(replayed ? { "Idempotency-Replayed": "true" } : {}) } })
  } catch (error) {
    if (error instanceof PagoRecepcionError) return failure(error.resultado)
    return errorInterno("pago al recibir", error)
  }
}

// ---------------------------------------------------------------------------
// Dueño
// ---------------------------------------------------------------------------

export async function asociarPagoHttp(req: NextRequest, negocioId: string, recepcionId: string) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const r = await asociarPagoExistente(db, { negocioId, recepcionId, egresoCajaId: body.egresoCajaId }, { auditar: auditarDueno(negocioId) })
    if (!r.ok) return failure(r)
    return NextResponse.json({ ok: true, ...r.value }, { status: r.value.replayed ? 200 : 201, headers: NO_STORE })
  } catch (error) {
    return errorInterno("asociar pago", error)
  }
}

export async function cambiarEstadoPagoHttp(req: NextRequest, negocioId: string, recepcionId: string, pagoId: string) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const r = await cambiarEstadoPago(db, { negocioId, recepcionId, pagoId, accion: body.accion, motivo: body.motivo }, { auditar: auditarDueno(negocioId) })
    if (!r.ok) return failure(r)
    return NextResponse.json({ ok: true, ...r.value }, { headers: NO_STORE })
  } catch (error) {
    return errorInterno("observar pago", error)
  }
}
