// ============================================
// F10-B2.0 — exact money helpers (pure, no DB)
// ============================================
// Decimal comparisons (Decimal.equals / toFixed), never float equality.
import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { computeSaleFromAuthoritativeProducts } from "@/lib/caja-venta"
import {
  addMoney,
  assertMoney,
  compareMoney,
  isMoneyInRange,
  lineSubtotalCaja,
  MONEY_MAX,
  MoneyError,
  moneyEquals,
  moneyToNumber,
  round2,
  saleAmountsExact,
  storedMoney,
  subtractMoney,
  toDecimalExact,
} from "@/lib/money"

const D = (v: string) => new Prisma.Decimal(v)
const legacyRound = (x: number) => Math.round(x * 100) / 100

describe("F10-B2.0 — exact arithmetic", () => {
  test("0.10 + 0.20 = 0.30 exactly (floats give 0.30000000000000004)", () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    const sum = addMoney(round2(0.1), round2(0.2))
    expect(sum.toFixed(2)).toBe("0.30")
    expect(moneyEquals(sum, D("0.30"))).toBe(true)
  })

  test("repeated sum of cents stays exact (1000 × 0.10 = 100.00; floats drift)", () => {
    let floatSum = 0
    for (let i = 0; i < 1000; i++) floatSum += 0.1
    expect(floatSum).not.toBe(100)
    const exact = addMoney(...Array.from({ length: 1000 }, () => round2(0.1)))
    expect(exact.toFixed(2)).toBe("100.00")
  })

  test("subtract / compare are exact", () => {
    expect(subtractMoney(D("100.00"), D("99.99")).toFixed(2)).toBe("0.01")
    expect(compareMoney(D("0.30"), addMoney(D("0.10"), D("0.20")))).toBe(0)
    expect(compareMoney(D("0.31"), D("0.30"))).toBe(1)
    expect(compareMoney(D("-0.01"), D("0"))).toBe(-1)
  })

  test("rounding is ROUND_HALF_UP to 2 decimals on the exact decimal value", () => {
    expect(round2("1.005").toFixed(2)).toBe("1.01")
    expect(round2("2.675").toFixed(2)).toBe("2.68")
    expect(round2("0.004").toFixed(2)).toBe("0.00")
    expect(round2("0.005").toFixed(2)).toBe("0.01")
  })

  test("Caja line rule is bit-for-bit the previous one, even where exact half-up would differ (pending decision)", () => {
    // true half-cent from a FRACTIONAL quantity: legacy float rule 0.14, exact half-up 0.15
    expect(legacyRound(0.29 * 0.5)).toBe(0.14)
    expect(round2(toDecimalExact(0.29).times(0.5)).toFixed(2)).toBe("0.15")
    expect(lineSubtotalCaja(0.29, 0.5).toFixed(2)).toBe("0.14")
    // sub-cent price: legacy 1.00, exact half-up 1.01
    expect(lineSubtotalCaja(1.005, 1).toFixed(2)).toBe("1.00")
    // across fractional quantities the Caja rule always reproduces the old value
    for (let c = 1; c <= 5000; c += 3) for (const q of [0.5, 0.25, 1.5, 2.5, 0.125, 0.75]) {
      expect(moneyToNumber(lineSubtotalCaja(c / 100, q))).toBe(legacyRound((c / 100) * q))
    }
  })

  test("a Float input is read from its shortest decimal form (0.15 → 0.15, not 0.1499999…)", () => {
    expect(toDecimalExact(0.15).toString()).toBe("0.15")
    expect(toDecimalExact(1999.99).toString()).toBe("1999.99")
  })

  test("non-finite and non-numeric values are rejected", () => {
    expect(() => toDecimalExact(Number.NaN)).toThrow(MoneyError)
    expect(() => toDecimalExact(Number.POSITIVE_INFINITY)).toThrow(MoneyError)
    expect(() => toDecimalExact("abc")).toThrow(MoneyError)
    expect(() => lineSubtotalCaja(Number.NaN, 1)).toThrow(MoneyError)
    expect(() => lineSubtotalCaja(1e300, 1e10)).toThrow(MoneyError)
  })

  test("range = NUMERIC(12,2): max 9999999999.99; negatives only when explicitly allowed", () => {
    expect(MONEY_MAX.toFixed(2)).toBe("9999999999.99")
    expect(isMoneyInRange(D("9999999999.99"))).toBe(true)
    expect(isMoneyInRange(D("10000000000.00"))).toBe(false)
    expect(isMoneyInRange(D("-1.00"))).toBe(false)
    expect(isMoneyInRange(D("-1.00"), { allowNegative: true })).toBe(true)
    expect(isMoneyInRange(D("1.001"))).toBe(false)
    expect(() => assertMoney(-5)).toThrow(MoneyError)
    expect(() => assertMoney(9999999999.995)).toThrow(MoneyError)
    expect(assertMoney(-5, { allowNegative: true }).toFixed(2)).toBe("-5.00")
  })

  test("large quantities within range", () => {
    expect(lineSubtotalCaja(9999.99, 100000).toFixed(2)).toBe("999999000.00")
    expect(isMoneyInRange(lineSubtotalCaja(9999999.99, 1000))).toBe(true)
    expect(isMoneyInRange(lineSubtotalCaja(9999999.99, 1001))).toBe(false)
  })
})

