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
import { Prisma as PrismaNs } from "@prisma/client"
import { addMoney, moneyToNumber } from "@/lib/money"

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

/**
 * F10-C1c — the shift's CASH by ledger operation type (owner only). It reads the
 * SAME legs as the expected cash (the register's cash account, operations
 * attributed to the shift) and splits them by type, so the parts always add up:
 *   fondo + ventas en efectivo − reintegros − gastos − pagos a proveedores
 *   − retiros del dueño + compensaciones (± otros) = esperado (exact).
 * `cuadra` compares that sum with the expected cash (live for an open shift,
 * the FROZEN snapshot for a closed one; a closed shift never gains legs).
 * The natures are never added into one "expense" figure: a supplier payment
 * settles a purchase (F5) and a withdrawal is not an expense.
 */
export type DesgloseEfectivoTurno = {
  ventasEfectivo: Prisma.Decimal
  reintegros: Prisma.Decimal
  gastos: Prisma.Decimal
  pagosProveedor: Prisma.Decimal
  retirosDueno: Prisma.Decimal
  compensaciones: Prisma.Decimal
  compensacionesPorNaturaleza: { GASTO: Prisma.Decimal; PAGO_PROVEEDOR: Prisma.Decimal; RETIRO_DUENO: Prisma.Decimal }
  otrosIngresos: Prisma.Decimal
  otrasSalidas: Prisma.Decimal
  totalMovimientos: Prisma.Decimal
}

export async function desgloseEfectivoTurnos(db: Pick<PrismaClient, "$queryRaw">, negocioId: string, turnoIds: string[]) {
  const cero = () => new PrismaNs.Decimal(0)
  const vacio = (): DesgloseEfectivoTurno => ({
    ventasEfectivo: cero(), reintegros: cero(), gastos: cero(), pagosProveedor: cero(), retirosDueno: cero(), compensaciones: cero(),
    compensacionesPorNaturaleza: { GASTO: cero(), PAGO_PROVEEDOR: cero(), RETIRO_DUENO: cero() },
    otrosIngresos: cero(), otrasSalidas: cero(), totalMovimientos: cero(),
  })
  const acc = new Map(turnoIds.map((id) => [id, vacio()]))
  if (turnoIds.length === 0) return acc
  const filas = await db.$queryRaw<Array<{ turnoId: string; tipo: string; origenTipo: string | null; total: string }>>`
    SELECT o."turnoCajaId" AS "turnoId", o."tipo" AS "tipo", orig."tipo" AS "origenTipo",
           (CASE WHEN COALESCE(m."importeDecimal", round(m."importe"::numeric, 2)) > 0 THEN 'E' ELSE 'S' END) AS "dir",
           sum(COALESCE(m."importeDecimal", round(m."importe"::numeric, 2)))::text AS "total"
      FROM "movimientos_financieros" m
      JOIN "operaciones_financieras" o ON o."id" = m."operacionId"
      JOIN "turnos_caja" t ON t."id" = o."turnoCajaId" AND t."negocioId" = o."negocioId"
      JOIN "cuentas_financieras" c ON c."id" = m."cuentaId"
      LEFT JOIN "operaciones_financieras" orig ON orig."id" = o."revierteOperacionId"
     WHERE o."negocioId" = ${negocioId} AND m."negocioId" = ${negocioId} AND c."negocioId" = ${negocioId}
       AND o."turnoCajaId" IN (${PrismaNs.join(turnoIds)})
       AND c."cajaFisicaId" = t."cajaFisicaId" AND c."tipo" = 'EFECTIVO'
     GROUP BY 1, 2, 3, 4`
  for (const f of filas) {
    const d = acc.get(f.turnoId)
    if (!d) continue
    const importe = new PrismaNs.Decimal(f.total)
    d.totalMovimientos = d.totalMovimientos.plus(importe)
    const entra = importe.isPositive() && !importe.isZero()
    if (f.tipo === "VENTA_COBRO" && entra) d.ventasEfectivo = d.ventasEfectivo.plus(importe)
    else if (f.tipo === "DEVOLUCION_VENTA" && !entra) d.reintegros = d.reintegros.plus(importe.abs())
    else if (f.tipo === "GASTO" && !entra) d.gastos = d.gastos.plus(importe.abs())
    else if (f.tipo === "PAGO_PROVEEDOR" && !entra) d.pagosProveedor = d.pagosProveedor.plus(importe.abs())
    else if (f.tipo === "RETIRO_DUENO" && !entra) d.retirosDueno = d.retirosDueno.plus(importe.abs())
    else if (f.tipo === "REVERSION" && entra && (f.origenTipo === "GASTO" || f.origenTipo === "PAGO_PROVEEDOR" || f.origenTipo === "RETIRO_DUENO")) {
      d.compensaciones = d.compensaciones.plus(importe)
      d.compensacionesPorNaturaleza[f.origenTipo] = d.compensacionesPorNaturaleza[f.origenTipo].plus(importe)
    } else if (entra) d.otrosIngresos = d.otrosIngresos.plus(importe)
    else d.otrasSalidas = d.otrasSalidas.plus(importe.abs())
  }
  return acc
}

