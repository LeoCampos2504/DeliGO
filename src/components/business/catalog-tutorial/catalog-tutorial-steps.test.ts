/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import {
  CATALOG_TUTORIAL_DECISION_TABLE,
  CATALOG_TUTORIAL_OWN_VS_SHARED_COMPARISON,
  CATALOG_TUTORIAL_STEPS,
  getStepById,
  getVisibleSteps,
  normalizeRubro,
  resolveRubroCopy,
  resolveStepCopy,
} from "./catalog-tutorial-steps"

describe("normalizeRubro — mirrors business-panel.tsx's isRopa/isNegocio checks exactly", () => {
  test("'ropa' => 'ropa'", () => expect(normalizeRubro("ropa")).toBe("ropa"))
  test("'negocio' => 'negocio'", () => expect(normalizeRubro("negocio")).toBe("negocio"))
  test("'restaurante' => 'restaurante'", () => expect(normalizeRubro("restaurante")).toBe("restaurante"))
  test("any other/unknown string falls back to 'restaurante', same as the app's own default", () => {
    expect(normalizeRubro("")).toBe("restaurante")
    expect(normalizeRubro("algo-desconocido")).toBe("restaurante")
  })
})

describe("step catalog integrity", () => {
  test("every step has a unique id", () => {
    const ids = CATALOG_TUTORIAL_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test("every step has a non-empty title, description, and completionLabel", () => {
    for (const step of CATALOG_TUTORIAL_STEPS) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.description.length).toBeGreaterThan(0)
      expect(step.completionLabel.length).toBeGreaterThan(0)
    }
  })

  test("every step with an actionKey other than 'none' has an actionLabel", () => {
    for (const step of CATALOG_TUTORIAL_STEPS) {
      if (step.actionKey && step.actionKey !== "none") {
        expect(step.actionLabel).toBeTruthy()
      }
    }
  })

  test("every restaurant-only capability step is gated away from ropa/negocio", () => {
    const restricted = CATALOG_TUTORIAL_STEPS.filter((s) => s.supportedRubros)
    const restrictedIds = restricted.map((s) => s.id).sort()
    expect(restrictedIds).toEqual([
      "create-additions",
      "create-ingredients",
      "description-discounts",
      "own-product-section",
      "simple-vs-expert",
    ])
    for (const step of restricted) {
      expect(step.supportedRubros).toEqual(["restaurante"])
    }
  })
})

describe("getVisibleSteps — rubro filtering (task §10, §34: no impossible steps shown)", () => {
  test("restaurante gets the full step list", () => {
    expect(getVisibleSteps("restaurante").length).toBe(CATALOG_TUTORIAL_STEPS.length)
  })

  test("ropa never sees the ingredients/additions steps", () => {
    const visible = getVisibleSteps("ropa").map((s) => s.id)
    expect(visible).not.toContain("create-ingredients")
    expect(visible).not.toContain("create-additions")
  })

  test("negocio never sees the ingredients/additions steps", () => {
    const visible = getVisibleSteps("negocio").map((s) => s.id)
    expect(visible).not.toContain("create-ingredients")
    expect(visible).not.toContain("create-additions")
  })

  test("ropa/negocio see the steps supported by their capability model", () => {
    const restauranteIds = new Set(getVisibleSteps("restaurante").map((s) => s.id))
    const ropaIds = new Set(getVisibleSteps("ropa").map((s) => s.id))
    const onlyInRestaurante = [...restauranteIds].filter((id) => !ropaIds.has(id))
    expect(onlyInRestaurante.sort()).toEqual([
      "create-additions",
      "create-ingredients",
      "description-discounts",
      "own-product-section",
      "simple-vs-expert",
    ])
  })
})

describe("getStepById", () => {
  test("finds a known step", () => {
    expect(getStepById("intro")?.id).toBe("intro")
  })
  test("returns undefined for an unknown id", () => {
    expect(getStepById("does-not-exist")).toBeUndefined()
  })
})

