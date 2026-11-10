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
// F4-C2: the per-method sales summary below reads the real cobros (CobroVenta);
// the expected cash keeps reading the ledger only.
// Transfers / OTRO never touch cash, so they never enter this figure.
// Only operations DeliGO really records are counted — nothing is invented.

import type { Prisma, PrismaClient } from "@prisma/client"
import { calcularSnapshotEfectivoTurno } from "@/lib/caja-turnos-snapshot"
import { COBRO_RESUMEN_SELECT, resumirCobrosCaja } from "@/lib/caja-resumen-cobros"
import { addMoney } from "@/lib/money"

type Db = Pick<PrismaClient, "turnoCaja" | "cuentaFinanciera" | "movimientoFinanciero" | "venta">

export const calcularEfectivoEsperadoTurno = calcularSnapshotEfectivoTurno

/**
 * Sales attributed to a shift, by method (exact). Transfers are DECLARADO, never verified credits.
 * F4-C2: the money by method comes from the sales' real cobros (CobroVenta), with
 * the pre-F10-B0 fallback (one cobro of Venta.metodoPago for its total) — identical
 * to the former grouping for every sale written today. The expected cash and the
 * frozen closing snapshot are NOT computed here (ledger, caja-turnos-snapshot.ts).
 */
export async function resumenVentasTurno(db: Db, negocioId: string, turnoId: string) {
  const ventas = await db.venta.findMany({
    where: { negocioId, turnoCajaId: turnoId },
    select: { metodoPago: true, total: true, totalDecimal: true, cobros: { select: COBRO_RESUMEN_SELECT } },
  })
  const resumen = resumirCobrosCaja(ventas)
  return {
    cantidadVentas: ventas.length,
    totalEfectivo: resumen.cobradoPorMedio.EFECTIVO,
    totalTransferencia: resumen.cobradoPorMedio.TRANSFERENCIA,
    totalOtro: resumen.cobradoPorMedio.OTRO,
  }
}

/**
 * F4-C5 (D7) — exchanges attributed to these shifts (owner only). Read from the
 * immutable exchange rows: SQL only lets an exchange be attributed to an OPEN
 * shift, so a closed shift never gains rows and its frozen closing snapshot is
 * never recalculated. Money = the charged difference D+ and the D− refunds paid
 * in cash from the shift; the credit is a non-monetary compensation.
 */
export async function resumenCambiosTurnos(db: Pick<PrismaClient, "cambioVenta" | "devolucionVenta">, negocioId: string, turnoIds: string[]) {
  const vacio = () => ({ cantidad: 0, diferenciaCobrada: [] as Prisma.Decimal[], compensacionInterna: [] as Prisma.Decimal[], reintegradoEfectivo: [] as Prisma.Decimal[] })
  const acc = new Map(turnoIds.map((id) => [id, vacio()]))
  if (turnoIds.length > 0) {
    const [cambios, reintegros] = await Promise.all([
      db.cambioVenta.findMany({ where: { negocioId, turnoCajaId: { in: turnoIds } }, select: { turnoCajaId: true, diferenciaCobradaDecimal: true, creditoAplicadoDecimal: true } }),
      db.devolucionVenta.findMany({
        where: { negocioId, reintegroTurnoCajaId: { in: turnoIds }, reintegroEstado: "REALIZADO", cambio: { isNot: null } },
        select: { reintegroTurnoCajaId: true, importeDecimal: true, importeCompensadoDecimal: true },
      }),
    ])
    for (const c of cambios) {
      const a = acc.get(c.turnoCajaId!)
      if (!a) continue
      a.cantidad++
      a.diferenciaCobrada.push(c.diferenciaCobradaDecimal)
      a.compensacionInterna.push(c.creditoAplicadoDecimal)
    }
    for (const d of reintegros) acc.get(d.reintegroTurnoCajaId!)?.reintegradoEfectivo.push(d.importeDecimal.minus(d.importeCompensadoDecimal))
  }
  return new Map([...acc].map(([id, a]) => [id, {
    cantidad: a.cantidad,
    diferenciaCobrada: addMoney(...a.diferenciaCobrada),
    compensacionInterna: addMoney(...a.compensacionInterna),
    reintegradoEfectivo: addMoney(...a.reintegradoEfectivo),
  }]))
}

export async function resumenCambiosTurno(db: Pick<PrismaClient, "cambioVenta" | "devolucionVenta">, negocioId: string, turnoId: string) {
  return (await resumenCambiosTurnos(db, negocioId, [turnoId])).get(turnoId)!
}
