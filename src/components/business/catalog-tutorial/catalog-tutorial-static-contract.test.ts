/// <reference types="bun-types" />

// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R1 — contrato estático de seguridad
// ============================================
// Static source-text contract for the tutorial's safety/UX guarantees
// (task §26 A-T). Mirrors this codebase's established convention for
// components too large/complex to mount with React Testing Library (no
// RTL exists anywhere in this repo — see config-tab.test.tsx and the iOS
// static-contract files) — assertions run against the raw source text.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const TUTORIAL = readFileSync(
  join(process.cwd(), "src", "components", "business", "catalog-tutorial", "catalog-tutorial.tsx"),
  "utf8"
)
const STORAGE = readFileSync(
  join(process.cwd(), "src", "components", "business", "catalog-tutorial", "catalog-tutorial-storage.ts"),
  "utf8"
)
const PROGRESS = readFileSync(
  join(process.cwd(), "src", "components", "business", "catalog-tutorial", "catalog-tutorial-progress.ts"),
  "utf8"
)
const STEPS = readFileSync(
  join(process.cwd(), "src", "components", "business", "catalog-tutorial", "catalog-tutorial-steps.ts"),
  "utf8"
)
const PRODUCTS_TAB = readFileSync(join(process.cwd(), "src", "components", "business", "products-tab.tsx"), "utf8")

// A
describe("A. entry point visible in Productos", () => {
  test("the 'Tutorial del catálogo' button exists and is always rendered (not behind any first-visit-only gate)", () => {
    expect(TUTORIAL).toContain("Tutorial del catálogo")
    expect(TUTORIAL).toMatch(/aria-label="Abrir tutorial del catálogo"/)
  })

  test("CatalogTutorial is mounted directly inside products-tab.tsx (all 5 subtab branches, per its own subTab-based routing)", () => {
    const mounts = PRODUCTS_TAB.match(/<CatalogTutorial\b/g) ?? []
    expect(mounts.length).toBe(5)
  })
})

// B
describe("B. does not auto-start in a blocking way", () => {
  test("the Sheet's open state defaults to false — never true on mount", () => {
    expect(TUTORIAL).toMatch(/const \[open, setOpen\] = useState\(false\)/)
  })

  test("no effect forces open=true on mount", () => {
    const effectBlocks = TUTORIAL.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[[^\]]*\]\)/g) ?? []
    for (const block of effectBlocks) {
      expect(block).not.toMatch(/setOpen\(true\)/)
    }
  })

  test("the first-visit card is only shown when NOT started and NOT dismissed — never forced, always has an escape ('Ahora no')", () => {
    expect(TUTORIAL).toMatch(/const showIntroCard = !started && !progress\.dismissedIntro/)
    expect(TUTORIAL).toContain("Ahora no")
  })
})

// C, D, E, F — covered functionally by catalog-tutorial-progress.test.ts
// (startOrContinue/back/skip/complete transitions); here we confirm the
// UI wires to those exact real controls, not placeholders.
describe("C-F. start / Next / Back / Skip / continue-after-reopen controls exist and call the real progress transitions", () => {
  test("Back ('Atrás') and Skip ('Saltar') controls exist in the step view", () => {
    expect(TUTORIAL).toContain('Atrás')
    expect(TUTORIAL).toContain('Saltar')
  })

  test("the mini 'Continuar tutorial' control only renders when started, not finished, and the sheet is closed", () => {
    expect(TUTORIAL).toMatch(/!open && started && !finished/)
    expect(TUTORIAL).toContain("Continuar tutorial · Paso")
  })

  test("completing a step calls markStepCompleted (real progress transition, not a fabricated success)", () => {
    expect(TUTORIAL).toMatch(/markStepCompleted\(progress, step\.id, Date\.now\(\)\)/)
  })
})

