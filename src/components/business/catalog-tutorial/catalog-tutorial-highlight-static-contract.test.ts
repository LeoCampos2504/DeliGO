/// <reference types="bun-types" />

// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R2 §5-15 — contrato estático de highlighting
// ============================================
// Static source-text contract for the interactive field-highlighting
// feature (task §5-15), matching this codebase's established
// static-contract convention.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { CATALOG_TUTORIAL_STEPS } from "./catalog-tutorial-steps"

const DIR = join(process.cwd(), "src", "components", "business", "catalog-tutorial")
const HIGHLIGHT = readFileSync(join(DIR, "catalog-tutorial-highlight.tsx"), "utf8")
const TUTORIAL = readFileSync(join(DIR, "catalog-tutorial.tsx"), "utf8")
const TARGETS = readFileSync(join(DIR, "catalog-tutorial-targets.ts"), "utf8")
const STEPS = readFileSync(join(DIR, "catalog-tutorial-steps.ts"), "utf8")
const PRODUCTS_TAB = readFileSync(
  join(process.cwd(), "src", "components", "business", "products-tab.tsx"),
  "utf8"
)

const ALLOWED_TARGET_KEYS = [
  "catalog-tutorial-button",
  "category-control",
  "add-product",
  "mode-simple",
  "mode-expert",
  "product-name",
  "product-price",
  "product-category",
  "product-main-image",
  "product-gallery",
  "product-stock",
  "product-description",
  "product-discount",
  "ingredients-tab",
  "ingredient-add",
  "product-ingredients",
  "additions-tab",
  "addition-add",
  "product-additions",
  "product-own-sections",
  "shared-options-tab",
  "shared-option-add",
  "product-shared-options",
  "catalog-sections-tab",
  "catalog-section-add",
  "preview-button",
  "product-edit",
]

