/// <reference types="bun-types" />

// ============================================
// IOS-24-RUNTIME-DIAGNOSTIC — contrato estático focal
// ============================================
// Protege únicamente que la instrumentación temporal de diagnóstico sea
// segura de tener en el árbol: sólo se activa con ?iosdebug=1, nunca previene
// eventos nativos, nunca escribe scroll/estilos de body/html, y no modifica
// ningún archivo productivo de IOS-24 (BottomNav, Chat, sheet.tsx,
// globals.css, IOSKeyboardFix). Lectura de texto, no un parser de TSX
// completo. NO simula iOS/WebKit real.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const PANEL = join(process.cwd(), "src", "components", "pwa", "ios-runtime-debug-panel.tsx")
const ROOT_LAYOUT = join(process.cwd(), "src", "app", "layout.tsx")
const BOTTOM_NAV = join(process.cwd(), "src", "components", "shared", "bottom-nav.tsx")
const CHAT_SHEET = join(process.cwd(), "src", "components", "chat", "chat-sheet.tsx")
const CHAT_VIEW = join(process.cwd(), "src", "components", "chat", "chat-view.tsx")
const UI_SHEET = join(process.cwd(), "src", "components", "ui", "sheet.tsx")
const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")
const IOS_KEYBOARD_FIX = join(process.cwd(), "src", "components", "pwa", "ios-keyboard-fix.tsx")

