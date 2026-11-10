// ============================================
// F4-C2 — money of Caja sales read from the REAL cobros (server only)
// ============================================
// Owner summaries used to group Venta.total by Venta.metodoPago. That is only
// right while every sale has exactly one cobro for its whole total, which is
// how the engine writes them today (D7 of F10). F4-C will add sales paid partly
// with an internal exchange credit, so the money by method must come from the
// cobros actually registered (CobroVenta), never from the sale's summary field.
//
// Rules (codex-reports/F4_C_SALE_EXCHANGES.md §8):
//   - commercial volume = Σ Venta.total (exact) — unchanged;
//   - real money by method = Σ cobros whose method is EFECTIVO / TRANSFERENCIA /
//     OTRO (exact Decimal column, or the legacy Float quantized to cents);
//   - a sale WITHOUT CobroVenta rows (before F10-B0) is read as ONE cobro of its
//     own Venta.metodoPago for its total — the same reading as resolveCobrosVenta;
//   - a cobro of any other method (the future internal exchange credit) is never
//     money: it is reported apart (noDinero) and never added to a method;
//   - each cobro is counted once, and only for the sale it belongs to;
//   - TRANSFERENCIA is the amount DECLARED by whoever sold (CobroVenta
//     estadoConciliacion DECLARADO), never a verified / reconciled credit: the
//     summary does not read the reconciliation state and reports nothing as
//     conciliado (verification arrives with F10-D).
// For every sale written today the result is identical to the former grouping.
// Owner-only: cashier code never imports this module (blind close).

import { Prisma, type CobroVenta, type Venta } from "@prisma/client"
import { addMoney, storedMoney } from "@/lib/money"

export const MEDIOS_DINERO_CAJA = ["EFECTIVO", "TRANSFERENCIA", "OTRO"] as const
export type MedioDineroCaja = (typeof MEDIOS_DINERO_CAJA)[number]

export type CobroParaResumen = Pick<CobroVenta, "metodo" | "importe" | "importeDecimal">
export type VentaParaResumen = Pick<Venta, "metodoPago" | "total" | "totalDecimal"> & {
  /** The sale's CobroVenta rows; empty / absent = sale created before F10-B0. */
  cobros?: ReadonlyArray<CobroParaResumen>
}

/** Prisma select of the cobro fields the summary needs (no ids, no reconciliation state). */
export const COBRO_RESUMEN_SELECT = { metodo: true, importe: true, importeDecimal: true } as const

export interface ResumenCobrosCaja {
  cantidadVentas: number
  /** Commercial volume: Σ Venta.total. */
  ventasBrutas: Prisma.Decimal
  /** Real money received, by method. */
  cobradoPorMedio: Record<MedioDineroCaja, Prisma.Decimal>
  /** Σ cobradoPorMedio. */
  cobradoTotal: Prisma.Decimal
  /** Cobros of a method that is not money (future internal exchange credit). 0 today. */
  noDinero: Prisma.Decimal
  /** Sales read through the pre-F10-B0 fallback (no CobroVenta rows). */
  ventasSinCobros: number
}

const esMedioDinero = (metodo: string): metodo is MedioDineroCaja => (MEDIOS_DINERO_CAJA as readonly string[]).includes(metodo)

/** The cobros of one sale as exact amounts, with the pre-F10-B0 fallback. */
export function cobrosDeVenta(venta: VentaParaResumen): Array<{ metodo: string; importe: Prisma.Decimal; legacy: boolean }> {
  if (venta.cobros && venta.cobros.length > 0) {
    return venta.cobros.map((c) => ({ metodo: c.metodo, importe: storedMoney(c.importeDecimal, c.importe), legacy: false }))
  }
  return [{ metodo: venta.metodoPago, importe: storedMoney(venta.totalDecimal, venta.total), legacy: true }]
}

export function resumirCobrosCaja(ventas: ReadonlyArray<VentaParaResumen>): ResumenCobrosCaja {
  const porMedio: Record<MedioDineroCaja, Prisma.Decimal[]> = { EFECTIVO: [], TRANSFERENCIA: [], OTRO: [] }
  const noDinero: Prisma.Decimal[] = []
  let ventasSinCobros = 0
  for (const venta of ventas) {
    for (const cobro of cobrosDeVenta(venta)) {
      if (cobro.legacy) ventasSinCobros++
      if (esMedioDinero(cobro.metodo)) porMedio[cobro.metodo].push(cobro.importe)
      else noDinero.push(cobro.importe)
    }
  }
  const cobradoPorMedio = {
    EFECTIVO: addMoney(...porMedio.EFECTIVO),
    TRANSFERENCIA: addMoney(...porMedio.TRANSFERENCIA),
    OTRO: addMoney(...porMedio.OTRO),
  }
  return {
    cantidadVentas: ventas.length,
    ventasBrutas: addMoney(...ventas.map((v) => storedMoney(v.totalDecimal, v.total))),
    cobradoPorMedio,
    cobradoTotal: addMoney(cobradoPorMedio.EFECTIVO, cobradoPorMedio.TRANSFERENCIA, cobradoPorMedio.OTRO),
    noDinero: addMoney(...noDinero),
    ventasSinCobros,
  }
}

