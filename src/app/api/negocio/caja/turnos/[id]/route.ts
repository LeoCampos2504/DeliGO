import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { auditLog } from "@/lib/audit"
import { cerrarTurnoCaja, TURNO_ESTADO_CERRADO_DECLARADO } from "@/lib/caja-turnos-service"
import { moneyToNumber } from "@/lib/money"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { calcularEfectivoEsperadoTurno, resumenVentasTurno } from "@/lib/caja-turnos-admin"

// ============================================
// F10-B2.1 — owner ONLY: administrative detail of one shift
// ============================================
// Includes the exact EXPECTED CASH (fondo inicial + cash legs of the shift).
// This figure is administrative: it never exists in any cashier route (blind
// close, F10-B2.2). Scoped to the owner's own business.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const { id } = await params
    const turno = await db.turnoCaja.findFirst({
      where: { id, negocioId: auth.negocioId },
      include: { cajaFisica: { select: { id: true, nombre: true } }, empleado: { select: { nombre: true } } },
    })
    if (!turno) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
    const [efectivoCalculado, ventas] = await Promise.all([
      turno.estado === TURNO_ESTADO_CERRADO_DECLARADO && turno.efectivoEsperadoDecimal
        ? Promise.resolve(null)
        : calcularEfectivoEsperadoTurno(db, auth.negocioId, turno.id),
      resumenVentasTurno(db, auth.negocioId, turno.id),
    ])
    const efectivoEsperado = turno.estado === TURNO_ESTADO_CERRADO_DECLARADO
      ? turno.efectivoEsperadoDecimal
      : efectivoCalculado?.esperado
    const efectivoCounted = turno.estado === TURNO_ESTADO_CERRADO_DECLARADO ? turno.efectivoContadoDecimal : null
    const diferencia = efectivoEsperado && efectivoCounted ? efectivoCounted.minus(efectivoEsperado) : null
    return NextResponse.json({
      id: turno.id,
      caja: turno.cajaFisica,
      responsableTipo: turno.responsableTipo,
      responsableNombre: turno.responsableTipo === "EMPLEADO" ? (turno.empleado?.nombre ?? "Empleado") : "Dueño",
      estado: turno.estado,
      cierreOrigen: turno.cierreOrigen,
      cierreMotivo: turno.cierreMotivo,
      abiertoEn: turno.abiertoEn,
      cerradoEn: turno.cerradoEn,
      efectivo: efectivoEsperado ? {
        fondoInicial: moneyToNumber(turno.fondoInicialDecimal),
        ingresosEfectivo: efectivoCalculado ? moneyToNumber(efectivoCalculado.ingresosEfectivo) : null,
        salidasEfectivo: efectivoCalculado ? moneyToNumber(efectivoCalculado.salidasEfectivo) : null,
        esperado: moneyToNumber(efectivoEsperado),
        contadoDeclarado: efectivoCounted ? moneyToNumber(efectivoCounted) : null,
        diferencia: diferencia ? moneyToNumber(diferencia) : null,
      } : null,
      ventas: {
        cantidad: ventas.cantidadVentas,
        totalEfectivo: moneyToNumber(ventas.totalEfectivo),
        totalTransferencia: moneyToNumber(ventas.totalTransferencia),
        totalOtro: moneyToNumber(ventas.totalOtro),
      },
    })
  } catch (error) {
    console.error("Error reading turno de caja:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener el turno" }, { status: 500 })
  }
}
// F10-B2.2-C — an owner may close only their own NEGOCIO-responsible shift.
// The service rejects owner attempts to close an employee's shared shift.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const { id } = await params
    const body = (await req.json().catch(() => null)) as { efectivoContado?: unknown } | null

    const result = await cerrarTurnoCaja(db, {
      negocioId: auth.negocioId,
      turnoCajaId: id,
      actor: { tipo: "NEGOCIO" },
      efectivoContado: body?.efectivoContado,
      idempotencyKey: req.headers.get("idempotency-key")?.trim() ?? "",
    })
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status })
    const { turno, replayed } = result.value
    if (!replayed) await auditLog({
      userId: auth.negocioId,
      userType: "negocio",
      accion: "turno_caja.cerrado_declarado",
      recurso: "turno_caja",
      recursoId: turno.id,
      detalle: { negocioId: auth.negocioId, estado: TURNO_ESTADO_CERRADO_DECLARADO },
    })
    return NextResponse.json(
      { ok: true, turno: { id: turno.id, estado: turno.estado, cerradoEn: turno.cerradoEn.toISOString() } },
      { status: 200, headers: replayed ? { "Idempotency-Replayed": "true" } : undefined }
    )
  } catch (error) {
    console.error("Error closing turno de caja:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "Error al cerrar el turno" }, { status: 500 })
  }
}
