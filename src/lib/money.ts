// ============================================
// F10-B2.0 — exact money (server only)
// ============================================
// Money amounts that are ADDED, SUBTRACTED or COMPARED (sale totals, line
// subtotals, cobros, ledger legs, and later expected cash / blind-close
// differences / transfers) are computed with decimal arithmetic — never by
// summing JavaScript floats. Representation: Prisma.Decimal (decimal.js) in
// memory, PostgreSQL NUMERIC(12,2) at rest (the *Decimal columns added by
// migration 20261010120000_f10_b2_0_money_decimal_columns).
//
// Rounding rules:
//   - Quantizing a stored/legacy amount (round2): 2 decimals ROUND_HALF_UP.
//   - Caja LINE subtotal (lineSubtotalCaja): EXACTLY the rule Caja always had,
//     Math.round(precio × cantidad × 100) / 100, returned as an exact Decimal.
//     For every price with ≤ 2 decimals and integer quantity (all historical
//     data and the supported catalog) this equals exact half-up rounding
//     (proved in money.test.ts). It differs by one cent only on true
//     half-cent results from FRACTIONAL quantities or sub-cent prices
//     (e.g. 0.29 × 0.5: legacy 0.14, exact half-up 0.15). Changing that would
//     be a commercial rounding decision (selling by weight, F1, is not an
//     approved feature) — kept as before, recorded as a pending decision.
//   - Everything after the line (sale total, cobros, ledger legs, future
//     expected cash / differences / transfers) is EXACT decimal arithmetic:
//     the total is the exact sum of the line subtotals.
//
// Source of a Float value: its shortest round-trip decimal string (what
// String(number) prints, e.g. 0.15 → "0.15") — the value the merchant typed.
// Converting an old Float to Decimal does NOT recover precision that was
// never stored; the quantization point for stored Float amounts is
// round2() here (and ROUND(x::numeric, 2) in the backfill).
//
// This module is NOT imported by client code (the browser cart keeps its
// display-only float helpers in caja-venta.ts; the server is the authority).

import { Prisma } from "@prisma/client"

export type Money = Prisma.Decimal
export const MONEY_SCALE = 2
/** Largest value NUMERIC(12,2) can hold. */
export const MONEY_MAX = new Prisma.Decimal("9999999999.99")
const HALF_UP = Prisma.Decimal.ROUND_HALF_UP

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MoneyError"
  }
}

/** Exact decimal of a finite number / numeric string / Decimal. Rejects NaN, ±Infinity and non-numeric input. */
export function toDecimalExact(value: number | string | Prisma.Decimal): Prisma.Decimal {
  if (typeof value === "number" && !Number.isFinite(value)) throw new MoneyError("Importe no finito")
  let d: Prisma.Decimal
  try {
    d = new Prisma.Decimal(value)
  } catch {
    throw new MoneyError("Importe inválido")
  }
  if (!d.isFinite()) throw new MoneyError("Importe no finito")
  return d
}

/** Quantizes to cents, ROUND_HALF_UP. */
export function round2(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return toDecimalExact(value).toDecimalPlaces(MONEY_SCALE, HALF_UP)
}

export function isMoneyInRange(value: Prisma.Decimal, opts: { allowNegative?: boolean } = {}): boolean {
  if (!value.isFinite() || value.decimalPlaces() > MONEY_SCALE) return false
  if (!opts.allowNegative && value.isNegative() && !value.isZero()) return false
  return value.abs().lte(MONEY_MAX)
}

/** Validated cents amount; throws MoneyError when out of NUMERIC(12,2) range, negative (unless allowed) or not finite. */
export function assertMoney(value: number | string | Prisma.Decimal, opts: { allowNegative?: boolean } = {}): Prisma.Decimal {
  const d = round2(value)
  if (!isMoneyInRange(d, opts)) throw new MoneyError("Importe fuera de rango")
  return d
}

export function addMoney(...values: ReadonlyArray<Prisma.Decimal>): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(v), new Prisma.Decimal(0))
}

export function subtractMoney(a: Prisma.Decimal, b: Prisma.Decimal): Prisma.Decimal {
  return a.minus(b)
}

export function moneyEquals(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.equals(b)
}

export function compareMoney(a: Prisma.Decimal, b: Prisma.Decimal): -1 | 0 | 1 {
  return a.comparedTo(b) as -1 | 0 | 1
}

/**
 * Caja line subtotal — bit-for-bit the pre-F10-B2.0 rule
 * (Math.round(precio × cantidad × 100) / 100), as an exact Decimal of cents.
 */
export function lineSubtotalCaja(precio: number, cantidad: number): Prisma.Decimal {
  if (!Number.isFinite(precio) || !Number.isFinite(cantidad)) throw new MoneyError("Importe no finito")
  const cents = Math.round(precio * cantidad * 100)
  if (!Number.isSafeInteger(cents)) throw new MoneyError("Importe fuera de rango")
  return new Prisma.Decimal(cents).dividedBy(100)
}

export interface SaleAmountsExact {
  subtotales: Prisma.Decimal[]
  total: Prisma.Decimal
}

/** Line subtotals (Caja rule) + exact total (= exact sum of the subtotals) for a resolved sale. */
export function saleAmountsExact(lines: ReadonlyArray<{ precio: number; cantidad: number }>): SaleAmountsExact {
  const subtotales = lines.map((l) => lineSubtotalCaja(l.precio, l.cantidad))
  return { subtotales, total: addMoney(...subtotales) }
}

/**
 * Read compatibility: the exact amount of a stored row — its *Decimal column
 * when present, otherwise its legacy Float quantized to cents (rows written
 * before the backfill or by a pre-F10-B2.0 deploy).
 */
export function storedMoney(decimal: Prisma.Decimal | null | undefined, legacyFloat: number): Prisma.Decimal {
  return decimal ?? round2(legacyFloat)
}

/**
 * Transport form for the existing JSON contracts (they carry numbers): the
 * closest double, whose shortest decimal form is exactly the 2-decimal
 * amount (e.g. 10.1 → 10.1, 1000 → 1000). Never used for arithmetic.
 */
export function moneyToNumber(value: Prisma.Decimal): number {
  return value.toNumber()
}
