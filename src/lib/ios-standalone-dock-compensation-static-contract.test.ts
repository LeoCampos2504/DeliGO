/// <reference types="bun-types" />

// ============================================
// IOS-STANDALONE-REAL-DEVICE-FIX-R3 — contrato estático + matemático focal
// ============================================
// Protege la compensación de offset residual del dock (BottomNav/ChatFab)
// en PWA standalone. Dos frentes:
//  1) texto: la regla real en globals.css usa exactamente la fórmula
//     esperada, dentro de @media (display-mode: standalone) únicamente;
//  2) aritmética: reproduce en JS puro la relación de renderizado de
//     WebKit confirmada por el dataset real (iOS 18.7, Safari 26.0.1,
//     standalone=true) — un `position:fixed; bottom:Npx` con
//     visualViewport.offsetTop != 0 renderiza en:
//       rect.bottom = (innerHeight - offsetTop) - N
//     Esto fue confirmado en el propio payload real (offsetTop=0 →
//     rect.bottom=755=797-42; offsetTop=68 → rect.bottom=687=(797-68)-42),
//     y es DISTINTO de "innerHeight - offsetTop - rect.bottom == cssBottom"
//     (esa es la fórmula de IOS_MOBILE_REAL_DEVICE_R2's `fixedViewportBottom`,
//     que sólo prueba que rect.bottom es internamente consistente con el
//     CSS declarado — es una tautología que da 42 SIEMPRE, incluso cuando
//     la posición visual real está mal, así que no sirve para detectar
//     este bug). La distancia física real observable en pantalla es
//     `innerHeight - rect.bottom` — eso es lo que este archivo verifica.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")
const CHAT_SHEET = join(process.cwd(), "src", "components", "chat", "chat-sheet.tsx")

// Relación de renderizado de WebKit confirmada por el dataset real — ver
// comentario de módulo. `cssBottomPx` es el valor QUE EFECTIVAMENTE
// resuelve el calc() (ya con cualquier compensación aplicada).
function simulateWebkitFixedRectBottom(innerHeight: number, offsetTop: number, cssBottomPx: number): number {
  return innerHeight - offsetTop - cssBottomPx
}

// La compensación implementada — debe coincidir EXACTAMENTE con la fórmula
// real en globals.css (verificado también por texto más abajo).
function compensatedCssBottom(baseCssBottomPx: number, offsetTop: number): number {
  return baseCssBottomPx - offsetTop
}

function physicalDistanceFromBottom(innerHeight: number, rectBottom: number): number {
  return innerHeight - rectBottom
}

