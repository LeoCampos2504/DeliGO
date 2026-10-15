import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { moneyToNumber } from "@/lib/money"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { asegurarCajaPredeterminada, crearCajaFisica, listarCajasFisicas, listarFondosRemanentesTransferibles, TURNO_ESTADO_ABIERTO } from "@/lib/caja-turnos-service"

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
    const fondosTransferibles = await listarFondosRemanentesTransferibles(db, auth.negocioId, cajas.filter((c) => c.activa).map((c) => c.id))
    const fondoPorCaja = new Map(fondosTransferibles.map((fondo) => [fondo.cajaFisicaId, fondo]))
    const traspasos = await db.traspasoFondoTurnoCaja.findMany({
      where: { negocioId: auth.negocioId },
      orderBy: { confirmadoEn: "desc" },
      take: 100,
      include: {
        caja: { select: { id: true, nombre: true } },
        turnoOrigen: { include: { empleado: { select: { nombre: true } } } },
        turnoDestino: { include: { empleado: { select: { nombre: true } } } },
      },
    })
    const porCaja = new Map(abiertos.map((t) => [t.cajaFisicaId, t]))
    return NextResponse.json({
      modoTurnos: auth.cajaTurnosModo,
      traspasos: traspasos.map((traspaso) => ({
        id: traspaso.id,
        caja: traspaso.caja,
        importe: traspaso.montoDecimal.toFixed(2),
        confirmadoEn: traspaso.confirmadoEn,
        estado: traspaso.estado,
        turnoOrigen: {
          id: traspaso.turnoOrigen.id,
          responsableNombre: traspaso.turnoOrigen.responsableTipo === "EMPLEADO" ? (traspaso.turnoOrigen.empleado?.nombre ?? "Empleado") : "Dueño",
        },
        turnoDestino: {
          id: traspaso.turnoDestino.id,
          responsableNombre: traspaso.turnoDestino.responsableTipo === "EMPLEADO" ? (traspaso.turnoDestino.empleado?.nombre ?? "Empleado") : "Dueño",
        },
      })),
      cajas: cajas.map((c) => {
        const t = porCaja.get(c.id)
        const fondo = fondoPorCaja.get(c.id)
        return {
          id: c.id,
          nombre: c.nombre,
          descripcion: c.descripcion,
          esPredeterminada: c.esPredeterminada,
          activa: c.activa,
          fondoTransferible: fondo ? { turnoOrigenId: fondo.turnoOrigenId, importe: fondo.fondoRemanenteDecimal.toFixed(2), cerradoEn: fondo.cerradoEn } : null,
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