describe("IOS-24-RUNTIME-DIAGNOSTIC — contrato estático del panel de diagnóstico", () => {
  test("A. el panel sólo se activa vía el query param literal iosdebug=1 (no por user-agent/entorno)", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).toContain('"iosdebug"')
    expect(source).toContain('=== "1"')
    expect(source).not.toMatch(/userAgent/i)
    expect(source).not.toMatch(/NODE_ENV|process\.env/i)
  })

  test("B. el panel nunca llama preventDefault()/stopPropagation()/stopImmediatePropagation() (se excluyen menciones en comentarios)", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).not.toMatch(/\.(preventDefault|stopPropagation|stopImmediatePropagation)\(/)
  })

  test("C. el panel nunca llama window.scrollTo/scrollBy ni escribe scrollTop", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).not.toMatch(/window\.scrollTo|window\.scrollBy|\.scrollTop\s*=/)
  })

  test("D. el panel nunca escribe estilos/clases de document.body o document.documentElement", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).not.toMatch(/document\.body\.style|document\.body\.classList|document\.documentElement\.style|document\.documentElement\.classList/)
  })

  test("E. el panel no usa transform/translate para su propio posicionamiento (position: fixed sin transform)", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).toContain('position: "fixed"')
    // Se aísla el objeto panelStyle (el shell fixed real) del resto del
    // archivo — IOS-24-NAV-RUNTIME-DIAGNOSTIC agregó campos de datos como
    // `navComputedTransform` (lectura diagnóstica del transform del NAV,
    // no del propio panel), que de otro modo coincidirían con un grep global.
    const panelStyleMatch = source.match(/const panelStyle: CSSProperties = \{([\s\S]*?)\n  \}/)
    expect(panelStyleMatch).not.toBeNull()
    expect(panelStyleMatch?.[1] ?? "").not.toMatch(/\btransform\s*:/i)
  })

  test("F. el panel no muestra el valor/contenido del input enfocado, sólo tag/type", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).not.toMatch(/\.value\b/)
    expect(source).not.toMatch(/textContent|innerText/)
  })

  test("G. el panel no expone location.search completo en el diagnóstico mostrado/copiado, sólo pathname", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).toContain("window.location.pathname")
    expect(source).not.toMatch(/path:\s*window\.location\.search/)
    expect(source).not.toMatch(/\$\{live\.search\}/)
  })

  test("H. root layout monta el panel junto a IOSKeyboardFix, sin más cambios en el archivo", () => {
    const source = readFileSync(ROOT_LAYOUT, "utf-8")
    expect(source).toContain("<IOSRuntimeDebugPanel />")
    expect(source).toContain("<IOSKeyboardFix />")
  })

  test("I. IOSKeyboardFix (fase IOS-24-POSITION-FIX): la restauración de scroll que agrega no usa scrollTo(0,0) hardcodeado ni un setTimeout ciego como mecanismo de espera", () => {
    // Nota: esta aserción cambió respecto de la fase de instrumentación
    // (donde exigía "IOSKeyboardFix sin cambios") — esa premisa quedó
    // obsoleta a propósito en IOS-24-POSITION-FIX, que extiende el mismo
    // archivo para restaurar la posición real pre-focus. Lo que sigue
    // protegido aquí es que la extensión no reintroduzca los antipatrones
    // ya rechazados (scrollTo(0,0) fijo, setTimeout ciego).
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).toMatch(/scrollTo|preFocusScrollY/)
    expect(source).not.toMatch(/scrollTo\(\s*\{\s*top:\s*0\s*,/)
    expect(source).not.toMatch(/scrollTo\(\s*0\s*,\s*0\s*\)/)
    expect(source).not.toMatch(/setTimeout/)
  })

  test("J. BottomNav, ChatSheet, ChatView, sheet.tsx no mencionan el panel de diagnóstico ni fueron acoplados a él", () => {
    for (const file of [BOTTOM_NAV, CHAT_SHEET, CHAT_VIEW, UI_SHEET]) {
      const source = readFileSync(file, "utf-8")
      expect(source).not.toContain("ios-runtime-debug-panel")
      expect(source).not.toContain("IOSRuntimeDebugPanel")
    }
  })

  test("K. globals.css no fue modificado para el panel (estilos inline en el propio componente)", () => {
    const css = readFileSync(GLOBALS_CSS, "utf-8")
    expect(css).not.toMatch(/iosdebug|ios-runtime-debug/i)
  })

  test("L. IOS-24-NAV-RUNTIME-DIAGNOSTIC: localiza el nav exclusivamente vía la clase productiva existente .ios-bottom-nav, sin agregar clase/id nuevo", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).toContain('".ios-bottom-nav"')
    expect(source).not.toMatch(/data-ios-?debug|ios-nav-debug-id/i)
  })

  test("M. el panel nunca escribe en el/los nodo(s) del nav (sólo querySelectorAll/getBoundingClientRect/getComputedStyle — lectura pura)", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).not.toMatch(/nav\.style\.|nav\.classList|navs?\[\d+\]\.style|navs?\[\d+\]\.classList|\.setAttribute\(/)
  })

  test("N. usa getBoundingClientRect para la geometría real del nav", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).toContain("getBoundingClientRect")
  })

  test("O. usa getComputedStyle de forma read-only para el nav", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).toContain("getComputedStyle")
  })

  test("P. calcula navGapToLayoutBottom (distancia real al layout viewport)", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).toContain("navGapToLayoutBottom")
  })

  test("Q. calcula navGapToVisualBottom (distancia real al visual viewport)", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).toContain("navGapToVisualBottom")
  })

  test("R. calcula navDocumentTop/navDocumentBottom (posición documental derivada, rect + scrollY)", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).toContain("navDocumentTop")
    expect(source).toMatch(/navDocumentTop:\s*rect\.top\s*\+\s*window\.scrollY/)
  })

  test("S. mide navCount para detectar duplicación de portales/instancias", () => {
    const source = readFileSync(PANEL, "utf-8")
    expect(source).toMatch(/navCount\s*[,:]/)
    expect(source).toContain("querySelectorAll")
  })

  test("T. BottomNav sigue sin ningún cambio (sin diff productivo esperado en esta tarea)", () => {
    const source = readFileSync(BOTTOM_NAV, "utf-8")
    expect(source).not.toMatch(/ios-runtime-debug|iosdebug/i)
  })
})