describe("F10-B2.0 — sale amounts", () => {
  test("multi-line sale: total = exact sum of rounded subtotals", () => {
    const { subtotales, total } = saleAmountsExact([
      { precio: 0.1, cantidad: 3 },
      { precio: 0.2, cantidad: 1 },
      { precio: 1999.99, cantidad: 2 },
    ])
    expect(subtotales.map((s) => s.toFixed(2))).toEqual(["0.30", "0.20", "3999.98"])
    expect(total.toFixed(2)).toBe("4000.48")
    expect(moneyEquals(total, addMoney(...subtotales))).toBe(true)
  })

  test("for every ≤2-decimal price × integer quantity the Caja rule equals EXACT half-up and the previous float rule", () => {
    let checked = 0
    for (let cents = 1; cents <= 20000; cents += 7) {
      const precio = cents / 100
      for (const cantidad of [1, 2, 3, 7, 10, 13, 99]) {
        const caja = lineSubtotalCaja(precio, cantidad)
        expect(caja.equals(round2(toDecimalExact(precio).times(cantidad)))).toBe(true)
        expect(moneyToNumber(caja)).toBe(legacyRound(precio * cantidad))
        checked++
      }
    }
    expect(checked).toBeGreaterThan(19000)
  })

  test("engine totals: exact total equals computeSaleFromAuthoritativeProducts for cents prices and integer quantities", () => {
    const products = new Map([
      ["a", { nombre: "A", precio: 0.1 }],
      ["b", { nombre: "B", precio: 0.2 }],
      ["c", { nombre: "C", precio: 1234.56, variantes: new Map([["v", { nombre: "1L", precio: 99.99 }]]) }],
    ])
    const computed = computeSaleFromAuthoritativeProducts(
      [
        { productoId: "a", cantidad: 3 },
        { productoId: "b", cantidad: 4 },
        { productoId: "c", cantidad: 2 },
        { productoId: "c", varianteId: "v", cantidad: 5 },
      ],
      products
    )
    if (!computed.ok) throw new Error(computed.error)
    const exact = saleAmountsExact(computed.items)
    expect(moneyToNumber(exact.total)).toBe(computed.total)
    expect(exact.total.toFixed(2)).toBe("2970.17")
  })

  test("read compatibility: Decimal column wins; a legacy Float is quantized to cents", () => {
    expect(storedMoney(D("10.10"), 999).toFixed(2)).toBe("10.10")
    expect(storedMoney(null, 10.1).toFixed(2)).toBe("10.10")
    expect(storedMoney(undefined, 0.30000000000000004).toFixed(2)).toBe("0.30")
  })

  test("transport number keeps the visible format of the exact amount", () => {
    for (const v of ["0.30", "1000.00", "10.10", "9999999999.99", "123.45"]) {
      const n = moneyToNumber(D(v))
      expect(D(String(n)).equals(D(v))).toBe(true)
    }
    expect(JSON.stringify({ total: moneyToNumber(D("0.30")) })).toBe('{"total":0.3}')
  })
})
