import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { moneyToNumber } from "@/lib/money"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { CIERRE_ORIGEN_RECUPERACION, recuperarTurnoCaja } from "@/lib/caja-turnos-service"

// ============================================
// F10-B2.2-G — owner ONLY: administrative recovery of an employee's shift
// ============================================
// The business and the closing actor come from the owner session; the body
// only carries the physical count, the reason, the explicit confirmation and
// the register the owner saw. Requires an Idempotency-Key. The response is
// owner data (expected cash and difference) and never reaches cashier routes.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const { id } = await params
    const body = (await req.json().catch(() => null)) as { cajaFisicaId?: unknown; efectivoContado?: unknown; motivo?: unknown; confirmo?: unknown } | null
    const result = await recuperarTurnoCaja(db, {
      negocioId: auth.negocioId,
      turnoCajaId: id,
      cajaFisicaId: body?.cajaFisicaId,
      efectivoContado: body?.efectivoContado,
      motivo: body?.motivo,
      confirmo: body?.confirmo,
      idempotencyKey: req.headers.get("idempotency-key")?.trim() ?? "",
    })
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status })
    const { turno, replayed } = result.value
    const saved = await db.turnoCaja.findFirstOrThrow({
      where: { id: turno.id, negocioId: auth.negocioId },
      select: { cajaFisicaId: true, responsableTipo: true, responsableId: true, cierreMotivo: true, cajaFisica: { select: { id: true, nombre: true } }, empleado: { select: { nombre: true } } },
    })
    if (!replayed) await auditLog({
      userId: auth.negocioId,
      userType: "negocio",
      accion: "turno_caja.recuperado_administrativamente",
      recurso: "turno_caja",
      recursoId: turno.id,
      detalle: { negocioId: auth.negocioId, cajaFisicaId: saved.cajaFisicaId, responsableTipo: saved.responsableTipo, responsableId: saved.responsableId, cierreOrigen: CIERRE_ORIGEN_RECUPERACION, motivo: saved.cierreMotivo },
    })
    const diferencia = turno.efectivoEsperadoDecimal ? turno.efectivoContadoDecimal.minus(turno.efectivoEsperadoDecimal) : null
    return NextResponse.json(
      {
        ok: true,
        replayed,
        turno: {
          id: turno.id,
          estado: turno.estado,
          cierreOrigen: CIERRE_ORIGEN_RECUPERACION,
          caja: saved.cajaFisica,
          responsableNombre: saved.empleado?.nombre ?? "Empleado",
          cerradoEn: turno.cerradoEn.toISOString(),
          motivo: saved.cierreMotivo,
          efectivoContado: moneyToNumber(turno.efectivoContadoDecimal),
          efectivoEsperado: turno.efectivoEsperadoDecimal ? moneyToNumber(turno.efectivoEsperadoDecimal) : null,
          diferencia: diferencia ? moneyToNumber(diferencia) : null,
        },
      },
      { status: replayed ? 200 : 201, headers: replayed ? { "Idempotency-Replayed": "true" } : undefined }
    )
  } catch (error) {
    console.error("Error recovering turno de caja:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No se pudo recuperar el turno por un error inesperado. Podés reintentar sin duplicarlo." }, { status: 500 })
  }
}