/** JSON shape of the breakdown (owner only), with the reconciliation against the expected cash. */
export function desgloseEfectivoParaRespuesta(d: DesgloseEfectivoTurno, fondoInicial: Prisma.Decimal, esperado: Prisma.Decimal | null) {
  const calculado = fondoInicial.plus(d.totalMovimientos)
  const n = (v: Prisma.Decimal) => moneyToNumber(v)
  return {
    fondoInicial: n(fondoInicial),
    ventasEfectivo: n(d.ventasEfectivo),
    reintegros: n(d.reintegros),
    gastos: n(d.gastos),
    pagosProveedor: n(d.pagosProveedor),
    retirosDueno: n(d.retirosDueno),
    compensaciones: n(d.compensaciones),
    compensacionesPorNaturaleza: { GASTO: n(d.compensacionesPorNaturaleza.GASTO), PAGO_PROVEEDOR: n(d.compensacionesPorNaturaleza.PAGO_PROVEEDOR), RETIRO_DUENO: n(d.compensacionesPorNaturaleza.RETIRO_DUENO) },
    otrosIngresos: n(d.otrosIngresos),
    otrasSalidas: n(d.otrasSalidas),
    esperadoCalculado: n(calculado),
    cuadra: esperado ? calculado.equals(esperado) : null,
  }
}

/**
 * F10-C1c — owner's daily summary of cash outflows, by nature, never added into
 * one figure: operating expenses (with category), supplier payments (they settle
 * purchases — F5 links them to receptions, so they are NOT a profitability
 * expense here) and owner withdrawals (not an expense). Compensations registered
 * in the period are reported apart, by the nature of the outflow they reverse.
 */
export async function resumenEgresosDesde(db: Pick<PrismaClient, "egresoCaja" | "compensacionEgresoCaja">, negocioId: string, desde: Date) {
  const [egresos, compensaciones] = await Promise.all([
    db.egresoCaja.findMany({ where: { negocioId, createdAt: { gte: desde } }, select: { naturaleza: true, categoria: true, importeDecimal: true } }),
    db.compensacionEgresoCaja.findMany({ where: { negocioId, createdAt: { gte: desde } }, select: { importeDecimal: true, egreso: { select: { naturaleza: true } } } }),
  ])
  const naturalezas = ["GASTO", "PAGO_PROVEEDOR", "RETIRO_DUENO"] as const
  const porNaturaleza = Object.fromEntries(naturalezas.map((nat) => {
    const propios = egresos.filter((e) => e.naturaleza === nat)
    const comp = compensaciones.filter((c) => c.egreso.naturaleza === nat)
    return [nat, {
      cantidad: propios.length,
      importe: moneyToNumber(addMoney(...propios.map((e) => e.importeDecimal))),
      cantidadCompensaciones: comp.length,
      compensado: moneyToNumber(addMoney(...comp.map((c) => c.importeDecimal))),
    }]
  })) as Record<(typeof naturalezas)[number], { cantidad: number; importe: number; cantidadCompensaciones: number; compensado: number }>
  const categorias = [...new Set(egresos.filter((e) => e.naturaleza === "GASTO" && e.categoria).map((e) => e.categoria!))].sort()
  return {
    ...porNaturaleza,
    gastosPorCategoria: Object.fromEntries(categorias.map((cat) => [cat, moneyToNumber(addMoney(...egresos.filter((e) => e.naturaleza === "GASTO" && e.categoria === cat).map((e) => e.importeDecimal)))])),
  }
}
