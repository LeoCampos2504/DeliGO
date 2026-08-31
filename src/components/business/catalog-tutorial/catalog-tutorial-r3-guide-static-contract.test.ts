/// <reference types="bun-types" />

// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R3 — contrato estático de la guía contextual
// ============================================
// Static source-text contract proving the R3 rewrite: no user-facing
// "Mostrarme", no detached fixed-position highlight ring, real in-place
// highlighting via a React wrapper/ref (never document.querySelector),
// workflow-stage granularity, no auto-click/submit/mutation, guide
// cleanup on every required lifecycle event, and R2's Preview contract
// left untouched. Matches this codebase's established static-contract
// convention (no RTL anywhere in this repo).

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const DIR = join(process.cwd(), "src", "components", "business", "catalog-tutorial")
const TUTORIAL = readFileSync(join(DIR, "catalog-tutorial.tsx"), "utf8")
const GUIDE_CONTEXT = readFileSync(join(DIR, "catalog-tutorial-guide-context.tsx"), "utf8")
const TARGET = readFileSync(join(DIR, "catalog-tutorial-target.tsx"), "utf8")
const GUIDE_COACH = readFileSync(join(DIR, "catalog-tutorial-guide.tsx"), "utf8")
const GUIDES = readFileSync(join(DIR, "catalog-tutorial-guides.ts"), "utf8")
const PRODUCTS_TAB = readFileSync(
  join(process.cwd(), "src", "components", "business", "products-tab.tsx"),
  "utf8"
)
const BUSINESS_PANEL = readFileSync(
  join(process.cwd(), "src", "components", "business", "business-panel.tsx"),
  "utf8"
)
const INGREDIENTES = readFileSync(
  join(process.cwd(), "src", "components", "business", "ingredientes-section.tsx"),
  "utf8"
)
const AGREGADOS = readFileSync(
  join(process.cwd(), "src", "components", "business", "agregados-section.tsx"),
  "utf8"
)
const OPCIONES = readFileSync(
  join(process.cwd(), "src", "components", "business", "opciones-compartidas-section.tsx"),
  "utf8"
)
const SECCIONES = readFileSync(
  join(process.cwd(), "src", "components", "business", "secciones-section.tsx"),
  "utf8"
)

const ALL_R3_SOURCES = [TUTORIAL, GUIDE_CONTEXT, TARGET, GUIDE_COACH, GUIDES, PRODUCTS_TAB, BUSINESS_PANEL, INGREDIENTES, AGREGADOS, OPCIONES, SECCIONES]

// ============================================
// §6 — user-facing "Mostrarme" removed
// ============================================
describe("§6: R2's 'Mostrarme' user action is fully removed", () => {
  test("no 'Mostrarme' string anywhere in the tutorial/guide source", () => {
    for (const source of ALL_R3_SOURCES) {
      expect(source).not.toContain("Mostrarme")
    }
  })

  test("no separate onShowMe prop/handler exists — highlighting starts automatically from 'Ir a...', never a second click", () => {
    expect(TUTORIAL).not.toMatch(/onShowMe/)
    expect(TUTORIAL).not.toMatch(/showMe/)
  })
})

