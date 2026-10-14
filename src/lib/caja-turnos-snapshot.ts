import type { Prisma, PrismaClient } from "@prisma/client"
import { addMoney, storedMoney } from "@/lib/money"

type Db = Pick<PrismaClient, "turnoCaja" | "cuentaFinanciera" | "movimientoFinanciero">

export interface SnapshotEfectivoTurno {
  fondoInicial: Prisma.Decimal
  ingresosEfectivo: Prisma.Decimal
  salidasEfectivo: Prisma.Decimal
  esperado: Prisma.Decimal
}

/** Internal server calculation shared by owner reporting and the close snapshot writer. */
export async function calcularSnapshotEfectivoTurno(db: Db, negocioId: string, turnoId: string): Promise<SnapshotEfectivoTurno | null> {
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
  const amounts = legs.map((leg) => storedMoney(leg.importeDecimal, leg.importe))
  const ingresosEfectivo = addMoney(...amounts.filter((amount) => amount.isPositive() && !amount.isZero()))
  const salidasEfectivo = addMoney(...amounts.filter((amount) => amount.isNegative() && !amount.isZero()).map((amount) => amount.abs()))
  return {
    fondoInicial: turno.fondoInicialDecimal,
    ingresosEfectivo,
    salidasEfectivo,
    esperado: turno.fondoInicialDecimal.plus(ingresosEfectivo).minus(salidasEfectivo),
  }
}