describe("resolveRubroCopy / resolveStepCopy — label adaptation (task §10: adapt labels, not full rewrite)", () => {
  test("ropa swaps producto -> prenda", () => {
    const copy = resolveRubroCopy("ropa")
    expect(copy.productSingular).toBe("prenda")
    expect(copy.productsTabLabel).toBe("Prendas")
  })

  test("restaurante and negocio both keep the default producto/Productos wording", () => {
    expect(resolveRubroCopy("restaurante").productSingular).toBe("producto")
    expect(resolveRubroCopy("negocio").productSingular).toBe("producto")
  })

  test("resolveStepCopy substitutes every token variant correctly", () => {
    const text = "{Productos}: cargá tu primer {producto}. Repetí para más {productos}. {Producto} listo."
    expect(resolveStepCopy(text, "ropa")).toBe("Prendas: cargá tu primer prenda. Repetí para más prendas. Prenda listo.")
    expect(resolveStepCopy(text, "restaurante")).toBe(
      "Productos: cargá tu primer producto. Repetí para más productos. Producto listo."
    )
  })

  test("resolveStepCopy never leaves an unresolved {token} for any known rubro", () => {
    const tokenPattern = /\{(Productos|Producto|productos|producto)\}/
    for (const step of CATALOG_TUTORIAL_STEPS) {
      for (const rubro of ["restaurante", "ropa", "negocio"] as const) {
        expect(resolveStepCopy(step.title, rubro)).not.toMatch(tokenPattern)
        expect(resolveStepCopy(step.description, rubro)).not.toMatch(tokenPattern)
        for (const detail of step.details ?? []) {
          expect(resolveStepCopy(detail, rubro)).not.toMatch(tokenPattern)
        }
      }
    }
  })
})

describe("decision table and comparison content (task §12-13)", () => {
  test("decision table has the 4 documented rows", () => {
    expect(CATALOG_TUTORIAL_DECISION_TABLE.length).toBe(4)
  })

  test("comparison has exactly 2 columns (own section vs shared option)", () => {
    expect(CATALOG_TUTORIAL_OWN_VS_SHARED_COMPARISON.length).toBe(2)
    expect(CATALOG_TUTORIAL_OWN_VS_SHARED_COMPARISON.map((c) => c.title)).toEqual([
      "Sección propia",
      "Opción compartida",
    ])
  })

  test("OWN-PRODUCT-OPTION-PRICES-R1 §53: both own sections and shared options now state the same optional-per-option-price capability — price no longer distinguishes them, reuse does", () => {
    const ownSection = CATALOG_TUTORIAL_OWN_VS_SHARED_COMPARISON[0]
    const sharedOption = CATALOG_TUTORIAL_OWN_VS_SHARED_COMPARISON[1]
    expect(ownSection.points.some((p) => /recargo opcional/i.test(p))).toBe(true)
    expect(sharedOption.points.some((p) => /recargo opcional/i.test(p))).toBe(true)
    expect(ownSection.points.some((p) => /no (cambian|tienen) (el )?precio/i.test(p))).toBe(false)
  })
})

describe("no unsupported feature is taught (audit §18 'no se encontró en el flujo actual')", () => {
  // Patterns that would only match an AFFIRMATIVE claim of a nonexistent
  // feature — deliberately narrow enough to not false-positive on this
  // tutorial's own correct denials (e.g. "No es un ocultamiento total
  // garantizado" legitimately contains the substring "ocultamiento total"
  // while correctly stating the feature does NOT exist).
  const forbiddenClaims = [/duplicar|clonar|copiar (el )?producto/i]

  test("no step text claims a nonexistent feature", () => {
    for (const step of CATALOG_TUTORIAL_STEPS) {
      const allText = [step.title, step.description, ...(step.details ?? [])].join(" ")
      for (const pattern of forbiddenClaims) {
        expect(allText).not.toMatch(pattern)
      }
    }
  })

  test("the stock step describes the REAL observable behavior, not the misleading 'Oculto del catálogo' helper text (audit §13.1)", () => {
    const stockStep = getStepById("stock")!
    const allText = [stockStep.title, stockStep.description, ...(stockStep.details ?? [])].join(" ")
    expect(allText).toMatch(/Sin stock/)
    expect(allText).not.toMatch(/desaparece completamente|se oculta completamente/i)
  })

  test("the ingredient step correctly states every linked ingredient is removable, and does not claim a non-removable toggle exists (audit §6.1)", () => {
    const step = getStepById("create-ingredients")!
    const allText = [step.title, step.description, ...(step.details ?? [])].join(" ")
    expect(allText).toMatch(/no existe una opción para marcarlo como no removible/i)
    expect(allText).not.toMatch(/marcar (un |el )?ingrediente como no removible/i)
  })

  test("the delete-safety step never instructs an actual destructive action to complete it", () => {
    const step = getStepById("delete-safely")!
    expect(step.description).toMatch(/educativo|no hace falta borrar/i)
  })
})
