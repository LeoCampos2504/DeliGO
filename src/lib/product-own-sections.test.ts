/// <reference types="bun-types" />

// ============================================
// OWN-PRODUCT-OPTION-PRICES-R1 — pure normalizer/validator/formatter tests
// ============================================

import { describe, expect, test } from "bun:test"
import { formatOptionalPriceDelta, normalizeOwnSectionOptions, validateOwnSectionOptionPrice } from "./product-own-sections"

describe("normalizeOwnSectionOptions: legacy backward compatibility", () => {
  test("legacy string[] normalizes to {nombre, precio: 0} for every option — LEGACY_OWN_SECTION_STRING_OPTIONS_SUPPORTED", () => {
    expect(normalizeOwnSectionOptions(["Jugosa", "A punto", "Bien cocida"])).toEqual([
      { nombre: "Jugosa", precio: 0 },
      { nombre: "A punto", precio: 0 },
      { nombre: "Bien cocida", precio: 0 },
    ])
  })

  test("new canonical object[] shape passes through with its real price", () => {
    expect(normalizeOwnSectionOptions([{ nombre: "Individual", precio: 0 }, { nombre: "Familiar", precio: 2500 }])).toEqual([
      { nombre: "Individual", precio: 0 },
      { nombre: "Familiar", precio: 2500 },
    ])
  })

  test("mixed legacy strings and new objects in the same array both normalize correctly (defensive, partial-migration safe)", () => {
    expect(normalizeOwnSectionOptions(["Jugosa", { nombre: "Bien cocida", precio: 0 }])).toEqual([
      { nombre: "Jugosa", precio: 0 },
      { nombre: "Bien cocida", precio: 0 },
    ])
  })

  test("never throws on malformed input — non-array, null, garbage entries", () => {
    expect(normalizeOwnSectionOptions(null)).toEqual([])
    expect(normalizeOwnSectionOptions(undefined)).toEqual([])
    expect(normalizeOwnSectionOptions("not an array")).toEqual([])
    expect(normalizeOwnSectionOptions([123, null, {}, { nombre: "" }, { precio: 500 }])).toEqual([])
  })

  test("negative/NaN/Infinity prices in raw data fall back to 0 on read (save-time validation is a separate function)", () => {
    expect(normalizeOwnSectionOptions([{ nombre: "X", precio: -50 }])).toEqual([{ nombre: "X", precio: 0 }])
    expect(normalizeOwnSectionOptions([{ nombre: "X", precio: NaN }])).toEqual([{ nombre: "X", precio: 0 }])
    expect(normalizeOwnSectionOptions([{ nombre: "X", precio: Infinity }])).toEqual([{ nombre: "X", precio: 0 }])
  })

  test("blank/whitespace-only option names are dropped, never produce an empty-label option", () => {
    expect(normalizeOwnSectionOptions(["", "   ", { nombre: "  ", precio: 100 }])).toEqual([])
  })
})

describe("validateOwnSectionOptionPrice: save-time validation (task §38, §50)", () => {
  test("empty/undefined/null normalizes to 0 (task: 'Empty: normalize to 0')", () => {
    expect(validateOwnSectionOptionPrice(undefined)).toBe(0)
    expect(validateOwnSectionOptionPrice(null)).toBe(0)
    expect(validateOwnSectionOptionPrice("")).toBe(0)
  })

  test("a valid non-negative finite number is accepted as-is", () => {
    expect(validateOwnSectionOptionPrice(0)).toBe(0)
    expect(validateOwnSectionOptionPrice(2500)).toBe(2500)
    expect(validateOwnSectionOptionPrice(0.5)).toBe(0.5)
  })

  test("negative is rejected (returns null)", () => {
    expect(validateOwnSectionOptionPrice(-1)).toBeNull()
    expect(validateOwnSectionOptionPrice(-0.01)).toBeNull()
  })

  test("NaN/Infinity/-Infinity are rejected", () => {
    expect(validateOwnSectionOptionPrice(NaN)).toBeNull()
    expect(validateOwnSectionOptionPrice(Infinity)).toBeNull()
    expect(validateOwnSectionOptionPrice(-Infinity)).toBeNull()
  })

  test("a non-number type (string, object, boolean) is rejected", () => {
    expect(validateOwnSectionOptionPrice("2500")).toBeNull()
    expect(validateOwnSectionOptionPrice({})).toBeNull()
    expect(validateOwnSectionOptionPrice(true)).toBeNull()
  })
})

describe("formatOptionalPriceDelta: zero-price blank contract (task §32-33, non-negotiable)", () => {
  const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`

  test("zero renders exactly an empty string — never 'Gratis', '$0', '+$0'", () => {
    expect(formatOptionalPriceDelta(0, fmt)).toBe("")
  })

  test("a positive price renders a '+' prefix using the caller's formatter", () => {
    expect(formatOptionalPriceDelta(2500, fmt)).toBe("+$2.500")
  })

  test("the blank output never contains any of the forbidden zero-price strings", () => {
    const out = formatOptionalPriceDelta(0, fmt)
    for (const forbidden of ["Gratis", "Sin costo", "$0", "+$0", "0"]) {
      expect(out).not.toContain(forbidden)
    }
  })
})
