import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { moneyToNumber } from "@/lib/money"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { abrirTurnoCaja } from "@/lib/caja-turnos-service"

// ============================================
// F10-B2.1 — owner: shifts of THEIR business
// ============================================
// GET  → recent shifts (any responsible person of this business).
// POST → open the OWNER's own shift { cajaFisicaId?, fondoInicial } with a
//        required Idempotency-Key. The responsible person is the owner
//        (NEGOCIO) — the owner never opens a shift in an employee's name here.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const turnos = await db.turnoCaja.findMany({
      where: { negocioId: auth.negocioId },
      include: { cajaFisica: { select: { id: true, nombre: true } }, empleado: { select: { nombre: true } } },
      orderBy: { abiertoEn: "desc" },
      take: 50,
    })
    return NextResponse.json({
      modoTurnos: auth.cajaTurnosModo,
      turnos: turnos.map((t) => ({
        id: t.id,
        caja: t.cajaFisica,
        responsableTipo: t.responsableTipo,
        responsableNombre: t.responsableTipo === "EMPLEADO" ? (t.empleado?.nombre ?? "Empleado") : "Dueño",
        estado: t.estado,
        abiertoEn: t.abiertoEn,
        fondoInicial: moneyToNumber(t.fondoInicialDecimal),
      })),
    })
  } catch (error) {
    console.error("Error listing turnos de caja:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener los turnos" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const body = (await req.json().catch(() => null)) as { cajaFisicaId?: unknown; fondoInicial?: unknown } | null
    if (body?.cajaFisicaId !== undefined && body.cajaFisicaId !== null && typeof body.cajaFisicaId !== "string") {
      return NextResponse.json({ error: "Caja inválida" }, { status: 400 })
    }
    const result = await abrirTurnoCaja(db, {
      negocioId: auth.negocioId,
      actor: { tipo: "NEGOCIO" },
      cajaFisicaId: (body?.cajaFisicaId as string | null | undefined) ?? null,
      fondoInicial: body?.fondoInicial,
      idempotencyKey: req.headers.get("idempotency-key")?.trim() ?? "",
    })
    if (!result.ok) return NextResponse.json(result.code ? { error: result.error, code: result.code } : { error: result.error }, { status: result.status })
    const { turno, replayed } = result.value
    if (!replayed) {
      await auditLog({
        userId: auth.negocioId,
        userType: "negocio",
        accion: "turno_caja.abierto",
        recurso: "turno_caja",
        recursoId: turno.id,
        detalle: { cajaFisicaId: turno.cajaFisicaId, fondoInicial: turno.fondoInicialDecimal.toFixed(2) },
      })
    }
    return NextResponse.json(
      { id: turno.id, caja: turno.cajaFisica, responsableTipo: turno.responsableTipo, estado: turno.estado, abiertoEn: turno.abiertoEn, fondoInicial: moneyToNumber(turno.fondoInicialDecimal) },
      { status: replayed ? 200 : 201, headers: replayed ? { "Idempotency-Replayed": "true" } : undefined }
    )
  } catch (error) {
    console.error("Error opening turno de caja (dueño):", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al abrir el turno" }, { status: 500 })
  }
}
