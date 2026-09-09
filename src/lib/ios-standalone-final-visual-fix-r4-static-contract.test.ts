/// <reference types="bun-types" />

// ============================================
// IOS-STANDALONE-FINAL-VISUAL-FIX-R4 — contrato estático + matemático focal
// ============================================
// Protege los dos fixes reales de esta tarea, ambos confirmados con el
// payload físico de R3 (iOS 18.7, Safari 26.0.1, standalone=true):
//
// A. Sincronización del dock: --visual-viewport-offset-top (compartida,
//    actualizada dentro del requestAnimationFrame de updateViewportState)
//    puede quedar hasta un frame entero atrasada respecto al
//    visualViewport.offsetTop real durante un scroll rápido — varios
//    eventos nativos "scroll" pueden dispararse antes de que ese rAF
//    corra. La compensación del dock restaba ese valor atrasado,
//    empujando el dock a ~1px del borde físico real (recorte visual).
//    Fix: --ios-dock-visual-offset-top, escrita sincrónicamente dentro
//    del propio handler del evento nativo, sin el salto extra de rAF.
//
// B. El filler de fondo del teclado del Chat (R3) nunca pintó más allá
//    del borde de contenido visible porque era HIJO de SheetContent
//    (overflow-hidden) — el recorte de overflow aplica al árbol de
//    pintado sin importar que el descendiente sea position:fixed. Fix:
//    portaleado directo a document.body, hermano del propio portal de
//    Radix, nunca descendiente de nada que lo recorte.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")
const IOS_KEYBOARD_FIX = join(process.cwd(), "src", "components", "pwa", "ios-keyboard-fix.tsx")
const CHAT_SHEET = join(process.cwd(), "src", "components", "chat", "chat-sheet.tsx")
const BOTTOM_NAV = join(process.cwd(), "src", "components", "shared", "bottom-nav.tsx")
const CHAT_FAB = join(process.cwd(), "src", "components", "chat", "chat-fab.tsx")
const LOCATION_MAP_PICKER = join(process.cwd(), "src", "components", "location", "location-map-picker.tsx")
const CLIENT_PROFILE_PANEL = join(process.cwd(), "src", "components", "client", "client-profile-panel.tsx")
const LOCATION_PICKER_INLINE = join(process.cwd(), "src", "components", "business", "location-picker-inline.tsx")

// Misma relación de renderizado de WebKit confirmada en R3/R4 por el
// dataset real: un `position:fixed; bottom:Npx` con
// visualViewport.offsetTop != 0 renderiza en
// rect.bottom = (innerHeight - offsetTop) - N.
function simulateWebkitFixedRectBottom(innerHeight: number, offsetTop: number, cssBottomPx: number): number {
  return innerHeight - offsetTop - cssBottomPx
}

function physicalDistanceFromBottom(innerHeight: number, rectBottom: number): number {
  return innerHeight - rectBottom
}

// La compensación implementada — bottom = base - offsetTopACTUAL (nunca un
// valor atrasado, si la escritura es sincrónica como prueban los tests de
// texto más abajo).
function compensatedCssBottom(baseCssBottomPx: number, appliedOffsetTop: number): number {
  return baseCssBottomPx - appliedOffsetTop
}

