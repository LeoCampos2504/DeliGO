/// <reference types="bun-types" />

// ============================================
// IOS-24-FIX-A — contrato estático: invariantes de arquitectura del fix
// ============================================
// Este contrato protege ÚNICAMENTE la arquitectura del código fuente (lectura
// de texto, no un parser de CSS/TSX completo). NO simula Safari, WebKit ni
// el compositor de una PWA standalone en iPhone real — eso requiere el
// diagnóstico manual documentado en CODEX_REPORT.md.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT_LAYOUT = join(process.cwd(), "src", "app", "layout.tsx")
const CHAT_SHEET = join(process.cwd(), "src", "components", "chat", "chat-sheet.tsx")
const BOTTOM_NAV = join(process.cwd(), "src", "components", "shared", "bottom-nav.tsx")
const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")

describe("IOS-24-FIX-A — contrato estático de arquitectura del layout iOS", () => {
  test("A. el root layout no depende de la clase ios-min-viewport-height (stale CSS var)", () => {
    const source = readFileSync(ROOT_LAYOUT, "utf-8")
    expect(source).not.toContain("ios-min-viewport-height")
  })

  test("B. el Chat Sheet no depende de la clase ios-viewport-height (stale CSS var)", () => {
    const source = readFileSync(CHAT_SHEET, "utf-8")
    expect(source).not.toContain("ios-viewport-height")
  })

  test("C. BottomNav sigue siendo fixed bottom-0 (no se cambió el positioning en FIX-A)", () => {
    const source = readFileSync(BOTTOM_NAV, "utf-8")
    expect(source).toContain("fixed bottom-0")
  })

  test("D. la regla de .ios-keyboard-open para .ios-bottom-nav no usa transform/translate", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    const ruleStart = css.indexOf(".ios-keyboard-open .ios-bottom-nav")
    expect(ruleStart).toBeGreaterThan(-1)

    const ruleEnd = css.indexOf("}", ruleStart)
    const ruleBody = css.slice(ruleStart, ruleEnd)

    expect(ruleBody).not.toMatch(/transform|translate/i)
    expect(ruleBody).toMatch(/visibility\s*:\s*hidden/)
    expect(ruleBody).toMatch(/pointer-events\s*:\s*none/)
  })

  test("E. no se reintroduce padding-bottom global en body.ios-device > div / body.ios-device main (fix histórico de junio 2026, commit 648c5ce)", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")

    const globalDivRuleIdx = css.indexOf("body.ios-device > div,")
    expect(globalDivRuleIdx).toBe(-1)

    const mainRuleIdx = css.search(/body\.ios-device\s+main\s*\{/)
    expect(mainRuleIdx).toBe(-1)

    const firstChildRuleStart = css.indexOf("body.ios-device > div:first-child")
    expect(firstChildRuleStart).toBeGreaterThan(-1)
    const firstChildRuleEnd = css.indexOf("}", firstChildRuleStart)
    const firstChildRuleBody = css.slice(firstChildRuleStart, firstChildRuleEnd)
    expect(firstChildRuleBody).not.toMatch(/padding-bottom/)
  })

  test("F. .ios-viewport-height sigue definida (cart-panel.tsx todavía la usa, fuera de alcance de FIX-A)", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    expect(css).toContain(".ios-viewport-height {")
  })

  test("sanity check: el detector de 'transform/translate dentro de la regla' funciona sobre un caso sintético que SÍ los contiene", () => {
    const syntheticCss = `
.ios-keyboard-open .ios-bottom-nav {
  transform: translateY(100%) !important;
}
`
    const ruleStart = syntheticCss.indexOf(".ios-keyboard-open .ios-bottom-nav")
    const ruleEnd = syntheticCss.indexOf("}", ruleStart)
    const ruleBody = syntheticCss.slice(ruleStart, ruleEnd)
    expect(ruleBody).toMatch(/transform|translate/i)
  })
})
