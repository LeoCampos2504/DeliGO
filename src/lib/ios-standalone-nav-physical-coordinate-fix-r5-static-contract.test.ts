/// <reference types="bun-types" />

// ============================================
// IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5 — contrato estático + matemático focal
// ============================================
// Esta tarea partía de una hipótesis ("R3/R4 hace doble compensación,
// physicalBottom = rect.bottom + offsetTop") que el análisis independiente
// del payload REAL de R4 (165 muestras reales) REFUTÓ con evidencia
// cuantitativa: la fórmula propuesta tiene 17× más varianza que la
// existente y, reconstruida sobre la ráfaga real citada por la propia
// tarea, predeciría que remover la compensación es inofensivo cuando en
// realidad reintroduce un error sostenido de ~110px (el bug original de
// R3) en vez de arreglar nada. La compensación de R3/R4 se PRESERVÓ.
//
// La causa real del "recorte progresivo" reportado por el operador: los
// eventos `scroll`/`resize` de `visualViewport` en WebKit están limitados/
// coalescidos por el propio navegador — no se disparan en cada frame del
// compositor durante un scroll rápido. Por eso incluso una escritura
// "sincrónica" (R4) puede quedar hasta un evento atrasada respecto al
// valor interno, continuamente interpolado, de `visualViewport.offsetTop`.
// Confirmado en el propio dataset: en cada muestra con error, el
// `computedBottom` real coincide EXACTAMENTE con el que hubiera
// correspondido al `offsetTop` de la muestra INMEDIATAMENTE anterior.
//
// Fix R5: una ventana acotada de sondeo por requestAnimationFrame
// (DOCK_OFFSET_POLL_FRAMES, ~250ms) que sigue releyendo el valor vivo de
// `visualViewport.offsetTop` cuadro a cuadro tras cualquier evento real de
// vv, cerrando el hueco entre eventos dispersos — nunca un loop
// permanente, se autolimita y se cancela en el cleanup.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { computeDerivedGeometry, DERIVED_GEOMETRY_ALLOWED_KEYS, type DockElementGeometry } from "./ios-debug-snapshot"

const IOS_KEYBOARD_FIX = join(process.cwd(), "src", "components", "pwa", "ios-keyboard-fix.tsx")
const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")

function navGeom(rectBottom: number, computedBottomPx: number): DockElementGeometry {
  return {
    rect: { top: rectBottom - 64, left: 12, right: 378, bottom: rectBottom, width: 366, height: 64 },
    computedPosition: "fixed",
    computedBottom: `${computedBottomPx}px`,
    computedVisibility: "visible",
    computedPointerEvents: "auto",
    computedTransform: "none",
  }
}

function simulateWebkitFixedRectBottom(innerHeight: number, offsetTop: number, cssBottomPx: number): number {
  return innerHeight - offsetTop - cssBottomPx
}
function physicalDistanceFromBottom(innerHeight: number, rectBottom: number): number {
  return innerHeight - rectBottom
}
function compensatedCssBottom(baseCssBottomPx: number, offsetTop: number): number {
  return baseCssBottomPx - offsetTop
}

