import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { safeErrorForLog } from "@/lib/log-safe-error"
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
    const [efectivo, ventas] = await Promise.all([
      calcularEfectivoEsperadoTurno(db, auth.negocioId, turno.id),
      resumenVentasTurno(db, auth.negocioId, turno.id),
    ])
    return NextResponse.json({
      id: turno.id,
      caja: turno.cajaFisica,
      responsableTipo: turno.responsableTipo,
      responsableNombre: turno.responsableTipo === "EMPLEADO" ? (turno.empleado?.nombre ?? "Empleado") : "Dueño",
      estado: turno.estado,
      abiertoEn: turno.abiertoEn,
      efectivo: {
        fondoInicial: moneyToNumber(efectivo!.fondoInicial),
        ingresosEfectivo: moneyToNumber(efectivo!.ingresosEfectivo),
        salidasEfectivo: moneyToNumber(efectivo!.salidasEfectivo),
        esperado: moneyToNumber(efectivo!.esperado),
      },
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