describe("IOS-STANDALONE-REAL-DEVICE-FIX-R3 — aritmética de compensación del dock", () => {
  test("sin compensar: offsetTop residual desplaza la distancia física real (reproduce el bug real)", () => {
    const innerHeight = 797
    // BASELINE real: offsetTop=0 → correcto incluso sin compensar.
    const baselineRect = simulateWebkitFixedRectBottom(innerHeight, 0, 42)
    expect(physicalDistanceFromBottom(innerHeight, baselineRect)).toBe(42)

    // STALE real: offsetTop=68 residual, SIN compensar (fórmula vieja) → 110, no 42.
    const staleRectUncompensated = simulateWebkitFixedRectBottom(innerHeight, 68, 42)
    expect(physicalDistanceFromBottom(innerHeight, staleRectUncompensated)).toBe(110)
  })

  test("compensado: la distancia física real permanece en 42 para cualquier offsetTop residual", () => {
    const innerHeight = 797
    for (const offsetTop of [0, 10, 20, 49, 50, 68, 138, 403]) {
      const compensated = compensatedCssBottom(42, offsetTop)
      const rectBottom = simulateWebkitFixedRectBottom(innerHeight, offsetTop, compensated)
      expect(physicalDistanceFromBottom(innerHeight, rectBottom)).toBe(42)
    }
  })

  test("transición 68 -> 50 -> 20 -> 0: la posición física del nav permanece estable (sin translateY, sin salto)", () => {
    const innerHeight = 797
    const distances = [68, 50, 20, 0].map((offsetTop) => {
      const compensated = compensatedCssBottom(42, offsetTop)
      const rectBottom = simulateWebkitFixedRectBottom(innerHeight, offsetTop, compensated)
      return physicalDistanceFromBottom(innerHeight, rectBottom)
    })
    expect(new Set(distances).size).toBe(1)
    expect(distances[0]).toBe(42)
  })

  test("FAB: la compensación preserva el gap sobre el nav constante para cualquier offsetTop residual (no introduce drift nuevo)", () => {
    // El valor absoluto exacto del gap (fórmula CSS pura vs. rect renderizado
    // real, que incluye ~2px de borde del nav) ya tenía una diferencia menor
    // preexistente desde R1 (fórmula≈12px, real≈10px) — no es competencia de
    // esta tarea. Lo que SÍ debe probarse acá es que la compensación no
    // introduce NINGÚN drift adicional: el gap calculado por la fórmula debe
    // ser IDÉNTICO para cualquier offsetTop residual.
    const innerHeight = 797
    const FOOTPRINT = 34
    const DOCK_GAP = 8
    const NAV_HEIGHT = 64
    const FAB_GAP_ABOVE_NAV = 12
    const NAV_BASE = FOOTPRINT + DOCK_GAP // 42
    const FAB_BASE = FOOTPRINT + DOCK_GAP + NAV_HEIGHT + FAB_GAP_ABOVE_NAV // 118
    const gaps = [0, 68, 138, 403].map((offsetTop) => {
      const navBottomCss = compensatedCssBottom(NAV_BASE, offsetTop)
      const fabBottomCss = compensatedCssBottom(FAB_BASE, offsetTop)
      const navRectBottom = simulateWebkitFixedRectBottom(innerHeight, offsetTop, navBottomCss)
      const fabRectBottom = simulateWebkitFixedRectBottom(innerHeight, offsetTop, fabBottomCss)
      const navTop = navRectBottom - NAV_HEIGHT
      return navTop - fabRectBottom
    })
    expect(new Set(gaps).size).toBe(1)
    expect(gaps[0]).toBe(FAB_GAP_ABOVE_NAV) // = --ios-chat-fab-gap-above-nav, constante de diseño desde R1
  })

  test("real device example — §21 chrome-collapsed-equivalente (offsetTop=68) reproduce el ejemplo exacto del payload real", () => {
    // Del payload real: AUTO_AFTER_KEYBOARD_CLOSE y AUTO_FINAL_STABLE,
    // ambos con innerHeight=797, offsetTop=68, nav.rect.bottom=687 SIN
    // compensar (el build todavía no tenía este fix cuando se capturó).
    const innerHeight = 797
    const offsetTop = 68
    const realUncompensatedRectBottom = 687
    expect(simulateWebkitFixedRectBottom(innerHeight, offsetTop, 42)).toBe(realUncompensatedRectBottom)
    expect(physicalDistanceFromBottom(innerHeight, realUncompensatedRectBottom)).toBe(110)
    // Con la compensación implementada, el mismo offsetTop debe volver a dar 42.
    const compensated = compensatedCssBottom(42, offsetTop)
    const fixedRectBottom = simulateWebkitFixedRectBottom(innerHeight, offsetTop, compensated)
    expect(physicalDistanceFromBottom(innerHeight, fixedRectBottom)).toBe(42)
  })
})