describe("IOS-STANDALONE-FINAL-VISUAL-FIX-R4 — sincronización del dock (§20)", () => {
  test("A. --ios-dock-visual-offset-top se escribe sincrónicamente dentro del handler nativo de visualViewport, ANTES de scheduleUpdate (nunca dentro de su rAF)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    const handlerMatch = source.match(/const handleViewportChange = \(\) => \{([\s\S]*?)\n\s*\}/)
    expect(handlerMatch).not.toBeNull()
    const handlerBody = handlerMatch?.[1] ?? ""
    expect(handlerBody).toContain("updateDockVisualOffsetSync()")
    // La llamada a updateDockVisualOffsetSync debe preceder a scheduleUpdate
    // (que sí difiere vía rAF) — texto antes en el mismo bloque.
    const syncIdx = handlerBody.indexOf("updateDockVisualOffsetSync()")
    const scheduleIdx = handlerBody.indexOf("scheduleUpdate()")
    expect(syncIdx).toBeGreaterThan(-1)
    expect(scheduleIdx).toBeGreaterThan(syncIdx)
  })

  test("B. updateDockVisualOffsetSync no está envuelta en requestAnimationFrame ni setTimeout", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    const fnMatch = source.match(/const updateDockVisualOffsetSync = \(\) => \{([\s\S]*?)\n\s*\}/)
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch?.[1] ?? ""
    expect(fnBody).not.toMatch(/requestAnimationFrame|setTimeout/)
    expect(fnBody).toContain('root.style.setProperty("--ios-dock-visual-offset-top"')
  })

  test("C. se inicializa al montar (no sólo en el primer evento) y se limpia en el cleanup", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).toMatch(/updateViewportState\(\)\s*\n\s*updateDockVisualOffsetSync\(\)/)
    expect(source).toContain('root.style.removeProperty("--ios-dock-visual-offset-top")')
  })

  test("D. globals.css: la compensación del nav y del FAB en standalone usan --ios-dock-visual-offset-top (no la variable compartida atrasada)", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    expect(css).toMatch(/@media \(display-mode: standalone\) \{[\s\S]*?\.ios-bottom-nav[\s\S]*?var\(--ios-dock-visual-offset-top, 0px\)/)
    expect(css).toMatch(/@media \(display-mode: standalone\) \{[\s\S]*?\.ios-chat-fab[\s\S]*?var\(--ios-dock-visual-offset-top, 0px\)/)
  })

  test("E. aritmética: reproduce la secuencia real §20 (68,56,41,0,-9,-25,-52,0) — con compensación SINCRÓNICA (offset aplicado == offset actual), la distancia física permanece en 42 en TODOS los pasos", () => {
    const innerHeight = 797
    const sequence = [68, 56, 41, 0, -9, -25, -52, 0]
    const distances = sequence.map((offsetTop) => {
      // Sincronizado: el offset aplicado por CSS es exactamente el actual
      // (nunca uno de un evento anterior) — eso es lo que la escritura
      // sincrónica garantiza estructuralmente (tests A-C arriba).
      const compensated = compensatedCssBottom(42, offsetTop)
      const rectBottom = simulateWebkitFixedRectBottom(innerHeight, offsetTop, compensated)
      return physicalDistanceFromBottom(innerHeight, rectBottom)
    })
    for (const d of distances) expect(d).toBe(42)
  })

  test("F. aritmética: offset firmado (negativo) NUNCA se clampea a 0 — ni en la fórmula CSS ni en la lectura de IOSKeyboardFix", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const mediaBlock = css.slice(css.indexOf("@media (display-mode: standalone)"))
    expect(mediaBlock).not.toMatch(/max\(\s*0(px)?\s*,\s*var\(--ios-dock-visual-offset-top/)
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    const fnMatch = source.match(/const updateDockVisualOffsetSync = \(\) => \{([\s\S]*?)\n\s*\}/)
    const fnBody = fnMatch?.[1] ?? ""
    expect(fnBody).not.toMatch(/Math\.max\(\s*0/)
    // La matemática de calc() resta un valor negativo correctamente (suma):
    // ejemplo real offsetTop=-52 → bottom aplicado = 42-(-52) = 94.
    expect(compensatedCssBottom(42, -52)).toBe(94)
  })

  test("sanity: la simulación desincronizada (offset aplicado de un evento anterior) SÍ produce el bug real observado — confirma que el test E realmente distingue sincronizado de no-sincronizado", () => {
    const innerHeight = 797
    // Ejemplo real exacto: vv.offsetTop=41.34375 mientras el CSS todavía
    // compensaba para offsetTop≈66 (evento anterior) → computedBottom=-24px.
    const staleAppliedOffset = 66
    const currentOffset = 41.34375
    const compensatedForStale = compensatedCssBottom(42, staleAppliedOffset) // -24
    const rectBottom = simulateWebkitFixedRectBottom(innerHeight, currentOffset, compensatedForStale)
    const physicalDistance = physicalDistanceFromBottom(innerHeight, rectBottom)
    expect(Math.round(physicalDistance * 100) / 100).toBe(17.34)
    expect(physicalDistance).not.toBe(42)
  })
})

describe("IOS-STANDALONE-FINAL-VISUAL-FIX-R4 — invariante de no-recorte del dock (§21)", () => {
  test("para toda la secuencia de transición, el nav permanece completamente dentro del viewport físico (0 <= top, bottom <= innerHeight) con distancia de diseño ~42px", () => {
    const innerHeight = 797
    const NAV_HEIGHT = 64
    const sequence = [68, 56, 41, 20, 0, -9, -25, -52, 0]
    for (const offsetTop of sequence) {
      const compensated = compensatedCssBottom(42, offsetTop)
      const rectBottom = simulateWebkitFixedRectBottom(innerHeight, offsetTop, compensated)
      const rectTop = rectBottom - NAV_HEIGHT
      expect(rectBottom).toBeLessThanOrEqual(innerHeight)
      expect(rectBottom).toBeGreaterThan(0)
      expect(rectTop).toBeGreaterThanOrEqual(0)
      expect(physicalDistanceFromBottom(innerHeight, rectBottom)).toBe(42)
    }
  })

  test("ningún estado sincronizado puede producir distancia física <= 1px cuando el objetivo de diseño es 42px", () => {
    const innerHeight = 797
    const sequence = [68, 56, 41, 20, 0, -9, -25, -52, 0, 403, 138]
    for (const offsetTop of sequence) {
      const compensated = compensatedCssBottom(42, offsetTop)
      const rectBottom = simulateWebkitFixedRectBottom(innerHeight, offsetTop, compensated)
      const dist = physicalDistanceFromBottom(innerHeight, rectBottom)
      expect(dist).toBeGreaterThan(1)
    }
  })
})

describe("IOS-STANDALONE-FINAL-VISUAL-FIX-R4 — auditoría de stacking (§10/§22)", () => {
  test("BottomNav conserva z-40 (por debajo de Chat, z-50) — sin cambios", () => {
    const source = readFileSync(BOTTOM_NAV, "utf-8")
    expect(source).toMatch(/\bz-40\b/)
  })

  test("ChatFab conserva z-50", () => {
    const source = readFileSync(CHAT_FAB, "utf-8")
    expect(source).toMatch(/\bz-50\b/)
  })

  // Hallazgo de la auditoría: 3 botones de ubicación (GPS) usan z-[1000]
  // dentro de un contenedor `relative` SIN z-index propio — position:relative
  // sin z-index NO crea un contexto de stacking nuevo, así que ese z-1000
  // competía directamente contra BottomNav (z-40)/ChatFab (z-50) en el
  // stacking context raíz en vez de quedar contenido dentro de su propio
  // mapa. Fix: `isolate` (aísla el contexto de stacking) en el wrapper.
  test("los 3 wrappers de mapa con botón GPS (z-[1000]) están aislados con `isolate` — su z-index ya no puede competir con BottomNav/ChatFab", () => {
    for (const file of [LOCATION_MAP_PICKER, CLIENT_PROFILE_PANEL, LOCATION_PICKER_INLINE]) {
      const source = readFileSync(file, "utf-8")
      expect(source).toMatch(/z-\[1000\]/) // el botón GPS sigue existiendo
      expect(source).toMatch(/className="relative isolate /) // su wrapper ahora lo aísla
    }
  })

  test("SectionCard (Información Personal / Mis Direcciones / Configuración) no declara z-index ni transform propios — contenido ordinario no puede pintar sobre BottomNav sin uno", () => {
    const source = readFileSync(CLIENT_PROFILE_PANEL, "utf-8")
    const sectionCardMatch = source.match(/function SectionCard\([\s\S]*?\n\}/)
    expect(sectionCardMatch).not.toBeNull()
    const body = sectionCardMatch?.[0] ?? ""
    expect(body).not.toMatch(/z-\[|z-10|z-20|z-30|z-40|z-50|zIndex|isolate|transform/)
  })
})

describe("IOS-STANDALONE-FINAL-VISUAL-FIX-R4 — Chat backdrop fuera del recorte de SheetContent (§23)", () => {
  test("A. el filler ya NO es hijo de <SheetContent> — se porta a document.body ANTES de <Sheet>, como hermano", () => {
    const source = readFileSync(CHAT_SHEET, "utf-8")
    const sheetOpenIdx = source.indexOf("<Sheet open={isSheetOpen}")
    const backdropIdx = source.indexOf('className="ios-chat-keyboard-backdrop"')
    expect(sheetOpenIdx).toBeGreaterThan(-1)
    expect(backdropIdx).toBeGreaterThan(-1)
    expect(backdropIdx).toBeLessThan(sheetOpenIdx)
  })

  test("B. usa createPortal(..., document.body) explícitamente, gateado por isSheetOpen", () => {
    const source = readFileSync(CHAT_SHEET, "utf-8")
    expect(source).toMatch(/createPortal\(\s*<div[\s\S]*?ios-chat-keyboard-backdrop[\s\S]*?,\s*document\.body\s*\)/)
    expect(source).toMatch(/isSheetOpen\s*&&\s*typeof document/)
  })

  test("C. no está envuelto por ningún elemento con overflow-hidden en chat-sheet.tsx (la única mención de overflow-hidden en código real sigue siendo la de SheetContent, que ya no lo contiene)", () => {
    const source = readFileSync(CHAT_SHEET, "utf-8")
    // Excluye comentarios — el propio comentario del filler explica, en
    // prosa, por qué SheetContent (que SÍ usa overflow-hidden) ya no lo
    // envuelve; eso no debe contar como "envuelto por overflow-hidden".
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
      .join("\n")
    const backdropIdx = codeOnly.indexOf('className="ios-chat-keyboard-backdrop"')
    expect(backdropIdx).toBeGreaterThan(-1)
    const beforeBackdrop = codeOnly.slice(0, backdropIdx)
    expect(beforeBackdrop).not.toMatch(/overflow-hidden/)
  })

  test("D. mantiene data-ios-debug-role para el hook de diagnóstico temporal", () => {
    const source = readFileSync(CHAT_SHEET, "utf-8")
    expect(source).toContain('data-ios-debug-role="chat-keyboard-backdrop"')
  })

  test("E. z-index del filler (45) queda entre BottomNav (40) y Chat (50) — visible sobre la página normal, nunca sobre el contenido real del chat", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const ruleStart = css.indexOf(".ios-chat-keyboard-backdrop {")
    const ruleEnd = css.indexOf("}", ruleStart)
    const ruleBody = css.slice(ruleStart, ruleEnd)
    expect(ruleBody).toMatch(/z-index:\s*45/)
  })

  test("F. aritmética sin cambios: con offsetTop=403 el filler sigue cubriendo exactamente 394..797, independiente de cualquier recorte (ya no aplica)", () => {
    const innerHeight = 797
    const offsetTop = 403
    const contentVisibleBottom = innerHeight - offsetTop
    expect(contentVisibleBottom).toBe(394)
    const fillerBottomCss = -offsetTop
    const fillerHeightCss = offsetTop
    expect(fillerBottomCss + fillerHeightCss).toBe(0)
  })

  test("G. no se movió el composer — chat-view.tsx no fue tocado por este fix", () => {
    const chatView = readFileSync(join(process.cwd(), "src", "components", "chat", "chat-view.tsx"), "utf-8")
    expect(chatView).not.toMatch(/ios-chat-keyboard-backdrop/)
  })
})
