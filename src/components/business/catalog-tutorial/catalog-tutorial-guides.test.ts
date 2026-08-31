/// <reference types="bun-types" />

// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R3 §12-19 — pure guide-phase logic
// ============================================

import { describe, expect, test } from "bun:test"
import { CATALOG_TUTORIAL_TARGET_KEYS, type CatalogTutorialTargetKey } from "./catalog-tutorial-targets"
import { getFirstGuidePhase, getGuidePhases, hasGuide } from "./catalog-tutorial-guides"
import { CATALOG_TUTORIAL_STEPS } from "./catalog-tutorial-steps"

const ALL_KEYS = new Set<string>(CATALOG_TUTORIAL_TARGET_KEYS)

describe("hasGuide / getGuidePhases: only steps with a real workflow to highlight have one", () => {
  const GUIDED_STEP_IDS = [
    "create-category",
    "create-simple-product",
    "edit-product",
    "simple-vs-expert",
    "create-ingredients",
    "create-additions",
    "own-product-section",
    "create-shared-options",
    "reuse-shared-options",
    "stock",
    "catalog-sections",
    "preview",
  ]
  const UNGUIDED_STEP_IDS = ["intro", "description-discounts", "edit-reusable-safely", "delete-safely", "final-checklist"]

  test("every guided step id resolves to at least one phase, for both simple and expert mode", () => {
    for (const id of GUIDED_STEP_IDS) {
      expect(hasGuide(id)).toBe(true)
      expect(getGuidePhases(id, { mode: "simple" }).length).toBeGreaterThan(0)
      expect(getGuidePhases(id, { mode: "expert" }).length).toBeGreaterThan(0)
    }
  })

  test("purely informational steps have no guide", () => {
    for (const id of UNGUIDED_STEP_IDS) {
      expect(hasGuide(id)).toBe(false)
      expect(getGuidePhases(id, { mode: "expert" })).toEqual([])
      expect(getFirstGuidePhase(id, { mode: "expert" })).toBeNull()
    }
  })

  test("every guided step id in this test list is a real step id from catalog-tutorial-steps.ts (no drift)", () => {
    const realIds = new Set(CATALOG_TUTORIAL_STEPS.map((s) => s.id))
    for (const id of [...GUIDED_STEP_IDS, ...UNGUIDED_STEP_IDS]) {
      expect(realIds.has(id)).toBe(true)
    }
    // and vice versa — no real step id was forgotten from this test's coverage
    expect(realIds.size).toBe(GUIDED_STEP_IDS.length + UNGUIDED_STEP_IDS.length)
  })
})

describe("task §12: product-creation guide phase count and mode-awareness", () => {
  test("Simple mode: 3 phases (add button, basic info, review) — no advanced-options phase since that form step doesn't exist in Simple", () => {
    const phases = getGuidePhases("create-simple-product", { mode: "simple" })
    expect(phases.map((p) => p.targetKey)).toEqual(["add-product", "product-basic-info-area", "product-review-area"])
  })

  test("Expert mode: 4 phases (add button, basic info, advanced options, review) — NOT 10+", () => {
    const phases = getGuidePhases("create-simple-product", { mode: "expert" })
    expect(phases.map((p) => p.targetKey)).toEqual([
      "add-product",
      "product-basic-info-area",
      "product-advanced-options-area",
      "product-review-area",
    ])
    expect(phases.length).toBeLessThan(10)
  })

  test("no product-creation phase targets an individual field — every target is a whole-area key (ends in -area) or the add/edit button", () => {
    const phases = getGuidePhases("create-simple-product", { mode: "expert" })
    for (const phase of phases) {
      const isAreaOrButton = phase.targetKey === "add-product" || phase.targetKey.endsWith("-area")
      expect(isAreaOrButton).toBe(true)
    }
  })
})

describe("task §5: workflow-stage granularity — one phase per meaningful action/area, never per field", () => {
  test("ingredient/addition/shared-option/catalog-section guides are exactly 2 phases (add button, form area)", () => {
    for (const id of ["create-ingredients", "create-additions", "create-shared-options", "catalog-sections"]) {
      const phases = getGuidePhases(id, { mode: "expert" })
      expect(phases.length).toBe(2)
      expect(phases[1].targetKey).toMatch(/-form-area$/)
    }
  })

  test("single-highlight guides (category, edit, mode toggle, own-section, reuse-shared-option, stock, preview) are exactly 1 phase", () => {
    for (const id of ["create-category", "edit-product", "simple-vs-expert", "own-product-section", "reuse-shared-options", "stock", "preview"]) {
      expect(getGuidePhases(id, { mode: "expert" }).length).toBe(1)
    }
  })
})

describe("every phase target key is a real, registered target key", () => {
  test("no guide phase references a target key outside the closed CATALOG_TUTORIAL_TARGET_KEYS registry", () => {
    for (const step of CATALOG_TUTORIAL_STEPS) {
      for (const mode of ["simple", "expert"] as const) {
        for (const phase of getGuidePhases(step.id, { mode })) {
          expect(ALL_KEYS.has(phase.targetKey)).toBe(true)
        }
      }
    }
  })
})

describe("getFirstGuidePhase matches the first entry of getGuidePhases", () => {
  test("for every guided step and mode", () => {
    for (const step of CATALOG_TUTORIAL_STEPS) {
      for (const mode of ["simple", "expert"] as const) {
        const phases = getGuidePhases(step.id, { mode })
        const first = getFirstGuidePhase(step.id, { mode })
        expect(first).toEqual(phases[0] ?? null)
      }
    }
  })
})

describe("phase copy never invents a feature the audit didn't confirm", () => {
  test("no phase claims automatic saving/creation — copy only describes what the owner does manually", () => {
    for (const step of CATALOG_TUTORIAL_STEPS) {
      for (const phase of getGuidePhases(step.id, { mode: "expert" })) {
        expect(phase.body).not.toMatch(/se guarda automáticamente|se crea automáticamente/i)
      }
    }
  })

  const usedTargetKeys: CatalogTutorialTargetKey[] = []
  test("no two DIFFERENT guides reuse a form-area/add-button target in a way that would show two unrelated coach messages for the same key (each -area/-add key belongs to exactly one guide)", () => {
    const ownerByKey = new Map<CatalogTutorialTargetKey, string>()
    for (const step of CATALOG_TUTORIAL_STEPS) {
      for (const phase of getGuidePhases(step.id, { mode: "expert" })) {
        usedTargetKeys.push(phase.targetKey)
        const existingOwner = ownerByKey.get(phase.targetKey)
        if (existingOwner && existingOwner !== step.id) {
          // product-own-sections / product-shared-options are intentionally
          // reused as single-highlight targets by two related but distinct
          // steps already (own-product-section vs the product form's own
          // area). product-basic-info-area is intentionally shared by
          // create-simple-product's own basic-info phase AND the "stock"
          // step (stock lives inside that same real area) — everything
          // else must be exclusive.
          expect(["product-own-sections", "product-shared-options", "product-basic-info-area"]).toContain(
            phase.targetKey
          )
        }
        ownerByKey.set(phase.targetKey, step.id)
      }
    }
    expect(usedTargetKeys.length).toBeGreaterThan(0)
  })
})
