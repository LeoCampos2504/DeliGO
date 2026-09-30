/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import {
  isVarianteDisponible,
  isProductoConVariantesDisponible,
  precioDesdeVariantes,
  resolveSingleActiveVariant,
  type ClientProductoVariante,
} from "@/lib/client-product-variants"

function v(overrides: Partial<ClientProductoVariante>): ClientProductoVariante {
  return {
    id: "v1",
    nombre: "500 ml",
    precio: 2000,
    controlStock: false,
    stockCantidad: 0,
    ...overrides,
  }
}

describe("isVarianteDisponible", () => {
  test("uncontrolled stock is always available", () => {
    expect(isVarianteDisponible(v({ controlStock: false, stockCantidad: 0 }))).toBe(true)
  })
  test("controlled stock > 0 is available", () => {
    expect(isVarianteDisponible(v({ controlStock: true, stockCantidad: 5 }))).toBe(true)
  })
  test("controlled stock at 0 is not available", () => {
    expect(isVarianteDisponible(v({ controlStock: true, stockCantidad: 0 }))).toBe(false)
  })
  test("controlled negative stock is not available", () => {
    expect(isVarianteDisponible(v({ controlStock: true, stockCantidad: -1 }))).toBe(false)
  })
})

describe("isProductoConVariantesDisponible", () => {
  test("no active variants -> unavailable", () => {
    expect(isProductoConVariantesDisponible([])).toBe(false)
  })
  test("one depleted variant among several available -> product still available", () => {
    const variantes = [
      v({ id: "a", controlStock: true, stockCantidad: 0 }),
      v({ id: "b", controlStock: true, stockCantidad: 3 }),
    ]
    expect(isProductoConVariantesDisponible(variantes)).toBe(true)
  })
  test("every active variant depleted -> unavailable", () => {
    const variantes = [
      v({ id: "a", controlStock: true, stockCantidad: 0 }),
      v({ id: "b", controlStock: true, stockCantidad: 0 }),
    ]
    expect(isProductoConVariantesDisponible(variantes)).toBe(false)
  })
  test("uncontrolled variants are always available regardless of count", () => {
    const variantes = [v({ id: "a", controlStock: false }), v({ id: "b", controlStock: false })]
    expect(isProductoConVariantesDisponible(variantes)).toBe(true)
  })
})

describe("precioDesdeVariantes", () => {
  test("no variants -> null", () => {
    expect(precioDesdeVariantes([])).toBeNull()
  })
  test("returns the minimum price across variants", () => {
    const variantes = [
      v({ id: "a", precio: 4500 }),
      v({ id: "b", precio: 2000 }),
      v({ id: "c", precio: 3200 }),
    ]
    expect(precioDesdeVariantes(variantes)).toBe(2000)
  })
  test("single variant -> its own price", () => {
    expect(precioDesdeVariantes([v({ precio: 2500 })])).toBe(2500)
  })
})

describe("resolveSingleActiveVariant", () => {
  test("exactly one active variant -> returns it", () => {
    const only = v({ id: "only" })
    expect(resolveSingleActiveVariant([only])).toBe(only)
  })
  test("zero active variants -> null", () => {
    expect(resolveSingleActiveVariant([])).toBeNull()
  })
  test("more than one active variant -> null (no auto-select)", () => {
    expect(resolveSingleActiveVariant([v({ id: "a" }), v({ id: "b" })])).toBeNull()
  })
})
