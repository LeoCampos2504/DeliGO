import { describe, expect, test } from "bun:test"
import { normalizarDestinoNombre, normalizarNotaEntrega, parseImporteCustodia } from "./caja-turnos-entrega"

describe("F10-B2.2-E — exact custody input validation", () => {
  test("accepts exact cents, zero, and large supported amounts without float arithmetic", () => {
    expect(parseImporteCustodia("0")?.toFixed(2)).toBe("0.00")
    expect(parseImporteCustodia("9999999999.99")?.toFixed(2)).toBe("9999999999.99")
    expect(parseImporteCustodia("12.30")?.toFixed(2)).toBe("12.30")
    expect(parseImporteCustodia("12.3")?.toFixed(2)).toBe("12.30")
  })

  test("rejects negative, over-precision, exponent, non-string, and out-of-range inputs", () => {
    for (const invalid of ["-0.01", ".50", "1.", "1.001", "1e2", "NaN", "10000000000.00", 1.25, null]) {
      expect(parseImporteCustodia(invalid)).toBeNull()
    }
  })

  test("normalizes custody destinations and notes within bounds", () => {
    expect(normalizarDestinoNombre("  caja fuerte  ")).toBe("caja fuerte")
    expect(normalizarDestinoNombre("   ")).toBeUndefined()
    expect(normalizarDestinoNombre("x".repeat(121))).toBeUndefined()
    expect(normalizarNotaEntrega("  recibido  ")).toBe("recibido")
    expect(normalizarNotaEntrega("x".repeat(1001))).toBeUndefined()
  })
})

