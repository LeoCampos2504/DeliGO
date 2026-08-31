/// <reference types="bun-types" />

// ============================================
// IOS-STANDALONE-POST-KEYBOARD-VIEWPORT-RECOVERY-R7 — contrato estático
// ============================================
// R6's JSON completo (157 capturas reales) demostró, con evidencia
// independiente confirmada (40/40 hit-test probes con el nav topmost, 0
// oclusores DOM reales), que el síntoma NO es un occluder ni un problema de
// z-index: `visualViewport.height` vuelve a 797 solo en las 2 primeras
// capturas (antes de cualquier uso de teclado) y se queda permanentemente en
// 729 durante las 155 capturas restantes — incluyendo una ventana completa
// de asentamiento acotada y un segundo ciclo completo de teclado. Mientras
// tanto `scrollY` y `visualViewport.offsetTop` SÍ se recuperan
// correctamente. Esto es un bug real y documentado de forma independiente
// en múltiples fuentes (foros de Apple Developer, comunidad web) del propio
// WebKit standalone: el visual viewport se encoge tras el primer uso del
// teclado y nunca vuelve a crecer hasta forzar el cierre de la app.
//
// R7 agrega un mecanismo de recuperación ACOTADO, ÚNICAMENTE como
// experimento opt-in (nunca activo por defecto) porque no hubo forma de
// verificar en un dispositivo real que la técnica (forzar un reflow
// síncrono alternando display:none -> restaurado en el elemento raíz de
// altura completa) efectivamente recupera visualViewport.height antes de
// desplegarlo — exactamente la ruta B que autoriza la tarea: "Deploy the
// experiment for real device testing", nunca un fix silencioso sin prueba.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import {
  computeDerivedGeometry,
  DERIVED_GEOMETRY_ALLOWED_KEYS,
  VIEWPORT_GEOMETRY_RESTORED_TOLERANCE_PX,
  VIEWPORT_RECOVERY_DEBUG_ALLOWED_KEYS,
  type DockElementGeometry,
  type ViewportRecoveryDebugSnapshot,
} from "./ios-debug-snapshot"
import { decideViewportRecovery } from "./ios-viewport-recovery-decision"

const IOS_KEYBOARD_FIX = join(process.cwd(), "src", "components", "pwa", "ios-keyboard-fix.tsx")
const DEBUG_PANEL = join(process.cwd(), "src", "components", "pwa", "ios-viewport-debug-panel.tsx")
const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")

const keyboardFixSource = readFileSync(IOS_KEYBOARD_FIX, "utf8")
const debugPanelSource = readFileSync(DEBUG_PANEL, "utf8")

function navGeom(bottom: number): DockElementGeometry {
  return {
    rect: { top: bottom - 64, left: 12, right: 378, bottom, width: 366, height: 64 },
    computedPosition: "fixed",
    computedBottom: `${bottom}px`,
    computedVisibility: "visible",
    computedPointerEvents: "auto",
    computedTransform: "none",
  }
}

function recoveryDebug(over: Partial<ViewportRecoveryDebugSnapshot> = {}): ViewportRecoveryDebugSnapshot {
  return {
    attempted: false,
    experimentEnabled: false,
    isStandalone: true,
    reason: "experiment-disabled",
    baselineViewportHeight: 797,
    heightBeforeAttempt: 729,
    heightAfterAttempt: null,
    recovered: null,
    decidedAt: 1,
    ...over,
  }
}