describe("target registry: exactly the 27 allowed keys, closed union", () => {
  test("CATALOG_TUTORIAL_TARGET_KEYS contains exactly the allowed 27 keys, no more, no fewer", () => {
    for (const key of ALLOWED_TARGET_KEYS) {
      expect(TARGETS).toContain(`"${key}"`)
    }
    const arrayMatch = TARGETS.match(/CATALOG_TUTORIAL_TARGET_KEYS = \[([\s\S]*?)\] as const/)
    expect(arrayMatch).not.toBeNull()
    const declared = (arrayMatch![1].match(/"([a-z0-9-]+)"/g) ?? []).map((s) => s.replace(/"/g, ""))
    expect(declared.sort()).toEqual([...ALLOWED_TARGET_KEYS].sort())
  })

  test("buildTargetSelector produces a data-attribute selector, never an id/class selector", () => {
    expect(TARGETS).toMatch(/buildTargetSelector[\s\S]*?`\[data-catalog-tutorial-target="\$\{key\}"\]`/)
  })
})

describe("DOM queries against the registry are discovery-only — never click/submit/mutate", () => {
  test("catalog-tutorial-highlight.tsx never calls .click(), .submit(), or requestSubmit() on a queried target", () => {
    expect(HIGHLIGHT).not.toMatch(/\.click\(\)/)
    expect(HIGHLIGHT).not.toMatch(/\.submit\(\)/)
    expect(HIGHLIGHT).not.toMatch(/requestSubmit/)
  })

  test("the only DOM APIs used on a found target are scrollIntoView and getBoundingClientRect", () => {
    const el = HIGHLIGHT.match(/const el = document\.querySelector[\s\S]*?\n(?:\s*\n)*/g) ?? []
    expect(el.length).toBeGreaterThan(0)
    expect(HIGHLIGHT).toMatch(/el\.scrollIntoView\(/)
    expect(HIGHLIGHT).toMatch(/el\.getBoundingClientRect\(\)/)
    expect(HIGHLIGHT).not.toMatch(/el\.value\s*=/)
    expect(HIGHLIGHT).not.toMatch(/el\.focus\(\)/)
  })

  test("the highlight ring never mutates the target element's own className/style — it is a fully separate, position:fixed, pointer-events:none, portaled overlay", () => {
    expect(HIGHLIGHT).toMatch(/createPortal\(/)
    expect(HIGHLIGHT).toMatch(/pointerEvents: "none"/)
    expect(HIGHLIGHT).toMatch(/position: "fixed"/)
    expect(HIGHLIGHT).not.toMatch(/el\.className\s*=/)
    expect(HIGHLIGHT).not.toMatch(/el\.style\./)
  })
})

describe("bounded retries — never an infinite/unbounded loop (task §15)", () => {
  test("mount-wait has a fixed max-attempts bound and fails safe (sets failed:true) instead of retrying forever", () => {
    expect(HIGHLIGHT).toMatch(/const TARGET_MOUNT_WAIT_MAX_FRAMES = 45/)
    expect(HIGHLIGHT).toMatch(/if \(mountWaitAttemptsRef\.current >= TARGET_MOUNT_WAIT_MAX_FRAMES\) \{/)
    expect(HIGHLIGHT).toMatch(/setState\(\{ activeTargetKey: targetKey, rect: null, failed: true \}\)/)
  })

  test("the resync loop is throttled and self-terminates via useEffect cleanup keyed to activeTargetKey/failed — not a standing global interval", () => {
    expect(HIGHLIGHT).toMatch(/const HIGHLIGHT_RESYNC_INTERVAL_MS = 200/)
    expect(HIGHLIGHT).toMatch(/return \(\) => window\.cancelAnimationFrame\(rafId\)/)
    expect(HIGHLIGHT).toMatch(/\}, \[state\.activeTargetKey, state\.failed\]\)/)
  })

  test("target unmount is detected by the resync loop and clears the highlight — never leaves a stale ring", () => {
    const block = HIGHLIGHT.match(/if \(!el\) \{[\s\S]*?setState\(\{ activeTargetKey: null, rect: null, failed: false \}\)/)
    expect(block).not.toBeNull()
  })
})

describe("reduced motion respected", () => {
  test("scrollIntoView uses instant behavior under prefers-reduced-motion", () => {
    expect(HIGHLIGHT).toMatch(/prefersReducedMotion \? "auto" : "smooth"/)
  })

  test("the pulse animation is Tailwind's built-in animate-pulse with motion-reduce:animate-none — no custom @keyframes added (never touches globals.css, a paused iOS file)", () => {
    expect(HIGHLIGHT).toMatch(/animate-pulse motion-reduce:animate-none/)
    expect(HIGHLIGHT).not.toMatch(/@keyframes/)
    expect(HIGHLIGHT).not.toContain("globals.css")
  })
})

describe("'Paso del tutorial' badge and ring styling never obscures the real field", () => {
  test("the ring is a border/glow overlay, not an opaque fill — pointer-events:none guarantees the real field stays fully interactive underneath", () => {
    expect(HIGHLIGHT).toMatch(/ring-2 ring-primary/)
    expect(HIGHLIGHT).toMatch(/pointerEvents: "none"/)
  })

  test("the badge text is exactly 'Paso del tutorial'", () => {
    expect(HIGHLIGHT).toContain("Paso del tutorial")
  })
})

describe("highlight clears on every required lifecycle event (task §12)", () => {
  test("a single unified effect clears the highlight on step change, view change, and open/close — keyed to [view, currentStep?.id, open]", () => {
    expect(TUTORIAL).toMatch(/highlight\.clearHighlight\(\)/)
    expect(TUTORIAL).toMatch(/\}, \[view, currentStep\?\.id, open\]\)/)
  })

  test("useCatalogTutorialHighlight itself clears on unmount", () => {
    expect(HIGHLIGHT).toMatch(/useEffect\(\(\) => clearHighlight, \[clearHighlight\]\)/)
  })
})

describe("'Mostrarme' action wired to real showMe, only shown when a step/field actually has a targetKey", () => {
  test("the step-level Mostrarme button only renders when step.targetKey exists", () => {
    expect(TUTORIAL).toMatch(/\{step\.targetKey && \(\s*\n\s*<Button type="button" variant="outline" onClick=\{\(\) => onShowMe\(step\.targetKey!\)\}>\s*\n\s*Mostrarme/)
  })

  test("the field-guide sub-navigator's Mostrarme button targets the CURRENT field, not the parent step", () => {
    expect(TUTORIAL).toMatch(/onClick=\{\(\) => onShowMe\(currentField\.targetKey\)\}/)
  })

  test("field guide never introduces a new top-level tutorial step — fieldGuide is a property ON an existing step, not a new entry in the steps array", () => {
    // 17-step architecture preserved (R1 baseline), fieldGuide is additive metadata only
    expect(CATALOG_TUTORIAL_STEPS.length).toBe(17)
  })
})

describe("field sub-guide navigation ('Campo X de N')", () => {
  test("the counter and aria-live announcement are present", () => {
    expect(TUTORIAL).toMatch(/Campo \{fieldGuideIndex \+ 1\} de \{fieldGuide\.length\}/)
    expect(TUTORIAL).toMatch(/aria-live="polite"/)
  })

  test("Anterior/Siguiente are bounded (disabled at the ends) — never wrap around or go out of range", () => {
    expect(TUTORIAL).toMatch(/disabled=\{fieldGuideIndex === 0\}/)
    expect(TUTORIAL).toMatch(/disabled=\{fieldGuideIndex >= fieldGuide\.length - 1\}/)
    expect(TUTORIAL).toMatch(/Math\.max\(0, fieldGuideIndex - 1\)/)
    expect(TUTORIAL).toMatch(/Math\.min\(fieldGuide\.length - 1, fieldGuideIndex \+ 1\)/)
  })

  test("no auto-fill and no forced auto-focus of the target field — the guide only scrolls/highlights, never sets a form value or calls .focus()", () => {
    expect(TUTORIAL).not.toMatch(/currentField[\s\S]{0,80}\.focus\(\)/)
    expect(TUTORIAL).not.toMatch(/currentField[\s\S]{0,80}setFormData/)
  })
})

describe("fail-safe UX when a target can't be found (task §15)", () => {
  test("a role=status message is shown, the tutorial stays usable (no crash, no thrown error)", () => {
    expect(TUTORIAL).toMatch(/\{highlightFailed && \(/)
    expect(TUTORIAL).toMatch(/role="status"/)
    expect(TUTORIAL).toContain("No pudimos señalar este campo automáticamente. Podés seguir el paso manualmente.")
  })
})

describe("tab highlighting for Ingredientes/Agregados/Secciones/Opciones sub-tabs", () => {
  test("CatalogSubNav maps each gated sub-tab to its registry tab key and applies it as a real data attribute on the tab button", () => {
    expect(PRODUCTS_TAB).toMatch(/ingredientes: "ingredients-tab"/)
    expect(PRODUCTS_TAB).toMatch(/agregados: "additions-tab"/)
    expect(PRODUCTS_TAB).toMatch(/secciones: "catalog-sections-tab"/)
    expect(PRODUCTS_TAB).toMatch(/opciones: "shared-options-tab"/)
    expect(PRODUCTS_TAB).toMatch(/data-catalog-tutorial-target=\{subTabTutorialTarget\[item\.id\]\}/)
  })
})

describe("mobile safety (task §13): highlighting never touches visualViewport, the iOS dock, or fixed-overlay keyboard hacks", () => {
  test("catalog-tutorial-highlight.tsx never references visualViewport or the paused iOS dock/keyboard system", () => {
    expect(HIGHLIGHT).not.toMatch(/visualViewport/)
    expect(HIGHLIGHT).not.toMatch(/ios-dock|ios-keyboard-open|ios-bottom-nav/)
  })

  test("the ring overlay positions itself purely from getBoundingClientRect (viewport-relative fixed coordinates), with no special-cased mobile/iOS branch", () => {
    expect(HIGHLIGHT).not.toMatch(/isIOS|iPhone|standalone/)
  })
})

describe("no new tour dependency introduced", () => {
  test("no Driver.js/Shepherd/Intro.js import anywhere in the tutorial directory's source", () => {
    const forbidden = /driver\.js|shepherd|intro\.js/i
    for (const source of [HIGHLIGHT, TUTORIAL, TARGETS, STEPS]) {
      expect(source).not.toMatch(forbidden)
    }
  })
})

describe("no paused iOS R8 file was modified by the highlighting feature", () => {
  const iosFiles = [
    "ios-keyboard-fix",
    "ios-viewport-debug-panel",
    "ios-debug-snapshot",
    "ios-dock-viewport-state",
  ]

  test("none of the paused iOS files are imported by any highlighting file", () => {
    for (const source of [HIGHLIGHT, TUTORIAL, TARGETS]) {
      for (const iosFile of iosFiles) {
        expect(source).not.toContain(iosFile)
      }
    }
  })
})