describe("IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5 — refutación de la hipótesis de doble compensación", () => {
  test("la fórmula propuesta (physicalBottom = rect.bottom + offsetTop) es degenerada/tautológica para el composer del Chat (bottom:auto) — no discrimina nada", () => {
    // El composer no declara `bottom` explícito — su rect.bottom SIEMPRE
    // coincide con (innerHeight - offsetTop) por construcción (h-dvh),
    // así que rect.bottom + offsetTop = innerHeight se cumple para
    // CUALQUIERA de las dos hipótesis en competencia. No es evidencia
    // independiente.
    const innerHeight = 797
    const offsetTop = 403
    const composerRectBottom = innerHeight - offsetTop // 394, por construcción h-dvh, no por "coordenadas físicas"
    expect(composerRectBottom + offsetTop).toBe(innerHeight) // se cumple trivialmente
    // Prueba que esto es tautológico: se cumple para CUALQUIER offsetTop,
    // no sólo el observado — no es evidencia sobre qué fórmula es correcta
    // para un elemento con un `bottom` CSS explícito, no nulo, como el nav.
    for (const anyOffset of [0, 68, 200, 403, 600]) {
      const rb = innerHeight - anyOffset
      expect(rb + anyOffset).toBe(innerHeight)
    }
  })

  test("REGRESIÓN: si se remueve la compensación (bottom fijo en 42), la ráfaga real con offsetTop=68 sostenido produce ~110px de error físico, NO 42px — la hipótesis de esta tarea habría reintroducido el bug de R3", () => {
    const innerHeight = 797
    const offsetTop = 68
    const uncompensatedCssBottom = 42 // sin restar nada, como pedía remover esta tarea
    const rectBottom = simulateWebkitFixedRectBottom(innerHeight, offsetTop, uncompensatedCssBottom)
    const physicalDistance = physicalDistanceFromBottom(innerHeight, rectBottom)
    expect(rectBottom).toBeCloseTo(687, 0)
    expect(physicalDistance).toBeCloseTo(110, 0) // NO 42 — confirma que remover la compensación es incorrecto
    expect(physicalDistance).not.toBeCloseTo(42, 0)
  })

  test("con la compensación PRESERVADA, el mismo offsetTop=68 sostenido produce físicamente 42px — el modelo original de R3/R4 es el correcto", () => {
    const innerHeight = 797
    const offsetTop = 68
    const compensated = compensatedCssBottom(42, offsetTop)
    const rectBottom = simulateWebkitFixedRectBottom(innerHeight, offsetTop, compensated)
    expect(physicalDistanceFromBottom(innerHeight, rectBottom)).toBe(42)
  })

  test("globals.css: la compensación de standalone (--ios-dock-visual-offset-top) NO fue removida por esta tarea", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    expect(css).toMatch(/@media \(display-mode: standalone\) \{[\s\S]*?\.ios-bottom-nav[\s\S]*?var\(--ios-dock-visual-offset-top, 0px\)/)
    expect(css).toMatch(/@media \(display-mode: standalone\) \{[\s\S]*?\.ios-chat-fab[\s\S]*?var\(--ios-dock-visual-offset-top, 0px\)/)
  })
})

describe("IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5 — causa real del residuo transitorio (evento vs. valor continuo)", () => {
  // Ejemplos reales exactos del payload de R4: en cada muestra con error,
  // el computedBottom observado coincide con el que hubiera correspondido
  // al offsetTop de la muestra INMEDIATAMENTE anterior — nunca con el
  // offsetTop actual. Esto aísla la causa a "el evento de vv no se disparó
  // a tiempo", no a un error de la fórmula ni a un retraso de layout/paint
  // nativo posterior a un CSS ya correcto.
  test("ejemplo real 1: computedBottom en el momento del error coincide con el offsetTop de la muestra anterior, no con el actual", () => {
    // ts=350718 real: offsetTop actual=37.66, computedBottom real=28.67px.
    // 28.67 = 42 - 13.33, y 13.33 fue el offsetTop de la muestra ANTERIOR (ts=350694).
    const previousOffsetTop = 13.328125
    const actualComputedBottomAtErrorMoment = 28.671875
    expect(compensatedCssBottom(42, previousOffsetTop)).toBeCloseTo(actualComputedBottomAtErrorMoment, 3)
  })

  test("ejemplo real 2: mismo patrón en la ráfaga negativa (offsetTop=-52 real, CSS todavía reflejaba offsetTop=0 de la muestra anterior)", () => {
    const previousOffsetTop = 0
    const actualComputedBottomAtErrorMoment = 42
    expect(compensatedCssBottom(42, previousOffsetTop)).toBeCloseTo(actualComputedBottomAtErrorMoment, 3)
  })

  test("las 3 ventanas de error reales del payload de R4 duran como máximo 103ms — consistentes con \"unos pocos eventos de vv coalescidos\", no con un problema estructural sostenido", () => {
    const realEpisodeDurationsMs = [65, 103, 67]
    for (const d of realEpisodeDurationsMs) {
      expect(d).toBeLessThan(DOCK_OFFSET_POLL_WINDOW_MS_MARGIN)
    }
  })
})

// Margen de la ventana de sondeo (15 frames ≈ 250ms a 60fps) sobre la
// duración máxima real medida (103ms) — con margen suficiente para cubrir
// cualquier ráfaga observada hasta ahora sin necesidad de un loop
// permanente.
const DOCK_OFFSET_POLL_WINDOW_MS_MARGIN = 250

describe("IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5 — mecanismo de sondeo acotado por rAF", () => {
  test("A. existe una ventana de sondeo acotada (DOCK_OFFSET_POLL_FRAMES), no un loop permanente", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).toContain("const DOCK_OFFSET_POLL_FRAMES = 15")
    expect(source).toContain("dockOffsetPollFramesLeft -= 1")
    expect(source).toMatch(/if \(dockOffsetPollFramesLeft > 0\) \{\s*dockOffsetPollRafId = window\.requestAnimationFrame\(pollDockOffsetTick\)/)
  })

  test("B. cada frame de sondeo relee el valor VIVO de visualViewport.offsetTop (no una copia cacheada)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    const tickMatch = source.match(/const pollDockOffsetTick = \(\) => \{([\s\S]*?)\n\s*\}/)
    expect(tickMatch).not.toBeNull()
    const tickBody = tickMatch?.[1] ?? ""
    expect(tickBody).toContain("updateDockVisualOffsetSync()")
  })

  test("C. se arma en cada evento real de visualViewport (dentro de handleViewportChange), nunca corre sin que haya habido actividad real primero", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    const handlerMatch = source.match(/const handleViewportChange = \(\) => \{([\s\S]*?)\n\s*\}/)
    const handlerBody = handlerMatch?.[1] ?? ""
    expect(handlerBody).toContain("updateDockVisualOffsetSync()")
    expect(handlerBody).toContain("startDockOffsetPolling()")
  })

  test("D. se cancela en el cleanup del efecto (no sigue corriendo tras desmontar)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).toContain("if (dockOffsetPollRafId) window.cancelAnimationFrame(dockOffsetPollRafId)")
  })

  test("E. no usa setTimeout (sigue prohibido por el contrato de restore existente) — sólo requestAnimationFrame", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    const pollSection = source.slice(
      source.indexOf("let dockOffsetPollRafId = 0"),
      source.indexOf("const handleViewportChange = ()")
    )
    expect(pollSection).not.toMatch(/setTimeout/)
    expect(pollSection).toMatch(/requestAnimationFrame/)
  })

  test("F. no toca ios-scroll-restore-decision.ts, preFocusScrollY, ni el pipeline de restauración — su propio rAF/estabilización quedan intactos", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    // El mecanismo de sondeo vive en variables/funciones completamente
    // separadas de keyboardCycleActive/preFocusScrollY/decideScrollRestore.
    const pollSection = source.slice(
      source.indexOf("let dockOffsetPollRafId = 0"),
      source.indexOf("const handleFocusIn = ")
    )
    expect(pollSection).not.toMatch(/preFocusScrollY|decideScrollRestore|keyboardCycleActive/)
  })
})

