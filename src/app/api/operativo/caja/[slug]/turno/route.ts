import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { moneyToNumber } from "@/lib/money"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { abrirTurnoCaja, asegurarCajaPredeterminada, TURNO_ESTADO_ABIERTO, turnoAbiertoDeActor } from "@/lib/caja-turnos-service"

// ============================================
// F10-B2.1 — cashier: THEIR OWN shift
// ============================================
// Personal operational session + área caja (resolveOperativoAreaForSlug),
// generic business only. GET → the active registers of their business (with
// a plain "ocupada" flag, never who/what) + their own open shift (register,
// opening time, the opening cash THEY declared) + the business's shift mode.
// POST → open their own shift { cajaFisicaId?, fondoInicial } with a
// required Idempotency-Key.
// NEVER here (blind close, F10-B2.2): expected cash, differences, totals,
// balances, other people's shifts or movements.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
    if (!auth.ok) return cajaAuthFailure(auth)
    await asegurarCajaPredeterminada(db, auth.negocio.id)
    const [cajas, abiertas, propio, negocio] = await Promise.all([
      db.cajaFisica.findMany({
        where: { negocioId: auth.negocio.id, activa: true },
        select: { id: true, nombre: true, esPredeterminada: true },
        orderBy: [{ esPredeterminada: "desc" }, { createdAt: "asc" }],
      }),
      db.turnoCaja.findMany({ where: { negocioId: auth.negocio.id, estado: TURNO_ESTADO_ABIERTO }, select: { cajaFisicaId: true } }),
      turnoAbiertoDeActor(db, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }),
      db.negocio.findUnique({ where: { id: auth.negocio.id }, select: { cajaTurnosModo: true } }),
    ])
    const ocupadas = new Set(abiertas.map((t) => t.cajaFisicaId))
    return noStore(
      NextResponse.json({
        ok: true,
        modoTurnos: negocio?.cajaTurnosModo ?? "OPCIONAL",
        cajas: cajas.map((c) => ({ id: c.id, nombre: c.nombre, esPredeterminada: c.esPredeterminada, ocupada: ocupadas.has(c.id) })),
        turno: propio
          ? { id: propio.id, caja: propio.cajaFisica, abiertoEn: propio.abiertoEn, fondoInicial: moneyToNumber(propio.fondoInicialDecimal) }
          : null,
      })
    )
  } catch (error) {
    console.error("Error reading turno de caja (operativo):", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "Error al obtener el turno" }, { status: 500 }))
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
    if (!auth.ok) return cajaAuthFailure(auth)
    const body = (await req.json().catch(() => null)) as { cajaFisicaId?: unknown; fondoInicial?: unknown } | null
    if (body?.cajaFisicaId !== undefined && body.cajaFisicaId !== null && typeof body.cajaFisicaId !== "string") {
      return noStore(NextResponse.json({ ok: false, error: "Caja inválida" }, { status: 400 }))
    }
    const result = await abrirTurnoCaja(db, {
      negocioId: auth.negocio.id,
      actor: { tipo: "EMPLEADO", empleadoId: auth.empleado.id },
      cajaFisicaId: (body?.cajaFisicaId as string | null | undefined) ?? null,
      fondoInicial: body?.fondoInicial,
      idempotencyKey: req.headers.get("idempotency-key")?.trim() ?? "",
    })
    if (!result.ok) {
      return noStore(
        NextResponse.json(result.code ? { ok: false, error: result.error, code: result.code } : { ok: false, error: result.error }, { status: result.status })
      )
    }
    const { turno, replayed } = result.value
    if (!replayed) {
      await auditLog({
        userId: auth.empleado.id,
        userType: "empleado",
        accion: "turno_caja.abierto",
        recurso: "turno_caja",
        recursoId: turno.id,
        detalle: { negocioId: auth.negocio.id, cajaFisicaId: turno.cajaFisicaId, fondoInicial: turno.fondoInicialDecimal.toFixed(2) },
      })
    }
    return noStore(
      NextResponse.json(
        { ok: true, turno: { id: turno.id, caja: turno.cajaFisica, abiertoEn: turno.abiertoEn, fondoInicial: moneyToNumber(turno.fondoInicialDecimal) } },
        { status: replayed ? 200 : 201, headers: replayed ? { "Idempotency-Replayed": "true" } : undefined }
      )
    )
  } catch (error) {
    console.error("Error opening turno de caja (operativo):", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "Error al abrir el turno" }, { status: 500 }))
  }
}
