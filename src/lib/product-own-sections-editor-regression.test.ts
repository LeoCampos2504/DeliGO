/// <reference types="bun-types" />

// ============================================
// OWN-PRODUCT-OPTIONS-REGRESSION-FIX-R1 — editor + save regression tests
// ============================================
// Reproduces the exact editor state cycle (parse -> normalize -> mutate
// -> stringify -> re-normalize) that ProductOptionSectionsEditor runs on
// every "Agregar opción" / name edit / price edit / remove, using the
// same pure functions the component itself calls — no React, no DOM,
// directly proving the regression is fixed at its root.

import { describe, expect, test } from "bun:test"
import {
  normalizeOwnSectionOptionsForEditor,
  validateOwnSectionOptionPrice,
  validateProductSectionsForSave,
  type OwnSectionOption,
} from "./product-own-sections"

// ---------------------------------------------------------------------------
// Minimal stand-in for ProductOptionSectionsEditor's own state cycle —
// mirrors addOption/updateOption/updateOptionPrice/removeOption exactly.
// ---------------------------------------------------------------------------
interface EditorSection {
  nombre: string
  opciones: OwnSectionOption[]
  obligatorio: boolean
  maximo: number
}

function computeSections(secciones: string): EditorSection[] {
  const parsed = JSON.parse(secciones)
  if (!Array.isArray(parsed)) return []
  return parsed.map((s: Record<string, unknown>) => ({
    nombre: typeof s?.nombre === "string" ? s.nombre : String(s ?? ""),
    opciones: normalizeOwnSectionOptionsForEditor(s?.opciones),
    obligatorio: s?.obligatorio === true,
    maximo: typeof s?.maximo === "number" ? s.maximo : 0,
  }))
}

function addOption(secciones: string, sectionIndex: number): string {
  const sections = computeSections(secciones)
  const updated = [...sections]
  updated[sectionIndex] = { ...updated[sectionIndex], opciones: [...updated[sectionIndex].opciones, { nombre: "", precio: 0 }] }
  return JSON.stringify(updated)
}

function updateOptionName(secciones: string, sectionIndex: number, optionIndex: number, value: string): string {
  const sections = computeSections(secciones)
  const updated = [...sections]
  const opts = [...updated[sectionIndex].opciones]
  opts[optionIndex] = { ...opts[optionIndex], nombre: value }
  updated[sectionIndex] = { ...updated[sectionIndex], opciones: opts }
  return JSON.stringify(updated)
}

function updateOptionPrice(secciones: string, sectionIndex: number, optionIndex: number, rawValue: string): string {
  const sections = computeSections(secciones)
  const parsed = rawValue.trim() === "" ? 0 : parseFloat(rawValue)
  const validated = validateOwnSectionOptionPrice(parsed)
  if (validated === null) return secciones
  const updated = [...sections]
  const opts = [...updated[sectionIndex].opciones]
  opts[optionIndex] = { ...opts[optionIndex], precio: validated }
  updated[sectionIndex] = { ...updated[sectionIndex], opciones: opts }
  return JSON.stringify(updated)
}

function removeOption(secciones: string, sectionIndex: number, optionIndex: number): string {
  const sections = computeSections(secciones)
  const updated = [...sections]
  updated[sectionIndex] = { ...updated[sectionIndex], opciones: updated[sectionIndex].opciones.filter((_, i) => i !== optionIndex) }
  return JSON.stringify(updated)
}

const oneSectionOneOption = JSON.stringify([
  { nombre: "Tamaño", opciones: [{ nombre: "Individual", precio: 0 }], obligatorio: true, maximo: 0 },
])

// ============================================
// §31: Add Option — canonical section with one option
// ============================================
describe("§31: Add Option restores a visible new row", () => {
  test("clicking Agregar opción goes from 1 option to 2 — the new row survives the next render's normalization (the exact regression)", () => {
    const after = addOption(oneSectionOneOption, 0)
    const sections = computeSections(after)
    expect(sections[0].opciones.length).toBe(2)
  })

  test("the new option starts as {nombre: '', precio: 0}", () => {
    const after = addOption(oneSectionOneOption, 0)
    const sections = computeSections(after)
    expect(sections[0].opciones[1]).toEqual({ nombre: "", precio: 0 })
  })

  test("the first option is never corrupted by adding a second", () => {
    const after = addOption(oneSectionOneOption, 0)
    const sections = computeSections(after)
    expect(sections[0].opciones[0]).toEqual({ nombre: "Individual", precio: 0 })
  })

  test("no API call is implied by adding a local row — this is pure client state (the function returns a JSON string, nothing is sent anywhere)", () => {
    const after = addOption(oneSectionOneOption, 0)
    expect(typeof after).toBe("string")
    expect(() => JSON.parse(after)).not.toThrow()
  })
})

