/// <reference types="bun-types" />

// ============================================
// IOS-24-POSITION-FIX — contrato estático focal
// ============================================
// Protege la implementación de restauración de scroll contra los
// antipatrones ya rechazados en esta iniciativa: scrollTo(0,0) fijo,
// body position:fixed global, altura de teclado hardcodeada, setTimeout
// ciego como mecanismo de espera/restauración. Lectura de texto, no un
// parser de TSX completo. NO simula iOS/WebKit real.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const IOS_KEYBOARD_FIX = join(process.cwd(), "src", "components", "pwa", "ios-keyboard-fix.tsx")
const BOTTOM_NAV = join(process.cwd(), "src", "components", "shared", "bottom-nav.tsx")
const CHAT_SHEET = join(process.cwd(), "src", "components", "chat", "chat-sheet.tsx")
const CHAT_VIEW = join(process.cwd(), "src", "components", "chat", "chat-view.tsx")
const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")

describe("IOS-24-POSITION-FIX — contrato estático de la restauración de scroll", () => {
  test("A. no usa scrollTo(0,0)/scrollTo({top:0}) hardcodeado — el destino siempre es preFocusScrollY", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).not.toMatch(/scrollTo\(\s*\{\s*top:\s*0\s*,/)
    expect(source).not.toMatch(/scrollTo\(\s*0\s*,\s*0\s*\)/)
  })

  test("B. no reintroduce body/documentElement position:fixed global (el fix de junio 2026 lo eliminó por romper todo el scroll)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).not.toMatch(/\.style\.position\s*=\s*["']fixed["']/)
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    expect(css).not.toMatch(/body\.ios-device\s*\{[^}]*position:\s*fixed/)
  })

  test("C. no usa un setTimeout ciego como mecanismo de espera/restauración (usa estabilización real vía requestAnimationFrame)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).not.toMatch(/setTimeout/)
    expect(source).toMatch(/requestAnimationFrame/)
  })

  test("D. no hardcodea una altura de teclado (el offset se sigue derivando de visualViewport, no de una constante de píxeles de teclado)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).not.toMatch(/keyboardHeight\s*=\s*\d/)
    expect(source).not.toMatch(/const\s+KEYBOARD_HEIGHT\b/)
  })

  test("E. la restauración distingue scroll intencional del usuario (no marca touchstart solo como scroll)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).toMatch(/touchmove/i)
    expect(source).toMatch(/TOUCH_MOVE_THRESHOLD/)
    // touchstart existe sólo para capturar la coordenada inicial, nunca para marcar userScrolledDuringCycle por sí solo
    const touchStartHandlerMatch = source.match(/const handleTouchStart[\s\S]*?\n\s*\}/)
    expect(touchStartHandlerMatch).not.toBeNull()
    expect(touchStartHandlerMatch?.[0] ?? "").not.toMatch(/userScrolledDuringCycle\s*=\s*true/)
  })

  test("F. los listeners de detección de intención son observadores puros (sin preventDefault/stopPropagation)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).not.toMatch(/\.(preventDefault|stopPropagation|stopImmediatePropagation)\(/)
  })

  test("G. la restauración tiene un límite acotado de reintentos (no hay loop sin condición de salida)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).toMatch(/RESTORE_MAX_RETRIES/)
    expect(source).toMatch(/STABLE_MAX_FRAMES/)
  })

  test("H. Chat y BottomNav no fueron modificados por este fix", () => {
    for (const file of [BOTTOM_NAV, CHAT_SHEET, CHAT_VIEW]) {
      const source = readFileSync(file, "utf-8")
      expect(source).not.toMatch(/preFocusScrollY|ios-scroll-restore-decision/)
    }
  })

  test("I. la lógica de decisión vive en un módulo puro separado, importado (no reimplementada inline dos veces)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).toContain("ios-scroll-restore-decision")
    expect(source).toContain("decideScrollRestore")
    expect(source).toContain("resolveCycleStart")
  })
})