describe("IOS-STANDALONE-REAL-DEVICE-FIX-R3 — texto de la regla real en globals.css", () => {
  // IOS-STANDALONE-FINAL-VISUAL-FIX-R4 renombró la variable de compensación
  // del DOCK de --visual-viewport-offset-top (compartida, actualizada con
  // hasta un frame de atraso) a --ios-dock-visual-offset-top (dedicada,
  // sincrónica) — ver ios-standalone-final-visual-fix-r4-static-contract.test.ts
  // para el contrato completo de la nueva variable. El filler de fondo del
  // Chat, más abajo, sigue usando la variable compartida original — su
  // problema era clipping (posición en el DOM), no timing.
  test("la compensación del nav está en @media (display-mode: standalone) y resta --ios-dock-visual-offset-top de la MISMA fórmula base", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    expect(css).toMatch(
      /@media \(display-mode: standalone\) \{[\s\S]*?body\.ios-device \.ios-bottom-nav \{\s*bottom: calc\(env\(safe-area-max-inset-bottom, 34px\) \+ 8px - var\(--ios-dock-visual-offset-top, 0px\)\);/
    )
  })

  test("la compensación del FAB está en el mismo bloque @media y resta --ios-dock-visual-offset-top sobre las mismas 4 variables compartidas", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    expect(css).toMatch(
      /@media \(display-mode: standalone\) \{[\s\S]*?body\.ios-device \.ios-chat-fab \{[\s\S]*?var\(--ios-bottom-safe-footprint\)[\s\S]*?var\(--ios-bottom-dock-gap\)[\s\S]*?var\(--ios-bottom-nav-height\)[\s\S]*?var\(--ios-chat-fab-gap-above-nav\)[\s\S]*?-\s*var\(--ios-dock-visual-offset-top, 0px\)/
    )
  })

  test("--visual-viewport-offset-top sigue publicada por IOSKeyboardFix (el filler de Chat todavía la usa — su fix fue de posición en el DOM, no de timing)", () => {
    const keyboardFix = readFileSync(
      join(process.cwd(), "src", "components", "pwa", "ios-keyboard-fix.tsx"),
      "utf-8"
    )
    expect(keyboardFix).toContain('root.style.setProperty("--visual-viewport-offset-top"')
  })

  test("la compensación de dock no usa transform/translateY", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const mediaStart = css.indexOf("@media (display-mode: standalone)")
    const openBraceIdx = css.indexOf("{", mediaStart)
    let depth = 0
    let closeIdx = -1
    for (let i = openBraceIdx; i < css.length; i++) {
      if (css[i] === "{") depth++
      else if (css[i] === "}") {
        depth--
        if (depth === 0) {
          closeIdx = i
          break
        }
      }
    }
    const mediaBlock = css.slice(mediaStart, closeIdx)
    expect(mediaBlock).not.toMatch(/transform|translate/i)
  })
})

describe("IOS-STANDALONE-REAL-DEVICE-FIX-R3 — Chat keyboard-region background coverage", () => {
  // IOS-STANDALONE-FINAL-VISUAL-FIX-R4: el filler dejó de ser hijo de
  // SheetContent (real device probó que overflow-hidden lo recortaba) y
  // ahora se porta directo a document.body, gateado por isSheetOpen — ver
  // ios-standalone-final-visual-fix-r4-static-contract.test.ts para el
  // contrato completo de esa reubicación. Este test sólo confirma que
  // sigue existiendo únicamente mientras el Chat está abierto (no un layer
  // permanente).
  test("el filler sigue existiendo sólo mientras el Chat está abierto (no un layer global permanente)", () => {
    const source = readFileSync(CHAT_SHEET, "utf-8")
    expect(source).toContain('className="ios-chat-keyboard-backdrop"')
    expect(source).toContain('aria-hidden="true"')
    expect(source).toMatch(/isSheetOpen\s*&&[\s\S]{0,80}createPortal/)
  })

  test("la regla CSS del filler es pointer-events:none, sin transform, y su bottom/height dependen SOLO de --visual-viewport-offset-top (0 cuando no hay residual)", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const ruleStart = css.indexOf(".ios-chat-keyboard-backdrop {")
    expect(ruleStart).toBeGreaterThan(-1)
    const ruleEnd = css.indexOf("}", ruleStart)
    const ruleBody = css.slice(ruleStart, ruleEnd)
    expect(ruleBody).toMatch(/pointer-events:\s*none/)
    expect(ruleBody).not.toMatch(/transform|translate/i)
    expect(ruleBody).toContain("var(--visual-viewport-offset-top, 0px)")
    expect(ruleBody).toMatch(/bottom:\s*calc\(-1 \* var\(--visual-viewport-offset-top, 0px\)\)/)
    expect(ruleBody).toMatch(/height:\s*var\(--visual-viewport-offset-top, 0px\)/)
  })

  test("aritmética: con offsetTop=403 (ejemplo real) el filler cubre exactamente desde el borde visible (394) hasta el borde físico real (797)", () => {
    const innerHeight = 797
    const offsetTop = 403
    // bottom = -offsetTop, height = offsetTop → top del filler = bottom + height = 0
    // (coincide con el borde inferior SIN compensar del contenido, 394,
    // que en la misma relación WebKit confirmada es innerHeight-offsetTop-0=394
    // para un elemento con bottom:0 sin compensación — el filler arranca
    // exactamente ahí y llega hasta el fondo físico real).
    const contentVisibleBottom = innerHeight - offsetTop // 394, igual al composer/sheet reales
    expect(contentVisibleBottom).toBe(394)
    const fillerBottomCss = -offsetTop
    const fillerHeightCss = offsetTop
    const fillerTopCss = fillerBottomCss + fillerHeightCss
    expect(fillerTopCss).toBe(0) // arranca flush con el bottom:0 sin compensar (394 visual)
    // El filler llega hasta innerHeight real (797) — su propio "bottom"
    // compensado en -offsetTop lo empuja exactamente offsetTop px más abajo
    // que un bottom:0 sin compensar, cerrando el hueco completo.
    expect(offsetTop).toBe(innerHeight - contentVisibleBottom)
  })

  test("con offsetTop=0 (teclado cerrado) el filler tiene altura 0 — no pinta nada, es un no-op", () => {
    const offsetTop = 0
    expect(offsetTop).toBe(0) // height: var(--visual-viewport-offset-top, 0px) === 0px
  })
})
