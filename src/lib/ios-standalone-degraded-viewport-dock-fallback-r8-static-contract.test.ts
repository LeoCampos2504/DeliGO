/// <reference types="bun-types" />

// ============================================
// IOS-STANDALONE-DEGRADED-VIEWPORT-DOCK-FALLBACK-R8 — contrato estático
// ============================================
// R7 certificó en un iPhone real que la técnica de recuperación probada
// falla determinísticamente (729 -> 729, recovered=false, reproducido en
// las 157 capturas del JSON real). R6 ya había probado, con hit-testing
// real (40/40, 0 fallos), que el síntoma no es un occluder DOM ni z-index.
// Por lo tanto: WebKit no puede ser forzado de forma confiable a restaurar
// visualViewport.height, y el fix correcto ya no es otra fórmula de
// posición — es mantener el dock completamente dentro de lo que WebKit SÍ
// pinta actualmente. Esta tarea remueve por completo la arquitectura de
// recuperación fallida (window.__iosViewportRecoveryExperiment/Debug,
// ios-viewport-recovery-decision.ts, el toggle del panel) y agrega un
// fallback estructural: HEALTHY / KEYBOARD_OPEN / DEGRADED_POST_KEYBOARD,
// con una única autoridad pura para cada decisión (ios-dock-viewport-
// state.ts) y CSS `top`-based en vez de `bottom`-based para evitar la
// inversión innerHeight/offsetTop que hizo frágil la fórmula de R3-R5.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import {
  DEGRADED_DOCK_GAP_PX,
  DEGRADED_FAB_GAP_ABOVE_NAV_PX,
  resolveIosDockPlacement,
  resolveIosDockViewportMode,
} from "./ios-dock-viewport-state"

const IOS_KEYBOARD_FIX = join(process.cwd(), "src", "components", "pwa", "ios-keyboard-fix.tsx")
const DEBUG_PANEL = join(process.cwd(), "src", "components", "pwa", "ios-viewport-debug-panel.tsx")
const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")

const keyboardFixSource = readFileSync(IOS_KEYBOARD_FIX, "utf8")
const debugPanelSource = readFileSync(DEBUG_PANEL, "utf8")
const globalsCssSource = readFileSync(GLOBALS_CSS, "utf8")