// ============================================
// §32: Repeated Add Option
// ============================================
describe("§32: repeated Add Option produces stable, independent rows", () => {
  test("adding 3 times yields 4 total options (1 existing + 3 new), each independently editable", () => {
    let secciones = oneSectionOneOption
    secciones = addOption(secciones, 0)
    secciones = addOption(secciones, 0)
    secciones = addOption(secciones, 0)
    const sections = computeSections(secciones)
    expect(sections[0].opciones.length).toBe(4)
    expect(sections[0].opciones.map((o) => o.nombre)).toEqual(["Individual", "", "", ""])
  })

  test("no shared-object-reference bug: naming the second blank row never renames the third", () => {
    let secciones = oneSectionOneOption
    secciones = addOption(secciones, 0)
    secciones = addOption(secciones, 0)
    secciones = updateOptionName(secciones, 0, 1, "Familiar")
    const sections = computeSections(secciones)
    expect(sections[0].opciones[1].nombre).toBe("Familiar")
    expect(sections[0].opciones[2].nombre).toBe("") // untouched
  })

  test("each row's price is independently editable after repeated adds", () => {
    let secciones = oneSectionOneOption
    secciones = addOption(secciones, 0)
    secciones = addOption(secciones, 0)
    secciones = updateOptionName(secciones, 0, 1, "Familiar")
    secciones = updateOptionPrice(secciones, 0, 1, "2500")
    secciones = updateOptionName(secciones, 0, 2, "Super")
    secciones = updateOptionPrice(secciones, 0, 2, "5000")
    const sections = computeSections(secciones)
    expect(sections[0].opciones).toEqual([
      { nombre: "Individual", precio: 0 },
      { nombre: "Familiar", precio: 2500 },
      { nombre: "Super", precio: 5000 },
    ])
  })
})

// ============================================
// Name edit / price edit isolation
// ============================================
describe("OWN_OPTION_NAME_EDIT_PASS / OWN_OPTION_PRICE_EDIT_PASS", () => {
  test("editing an option's name preserves its price, obligatorio, maximo, and every other option untouched", () => {
    const twoOptions = JSON.stringify([
      { nombre: "Tamaño", opciones: [{ nombre: "Individual", precio: 0 }, { nombre: "Grande", precio: 1000 }], obligatorio: true, maximo: 2 },
    ])
    const after = updateOptionName(twoOptions, 0, 1, "Familiar")
    const sections = computeSections(after)
    expect(sections[0].opciones).toEqual([
      { nombre: "Individual", precio: 0 },
      { nombre: "Familiar", precio: 1000 },
    ])
    expect(sections[0].obligatorio).toBe(true)
    expect(sections[0].maximo).toBe(2)
  })

  test("editing an option's price preserves its name and every other option", () => {
    const twoOptions = JSON.stringify([
      { nombre: "Tamaño", opciones: [{ nombre: "Individual", precio: 0 }, { nombre: "Familiar", precio: 1000 }], obligatorio: false, maximo: 0 },
    ])
    const after = updateOptionPrice(twoOptions, 0, 1, "2500")
    const sections = computeSections(after)
    expect(sections[0].opciones).toEqual([
      { nombre: "Individual", precio: 0 },
      { nombre: "Familiar", precio: 2500 },
    ])
  })

  test("an empty price input normalizes to 0 (task §8)", () => {
    const after = updateOptionPrice(oneSectionOneOption, 0, 0, "")
    const sections = computeSections(after)
    expect(sections[0].opciones[0].precio).toBe(0)
  })

  test("a negative price input is rejected — the option keeps its previous price, state is unchanged", () => {
    const withPrice = updateOptionPrice(oneSectionOneOption, 0, 0, "500")
    const after = updateOptionPrice(withPrice, 0, 0, "-5")
    expect(after).toBe(withPrice) // rejected, no-op
  })
})

// ============================================
// §9 / §22: Remove Option
// ============================================
describe("Remove Option (OWN_OPTION_REMOVE_PASS)", () => {
  test("removing the middle option of three leaves the other two intact with correct prices (task §22 exact scenario)", () => {
    const salsas = JSON.stringify([
      {
        nombre: "Salsas",
        opciones: [
          { nombre: "Mayonesa", precio: 0 },
          { nombre: "Barbacoa", precio: 300 },
          { nombre: "Cheddar", precio: 500 },
        ],
        obligatorio: false,
        maximo: 3,
      },
    ])
    const after = removeOption(salsas, 0, 1) // remove Barbacoa
    const sections = computeSections(after)
    expect(sections[0].opciones).toEqual([
      { nombre: "Mayonesa", precio: 0 },
      { nombre: "Cheddar", precio: 500 },
    ])
  })
})

