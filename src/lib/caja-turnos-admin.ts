// ============================================
// F10-B2.1 — OWNER-ONLY shift administration (server only)
// ============================================
// Expected cash is administrative information of the business owner. It must
// NEVER reach a cashier — not even through a hidden API — because F10-B2.2
// implements a BLIND close (the cashier declares what they counted without
// knowing the system figure). This module is imported only by owner routes
// (/api/negocio/**); a static contract forbids importing it from cashier
// (/api/operativo/**, /operaciones/**) code.
//
// Expected cash of a shift, exact (src/lib/money.ts, never floats):
//   fondo inicial (declared at opening, not a ledger movement)
//   + cash legs of operations attributed to the shift on its register's cash
//     account (sales today; signed, so future outflows enter as negatives)
// Transfers / OTRO never touch cash, so they never enter this figure.
// Only operations DeliGO really records are counted — nothing is invented.

import type { Prisma, PrismaClient } from "@prisma/client"
import { addMoney, storedMoney } from "@/lib/money"

type Db = Pick<PrismaClient, "turnoCaja" | "cuentaFinanciera" | "movimientoFinanciero" | "venta">

export interface EfectivoEsperadoTurno {
  fondoInicial: Prisma.Decimal
  ingresosEfectivo: Prisma.Decimal
  salidasEfectivo: Prisma.Decimal
  esperado: Prisma.Decimal
}

export async function calcularEfectivoEsperadoTurno(db: Db, negocioId: string, turnoId: string): Promise<EfectivoEsperadoTurno | null> {
  const turno = await db.turnoCaja.findFirst({ where: { id: turnoId, negocioId }, select: { id: true, cajaFisicaId: true, fondoInicialDecimal: true } })
  if (!turno) return null
  const cuenta = await db.cuentaFinanciera.findFirst({
    where: { negocioId, cajaFisicaId: turno.cajaFisicaId, tipo: "EFECTIVO" },
    select: { id: true },
  })
  const legs = cuenta
    ? await db.movimientoFinanciero.findMany({
        where: { negocioId, cuentaId: cuenta.id, operacion: { turnoCajaId: turno.id, negocioId } },
        select: { importe: true, importeDecimal: true },
      })
    : []
  const importes = legs.map((l) => storedMoney(l.importeDecimal, l.importe))
  const ingresosEfectivo = addMoney(...importes.filter((x) => x.isPositive() && !x.isZero()))
  const salidasEfectivo = addMoney(...importes.filter((x) => x.isNegative() && !x.isZero()).map((x) => x.abs()))
  return {
    fondoInicial: turno.fondoInicialDecimal,
    ingresosEfectivo,
    salidasEfectivo,
    esperado: turno.fondoInicialDecimal.plus(ingresosEfectivo).minus(salidasEfectivo),
  }
}

/** Sales attributed to a shift, by method (exact). Transfers are DECLARADO, never verified credits. */
export async function resumenVentasTurno(db: Db, negocioId: string, turnoId: string) {
  const ventas = await db.venta.findMany({
    where: { negocioId, turnoCajaId: turnoId },
    select: { metodoPago: true, total: true, totalDecimal: true },
  })
  const sumar = (metodo: string) => addMoney(...ventas.filter((v) => v.metodoPago === metodo).map((v) => storedMoney(v.totalDecimal, v.total)))
  return {
    cantidadVentas: ventas.length,
    totalEfectivo: sumar("EFECTIVO"),
    totalTransferencia: sumar("TRANSFERENCIA"),
    totalOtro: sumar("OTRO"),
  }
}
