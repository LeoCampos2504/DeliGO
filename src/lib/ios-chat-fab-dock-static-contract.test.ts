/// <reference types="bun-types" />

// ============================================
// IOS-MOBILE-FIX-AND-REAL-DEVICE-INSTRUMENTATION-R1 — contrato estático focal
// ============================================
// Protege el fix confirmado por el diagnóstico independiente (Claude R1) y
// los dos diagnósticos de Codex (R1/R2): BottomNav y ChatFab compartiendo la
// misma autoridad de safe-area estática en iOS, ChatFab derivando su
// posición de métricas explícitas del dock en vez de una fórmula
// independiente hardcodeada, y ChatFab ocultándose de verdad durante el
// teclado (las clases previas no tenían regla CSS). Lectura de texto, no un
// parser de TSX/CSS completo.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const CHAT_FAB = join(process.cwd(), "src", "components", "chat", "chat-fab.tsx")
const BOTTOM_NAV = join(process.cwd(), "src", "components", "shared", "bottom-nav.tsx")
const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")

function ruleBodyFor(css: string, selectorLiteral: string): string {
  const ruleStart = css.indexOf(selectorLiteral)
  expect(ruleStart).toBeGreaterThan(-1)
  const ruleEnd = css.indexOf("}", ruleStart)
  return css.slice(ruleStart, ruleEnd)
}

describe("IOS-MOBILE-FIX-AND-REAL-DEVICE-INSTRUMENTATION-R1 — dock compartido FAB/Nav", () => {
  test("A. ChatFab usa la clase ios-chat-fab (autoridad de dock compartida)", () => {
    const source = readFileSync(CHAT_FAB, "utf-8")
    expect(source).toMatch(/className="ios-chat-fab\b/)
  })

  test("B. ChatFab ya no usa las clases muertas ios-keyboard-hide / keyboard-hide-when-editing", () => {
    const source = readFileSync(CHAT_FAB, "utf-8")
    expect(source).not.toMatch(/ios-keyboard-hide/)
    expect(source).not.toMatch(/keyboard-hide-when-editing/)
  })

  test("C. no-iOS: ChatFab conserva el fallback dinámico base (5rem + env(safe-area-inset-bottom))", () => {
    const source = readFileSync(CHAT_FAB, "utf-8")
    expect(source).toContain("bottom-[calc(5rem+env(safe-area-inset-bottom))]")
  })

  test("D. drift-lock: --ios-bottom-safe-footprint usa exactamente la misma fórmula literal que ya usa body.ios-device .ios-bottom-nav", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const navRuleBody = ruleBodyFor(css, "body.ios-device .ios-bottom-nav {")
    expect(navRuleBody).toMatch(/env\(safe-area-max-inset-bottom,\s*34px\)/)

    const sharedBlockBody = ruleBodyFor(css, "--ios-bottom-safe-footprint:")
    // ruleBodyFor busca hasta el primer "}" desde el indexOf del token; como
    // el token está dentro de un bloque body.ios-device {...}, esto captura
    // el resto del bloque compartido completo.
    expect(sharedBlockBody).toMatch(/--ios-bottom-safe-footprint:\s*env\(safe-area-max-inset-bottom,\s*34px\)/)
  })

  test("E. body.ios-device .ios-chat-fab deriva bottom de las variables del dock compartido, no de un env() propio hardcodeado", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const ruleBody = ruleBodyFor(css, "body.ios-device .ios-chat-fab {")
    expect(ruleBody).toMatch(/var\(--ios-bottom-safe-footprint\)/)
    expect(ruleBody).toMatch(/var\(--ios-bottom-nav-height\)/)
    expect(ruleBody).toMatch(/var\(--ios-bottom-dock-gap\)/)
    expect(ruleBody).toMatch(/var\(--ios-chat-fab-gap-above-nav\)/)
    expect(ruleBody).not.toMatch(/env\(safe-area-inset-bottom/)
  })

  test("F. keyboard-open oculta ChatFab con visibility/pointer-events (nunca transform), igual que BottomNav", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const ruleStart = css.indexOf(".ios-keyboard-open .ios-chat-fab")
    expect(ruleStart).toBeGreaterThan(-1)
    const ruleEnd = css.indexOf("}", ruleStart)
    const ruleBody = css.slice(ruleStart, ruleEnd)
    expect(ruleBody).not.toMatch(/transform|translate/i)
    expect(ruleBody).toMatch(/visibility\s*:\s*hidden/)
    expect(ruleBody).toMatch(/pointer-events\s*:\s*none/)
  })

  test("G. ChatFab no lee --ios-keyboard-offset ni visualViewport (sin compensación manual de teclado)", () => {
    const source = readFileSync(CHAT_FAB, "utf-8")
    expect(source).not.toMatch(/--ios-keyboard-offset/)
    expect(source).not.toMatch(/visualViewport/)
  })

  test("H. BottomNav no fue modificado en su regla de safe-area/keyboard existente (fórmula L/M/N/O intacta)", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const navRuleBody = ruleBodyFor(css, "body.ios-device .ios-bottom-nav {")
    const normalized = navRuleBody.replace(/\r\n/g, "\n").trim()
    expect(normalized).toBe(
      "body.ios-device .ios-bottom-nav {\n  bottom: calc(env(safe-area-max-inset-bottom, 34px) + 8px);"
    )
    const bottomNavSource = readFileSync(BOTTOM_NAV, "utf-8")
    expect(bottomNavSource).toContain("bottom-[calc(env(safe-area-inset-bottom,0px)+8px)]")
  })

  test("I. debug hooks son atributos data- sin efecto funcional (no className, no style)", () => {
    const chatFabSource = readFileSync(CHAT_FAB, "utf-8")
    expect(chatFabSource).toMatch(/data-ios-debug-role="chat-fab"/)
    const bottomNavSource = readFileSync(BOTTOM_NAV, "utf-8")
    expect(bottomNavSource).toMatch(/data-ios-debug-role="bottom-nav"/)
  })

  test("sanity check: el detector de transform en la regla de keyboard-hide encuentra un caso sintético que sí lo usa", () => {
    const syntheticCss = `
.ios-keyboard-open .ios-chat-fab {
  transform: translateY(200%) !important;
}
`
    const ruleStart = syntheticCss.indexOf(".ios-keyboard-open .ios-chat-fab")
    const ruleEnd = syntheticCss.indexOf("}", ruleStart)
    const ruleBody = syntheticCss.slice(ruleStart, ruleEnd)
    expect(ruleBody).toMatch(/transform|translate/i)
  })
})
