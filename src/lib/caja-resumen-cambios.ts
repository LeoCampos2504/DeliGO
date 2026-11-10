// ============================================
// F4-C5 (D7) — owner-only breakdown of exchanges and refunds (server only)
// ============================================
// Rules (operator, 2026-11-09):
//   - sales / returns that are part of an exchange are shown APART, as a part
//     of the commercial volume (same sets as the daily summary);
//   - refunds actually PAID are money, by method, attributed to the day they
//     were paid (reintegroRegistradoEn), for their refundable amount
//     (returned − compensated by an exchange), never the compensated part;
//   - PENDING refunds are never paid money: the open total of the business and
//     the ones generated today that are still pending, apart;
//   - the internal compensation (CREDITO_CAMBIO cobros) is a non-monetary credit.
// Owner-only: cashier code never imports this module (blind close).

import { Prisma, type DevolucionVenta, type PrismaClient } from "@prisma/client"
import { addMoney, moneyToNumber } from "@/lib/money"
import { importeReintegrableDevolucion } from "@/lib/caja-devoluciones-service"

type Db = Pick<PrismaClient, "devolucionVenta">
const MEDIOS = ["EFECTIVO", "TRANSFERENCIA", "OTRO"] as const

type Reintegrable = Pick<DevolucionVenta, "importeDecimal" | "importeCompensadoDecimal">
const reintegrable = (d: Reintegrable) => importeReintegrableDevolucion({ importeDevuelto: d.importeDecimal, importeCompensado: d.importeCompensadoDecimal })

export async function desgloseCambiosYReintegros(
  db: Db,
  negocioId: string,
  desde: Date,
  dia: {
    /** Sales from exchanges over EVERY sale of the day (resumirCobrosCajaDesde, B1). */
    ventasPorCambios: { cantidad: number; importe: Prisma.Decimal }
    devolucionesHoy: Array<{ importe: Prisma.Decimal; esCambio: boolean }>
    compensacionInterna: Prisma.Decimal
  }
) {
  const [pagados, pendientes] = await Promise.all([
    db.devolucionVenta.findMany({
      where: { negocioId, reintegroEstado: "REALIZADO", reintegroRegistradoEn: { gte: desde } },
      select: { importeDecimal: true, importeCompensadoDecimal: true, reintegroMedio: true, cambio: { select: { id: true } } },
    }),
    db.devolucionVenta.findMany({
      where: { negocioId, reintegroEstado: "PENDIENTE" },
      select: { importeDecimal: true, importeCompensadoDecimal: true, createdAt: true },
    }),
  ])
  const devolucionesCambio = dia.devolucionesHoy.filter((d) => d.esCambio)
  const porMedio = Object.fromEntries(MEDIOS.map((m) => [m, addMoney(...pagados.filter((d) => d.reintegroMedio === m).map(reintegrable))])) as Record<(typeof MEDIOS)[number], Prisma.Decimal>
  const pendientesHoy = pendientes.filter((d) => d.createdAt >= desde)
  return {
    porCambios: {
      cantidadVentas: dia.ventasPorCambios.cantidad,
      ventas: moneyToNumber(dia.ventasPorCambios.importe),
      cantidadDevoluciones: devolucionesCambio.length,
      devuelto: moneyToNumber(addMoney(...devolucionesCambio.map((d) => d.importe))),
    },
    reintegrosPagados: {
      EFECTIVO: moneyToNumber(porMedio.EFECTIVO),
      TRANSFERENCIA: moneyToNumber(porMedio.TRANSFERENCIA),
      OTRO: moneyToNumber(porMedio.OTRO),
      total: moneyToNumber(addMoney(porMedio.EFECTIVO, porMedio.TRANSFERENCIA, porMedio.OTRO)),
      cantidad: pagados.length,
      porCambios: moneyToNumber(addMoney(...pagados.filter((d) => d.cambio).map(reintegrable))),
    },
    reintegrosPendientes: {
      total: moneyToNumber(addMoney(...pendientes.map(reintegrable))),
      cantidad: pendientes.length,
    },
    reintegrosPendientesHoy: {
      total: moneyToNumber(addMoney(...pendientesHoy.map(reintegrable))),
      cantidad: pendientesHoy.length,
    },
    compensacionInterna: moneyToNumber(dia.compensacionInterna),
  }
}
