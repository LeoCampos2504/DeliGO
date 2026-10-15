import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { moneyToNumber } from "@/lib/money"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { normalizarNotaEntrega, normalizarDestinoNombre, parseImporteCustodia, registrarEntregaCustodia } from "@/lib/caja-turnos-entrega"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const { id } = await params
    const turno = await db.turnoCaja.findFirst({
      where: { id, negocioId: auth.negocioId, estado: "CERRADO_DECLARADO" },
      select: { id: true, efectivoContadoDecimal: true, entregasCustodia: { orderBy: { secuencia: "asc" } } },
    })
    if (!turno || !turno.efectivoContadoDecimal) return NextResponse.json({ error: "Turno cerrado no encontrado" }, { status: 404 })
    return NextResponse.json({ efectivoContado: moneyToNumber(turno.efectivoContadoDecimal), estadoEntrega: turno.entregasCustodia.length ? "ENTREGA_CONFIRMADA" : "PENDIENTE_ENTREGA", entregas: turno.entregasCustodia.map((item) => ({
      id: item.id, tipo: item.tipo, estado: item.estado, actor: "Dueño",
      responsableTipo: item.responsableTipo, responsableId: item.responsableId, empleadoId: item.empleadoId,
      efectivoContado: moneyToNumber(item.efectivoContadoDecimal), efectivoEsperado: moneyToNumber(item.efectivoEsperadoDecimal), diferencia: moneyToNumber(item.diferenciaDecimal),
      efectivoEntregado: moneyToNumber(item.efectivoEntregadoDecimal), fondoRemanente: moneyToNumber(item.fondoRemanenteDecimal),
      destinoTipo: item.destinoTipo, destinoNombre: item.destinoNombre, confirmadoEn: item.confirmadoEn, observacion: item.observacion,
    })) })
  } catch (error) {
    console.error("Error reading cash custody history:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener el historial de entrega" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const { id } = await params
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
    if (body.tipo !== "ENTREGA_CONFIRMADA" && body.tipo !== "RECTIFICACION") return NextResponse.json({ error: "Tipo de operación inválido." }, { status: 400 })
    // Validate simple field shapes at the edge; the service is still authoritative.
    if (body.efectivoEntregado !== undefined && parseImporteCustodia(body.efectivoEntregado) === null) return NextResponse.json({ error: "El importe entregado no es válido." }, { status: 400 })
    if (body.fondoRemanente !== undefined && parseImporteCustodia(body.fondoRemanente) === null) return NextResponse.json({ error: "El fondo remanente no es válido." }, { status: 400 })
    if (body.observacion !== undefined && normalizarNotaEntrega(body.observacion) === undefined) return NextResponse.json({ error: "La observación no es válida." }, { status: 400 })
    if (body.destinoNombre !== undefined && normalizarDestinoNombre(body.destinoNombre) === undefined) return NextResponse.json({ error: "El lugar de resguardo no es válido." }, { status: 400 })
    const result = await registrarEntregaCustodia(db, {
      negocioId: auth.negocioId,
      actorId: auth.negocioId,
      turnoCajaId: id,
      idempotencyKey: req.headers.get("idempotency-key")?.trim() ?? "",
      confirmar: body.confirmar === true,
      tipo: body.tipo,
      efectivoEntregado: body.efectivoEntregado,
      fondoRemanente: body.fondoRemanente,
      destinoTipo: body.destinoTipo,
      destinoNombre: body.destinoNombre,
      observacion: body.observacion,
    })
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    if (!result.replayed) await auditLog({
      userId: auth.negocioId,
      userType: "negocio",
      accion: result.entrega.tipo === "RECTIFICACION" ? "turno_caja.entrega_rectificada" : "turno_caja.entrega_confirmada",
      recurso: "entrega_custodia_turno_caja",
      recursoId: result.entrega.id,
      detalle: { turnoCajaId: id, tipo: result.entrega.tipo, destinoTipo: result.entrega.destinoTipo },
    })
    return NextResponse.json({ entrega: {
      id: result.entrega.id, tipo: result.entrega.tipo, estado: result.entrega.estado,
      efectivoContado: moneyToNumber(result.entrega.efectivoContadoDecimal),
      efectivoEntregado: moneyToNumber(result.entrega.efectivoEntregadoDecimal),
      fondoRemanente: moneyToNumber(result.entrega.fondoRemanenteDecimal),
      destinoTipo: result.entrega.destinoTipo, destinoNombre: result.entrega.destinoNombre,
      confirmadoEn: result.entrega.confirmadoEn, observacion: result.entrega.observacion,
    }, replayed: result.replayed }, { status: result.replayed ? 200 : 201, headers: result.replayed ? { "Idempotency-Replayed": "true" } : undefined })
  } catch (error) {
    console.error("Error recording cash custody:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al registrar la entrega de efectivo" }, { status: 500 })
  }
}