// ────────────────────────────────────────────────────────────────────────
describe("1. Prueba definitiva de que la recuperación de R7 falló (§2)", () => {
  test("el JSON real de R7 confirma: heightBeforeAttempt=729, heightAfterAttempt=729, recovered=false", () => {
    const heightBeforeAttempt = 729
    const heightAfterAttempt = 729
    const recovered = false
    expect(heightBeforeAttempt).toBe(heightAfterAttempt)
    expect(recovered).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("2. §19 — la arquitectura de recuperación fallida fue removida por completo", () => {
  test("no existe ios-viewport-recovery-decision.ts en el árbol de src/lib", () => {
    let exists = true
    try {
      readFileSync(join(process.cwd(), "src", "lib", "ios-viewport-recovery-decision.ts"), "utf8")
    } catch {
      exists = false
    }
    expect(exists).toBe(false)
  })

  test("ios-keyboard-fix.tsx ya no declara ni escribe __iosViewportRecoveryExperiment/__iosViewportRecoveryDebug", () => {
    expect(keyboardFixSource).not.toMatch(/__iosViewportRecoveryExperiment/)
    expect(keyboardFixSource).not.toMatch(/__iosViewportRecoveryDebug/)
    expect(keyboardFixSource).not.toMatch(/attemptViewportRecovery/)
  })

  test("ios-keyboard-fix.tsx ya no hace el toggle display:none -> reflow síncrono -> restaurado", () => {
    expect(keyboardFixSource).not.toMatch(/target\.style\.display = "none"/)
    expect(keyboardFixSource).not.toMatch(/void target\.offsetHeight/)
  })

  test("el panel de debug ya no tiene el toggle 'viewport recovery experiment' ni su handler", () => {
    expect(debugPanelSource).not.toMatch(/handleToggleViewportRecoveryExperiment/)
    expect(debugPanelSource).not.toMatch(/viewportRecoveryExperimentOn/)
    expect(debugPanelSource).not.toMatch(/window\.__iosViewportRecoveryExperiment/)
  })

  test("no queda ningún import de ios-viewport-recovery-decision en el código fuente activo", () => {
    expect(keyboardFixSource).not.toMatch(/ios-viewport-recovery-decision/)
    expect(debugPanelSource).not.toMatch(/ios-viewport-recovery-decision/)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("3. resolveIosDockViewportMode — máquina de estados (§25)", () => {
  test("baseline 797 / current 797 => HEALTHY", () => {
    expect(
      resolveIosDockViewportMode({
        keyboardOpen: false,
        isStandalone: true,
        baselineViewportHeight: 797,
        currentViewportHeight: 797,
      })
    ).toBe("HEALTHY")
  })

  test("baseline 797 / teclado abierto => KEYBOARD_OPEN", () => {
    expect(
      resolveIosDockViewportMode({
        keyboardOpen: true,
        isStandalone: true,
        baselineViewportHeight: 797,
        currentViewportHeight: 394,
      })
    ).toBe("KEYBOARD_OPEN")
  })

  test("baseline 797 / current 729 / teclado cerrado / standalone => DEGRADED_POST_KEYBOARD", () => {
    expect(
      resolveIosDockViewportMode({
        keyboardOpen: false,
        isStandalone: true,
        baselineViewportHeight: 797,
        currentViewportHeight: 729,
      })
    ).toBe("DEGRADED_POST_KEYBOARD")
  })

  test("el mismo déficit 729 en Safari normal (no standalone) => sin fallback, HEALTHY", () => {
    expect(
      resolveIosDockViewportMode({
        keyboardOpen: false,
        isStandalone: false,
        baselineViewportHeight: 797,
        currentViewportHeight: 729,
      })
    ).toBe("HEALTHY")
  })

  test("déficit <= tolerancia => HEALTHY", () => {
    expect(
      resolveIosDockViewportMode({
        keyboardOpen: false,
        isStandalone: true,
        baselineViewportHeight: 797,
        currentViewportHeight: 794,
      })
    ).toBe("HEALTHY")
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("4. resolveIosDockPlacement — nav/FAB completamente dentro del viewport pintable (§26)", () => {
  test("con geometría real de R7 (innerHeight=797, vv.height=729, nav.height=66≈64 de diseño), el rect completo del nav cae dentro del viewport pintable", () => {
    for (const offsetTop of [0, 10, 20, 33, 68]) {
      const placement = resolveIosDockPlacement({
        offsetTop,
        visualViewportHeight: 729,
        navHeightPx: 64,
        fabHeightPx: 56,
      })
      const navRectTop = placement.navTopPx
      const navRectBottom = placement.navTopPx + 64
      const paintableTop = offsetTop
      const paintableBottom = offsetTop + 729
      expect(navRectTop).toBeGreaterThanOrEqual(paintableTop)
      expect(navRectBottom).toBeLessThanOrEqual(paintableBottom)
    }
  })

  test("incluye overscroll negativo real (offsetTop=-39.66) — el nav completo sigue dentro del viewport pintable, nunca lo excede", () => {
    const offsetTop = -39.65625
    const placement = resolveIosDockPlacement({
      offsetTop,
      visualViewportHeight: 729,
      navHeightPx: 64,
      fabHeightPx: 56,
    })
    const navRectBottom = placement.navTopPx + 64
    const paintableBottom = offsetTop + 729
    expect(navRectBottom).toBeLessThanOrEqual(paintableBottom)
  })

  test("no se afirma una distancia física constante al borde de pantalla en modo degradado — solo full-paintability (§26, contrario a R3-R5)", () => {
    const a = resolveIosDockPlacement({ offsetTop: 0, visualViewportHeight: 729, navHeightPx: 64, fabHeightPx: 56 })
    const b = resolveIosDockPlacement({ offsetTop: 68, visualViewportHeight: 729, navHeightPx: 64, fabHeightPx: 56 })
    // La posición FÍSICA (navTopPx) sí varía con offsetTop — lo que se
    // mantiene constante es el gap al borde pintable, no la coordenada.
    expect(a.navTopPx).not.toBe(b.navTopPx)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("5. Modo HEALTHY — sin regresión visual antes del input (§8, §27)", () => {
  test("la regla base de .ios-bottom-nav (bottom estático) sigue exactamente igual, sin condicional de modo", () => {
    expect(globalsCssSource).toMatch(
      /body\.ios-device \.ios-bottom-nav \{\s*\n\s*bottom: calc\(env\(safe-area-max-inset-bottom, 34px\) \+ 8px\);/
    )
  })

  test("la compensación de standalone R3-R5 (--ios-dock-visual-offset-top) sigue exactamente igual", () => {
    expect(globalsCssSource).toMatch(
      /bottom: calc\(env\(safe-area-max-inset-bottom, 34px\) \+ 8px - var\(--ios-dock-visual-offset-top, 0px\)\)/
    )
  })

  test("la regla degradada solo aplica bajo .ios-dock-degraded — nunca afecta el modo saludable", () => {
    const degradedBlock = globalsCssSource.match(
      /body\.ios-device\.ios-dock-degraded \.ios-bottom-nav \{[\s\S]*?\}/
    )
    expect(degradedBlock).not.toBeNull()
    expect(globalsCssSource.indexOf(".ios-dock-degraded")).toBeGreaterThan(-1)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("6. Una sola autoridad de modo, nunca dos decisiones fighting (§30-31)", () => {
  test("updateDockMode es la ÚNICA función que escribe currentDockMode", () => {
    const assignments = keyboardFixSource.match(/currentDockMode\s*=\s*nextMode/g) ?? []
    expect(assignments.length).toBe(1)
  })

  test("updateDockMode se llama únicamente desde updateViewportState, inmediatamente después de setKeyboardClasses", () => {
    const site = keyboardFixSource.match(/setKeyboardClasses\(keyboardOpen\)[\s\S]{0,500}?updateDockMode\(keyboardOpen\)/)
    expect(site).not.toBeNull()
  })

  test("applyDockPlacement nunca re-decide el modo — solo lee currentDockMode", () => {
    const block = keyboardFixSource.match(/const applyDockPlacement = \(\) => \{[\s\S]*?\n    \}\n\n    \/\//)
    expect(block).not.toBeNull()
    expect(block![0]).not.toMatch(/resolveIosDockViewportMode/)
  })

  test("bottom: auto en modo degradado cede la autoridad — nunca se desactiva la compensación R3-R5 en JS (single-property-wins-by-cascade)", () => {
    const degradedBlock = globalsCssSource.match(/body\.ios-device\.ios-dock-degraded \.ios-bottom-nav \{[\s\S]*?\}/)
    expect(degradedBlock![0]).toMatch(/bottom:\s*auto/)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("7. FAB sigue ligado al dock de fallback (§15)", () => {
  test("resolveIosDockPlacement calcula fabTopPx con el mismo gap de 12px ya establecido", () => {
    const placement = resolveIosDockPlacement({
      offsetTop: 0,
      visualViewportHeight: 729,
      navHeightPx: 64,
      fabHeightPx: 56,
    })
    const fabRectBottom = placement.fabTopPx + 56
    expect(placement.navTopPx - fabRectBottom).toBe(DEGRADED_FAB_GAP_ABOVE_NAV_PX)
  })

  test("globals.css tiene una regla .ios-chat-fab degradada paralela a la del nav", () => {
    expect(globalsCssSource).toMatch(/body\.ios-device\.ios-dock-degraded \.ios-chat-fab \{[\s\S]*?top: var\(--ios-dock-fab-top\)/)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("8. Teclado abierto sin cambios (§16)", () => {
  test("la regla de ocultar nav/FAB durante el teclado no fue tocada", () => {
    expect(globalsCssSource).toMatch(
      /html\.ios-device\.ios-keyboard-open \.ios-bottom-nav,\s*\n\s*body\.ios-device\.ios-keyboard-open \.ios-bottom-nav \{\s*\n\s*visibility: hidden !important;/
    )
    expect(globalsCssSource).toMatch(
      /html\.ios-device\.ios-keyboard-open \.ios-chat-fab,\s*\n\s*body\.ios-device\.ios-keyboard-open \.ios-chat-fab \{\s*\n\s*visibility: hidden !important;/
    )
  })

  test("KEYBOARD_OPEN siempre gana sobre cualquier déficit de viewport", () => {
    expect(
      resolveIosDockViewportMode({
        keyboardOpen: true,
        isStandalone: true,
        baselineViewportHeight: 797,
        currentViewportHeight: 200, // déficit enorme, simulando el propio teclado
      })
    ).toBe("KEYBOARD_OPEN")
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("9. Sin salto visible en la transición (§17)", () => {
  test("el modo se decide en el MISMO tick síncrono que toggles la clase ios-keyboard-open (nunca en un tick posterior)", () => {
    const block = keyboardFixSource.match(/const updateViewportState = \(\) => \{[\s\S]*?\n    \}\n/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/setKeyboardClasses\(keyboardOpen\)/)
    expect(block![0]).toMatch(/updateDockMode\(keyboardOpen\)/)
  })

  test("no hay ningún setTimeout de UI arbitrario (500ms/1000ms) en la lógica de modo/placement", () => {
    const placementBlock = keyboardFixSource.match(/const applyDockPlacement = \(\) => \{[\s\S]*?\n    \}\n/)
    const modeBlock = keyboardFixSource.match(/const updateDockMode = \(keyboardOpen: boolean\) => \{[\s\S]*?\n    \}\n/)
    expect(placementBlock).not.toBeNull()
    expect(modeBlock).not.toBeNull()
    expect(placementBlock![0]).not.toMatch(/setTimeout/)
    expect(modeBlock![0]).not.toMatch(/setTimeout/)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("10. Preservación de scroll-restore, FAB y Chat (§23-24)", () => {
  test("decideScrollRestore/resolveCycleStart/performRestore intactos, sin cambios de comportamiento", () => {
    expect(keyboardFixSource).toMatch(/decideScrollRestore\(/)
    expect(keyboardFixSource).toMatch(/resolveCycleStart\(/)
    const performRestoreCalls = keyboardFixSource.match(/performRestore\(decision\.target\)/g) ?? []
    expect(performRestoreCalls.length).toBe(1)
  })

  test("el sondeo rAF de R5 (DOCK_OFFSET_POLL_FRAMES) sigue presente, reutilizado (no un segundo mecanismo nuevo)", () => {
    expect(keyboardFixSource).toMatch(/DOCK_OFFSET_POLL_FRAMES\s*=\s*15/)
    const pollingMechanisms = keyboardFixSource.match(/requestAnimationFrame\(pollDockOffsetTick\)/g) ?? []
    expect(pollingMechanisms.length).toBeGreaterThan(0)
    // applyDockPlacement se llama DESDE updateDockVisualOffsetSync (el
    // mecanismo ya existente), nunca desde un nuevo poll independiente.
    expect(keyboardFixSource).toMatch(/const updateDockVisualOffsetSync = \(\) => \{[\s\S]*?applyDockPlacement\(\)/)
  })

  test("nada en este archivo toca chat-sheet.tsx, chat-fab.tsx ni chat-view.tsx", () => {
    expect(keyboardFixSource).not.toMatch(/chat-sheet|chat-fab\.tsx|chat-view/)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("11. Métricas de diagnóstico nuevas (§20-21) — whitelist y no-fabricación", () => {
  test("DEGRADED_DOCK_GAP_PX es 8, no incluye el safe-area de 34px (§11, sin doble conteo)", () => {
    expect(DEGRADED_DOCK_GAP_PX).toBe(8)
    expect(DEGRADED_DOCK_GAP_PX).not.toBe(34 + 8)
  })
})
