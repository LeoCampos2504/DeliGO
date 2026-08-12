/// <reference types="bun-types" />

// ============================================
// IOS-24-NAV-DOCK — contrato estático focal
// ============================================
// Protege la arquitectura del floating dock: portal a document.body,
// position:fixed, inset lateral, gap inferior de diseño (no de teclado),
// safe-area de una sola fuente, sin transform en el shell, sin
// backdrop-filter, y que el resto de IOS-24 (IOSKeyboardFix, Chat) sigue
// intacto. Lectura de texto, no un parser de TSX completo.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const BOTTOM_NAV = join(process.cwd(), "src", "components", "shared", "bottom-nav.tsx")
const IOS_KEYBOARD_FIX = join(process.cwd(), "src", "components", "pwa", "ios-keyboard-fix.tsx")
const CHAT_SHEET = join(process.cwd(), "src", "components", "chat", "chat-sheet.tsx")
const CHAT_VIEW = join(process.cwd(), "src", "components", "chat", "chat-view.tsx")
const UI_SHEET = join(process.cwd(), "src", "components", "ui", "sheet.tsx")
const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")

describe("IOS-24-NAV-DOCK — contrato estático del floating dock", () => {
  test("A. BottomNav se renderiza vía createPortal a document.body", () => {
    const source = readFileSync(BOTTOM_NAV, "utf-8")
    expect(source).toContain("createPortal")
    expect(source).toMatch(/createPortal\([^)]*document\.body\)/)
  })

  test("B. BottomNav sigue siendo position:fixed", () => {
    const source = readFileSync(BOTTOM_NAV, "utf-8")
    expect(source).toMatch(/\bfixed\b/)
  })

  test("C. el gap inferior combina safe-area con un valor constante de diseño (no una variable de teclado)", () => {
    const source = readFileSync(BOTTOM_NAV, "utf-8")
    // Se excluyen menciones dentro de comentarios de documentación (el propio
    // comentario del componente explica, en prosa, qué variables NO usa).
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
      .join("\n")
    expect(codeOnly).toMatch(/env\(safe-area-inset-bottom/)
    expect(codeOnly).not.toMatch(/var\(--visual-viewport-height/)
    expect(codeOnly).not.toMatch(/var\(--visual-viewport-offset-top/)
    expect(codeOnly).not.toMatch(/var\(--ios-keyboard-offset/)
    expect(codeOnly).not.toMatch(/window\.scrollY/)
    expect(codeOnly).not.toMatch(/visualViewport/)
  })

  test("D. el shell no usa transform/translate/scale/will-change/perspective para su propio posicionamiento", () => {
    const source = readFileSync(BOTTOM_NAV, "utf-8")
    // El indicador de tab activo (motion.div, ~8px) usa transform para su
    // propia posición decorativa — eso es aceptable, no es el shell fixed.
    // Aislamos el <nav> (el shell real) del resto del archivo para el check.
    const navMatch = source.match(/<nav\s+className=\{cn\(([\s\S]*?)\)\}/)
    expect(navMatch).not.toBeNull()
    const navClassList = navMatch?.[1] ?? ""
    expect(navClassList).not.toMatch(/\btransform\b|\btranslate|\bscale-|will-change|perspective/)
  })

  test("E. sin backdrop-filter/backdrop-blur", () => {
    const source = readFileSync(BOTTOM_NAV, "utf-8")
    expect(source).not.toMatch(/backdrop-filter|backdrop-blur/)
  })

  test("F. inset lateral (no edge-to-edge) y ancho máximo acotado", () => {
    const source = readFileSync(BOTTOM_NAV, "utf-8")
    expect(source).toMatch(/left-3/)
    expect(source).toMatch(/right-3/)
    expect(source).not.toMatch(/left-0.*right-0|right-0.*left-0/)
  })

  test("G. SSR-safe: gatea el render en un flag `mounted`, nunca accede a document/window en el top-level del componente", () => {
    const source = readFileSync(BOTTOM_NAV, "utf-8")
    expect(source).toMatch(/mounted/)
    expect(source).toMatch(/if \(!mounted/)
  })

  test("H. keyboard-open sigue ocultando el nav con visibility/pointer-events (no transform) — regla ya protegida por ios-keyboard-layout-static-contract, se reconfirma aquí junto al dock", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const ruleStart = css.indexOf(".ios-keyboard-open .ios-bottom-nav")
    expect(ruleStart).toBeGreaterThan(-1)
    const ruleEnd = css.indexOf("}", ruleStart)
    const ruleBody = css.slice(ruleStart, ruleEnd)
    expect(ruleBody).not.toMatch(/transform|translate/i)
    expect(ruleBody).toMatch(/visibility\s*:\s*hidden/)
  })

  test("I. no se reintroduce padding-bottom global (globals.css sin tocar por esta tarea)", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const firstChildRuleStart = css.indexOf("body.ios-device > div:first-child")
    expect(firstChildRuleStart).toBeGreaterThan(-1)
    const firstChildRuleEnd = css.indexOf("}", firstChildRuleStart)
    const firstChildRuleBody = css.slice(firstChildRuleStart, firstChildRuleEnd)
    expect(firstChildRuleBody).not.toMatch(/padding-bottom/)
  })

  test("J. IOSKeyboardFix (position-restore) e IOS-24-POSITION-FIX no fueron tocados por esta tarea", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).toContain("preFocusScrollY")
    expect(source).not.toMatch(/createPortal|bottom-nav/)
  })

  test("K. Chat (chat-sheet/chat-view/sheet.tsx) no fue modificado por este fix", () => {
    for (const file of [CHAT_SHEET, CHAT_VIEW, UI_SHEET]) {
      const source = readFileSync(file, "utf-8")
      expect(source).not.toMatch(/bottom-nav|createPortal/)
    }
  })

  test("sanity check: el detector de transform en el shell encuentra un caso sintético que sí lo usa", () => {
    const syntheticSource = `
    <nav className={cn(
      "fixed transform translate-y-2"
    )}>
    `
    const navMatch = syntheticSource.match(/<nav\s+className=\{cn\(([\s\S]*?)\)\}/)
    const navClassList = navMatch?.[1] ?? ""
    expect(navClassList).toMatch(/\btransform\b|\btranslate/)
  })
})