// ============================================
// §7 — R2's detached fixed/portaled ring removed
// ============================================
describe("§7: R2's detached, fixed-position, portaled highlight ring is removed", () => {
  test("catalog-tutorial-highlight.tsx (the R2 architecture) no longer exists", () => {
    const fs = require("fs") as typeof import("fs")
    expect(fs.existsSync(join(DIR, "catalog-tutorial-highlight.tsx"))).toBe(false)
  })

  test("the new target mechanism never uses getBoundingClientRect, createPortal, or position:fixed — it highlights the real element in place", () => {
    expect(TARGET).not.toMatch(/getBoundingClientRect/)
    expect(TARGET).not.toMatch(/createPortal/)
    expect(TARGET).not.toMatch(/position:\s*["']fixed["']/)
    expect(TARGET).not.toMatch(/document\.body/)
  })

  test("no document.querySelector-based target discovery anywhere in the guide/target source — a real element ref is used instead", () => {
    for (const source of [TARGET, GUIDE_CONTEXT, TUTORIAL]) {
      expect(source).not.toMatch(/document\.querySelector/)
    }
  })
})

// ============================================
// §5, §12 — workflow-stage granularity, never field-by-field
// ============================================
describe("§5, §9: no field-by-field state machine survives from R2", () => {
  test("no fieldGuide / 'Campo X de N' / 'Anterior'-'Siguiente campo' sub-navigator anywhere", () => {
    for (const source of [TUTORIAL, GUIDE_COACH, GUIDES]) {
      expect(source).not.toMatch(/fieldGuide/)
      expect(source).not.toMatch(/Campo \d/)
      expect(source).not.toMatch(/Siguiente campo/)
    }
  })

  test("the guide context is a small, dedicated authority (guideId/target + start/advance/stop) — not a generic event bus with per-field state", () => {
    expect(GUIDE_CONTEXT).toMatch(/startGuide/)
    expect(GUIDE_CONTEXT).toMatch(/advanceIfActive/)
    expect(GUIDE_CONTEXT).toMatch(/stopGuide/)
    expect(GUIDE_CONTEXT).not.toMatch(/EventEmitter|eventBus|dispatchEvent/)
  })
})

// ============================================
// §8 — real target highlight, no layout-size change, pointer stays normal
// ============================================
describe("§8: real element highlight — no blocking overlay, pointer interaction stays normal", () => {
  test("the wrapper never sets pointer-events:none on the real content (unlike R2's inert ring) — the target stays fully interactive", () => {
    expect(TARGET).not.toMatch(/pointerEvents:\s*["']none["']/)
    expect(TARGET).not.toMatch(/pointer-events-none/)
  })

  test("the persistent highlight uses a CSS outline (never affects layout box size, never fills the interior); TUTORIAL-HIGHLIGHT-PULSE-POLISH-R1: the attention glow is a separate animated `boxShadow`, never Tailwind's infinite animate-pulse", () => {
    expect(TARGET).toMatch(/outline-2 outline-primary/)
    expect(TARGET).not.toMatch(/animate-pulse/)
  })
})

// ============================================
// §9 — contextual guide state, no huge state machine
// ============================================
describe("§9: contextual guide authority is minimal", () => {
  test("state shape is exactly guideId + targetKey (+ a mounted-targets registry for the fail-safe) — not one state field per input", () => {
    expect(GUIDE_CONTEXT).toMatch(/activeGuideId/)
    expect(GUIDE_CONTEXT).toMatch(/activeTargetKey/)
    expect(GUIDE_CONTEXT).toMatch(/mountedTargetsRef/)
  })
})

// ============================================
// §10 — contextual coach card, inline in document flow
// ============================================
describe("§10: coach card renders inline, never positioned by viewport coordinates", () => {
  test("the coach card component has no position:fixed/absolute, no top/left coordinate styling", () => {
    expect(GUIDE_COACH).not.toMatch(/position:\s*["'](fixed|absolute)["']/)
    expect(GUIDE_COACH).not.toMatch(/\btop:\s*\d/)
    expect(GUIDE_COACH).not.toMatch(/\bleft:\s*\d/)
  })

  test("the coach card exposes 'Volver al tutorial' and is scoped to specific target keys (targetKeys prop) so only one renders at a time per placement", () => {
    expect(GUIDE_COACH).toContain("Volver al tutorial")
    expect(GUIDE_COACH).toMatch(/targetKeys: CatalogTutorialTargetKey\[\]/)
  })
})

// ============================================
// §11 — large tutorial panel gets out of the way
// ============================================
describe("§11: large Tutorial Sheet closes on 'Ir a...', never covers the real form", () => {
  test("handleGoToAction calls setOpen(false) before/alongside starting the guide", () => {
    const block = TUTORIAL.match(/const handleGoToAction = [\s\S]*?\n  \}/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/setOpen\(false\)/)
    expect(block![0]).toMatch(/guide\.startGuide/)
  })

  test("a small non-obstructive inline indicator ('Tutorial activo · Volver al tutorial') replaces the large panel while a guide is active — never position:fixed", () => {
    expect(TUTORIAL).toContain("Tutorial activo · Volver al tutorial")
    expect(TUTORIAL).not.toMatch(/position:\s*["']fixed["']/)
  })
})

// ============================================
// §23 — automatic transitions from real state only
// ============================================
describe("§23: guide phases advance only from real React state changes, never synthetic input", () => {
  test("ProductsTab advances the product guide from real formOpen/formStep/mode state — no .click()", () => {
    const block = PRODUCTS_TAB.match(/useEffect\(\(\) => \{\s*\n\s*if \(!formOpen\) return[\s\S]*?guide\.advanceIfActive\("create-simple-product"[\s\S]*?\n {2}\}, \[formOpen, formStep, mode, guide\.advanceIfActive\]\)/)
    expect(block).not.toBeNull()
  })

  test("no .click(), .dispatchEvent(new MouseEvent), or synthetic click anywhere in the guide-consuming files", () => {
    for (const source of [PRODUCTS_TAB, INGREDIENTES, AGREGADOS, OPCIONES, SECCIONES, TUTORIAL]) {
      expect(source).not.toMatch(/\.click\(\)/)
      expect(source).not.toMatch(/new MouseEvent/)
    }
  })

  test("no real form's Siguiente/Guardar/submit handler is called programmatically by the guide — only the real onClick chain the owner triggers", () => {
    for (const source of [GUIDE_CONTEXT, TARGET, GUIDE_COACH, GUIDES]) {
      expect(source).not.toMatch(/handleSave\(\)|\.requestSubmit\(\)|\.submit\(\)/)
    }
  })
})

// ============================================
// §24 — no auto mutations
// ============================================
describe("§24: the guide never creates/saves/deletes anything automatically", () => {
  test("TUTORIAL_AUTO_MUTATION_COUNT=0: no save/create/delete mutation call anywhere in the guide/target/coach files", () => {
    for (const source of [GUIDE_CONTEXT, TARGET, GUIDE_COACH, GUIDES]) {
      expect(source).not.toMatch(/mutate\(|saveMutation|deleteMutation|fetch\(/)
    }
  })
})

// ============================================
// §22 — guide cleanup on every required lifecycle event
// ============================================
describe("§22: guide clears safely on close/skip/finish/reset/navigate-away — no stale ring", () => {
  test("openAtStep (navigating to a different step) stops the guide first", () => {
    const block = TUTORIAL.match(/const openAtStep = [\s\S]*?\n  \}/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/guide\.stopGuide\(\)/)
  })

  test("skip and complete both end the guide for the step being left", () => {
    expect(TUTORIAL).toMatch(/const handleCompleteStep = \(step: CatalogTutorialStep\) => \{\s*\n\s*guide\.stopGuideIfActive\(step\.id\)/)
    expect(TUTORIAL).toMatch(/const handleSkipStep = \(step: CatalogTutorialStep\) => \{\s*\n\s*guide\.stopGuideIfActive\(step\.id\)/)
  })

  test("resetting tutorial progress stops the guide", () => {
    const block = TUTORIAL.match(/const handleReset = [\s\S]*?\n  \}/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/guide\.stopGuide\(\)/)
  })

  test("every host form's closeForm stops its own guide (product, ingredient, addition, shared option, catalog section)", () => {
    expect(PRODUCTS_TAB).toMatch(/guide\.stopGuideIfActive\("create-simple-product"\)/)
    expect(PRODUCTS_TAB).toMatch(/guide\.stopGuideIfActive\("edit-product"\)/)
    expect(INGREDIENTES).toMatch(/guide\.stopGuideIfActive\("create-ingredients"\)/)
    expect(AGREGADOS).toMatch(/guide\.stopGuideIfActive\("create-additions"\)/)
    expect(OPCIONES).toMatch(/guide\.stopGuideIfActive\("create-shared-options"\)/)
    expect(SECCIONES).toMatch(/guide\.stopGuideIfActive\("catalog-sections"\)/)
  })

  test("no bounded/unbounded rAF polling loop anywhere in the new target mechanism — mount/unmount is handled by React's own lifecycle, not a scan loop", () => {
    expect(TARGET).not.toMatch(/requestAnimationFrame/)
  })

  test("a fail-safe message exists for when the guide's target genuinely isn't mounted, without any retry loop", () => {
    expect(TUTORIAL).toContain("El formulario cambió. Volvé al tutorial para continuar.")
    expect(TUTORIAL).toMatch(/isTargetMounted/)
  })
})

// ============================================
// §25 mobile — no visualViewport, no iOS dock/keyboard changes
// ============================================
describe("mobile safety: never touches visualViewport or the paused iOS dock/keyboard system", () => {
  test("no R3 guide file references visualViewport or ios-dock/ios-keyboard/ios-bottom-nav", () => {
    for (const source of ALL_R3_SOURCES) {
      expect(source).not.toMatch(/visualViewport/)
      expect(source).not.toMatch(/ios-dock|ios-keyboard-open|ios-bottom-nav/)
    }
  })
})

// ============================================
// §68 — no new tour dependency
// ============================================
describe("no new tour dependency introduced", () => {
  test("no Driver.js/Shepherd/Intro.js import anywhere in the R3 guide files", () => {
    const forbidden = /driver\.js|shepherd|intro\.js/i
    for (const source of ALL_R3_SOURCES) {
      expect(source).not.toMatch(forbidden)
    }
  })
})

// ============================================
// §27-28, §65 — R2 Business Preview contract untouched
// ============================================
describe("R2 Business Preview return contract and read-only detail are preserved", () => {
  const PAGE = readFileSync(join(process.cwd(), "src", "app", "n", "[slug]", "page.tsx"), "utf8")

  test("isBusinessPreview / previewSource=business gating is byte-for-byte the same as R2", () => {
    expect(PAGE).toMatch(/const isBusinessPreview = isPreview && previewSource === "business"/)
    expect(PAGE).toMatch(/if \(!isBusinessPreview && !requireAuth\(\)\) return/)
  })

  test("both in-app preview exits still resolve via the same isBusinessPreview ternary (EXIT A back-arrow, EXIT B banner)", () => {
    const exits = PAGE.match(/href=\{isBusinessPreview \? "\/negocio" : "\/cliente\/"\}/g) ?? []
    expect(exits.length).toBe(2)
  })

  test("preview still opens in a new tab/window from business-panel.tsx (EXIT C mitigation preserved)", () => {
    expect(BUSINESS_PANEL).toMatch(/window\.open\(`\/n\/\$\{slug\}\?preview=true&previewSource=business`, "_blank", "noopener,noreferrer"\)/)
  })

  test("CartPanel is still fully excluded from preview — no new order-mutation path introduced by the guide rewrite", () => {
    expect(PAGE).toMatch(/\{!isPreview && \(\s*\n\s*<CartPanel/)
  })
})

// ============================================
// no paused iOS R8 file touched
// ============================================
describe("no paused iOS R8 file was modified by the R3 guide rewrite", () => {
  const iosFiles = ["ios-keyboard-fix", "ios-viewport-debug-panel", "ios-debug-snapshot", "ios-dock-viewport-state"]

  test("none of the paused iOS files are referenced anywhere in the R3 guide source", () => {
    for (const source of ALL_R3_SOURCES) {
      for (const iosFile of iosFiles) {
        expect(source).not.toContain(iosFile)
      }
    }
  })
})
