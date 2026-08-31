/// <reference types="bun-types" />

// ============================================
// OWN-PRODUCT-OPTION-PRICES-R1 §48-51 — server-authoritative pricing tests
// ============================================
// Direct unit tests of validateAndPriceProductSections — pure, no
// database required (unlike src/app/api/pedidos/route.test.ts, which
// exercises the full POST handler against a live DATABASE_URL).

import { describe, expect, test } from "bun:test"
import { validateAndPriceProductSections, type OwnSection } from "./product-own-sections"

const PIZZA_TAMANO: OwnSection = {
  nombre: "Tamaño",
  obligatorio: true,
  maximo: 0,
  opciones: [
    { nombre: "Individual", precio: 0 },
    { nombre: "Familiar", precio: 2500 },
  ],
}

const PUNTO_COCCION_LEGACY_STYLE: OwnSection = {
  nombre: "Punto de cocción",
  obligatorio: false,
  maximo: 0,
  opciones: [
    { nombre: "Jugosa", precio: 0 },
    { nombre: "A punto", precio: 0 },
    { nombre: "Bien cocida", precio: 0 },
  ],
}

const SALSA_EXTRA_MULTI: OwnSection = {
  nombre: "Salsas",
  obligatorio: false,
  maximo: 3,
  opciones: [{ nombre: "Salsa extra", precio: 300 }],
}

describe("§56: single priced own section — base + delta", () => {
  test("selecting the zero-price option contributes no delta", () => {
    const result = validateAndPriceProductSections({ Tamaño: "Individual" }, [PIZZA_TAMANO])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.seccionesTotal).toBe(0)
    expect(result.value.seccionesPrecios).toEqual({})
  })

  test("selecting the positive-price option contributes exactly that delta, keyed sectionName::optionName", () => {
    const result = validateAndPriceProductSections({ Tamaño: "Familiar" }, [PIZZA_TAMANO])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.seccionesTotal).toBe(2500)
    expect(result.value.seccionesPrecios).toEqual({ "Tamaño::Familiar": 2500 })
  })
})

describe("§55: legacy string-option sections — every delta is 0", () => {
  test("all-zero-price legacy section produces zero total regardless of selection", () => {
    const result = validateAndPriceProductSections({ "Punto de cocción": "A punto" }, [PUNTO_COCCION_LEGACY_STYLE])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.seccionesTotal).toBe(0)
    expect(result.value.seccionesPrecios).toEqual({})
  })
})

describe("§57: multi-select / quantity — price * quantity", () => {
  test("selecting a priced option with quantity 2 multiplies the delta", () => {
    const result = validateAndPriceProductSections({ Salsas: { "Salsa extra": 2 } }, [SALSA_EXTRA_MULTI])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.seccionesTotal).toBe(600)
    expect(result.value.seccionesPrecios).toEqual({ "Salsas::Salsa extra": 600 })
  })

  test("quantity exceeding maximo is rejected — pricing rules never relax the existing selection-limit rules", () => {
    const result = validateAndPriceProductSections({ Salsas: { "Salsa extra": 4 } }, [SALSA_EXTRA_MULTI])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("Seleccion de seccion excede el maximo permitido")
  })
})

describe("§49: invalid selection is rejected — INVALID_OWN_OPTION_SELECTION_REJECTED", () => {
  test("an option name that doesn't exist in the stored section is rejected", () => {
    const result = validateAndPriceProductSections({ Tamaño: "Extra Grande" }, [PIZZA_TAMANO])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("Opcion de producto invalida")
  })

  test("a section name that doesn't exist on the product is rejected", () => {
    const result = validateAndPriceProductSections({ "Sección inventada": "X" }, [PIZZA_TAMANO])
    expect(result.ok).toBe(false)
  })

  test("obligatorio with nothing selected is rejected", () => {
    const result = validateAndPriceProductSections({}, [PIZZA_TAMANO])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe("Falta seleccionar una opcion obligatoria")
  })
})

describe("§48: CLIENT_SUPPLIED_OWN_OPTION_PRICE_TRUSTED=NO — the price always comes from `sections`, never from `selected`", () => {
  test("even if the caller's `selected` object were to carry an extra 'precio' field alongside the option name, it is never read — price is looked up in the stored section by name only", () => {
    // `selected` here is exactly the shape validateSecciones() in
    // pedidos/route.ts produces (option name -> quantity, or a plain
    // string) — there is no field for the client to smuggle a price into
    // in the first place. This test documents that contract: passing a
    // legitimate selection against a DIFFERENT sections array (as if the
    // product's real price were different) changes the result — proving
    // the price is resolved from `sections`, not from anything client-side.
    const cheapVariant: OwnSection = { ...PIZZA_TAMANO, opciones: [{ nombre: "Familiar", precio: 1 }] }
    const result = validateAndPriceProductSections({ Tamaño: "Familiar" }, [cheapVariant])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.seccionesTotal).toBe(1)
  })
})

describe("normalized selection output never includes an option with zero total selected", () => {
  test("a multi-select with all quantities effectively zero (empty object) is dropped from normalized", () => {
    const result = validateAndPriceProductSections({ Salsas: {} }, [SALSA_EXTRA_MULTI])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.normalized).toEqual({})
  })
})