// ============================================
// §33 / §11: Create and Update save paths with own options
// ============================================
describe("CREATE_WITH_OWN_OPTIONS_PASS / UPDATE_WITH_OWN_OPTIONS_PASS: full editor-to-save round trip", () => {
  test("a complete Tamaño section (Individual 0, Familiar 2500) built entirely through the editor handlers saves successfully", () => {
    let secciones = JSON.stringify([{ nombre: "", opciones: [], obligatorio: true, maximo: 0 }]) // addSection()
    // name the section
    const sections = computeSections(secciones)
    sections[0].nombre = "Tamaño"
    secciones = JSON.stringify(sections)
    // add + name + price the two options
    secciones = addOption(secciones, 0)
    secciones = updateOptionName(secciones, 0, 0, "Individual")
    secciones = addOption(secciones, 0)
    secciones = updateOptionName(secciones, 0, 1, "Familiar")
    secciones = updateOptionPrice(secciones, 0, 1, "2500")

    const payload = JSON.parse(secciones)
    const result = validateProductSectionsForSave(payload)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual([
        {
          nombre: "Tamaño",
          opciones: [
            { nombre: "Individual", precio: 0 },
            { nombre: "Familiar", precio: 2500 },
          ],
          obligatorio: true,
          maximo: 0,
        },
      ])
    }
  })

  test("SAVE_WITHOUT_OWN_OPTIONS_REGRESSION_PASS: a product with an empty secciones array still saves (the original working case must stay working)", () => {
    const result = validateProductSectionsForSave([])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual([])
  })

  test("a leftover blank placeholder section (from Agregar, never named) no longer blocks saving the rest of a valid product — this is the exact BUG B mechanism", () => {
    const payload = [
      { nombre: "", opciones: [], obligatorio: false, maximo: 0 },
      { nombre: "Tamaño", opciones: [{ nombre: "Individual", precio: 0 }, { nombre: "Familiar", precio: 2500 }], obligatorio: true, maximo: 0 },
    ]
    const result = validateProductSectionsForSave(payload)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.length).toBe(1)
      expect(result.value[0].nombre).toBe("Tamaño")
    }
  })
})

// ============================================
// §34: Legacy + new option mix
// ============================================
describe("LEGACY_PLUS_NEW_OPTION_MIX_PASS", () => {
  test("a legacy string-array section loads through the editor normalizer, a new priced option can be added after it, and the whole thing saves", () => {
    let secciones = JSON.stringify([
      { nombre: "Punto de cocción", opciones: ["Jugosa", "A punto", "Bien cocida"], obligatorio: false, maximo: 0 },
    ])
    let sections = computeSections(secciones)
    expect(sections[0].opciones).toEqual([
      { nombre: "Jugosa", precio: 0 },
      { nombre: "A punto", precio: 0 },
      { nombre: "Bien cocida", precio: 0 },
    ])

    secciones = addOption(secciones, 0)
    secciones = updateOptionName(secciones, 0, 3, "Bien pasada")
    secciones = updateOptionPrice(secciones, 0, 3, "0")

    const payload = JSON.parse(secciones)
    const result = validateProductSectionsForSave(payload)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value[0].opciones.map((o) => o.nombre)).toEqual(["Jugosa", "A punto", "Bien cocida", "Bien pasada"])
    }
  })

  test("reopening a saved canonical result loads identically (no data loss across a save/reopen cycle)", () => {
    const saved: unknown = [
      { nombre: "Tamaño", opciones: [{ nombre: "Individual", precio: 0 }, { nombre: "Familiar", precio: 2500 }], obligatorio: true, maximo: 0 },
    ]
    const secciones = JSON.stringify(saved)
    const reopened = computeSections(secciones)
    expect(reopened).toEqual([
      { nombre: "Tamaño", opciones: [{ nombre: "Individual", precio: 0 }, { nombre: "Familiar", precio: 2500 }], obligatorio: true, maximo: 0 },
    ])
  })
})

// ============================================
// §35: Invalid inputs
// ============================================
describe("§35: invalid inputs are still rejected — leniency is scoped to blank names only", () => {
  test("a negative price on an otherwise-complete option is rejected outright (whole save fails, not silently coerced)", () => {
    const result = validateProductSectionsForSave([
      { nombre: "Tamaño", opciones: [{ nombre: "Familiar", precio: -100 }], obligatorio: false, maximo: 0 },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("Precio de opción inválido")
  })

  test("a malformed option (not an object, not a string) is rejected outright", () => {
    const result = validateProductSectionsForSave([
      { nombre: "Tamaño", opciones: [42], obligatorio: false, maximo: 0 },
    ])
    expect(result.ok).toBe(false)
  })

  test("a valid price of exactly 0 is accepted", () => {
    const result = validateProductSectionsForSave([
      { nombre: "Tamaño", opciones: [{ nombre: "Individual", precio: 0 }], obligatorio: false, maximo: 0 },
    ])
    expect(result.ok).toBe(true)
  })

  test("an empty editor price input normalizes to 0 at validation time too", () => {
    expect(validateOwnSectionOptionPrice(undefined)).toBe(0)
  })

  test("a malformed top-level section (not an object) is rejected outright — leniency never extends to structurally broken data", () => {
    const result = validateProductSectionsForSave(["not a section object"])
    expect(result.ok).toBe(false)
  })
})
