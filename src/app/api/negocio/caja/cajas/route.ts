import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { EMPLEADO_NOMBRE_SELECT, nombreVisibleEmpleado } from "@/lib/caja-nombre-empleado"
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
        include: { empleado: { select: EMPLEADO_NOMBRE_SELECT } },
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
        turnoOrigen: { include: { empleado: { select: EMPLEADO_NOMBRE_SELECT } } },
        turnoDestino: { include: { empleado: { select: EMPLEADO_NOMBRE_SELECT } } },
      },
    })
    const porCaja = new Map(abiertos.map((t) => [t.cajaFisicaId, t]))
    // F10-B2.2-G: the only reliable activity signal of an open shift is the
    // sales DeliGO really recorded for it. No "last seen" is invented.
    const actividad = abiertos.length
      ? await db.venta.groupBy({
          by: ["turnoCajaId"],
          where: { negocioId: auth.negocioId, turnoCajaId: { in: abiertos.map((t) => t.id) } },
          _max: { createdAt: true },
          _count: { _all: true },
        })
      : []
    const actividadPorTurno = new Map(actividad.map((a) => [a.turnoCajaId, a]))
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
          responsableNombre: traspaso.turnoOrigen.responsableTipo === "EMPLEADO" ? (nombreVisibleEmpleado(traspaso.turnoOrigen.empleado)) : "Dueño",
        },
        turnoDestino: {
          id: traspaso.turnoDestino.id,
          responsableNombre: traspaso.turnoDestino.responsableTipo === "EMPLEADO" ? (nombreVisibleEmpleado(traspaso.turnoDestino.empleado)) : "Dueño",
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
                responsableNombre: t.responsableTipo === "EMPLEADO" ? (nombreVisibleEmpleado(t.empleado)) : "Dueño",
                abiertoEn: t.abiertoEn,
                fondoInicial: moneyToNumber(t.fondoInicialDecimal),
                estado: t.estado,
                cantidadVentas: actividadPorTurno.get(t.id)?._count._all ?? 0,
                ultimaVentaEn: actividadPorTurno.get(t.id)?._max.createdAt ?? null,
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

