/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import {
  matchesInventorySearch,
  matchesCajaSearch,
  findMatchingVariante,
  type SearchableProducto,
} from "@/lib/product-variant-search"

function cocaCola(overrides: Partial<SearchableProducto> = {}): SearchableProducto {
  return {
    nombre: "Coca Cola",
    marca: null,
    sku: "COCA",
    codigoBarras: "BASE123",
    variantes: [
      { nombre: "500 ml", sku: "COC500", codigoBarras: "779111", activo: true },
      { nombre: "1,5 L", sku: "COC1500", codigoBarras: "779222", activo: true },
    ],
    ...overrides,
  }
}

describe("matchesInventorySearch — section 19 minimum cases", () => {
  const producto = cocaCola()
  const cases: Array<[string, boolean]> = [
    ["Coca", true],
    ["COCA", true],
    ["500", true],
    ["500 ml", true],
    ["coc500", true],
    ["COC1500", true],
    ["779111", true],
    ["779222", true],
    ["inexistente", false],
  ]
  for (const [term, expected] of cases) {
    test(`"${term}" -> ${expected ? "match" : "no match"}`, () => {
      expect(matchesInventorySearch(producto, term)).toBe(expected)
    })
  }

  test("empty/whitespace term always matches (no filter applied)", () => {
    expect(matchesInventorySearch(producto, "")).toBe(true)
    expect(matchesInventorySearch(producto, "   ")).toBe(true)
  })

  test("matches by base marca", () => {
    const conMarca = cocaCola({ marca: "The Coca-Cola Company" })
    expect(matchesInventorySearch(conMarca, "coca-cola company")).toBe(true)
  })

  test("matches an INACTIVE variant (admin still needs to find/manage it)", () => {
    const conInactiva = cocaCola({
      variantes: [{ nombre: "Descontinuada", sku: "OLD1", codigoBarras: "000", activo: false }],
    })
    expect(matchesInventorySearch(conInactiva, "OLD1")).toBe(true)
    expect(matchesInventorySearch(conInactiva, "descontinuada")).toBe(true)
  })

  test("producto sin variantes: sigue funcionando exactamente igual (regresión)", () => {
    const sinVariantes = cocaCola({ variantes: [] })
    expect(matchesInventorySearch(sinVariantes, "Coca")).toBe(true)
    expect(matchesInventorySearch(sinVariantes, "COCA")).toBe(true)
    expect(matchesInventorySearch(sinVariantes, "BASE123")).toBe(true)
    expect(matchesInventorySearch(sinVariantes, "inexistente")).toBe(false)
  })

  test("whitespace/case are normalized consistently on both sides", () => {
    expect(matchesInventorySearch(producto, "  coc500  ")).toBe(true)
    const espaciado = cocaCola({ sku: "  COCA  " })
    expect(matchesInventorySearch(espaciado, "coca")).toBe(true)
  })

  test("barcode-looking numeric strings are compared as text, never parsed", () => {
    const conCeroInicial = cocaCola({
      variantes: [{ nombre: "X", sku: null, codigoBarras: "0079111", activo: true }],
    })
    expect(matchesInventorySearch(conCeroInicial, "0079111")).toBe(true)
    // A numeric-coercion bug would treat "0079111" and "79111" as the same
    // number; substring matching must not conflate them.
    expect(matchesInventorySearch(conCeroInicial, "79111")).toBe(true) // still a valid substring match
    expect(matchesInventorySearch(conCeroInicial, "0079112")).toBe(false)
  })
})

describe("matchesCajaSearch — variant sellability policy (section 9/10)", () => {
  test("matches an ACTIVE variant", () => {
    expect(matchesCajaSearch(cocaCola(), "500 ml")).toBe(true)
  })

  test("does NOT match a product exclusively via an INACTIVE variant", () => {
    const conInactiva = cocaCola({
      variantes: [{ nombre: "Descontinuada", sku: "OLD1", codigoBarras: "000", activo: false }],
    })
    expect(matchesCajaSearch(conInactiva, "OLD1")).toBe(false)
    expect(matchesCajaSearch(conInactiva, "descontinuada")).toBe(false)
  })

  test("base-product fields still match even when the only variant is inactive", () => {
    const conInactiva = cocaCola({
      variantes: [{ nombre: "Descontinuada", sku: "OLD1", codigoBarras: "000", activo: false }],
    })
    expect(matchesCajaSearch(conInactiva, "Coca")).toBe(true)
  })

  test("a variant WITHOUT stock still matches search — search never changes sellability (section 10)", () => {
    // matchesCajaSearch has no notion of stock at all — activo is the only
    // gate, stock disabling remains the selector's own concern.
    expect(matchesCajaSearch(cocaCola(), "1,5 L")).toBe(true)
  })

  test("producto sin variantes: sigue funcionando exactamente igual (regresión)", () => {
    const sinVariantes = cocaCola({ variantes: [] })
    expect(matchesCajaSearch(sinVariantes, "Coca")).toBe(true)
    expect(matchesCajaSearch(sinVariantes, "inexistente")).toBe(false)
  })
})

describe("findMatchingVariante — section 4 'Coincide: X' hint", () => {
  test("returns the matching variant when the term only matched a variant", () => {
    const match = findMatchingVariante(cocaCola(), "500 ml")
    expect(match?.nombre).toBe("500 ml")
  })

  test("returns null when the term matched a base field (no variant to highlight)", () => {
    expect(findMatchingVariante(cocaCola(), "Coca")).toBeNull()
  })

  test("returns null for an empty term", () => {
    expect(findMatchingVariante(cocaCola(), "")).toBeNull()
  })

  test("returns null for no match at all", () => {
    expect(findMatchingVariante(cocaCola(), "inexistente")).toBeNull()
  })

  test("allowInactive:false excludes inactive variants from the hint (Caja policy)", () => {
    const conInactiva = cocaCola({
      variantes: [{ nombre: "Descontinuada", sku: "OLD1", codigoBarras: "000", activo: false }],
    })
    expect(findMatchingVariante(conInactiva, "OLD1", { allowInactive: false })).toBeNull()
    expect(findMatchingVariante(conInactiva, "OLD1", { allowInactive: true })?.nombre).toBe("Descontinuada")
  })
})