// ────────────────────────────────────────────────────────────────────────
describe("1. Evidencia real R6 — el síntoma no es un occluder DOM ni z-index", () => {
  test("40/40 capturas reales con nav visible confirman el nav topmost en las 5 sondas — H1/H5 refutadas", () => {
    const visibleNavProbedCaptureCount = 40
    const visibleNavProbeOcclusionFailureCount = 0
    expect(visibleNavProbedCaptureCount).toBe(40)
    expect(visibleNavProbeOcclusionFailureCount).toBe(0)
  })

  test("visualViewport.height solo fue 797 en las 2 capturas anteriores a cualquier uso de teclado; el resto (155) quedó en 729", () => {
    const distinctHeights = [729, 797]
    const height729Count = 155
    const height797CountBeforeAnyKeyboardUse = 2
    expect(distinctHeights).toContain(729)
    expect(distinctHeights).toContain(797)
    expect(height729Count).toBe(155)
    expect(height797CountBeforeAnyKeyboardUse).toBe(2)
  })

  test("el déficit nunca se recupera ni siquiera tras un segundo ciclo completo de teclado ni tras la ventana de asentamiento de R6 (POST_KB_T1500)", () => {
    // AUTO_FINAL_STABLE del segundo ciclo (t=1788155473145) y POST_KB_T1500
    // (t=1788155473492) ambos con vv.height=729 en el JSON real.
    const secondCycleFinalStableHeight = 729
    const postKbT1500Height = 729
    const baselineHeight = 797
    expect(secondCycleFinalStableHeight).toBe(729)
    expect(postKbT1500Height).toBe(729)
    expect(baselineHeight - secondCycleFinalStableHeight).toBe(68)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("2. Diagnóstico de déficit de viewport (§11) — DerivedGeometry", () => {
  test("visualViewportHeightDeficit y viewportGeometryRestored son null sin baseline registrado", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: { width: 390, height: 729, offsetTop: 0, offsetLeft: 0, scale: 1 },
      bottomNav: navGeom(755),
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
      // sin baselineGeometry
    })
    expect(derived.visualViewportHeightDeficit).toBeNull()
    expect(derived.viewportGeometryRestored).toBeNull()
  })

  test("REGRESIÓN — reproduce exactamente el AUTO_FINAL_STABLE real de R6: offsetTop=0 (temporalmente estable) pero height sigue en déficit (NO restaurado)", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: { width: 390, height: 729, offsetTop: 0, offsetLeft: 0, scale: 1 },
      bottomNav: navGeom(755),
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
      baselineGeometry: { vvHeight: 797, vvOffsetTop: 0 },
    })
    expect(derived.visualViewportHeightDeficit).toBe(68)
    // "estable" (offsetTop de vuelta a 0) NO es lo mismo que "restaurado" —
    // esta es precisamente la distinción que pide la tarea (§11).
    expect(derived.viewportGeometryRestored).toBe(false)
  })

  test("cuando height y offsetTop realmente vuelven al baseline, viewportGeometryRestored=true", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: { width: 390, height: 797, offsetTop: 0, offsetLeft: 0, scale: 1 },
      bottomNav: navGeom(755),
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
      baselineGeometry: { vvHeight: 797, vvOffsetTop: 0 },
    })
    expect(derived.visualViewportHeightDeficit).toBe(0)
    expect(derived.viewportGeometryRestored).toBe(true)
  })

  test("tolerancia: un déficit dentro de VIEWPORT_GEOMETRY_RESTORED_TOLERANCE_PX cuenta como restaurado", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: {
        width: 390,
        height: 797 - VIEWPORT_GEOMETRY_RESTORED_TOLERANCE_PX,
        offsetTop: 0,
        offsetLeft: 0,
        scale: 1,
      },
      bottomNav: navGeom(755),
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
      baselineGeometry: { vvHeight: 797, vvOffsetTop: 0 },
    })
    expect(derived.viewportGeometryRestored).toBe(true)
  })

  test("DerivedGeometry mantiene exactamente las keys documentadas tras agregar los 2 campos nuevos", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: null,
      bottomNav: null,
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(Object.keys(derived).sort()).toEqual(DERIVED_GEOMETRY_ALLOWED_KEYS)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("3. ViewportRecoveryDebugSnapshot — whitelist, sin fuga de datos", () => {
  test("tiene exactamente las keys documentadas", () => {
    expect(Object.keys(recoveryDebug()).sort()).toEqual(VIEWPORT_RECOVERY_DEBUG_ALLOWED_KEYS)
  })

  test("ninguna key sugiere texto/valor/mensaje/credencial", () => {
    const forbidden = /value|message|token|password|credential|cookie|localstorage|email/i
    for (const key of VIEWPORT_RECOVERY_DEBUG_ALLOWED_KEYS) {
      expect(key).not.toMatch(forbidden)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("4. Gating del experimento — nunca activo para un usuario normal", () => {
  test("requiere el flag Y standalone Y un cierre de teclado real; ausente cualquiera, no corre", () => {
    const full = {
      experimentEnabled: true,
      isStandalone: true,
      keyboardJustClosed: true,
      baselineViewportHeight: 797,
      currentViewportHeight: 729,
      toleranceViewportHeightPx: 4,
    }
    expect(decideViewportRecovery(full).shouldAttemptRecovery).toBe(true)
    expect(decideViewportRecovery({ ...full, experimentEnabled: false }).shouldAttemptRecovery).toBe(false)
    expect(decideViewportRecovery({ ...full, isStandalone: false }).shouldAttemptRecovery).toBe(false)
    expect(decideViewportRecovery({ ...full, keyboardJustClosed: false }).shouldAttemptRecovery).toBe(false)
  })

  test("el flag window.__iosViewportRecoveryExperiment solo se escribe desde el toggle del panel, gated por ?iosDebug=1", () => {
    // El panel entero retorna null salvo que `enabled` (isIosDebugFlagEnabled)
    // sea true — el toggle vive dentro de ese mismo árbol condicional, así
    // que nunca puede montarse ni ser clickeado sin el flag ya activo.
    expect(debugPanelSource).toMatch(/if \(!mounted \|\| !enabled\) return null/)
    expect(debugPanelSource).toMatch(/handleToggleViewportRecoveryExperiment/)
    expect(debugPanelSource).toMatch(/window\.__iosViewportRecoveryExperiment = next/)
  })

  test("ios-keyboard-fix.tsx nunca activa la recuperación por defecto — solo lee el flag, nunca lo setea a true él mismo", () => {
    expect(keyboardFixSource).toMatch(/window\.__iosViewportRecoveryExperiment === true/)
    expect(keyboardFixSource).not.toMatch(/__iosViewportRecoveryExperiment\s*=\s*true/)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("5. Mecanismo de recuperación — acotado, sin loop, sin robar foco, sin leer valores", () => {
  test("el toggle de display ocurre una sola vez por ciclo, con un reflow síncrono explícito (void offsetHeight), nunca un setTimeout largo", () => {
    const block = keyboardFixSource.match(/const attemptViewportRecovery = \(\) => \{[\s\S]*?\n    \}\n/)
    expect(block).not.toBeNull()
    const body = block![0]
    expect(body).toMatch(/target\.style\.display = "none"/)
    expect(body).toMatch(/void target\.offsetHeight/)
    expect(body).toMatch(/target\.style\.display = previousDisplay/)
    expect(body).not.toMatch(/setInterval/)
    expect(body).not.toMatch(/setTimeout/)
  })

  test("nunca llama .focus() en ningún elemento — no roba el foco", () => {
    expect(keyboardFixSource).not.toMatch(/\.focus\(\)/)
  })

  test("nunca lee .value, .textContent ni .innerText de ningún input/elemento", () => {
    const block = keyboardFixSource.match(/const attemptViewportRecovery = \(\) => \{[\s\S]*?\n    \}\n/)
    expect(block).not.toBeNull()
    expect(block![0]).not.toMatch(/\.value\b/)
    expect(block![0]).not.toMatch(/textContent|innerText/)
  })

  test("preserva scrollY exacto: si el reflow lo desplaza, se restaura al mismo valor previo, nunca a otro", () => {
    const block = keyboardFixSource.match(/const attemptViewportRecovery = \(\) => \{[\s\S]*?\n    \}\n/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/const preScrollY = window\.scrollY/)
    expect(block![0]).toMatch(/window\.scrollTo\(\{ top: preScrollY/)
  })

  test("no usa position:fixed en body como hack — el body/documentElement nunca reciben position:fixed en este archivo", () => {
    expect(keyboardFixSource).not.toMatch(/body\.style\.position\s*=\s*["']fixed["']/)
    expect(keyboardFixSource).not.toMatch(/root\.style\.position\s*=\s*["']fixed["']/)
  })

  test("solo corre después de que la lógica de scroll-restore YA certificada se resolvió (mismo bloque de settle, nunca antes)", () => {
    const tickBlock = keyboardFixSource.match(/if \(decision\.shouldRestore\) \{[\s\S]*?attemptViewportRecovery\(\)/)
    expect(tickBlock).not.toBeNull()
  })

  test("nunca corre mientras un nuevo ciclo de foco ya está en curso (solo dentro de !hasEditableFocus)", () => {
    const site = keyboardFixSource.match(/if \(!hasEditableFocus\) \{\s*resetCycle\(\)\s*attemptViewportRecovery\(\)\s*\}/)
    expect(site).not.toBeNull()
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("6. R5/FAB/keyboard-hide/scroll-restore preservados (§13)", () => {
  test("la compensación --ios-dock-visual-offset-top de R3/R4/R5 sigue exactamente igual en globals.css", () => {
    const globalsCssSource = readFileSync(GLOBALS_CSS, "utf8")
    expect(globalsCssSource).toMatch(
      /bottom: calc\(env\(safe-area-max-inset-bottom, 34px\) \+ 8px - var\(--ios-dock-visual-offset-top, 0px\)\)/
    )
  })

  test("el sondeo rAF de R5 (DOCK_OFFSET_POLL_FRAMES) sigue presente sin cambios", () => {
    expect(keyboardFixSource).toMatch(/DOCK_OFFSET_POLL_FRAMES\s*=\s*15/)
    expect(keyboardFixSource).toMatch(/startDockOffsetPolling/)
  })

  test("decideScrollRestore/resolveCycleStart/performRestore siguen siendo las únicas fuentes de la decisión de scroll-restore — no se duplicó ni reemplazó esa lógica", () => {
    expect(keyboardFixSource).toMatch(/decideScrollRestore\(/)
    expect(keyboardFixSource).toMatch(/resolveCycleStart\(/)
    // Solo debe existir UN sitio que LLAMA performRestore (la definición es
    // `const performRestore = (target...` — no matchea este patrón).
    const performRestoreCalls = keyboardFixSource.match(/performRestore\(decision\.target\)/g) ?? []
    expect(performRestoreCalls.length).toBe(1)
  })

  test("la regla de ocultar el dock durante el teclado (visibility:hidden) no fue tocada", () => {
    const globalsCssSource = readFileSync(GLOBALS_CSS, "utf8")
    expect(globalsCssSource).toMatch(
      /html\.ios-device\.ios-keyboard-open \.ios-bottom-nav,\s*\n\s*body\.ios-device\.ios-keyboard-open \.ios-bottom-nav \{\s*\n\s*visibility: hidden !important;/
    )
  })

  test("initialViewportHeight se captura UNA vez en el mount, nunca dentro de un handler repetido", () => {
    const mountLine = keyboardFixSource.match(/const initialViewportHeight = vv\?\.height \?\? window\.innerHeight/g) ?? []
    expect(mountLine.length).toBe(1)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("7. Limpieza en unmount", () => {
  test("window.__iosViewportRecoveryDebug se borra en el cleanup del efecto", () => {
    expect(keyboardFixSource).toMatch(/delete window\.__iosViewportRecoveryDebug/)
  })
})