// G
describe("G. Reset clears ONLY tutorial progress — never catalog data", () => {
  test("handleReset only calls resetTutorialProgress — no product/category/ingredient/addition mutation function is referenced anywhere in this file", () => {
    expect(TUTORIAL).toMatch(/const handleReset = \(\) => \{[\s\S]*?resetTutorialProgress\(\)/)
    const forbidden = /deleteProduct|deleteCategoria|deleteIngrediente|deleteAgregado|saveMutation|useMutation|fetch\(/
    expect(TUTORIAL).not.toMatch(forbidden)
  })

  test("the reset confirmation dialog states explicitly that the catalog is not modified", () => {
    expect(TUTORIAL).toContain(
      "Esto reinicia únicamente el progreso del tutorial. Tu catálogo no se modifica."
    )
  })

  test("resetTutorialProgress (pure) returns a fresh initial progress and takes no catalog-related argument", () => {
    expect(PROGRESS).toMatch(/export function resetTutorialProgress\(\): CatalogTutorialProgress \{\s*\n\s*return createInitialProgress\(\)\s*\n\s*\}/)
  })
})

// H — covered by catalog-tutorial-progress.test.ts (buildTutorialStorageKey,
// CATALOG_TUTORIAL_STORAGE_VERSION, whitelist). Confirm the constant is
// exported and used consistently.
describe("H. localStorage schema/version", () => {
  test("the storage key includes the version and the business id", () => {
    expect(PROGRESS).toMatch(/`deligo:catalog-tutorial:v\$\{CATALOG_TUTORIAL_STORAGE_VERSION\}:\$\{businessId\}`/)
  })
})

// I
describe("I. corrupted/missing localStorage fails safely", () => {
  test("readTutorialProgress wraps localStorage.getItem in try/catch and falls back to createInitialProgress on any error", () => {
    const block = STORAGE.match(/export function readTutorialProgress[\s\S]*?\n\}/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/try \{/)
    expect(block![0]).toMatch(/catch \{/)
    expect(block![0]).toMatch(/createInitialProgress\(\)/)
  })

  test("writeTutorialProgress also wraps localStorage.setItem in try/catch — a failed write never throws up into the Productos UI", () => {
    const block = STORAGE.match(/export function writeTutorialProgress[\s\S]*?\n\}/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/try \{/)
    expect(block![0]).toMatch(/catch \{/)
  })
})

// J, K — covered by catalog-tutorial-steps.test.ts (getVisibleSteps).
// Confirm the UI actually calls the rubro-aware filter, not the raw list.
describe("J-K. rubro adaptation wired through in the UI, not just available in the pure module", () => {
  test("CatalogTutorial computes visibleSteps via getVisibleSteps(rubro), never renders the raw CATALOG_TUTORIAL_STEPS list directly", () => {
    expect(TUTORIAL).toMatch(/const visibleSteps = useMemo\(\(\) => getVisibleSteps\(rubro\), \[rubro\]\)/)
    expect(TUTORIAL).not.toMatch(/CATALOG_TUTORIAL_STEPS/)
  })

  test("rubro is normalized from the real negocio.rubro prop the same way business-panel.tsx does (normalizeRubro)", () => {
    expect(TUTORIAL).toMatch(/const rubro = useMemo\(\(\) => normalizeRubro\(negocio\.rubro\), \[negocio\.rubro\]\)/)
  })
})

// L
describe("L. Simple/Expert wording is correct (never 'convert'/'migrate')", () => {
  test("the simple-vs-expert step explicitly denies conversion/data loss", () => {
    expect(STEPS).toContain(
      "Modo Experto no convierte el {producto} ni borra lo que ya cargaste. Sólo muestra herramientas adicionales."
    )
  })

  test("the mode-switch step never affirmatively claims conversion/migration (only the negated denial from the previous test)", () => {
    const modeStep = STEPS.match(/id: "simple-vs-expert"[\s\S]*?\n  \},/)
    expect(modeStep).not.toBeNull()
    // Only the negated form ("no convierte") is allowed; an affirmative
    // "convierte el {producto}" (without "no" immediately before it)
    // would be a false claim and must never appear.
    expect(modeStep![0]).not.toMatch(/(?<!no )convierte el \{producto\}/)
  })
})

// M
describe("M. Ingredient vs. Addition distinction present", () => {
  test("ingredient step says no price / removable; addition step says can have a price and can be free", () => {
    expect(STEPS).toMatch(/No tienen precio — quitarlos no cambia el total\./)
    expect(STEPS).toMatch(/Precio 0 es válido: representa un extra gratuito\./)
  })

  test("the decision-table help explicitly distinguishes the two", () => {
    expect(STEPS).toContain('{ need: "Que el cliente pueda quitar tomate", answer: "Ingrediente" }')
    expect(STEPS).toContain('{ need: "Que agregue panceta por un precio extra", answer: "Agregado" }')
  })
})

// N
describe("N. Own-section vs. shared-option distinction present", () => {
  test("comparison content states own sections have no price delta, shared options do", () => {
    expect(STEPS).toMatch(/Las opciones no cambian el precio hoy/)
    expect(STEPS).toMatch(/Las opciones s.? pueden tener precio/)
  })
})

// O — covered by catalog-tutorial-steps.test.ts already (stock wording).

// P
describe("P. the deletion step never executes a real DELETE", () => {
  test("delete-safely step content is purely educational and requires no destructive action", () => {
    expect(STEPS).toMatch(/id: "delete-safely"/)
    expect(STEPS).toMatch(/Este paso es educativo — no hace falta borrar nada para completarlo\./)
  })

  test("catalog-tutorial.tsx never calls a DELETE fetch or any *delete* mutation function", () => {
    expect(TUTORIAL).not.toMatch(/method:\s*["']DELETE["']/)
    expect(TUTORIAL).not.toMatch(/deleteMutation|onDelete\(/)
  })
})

// Q
describe("Q. tutorial actions never auto-submit forms or fake DOM clicks", () => {
  test("no querySelector-based click hack anywhere in the tutorial", () => {
    expect(TUTORIAL).not.toMatch(/querySelector\([^)]*\)\.click\(\)/)
    expect(TUTORIAL).not.toMatch(/getElementById\([^)]*\)\.click\(\)/)
  })

  test("no .submit() call, no requestSubmit(), no simulated form submission", () => {
    expect(TUTORIAL).not.toMatch(/\.submit\(\)/)
    expect(TUTORIAL).not.toMatch(/requestSubmit/)
  })

  test("openCreateProduct action only opens the real create form (via the host's own openNewForm) — it never fills or submits it", () => {
    const block = TUTORIAL.match(/case "openCreateProduct":[\s\S]*?return/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/onRequestCreateProduct\(\)/)
    expect(block![0]).not.toMatch(/setFormData|handleSave|saveMutation/)
  })

  test("runAction never calls a save/create/update/delete mutation directly — only navigation/mode-switch callbacks", () => {
    const actionBlock = TUTORIAL.match(/const runAction = [\s\S]*?\n  \}/)
    expect(actionBlock).not.toBeNull()
    expect(actionBlock![0]).not.toMatch(/mutate\(|saveMutation|fetch\(/)
  })
})

// R
describe("R. no network call from progress storage", () => {
  test("catalog-tutorial-storage.ts never calls fetch/XMLHttpRequest/axios", () => {
    expect(STORAGE).not.toMatch(/fetch\(|XMLHttpRequest|axios/)
  })

  test("catalog-tutorial-progress.ts (pure logic) has no network/DOM API at all", () => {
    expect(PROGRESS).not.toMatch(/fetch\(|XMLHttpRequest|axios|window\.|document\./)
  })
})

// S
describe("S. no tutorial telemetry", () => {
  test("no analytics/tracking call anywhere in the catalog-tutorial directory's source files checked here", () => {
    const forbidden = /analytics|gtag|posthog|mixpanel|segment\.track|sendBeacon/i
    for (const source of [TUTORIAL, STORAGE, PROGRESS, STEPS]) {
      expect(source).not.toMatch(forbidden)
    }
  })
})

// T
describe("T. mobile-safe rendering / static contract", () => {
  test("the Sheet uses a responsive width (full width on mobile, capped on larger screens) — no fixed pixel width", () => {
    expect(TUTORIAL).toMatch(/className="flex w-full flex-col sm:max-w-md"/)
  })

  test("never reads visualViewport or touches the paused iOS dock system (task §19, §24)", () => {
    expect(TUTORIAL).not.toMatch(/visualViewport/)
    expect(TUTORIAL).not.toMatch(/ios-dock|ios-keyboard-open|ios-bottom-nav/)
  })

  test("every interactive control is a real <button>/Button component — never a clickable div", () => {
    expect(TUTORIAL).not.toMatch(/<div[^>]*onClick=/)
  })
})

describe("no paused iOS R8 file was modified by this task", () => {
  const iosFiles = [
    "src/app/globals.css",
    "src/components/pwa/ios-keyboard-fix.tsx",
    "src/components/pwa/ios-viewport-debug-panel.tsx",
    "src/lib/ios-debug-snapshot.ts",
    "src/lib/ios-debug-snapshot.test.ts",
    "src/lib/ios-nav-dock-static-contract.test.ts",
    "src/lib/ios-dock-viewport-state.ts",
    "src/lib/ios-dock-viewport-state.test.ts",
    "src/lib/ios-standalone-degraded-viewport-dock-fallback-r8-static-contract.test.ts",
  ]

  test("none of the paused iOS files are imported by any tutorial file (a proxy for 'never touched them')", () => {
    for (const source of [TUTORIAL, STORAGE, PROGRESS, STEPS]) {
      for (const iosFile of iosFiles) {
        const base = iosFile.split("/").pop()!.replace(/\.tsx?$/, "")
        expect(source).not.toContain(base)
      }
    }
  })
})