/** Groups cobro rows (with their ventaId) by sale, for callers that read them in a separate query. */
export function agruparCobrosPorVenta<C extends CobroParaResumen & { ventaId: string }>(cobros: ReadonlyArray<C>): Map<string, C[]> {
  const out = new Map<string, C[]>()
  for (const cobro of cobros) {
    const list = out.get(cobro.ventaId)
    if (list) list.push(cobro)
    else out.set(cobro.ventaId, [cobro])
  }
  return out
}

/** Exact sum of two summaries of the same period (pages): no rounding, only addMoney. */
export function sumarResumenesCobros(a: ResumenCobrosCaja, b: ResumenCobrosCaja): ResumenCobrosCaja {
  const cobradoPorMedio = {
    EFECTIVO: addMoney(a.cobradoPorMedio.EFECTIVO, b.cobradoPorMedio.EFECTIVO),
    TRANSFERENCIA: addMoney(a.cobradoPorMedio.TRANSFERENCIA, b.cobradoPorMedio.TRANSFERENCIA),
    OTRO: addMoney(a.cobradoPorMedio.OTRO, b.cobradoPorMedio.OTRO),
  }
  return {
    cantidadVentas: a.cantidadVentas + b.cantidadVentas,
    ventasBrutas: addMoney(a.ventasBrutas, b.ventasBrutas),
    cobradoPorMedio,
    cobradoTotal: addMoney(cobradoPorMedio.EFECTIVO, cobradoPorMedio.TRANSFERENCIA, cobradoPorMedio.OTRO),
    noDinero: addMoney(a.noDinero, b.noDinero),
    ventasSinCobros: a.ventasSinCobros + b.ventasSinCobros,
  }
}

export const RESUMEN_PAGINA_VENTAS = 1000

/**
 * F4-C5 (B1, operator-authorized 2026-11-10) — the summary of EVERY Caja sale
 * of a business created since `desde`, never truncated by a listing limit.
 * Stable keyset pages ordered by (createdAt, id): each page starts strictly
 * after the last (createdAt, id) read, so ties of createdAt across a page
 * boundary are neither skipped nor repeated. Each page is summarized with the
 * SAME rules (resumirCobrosCaja: cobros read in their own query, legacy sales
 * without cobros through their own metodoPago, non-money cobros apart) and
 * pages are added exactly (sumarResumenesCobros). Memory: one page at a time.
 * Call it inside one REPEATABLE READ transaction for a point-in-time result.
 * Also returns the part of the volume that comes from exchanges (F4-C5 D7).
 */
export async function resumirCobrosCajaDesde(
  db: Pick<Prisma.TransactionClient, "venta" | "cobroVenta">,
  negocioId: string,
  desde: Date,
  opciones: { tamanoPagina?: number } = {}
): Promise<{ resumen: ResumenCobrosCaja; ventasPorCambios: { cantidad: number; importe: Prisma.Decimal } }> {
  const tamano = opciones.tamanoPagina ?? RESUMEN_PAGINA_VENTAS
  let resumen = resumirCobrosCaja([])
  let cambiosCantidad = 0
  let cambiosImporte = addMoney()
  let cursor: { createdAt: Date; id: string } | null = null
  for (;;) {
    const pagina: Array<Pick<Venta, "id" | "createdAt" | "metodoPago" | "total" | "totalDecimal" | "vinculoTipo">> = await db.venta.findMany({
      where: {
        negocioId,
        createdAt: { gte: desde },
        ...(cursor ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] } : {}),
      },
      select: { id: true, createdAt: true, metodoPago: true, total: true, totalDecimal: true, vinculoTipo: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: tamano,
    })
    if (pagina.length === 0) break
    const cobrosPorVenta = agruparCobrosPorVenta(
      await db.cobroVenta.findMany({ where: { negocioId, ventaId: { in: pagina.map((v) => v.id) } }, select: { ventaId: true, ...COBRO_RESUMEN_SELECT } })
    )
    resumen = sumarResumenesCobros(resumen, resumirCobrosCaja(pagina.map((v) => ({ ...v, cobros: cobrosPorVenta.get(v.id) ?? [] }))))
    for (const v of pagina) {
      if (v.vinculoTipo !== "CAMBIO") continue
      cambiosCantidad++
      cambiosImporte = addMoney(cambiosImporte, storedMoney(v.totalDecimal, v.total))
    }
    if (pagina.length < tamano) break
    const ultima = pagina[pagina.length - 1]
    cursor = { createdAt: ultima.createdAt, id: ultima.id }
  }
  return { resumen, ventasPorCambios: { cantidad: cambiosCantidad, importe: cambiosImporte } }
}
