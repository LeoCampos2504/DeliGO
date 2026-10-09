import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { moneyToNumber } from "@/lib/money"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { asegurarCajaPredeterminada, crearCajaFisica, listarCajasFisicas, TURNO_ESTADO_ABIERTO } from "@/lib/caja-turnos-service"

// ============================================
// F10-B2.1 — owner: physical registers of THEIR business
// ============================================
// GET  → registers (the default one is ensured) + the open shift of each.
// POST → create a register { nombre, descripcion? }.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    await asegurarCajaPredeterminada(db, auth.negocioId)
    const [cajas, abiertos] = await Promise.all([
      listarCajasFisicas(db, auth.negocioId),
      db.turnoCaja.findMany({
        where: { negocioId: auth.negocioId, estado: TURNO_ESTADO_ABIERTO },
        include: { empleado: { select: { nombre: true } } },
      }),
    ])
    const porCaja = new Map(abiertos.map((t) => [t.cajaFisicaId, t]))
    return NextResponse.json({
      modoTurnos: auth.cajaTurnosModo,
      cajas: cajas.map((c) => {
        const t = porCaja.get(c.id)
        return {
          id: c.id,
          nombre: c.nombre,
          descripcion: c.descripcion,
          esPredeterminada: c.esPredeterminada,
          activa: c.activa,
          turnoAbierto: t
            ? {
                id: t.id,
                responsableTipo: t.responsableTipo,
                responsableNombre: t.responsableTipo === "EMPLEADO" ? (t.empleado?.nombre ?? "Empleado") : "Dueño",
                abiertoEn: t.abiertoEn,
                fondoInicial: moneyToNumber(t.fondoInicialDecimal),
              }
            : null,
        }
      }),
    })
  } catch (error) {
    console.error("Error listing cajas físicas:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener las cajas" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const body = (await req.json().catch(() => null)) as { nombre?: unknown; descripcion?: unknown } | null
    const result = await crearCajaFisica(db, auth.negocioId, { nombre: body?.nombre, descripcion: body?.descripcion })
    if (!result.ok) return NextResponse.json(result.code ? { error: result.error, code: result.code } : { error: result.error }, { status: result.status })
    await auditLog({
      userId: auth.negocioId,
      userType: "negocio",
      accion: "caja_fisica.creada",
      recurso: "caja_fisica",
      recursoId: result.value.id,
      detalle: { nombre: result.value.nombre },
    })
    const c = result.value
    return NextResponse.json({ id: c.id, nombre: c.nombre, descripcion: c.descripcion, esPredeterminada: c.esPredeterminada, activa: c.activa }, { status: 201 })
  } catch (error) {
    console.error("Error creating caja física:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al crear la caja" }, { status: 500 })
  }
}
