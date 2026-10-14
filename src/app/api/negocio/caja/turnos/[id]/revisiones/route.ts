import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { moneyToNumber } from "@/lib/money"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { normalizarObservacion, registrarRevisionTurnoCaja } from "@/lib/caja-turnos-revision"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const { id } = await params
    const turno = await db.turnoCaja.findFirst({
      where: { id, negocioId: auth.negocioId, estado: "CERRADO_DECLARADO" },
      select: { id: true, revisionesAdministrativas: { orderBy: { createdAt: "asc" } } },
    })
    if (!turno) return NextResponse.json({ error: "Turno cerrado no encontrado" }, { status: 404 })
    return NextResponse.json({ revisiones: turno.revisionesAdministrativas.map((revision) => ({
      id: revision.id,
      actor: "Dueño",
      accion: revision.accion,
      observacion: revision.observacion,
      efectivoEsperado: moneyToNumber(revision.efectivoEsperadoDecimal),
      efectivoContado: moneyToNumber(revision.efectivoContadoDecimal),
      diferencia: moneyToNumber(revision.diferenciaDecimal),
      createdAt: revision.createdAt,
    })) })
  } catch (error) {
    console.error("Error reading cash-shift reviews:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener las revisiones" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const { id } = await params
    const body = await req.json().catch(() => null) as { observacion?: unknown } | null
    const observacion = normalizarObservacion(body?.observacion)
    if (observacion === undefined) return NextResponse.json({ error: "La observación no es válida (máximo 1000 caracteres)." }, { status: 400 })

    const result = await registrarRevisionTurnoCaja(db, {
      negocioId: auth.negocioId,
      turnoCajaId: id,
      idempotencyKey: req.headers.get("idempotency-key")?.trim() ?? "",
      observacion,
    })
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    if (!result.replayed) await auditLog({
      userId: auth.negocioId,
      userType: "negocio",
      accion: "turno_caja.revision_administrativa",
      recurso: "revision_turno_caja",
      recursoId: result.revision.id,
      detalle: { turnoCajaId: id, accion: result.revision.accion },
    })
    return NextResponse.json({
      revision: {
        id: result.revision.id,
        accion: result.revision.accion,
        observacion: result.revision.observacion,
        efectivoEsperado: moneyToNumber(result.revision.efectivoEsperadoDecimal),
        efectivoContado: moneyToNumber(result.revision.efectivoContadoDecimal),
        diferencia: moneyToNumber(result.revision.diferenciaDecimal),
        createdAt: result.revision.createdAt,
      },
      replayed: result.replayed,
    }, { status: result.replayed ? 200 : 201, headers: result.replayed ? { "Idempotency-Replayed": "true" } : undefined })
  } catch (error) {
    console.error("Error recording cash-shift review:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al registrar la revisión" }, { status: 500 })
  }
}