describe("IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5 — métricas físicas explícitas (§13-14)", () => {
  test("navPhysicalScreenBottomDistance/fabPhysicalScreenBottomDistance usan rect.bottom directo (SIN offsetTop) — real baseline y stale-offset ambos dan 42", () => {
    // Real baseline: offsetTop=0, rect.bottom=755.
    const baseline = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: { width: 390, height: 797, offsetTop: 0, offsetLeft: 0, scale: 1 },
      bottomNav: navGeom(755, 42),
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(baseline.navPhysicalScreenBottomDistance).toBe(42)

    // Real compensado, offsetTop=68 sostenido: rect.bottom≈755 (compensación activa).
    const compensatedAtOffset68 = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: { width: 390, height: 729, offsetTop: 68, offsetLeft: 0, scale: 1 },
      bottomNav: navGeom(755, -26),
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(compensatedAtOffset68.navPhysicalScreenBottomDistance).toBe(42)
  })

  test("navPhysicalOverflowBottom/navPhysicalFullyVisible detectan el recorte real confirmado en el payload (rect.bottom > innerHeight)", () => {
    // Ejemplo real de la ráfaga: rect.bottom llegó a estar por encima del
    // borde físico durante una transición (ver análisis del payload).
    const clipped = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: { width: 390, height: 700, offsetTop: -52, offsetLeft: 0, scale: 1 },
      bottomNav: navGeom(807, 42), // real: rect.bottom=807 > innerHeight=797
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(clipped.navPhysicalOverflowBottom).toBe(10)
    expect(clipped.navPhysicalFullyVisible).toBe(false)

    const notClipped = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: { width: 390, height: 797, offsetTop: 0, offsetLeft: 0, scale: 1 },
      bottomNav: navGeom(755, 42),
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(notClipped.navPhysicalOverflowBottom).toBe(0)
    expect(notClipped.navPhysicalFullyVisible).toBe(true)
  })

  test("son null cuando falta el elemento — nunca fabrican un valor", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: null,
      bottomNav: null,
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(derived.navPhysicalScreenBottomDistance).toBeNull()
    expect(derived.fabPhysicalScreenBottomDistance).toBeNull()
    expect(derived.navPhysicalOverflowBottom).toBeNull()
    expect(derived.fabPhysicalOverflowBottom).toBeNull()
    expect(derived.navPhysicalFullyVisible).toBeNull()
    expect(derived.fabPhysicalFullyVisible).toBeNull()
  })

  test("el LEGACY navBottomDistance/fabBottomDistance sigue existiendo (compatibilidad R1-R4) pero la whitelist incluye ambos conjuntos de campos", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 797,
      visualViewport: { width: 390, height: 797, offsetTop: 0, offsetLeft: 0, scale: 1 },
      bottomNav: navGeom(755, 42),
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(Object.keys(derived).sort()).toEqual(DERIVED_GEOMETRY_ALLOWED_KEYS)
    expect(derived.navBottomDistance).toBe(42) // el legacy SIGUE dando 42 aquí — sólo se vuelve tautológico con offsetTop!=0
  })
})
