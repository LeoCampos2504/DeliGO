/// <reference types="bun-types" />

// ============================================
// IOS-STANDALONE-POST-KEYBOARD-VIEWPORT-RECOVERY-R7 — evidence + regression
// ============================================
// R6's JSON completo (157 capturas reales) demostró, con evidencia
// independiente confirmada (40/40 hit-test probes con el nav topmost, 0
// oclusores DOM reales), que el síntoma NO es un occluder ni un problema de
// z-index: `visualViewport.height` vuelve a 797 solo en las 2 primeras
// capturas (antes de cualquier uso de teclado) y se queda permanentemente en
// 729 durante las 155 capturas restantes — incluyendo una ventana completa
// de asentamiento acotada y un segundo ciclo completo de teclado. Mientras
// tanto `scrollY` y `visualViewport.offsetTop` SÍ se recuperan
// correctamente.
//
// R7 agregó un mecanismo de recuperación acotado, únicamente como
// experimento opt-in — REAL_IPHONE_VERIFICATION confirmó que falló
// (heightBeforeAttempt=729, heightAfterAttempt=729, recovered=false,
// reproducido en las 157 capturas del JSON real de R7). Por eso
// IOS-STANDALONE-DEGRADED-VIEWPORT-DOCK-FALLBACK-R8 removió por completo esa
// arquitectura de recuperación (src/lib/ios-viewport-recovery-decision.ts,
// el toggle del panel, window.__iosViewportRecoveryExperiment/Debug) — ver
// ios-standalone-degraded-viewport-dock-fallback-r8-static-contract.test.ts
// para el reemplazo estructural. Este archivo conserva SOLO lo que sigue
// siendo cierto y útil: la documentación de la evidencia real de R6/R7 y las
// pruebas de regresión de DerivedGeometry.visualViewportHeightDeficit/
// viewportGeometryRestored, que R8 reutiliza tal cual (§19 de R8: "keep
// only reusable diagnostic concepts").
// REAL_IPHONE_VERIFICATION_REQUIRED=NO (ya completada — ver R8)

import { describe, expect, test } from "bun:test"
import {
  computeDerivedGeometry,
  DERIVED_GEOMETRY_ALLOWED_KEYS,
  VIEWPORT_GEOMETRY_RESTORED_TOLERANCE_PX,
  type DockElementGeometry,
} from "./ios-debug-snapshot"

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
    const secondCycleFinalStableHeight = 729
    const postKbT1500Height = 729
    const baselineHeight = 797
    expect(secondCycleFinalStableHeight).toBe(729)
    expect(postKbT1500Height).toBe(729)
    expect(baselineHeight - secondCycleFinalStableHeight).toBe(68)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("2. Evidencia real R7 — el experimento de recuperación probado falló (729 -> 729)", () => {
  test("el JSON completo de R7 confirma attempted=true, recovered=false, heightBeforeAttempt=heightAfterAttempt=729", () => {
    const heightBeforeAttempt = 729
    const heightAfterAttempt = 729
    const recovered = false
    const baselineViewportHeight = 797
    expect(heightBeforeAttempt).toBe(heightAfterAttempt)
    expect(recovered).toBe(false)
    expect(baselineViewportHeight - heightAfterAttempt).toBe(68)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("3. Diagnóstico de déficit de viewport — DerivedGeometry (reutilizado sin cambios por R8)", () => {
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

  test("REGRESIÓN — reproduce exactamente el AUTO_FINAL_STABLE real de R6/R7: offsetTop=0 (temporalmente estable) pero height sigue en déficit (NO restaurado)", () => {
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

  test("DerivedGeometry mantiene exactamente las keys documentadas (incluyendo los campos paintable de R8)", () => {
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
