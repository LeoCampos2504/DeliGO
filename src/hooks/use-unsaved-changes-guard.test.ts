/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { deepEqual } from "./use-unsaved-changes-guard"

const ROOT = process.cwd()
const source = (relativePath: string) => readFileSync(join(ROOT, relativePath), "utf8")

describe("catalog unsaved changes — pure dirty-state contract", () => {
  test("equal baseline/current is clean", () => {
    expect(deepEqual({ nombre: "Pizza", precio: 8000 }, { nombre: "Pizza", precio: 8000 })).toBe(true)
  })

  test("an actual value difference is dirty", () => {
    expect(deepEqual({ nombre: "Pizza", precio: 8000 }, { nombre: "Pizza", precio: 9000 })).toBe(false)
  })

  test("changing and reverting to the baseline is clean again", () => {
    const baseline = { nombre: "Pizza", precio: 8000 }
    const current = { ...baseline, precio: 9000 }
    current.precio = 8000
    expect(deepEqual(baseline, current)).toBe(true)
  })

  test("comparison does not mutate either input", () => {
    const baseline = { secciones: [{ nombre: "Tamaño", opciones: ["Grande"] }] }
    const current = { secciones: [{ nombre: "Tamaño", opciones: ["Grande"] }] }
    const baselineBefore = structuredClone(baseline)
    const currentBefore = structuredClone(current)
    deepEqual(baseline, current)
    expect(baseline).toEqual(baselineBefore)
    expect(current).toEqual(currentBefore)
  })
})

describe("catalog unsaved changes — static wiring contract", () => {
  const files = [
    "src/components/business/products-tab.tsx",
    "src/components/business/ingredientes-section.tsx",
    "src/components/business/agregados-section.tsx",
    "src/components/business/opciones-compartidas-section.tsx",
    "src/components/business/secciones-section.tsx",
  ]

  test("all six catalog form owners use the shared guard and dialog", () => {
    for (const file of files) {
      const text = source(file)
      expect(text).toContain("useUnsavedChangesGuard")
      expect(text).toContain("CatalogUnsavedChangesDialog")
      expect(text).toContain("guardedClose")
    }
  })

  test("every child form reports dirty state to ProductsTab", () => {
    for (const file of files.slice(1)) {
      const text = source(file)
      expect(text).toContain("onDirtyChange")
      expect(text).toContain("deepEqual(initialFormData, formData)")
    }
    expect(source(files[0])).toContain("setOtherFormIsDirty")
  })

  test("Product normalization includes own option prices and canonical legacy handling", () => {
    const text = source(files[0])
    expect(text).toContain("normalizeProductFormData")
    expect(text).toContain("normalizeOwnSectionOptionsForEditor")
    expect(text).toContain("precio: option.precio")
    expect(text).toContain("requestSubTab")
    expect(text).toContain("onRegisterNavigationGuard")
  })

  test("native beforeunload is scoped to dirty state", () => {
    const text = source("src/hooks/use-unsaved-changes-guard.ts")
    expect(text).toContain("if (!isDirty || !beforeUnloadEnabled) return")
    expect(text).toContain("window.addEventListener(\"beforeunload\"")
    expect(text).toContain("window.removeEventListener(\"beforeunload\"")
  })
})

describe("catalog hardening — stock and capability copy contracts", () => {
  test("business stock helpers describe visible Sin stock behavior", () => {
    const text = source("src/components/business/products-tab.tsx")
    expect(text).toContain("está disponible para comprar")
    expect(text).toContain("se mostrará como Sin stock y no se podrá comprar")
    expect(text).not.toContain("Oculto del catálogo")
    expect(text).not.toContain("Oculta del catálogo")
  })

  test("tutorial uses the capability authority and does not teach impossible expert paths", () => {
    const steps = source("src/components/business/catalog-tutorial/catalog-tutorial-steps.ts")
    const capabilities = source("src/components/business/catalog-tutorial/catalog-tutorial-rubro-capabilities.ts")
    expect(steps).toContain("getCatalogRubroCapabilities")
    expect(steps).toContain("EXPERT_MODE_RUBROS")
    expect(capabilities).toContain("supportsCatalogExpertMode: isRestaurant")
    expect(capabilities).toContain("supportsIngredients: isRestaurant")
    expect(capabilities).toContain("supportsAdditions: isRestaurant")
  })
})
