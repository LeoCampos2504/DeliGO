// ============================================
// F10-B2.0 — idempotent backfill of the exact money columns (server only)
// ============================================
// Same rule as migration 20261010120000_f10_b2_0_money_decimal_columns:
// *Decimal = ROUND(float::numeric, 2), only where the Decimal is NULL and the
// value fits NUMERIC(12,2). Float columns are never touched. Needed after a
// deploy: rows written by the previous code between `migrate deploy` and the
// new code taking traffic have NULL Decimals. Values out of range stay NULL
// and are REPORTED (never corrected silently).
// Identifiers below are fixed constants (never user input). `negocioIds`
// scopes the run to specific businesses (tests); omitted = all rows.

import type { PrismaClient } from "@prisma/client"

type RawDb = Pick<PrismaClient, "$queryRawUnsafe" | "$executeRawUnsafe">

export const MONEY_BACKFILL_TARGETS = [
  { table: "ventas_caja", float: "total", decimal: "totalDecimal", scope: `"negocioId" = ANY($1::text[])` },
  { table: "venta_items", float: "subtotal", decimal: "subtotalDecimal", scope: `"ventaId" IN (SELECT id FROM "ventas_caja" WHERE "negocioId" = ANY($1::text[]))` },
  { table: "cobros_venta", float: "importe", decimal: "importeDecimal", scope: `"negocioId" = ANY($1::text[])` },
  { table: "movimientos_financieros", float: "importe", decimal: "importeDecimal", scope: `"negocioId" = ANY($1::text[])` },
] as const

const IN_RANGE = (col: string) => `abs("${col}") < 9999999999.995`

export interface MoneyBackfillTableReport {
  table: string
  pendientes: number
  fueraDeRango: number
  actualizadas?: number
}

function scopeSql(target: (typeof MONEY_BACKFILL_TARGETS)[number], negocioIds?: string[]) {
  return negocioIds ? ` AND ${target.scope}` : ""
}

/** Read-only: NULL Decimals that the backfill would fill, and the ones it would leave NULL (out of range). */
export async function reportarMoneyBackfill(db: RawDb, negocioIds?: string[]): Promise<MoneyBackfillTableReport[]> {
  const out: MoneyBackfillTableReport[] = []
  for (const t of MONEY_BACKFILL_TARGETS) {
    const params = negocioIds ? [negocioIds] : []
    const rows = await db.$queryRawUnsafe<Array<{ pendientes: number; fuera: number }>>(
      `SELECT COUNT(*) FILTER (WHERE ${IN_RANGE(t.float)})::int AS pendientes,
              COUNT(*) FILTER (WHERE NOT (${IN_RANGE(t.float)}))::int AS fuera
         FROM "${t.table}" WHERE "${t.decimal}" IS NULL${scopeSql(t, negocioIds)}`,
      ...params
    )
    out.push({ table: t.table, pendientes: rows[0].pendientes, fueraDeRango: rows[0].fuera })
  }
  return out
}

/** Fills NULL Decimals with ROUND(float::numeric, 2). Idempotent; never touches Float columns. */
export async function ejecutarMoneyBackfill(db: RawDb, negocioIds?: string[]): Promise<MoneyBackfillTableReport[]> {
  const before = await reportarMoneyBackfill(db, negocioIds)
  const out: MoneyBackfillTableReport[] = []
  for (const [i, t] of MONEY_BACKFILL_TARGETS.entries()) {
    const params = negocioIds ? [negocioIds] : []
    const updated = await db.$executeRawUnsafe(
      `UPDATE "${t.table}" SET "${t.decimal}" = ROUND("${t.float}"::numeric, 2)
        WHERE "${t.decimal}" IS NULL AND ${IN_RANGE(t.float)}${scopeSql(t, negocioIds)}`,
      ...params
    )
    out.push({ ...before[i], actualizadas: updated })
  }
  return out
}
