/// <reference types="bun-types" />

// ============================================
// IOS-MOBILE-FIX-AND-REAL-DEVICE-INSTRUMENTATION-R1 — contrato estático focal
// ============================================
// No existe React Testing Library en el stack de tests de este repo (ver el
// comentario de módulo de chat-fab.test.tsx / chat-sheet.test.tsx para el
// racional ya establecido) — este archivo prueba estructuralmente el
// contrato del panel de diagnóstico contra su propio texto fuente, misma
// estrategia que el resto de los contratos estáticos de este directorio. La
// lógica pura (derivados, ring buffer, whitelist de campos, export JSON) ya
// está cubierta con tests reales de comportamiento en
// src/lib/ios-debug-snapshot.test.ts — este archivo sólo protege el
// cableado del componente React alrededor de esa lógica.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const panelSource = () =>
  readFileSync(resolve(import.meta.dir, "ios-viewport-debug-panel.tsx"), "utf8").replace(/\r\n/g, "\n")

// Excluye líneas de comentario de documentación (el propio comentario de
// módulo explica, en prosa, qué APIs NO usa este componente) — mismo patrón
// que el test C de ios-nav-dock-static-contract.test.ts.
const panelCodeOnly = () =>
  panelSource()
    .split("\n")
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
    .join("\n")

describe("IOSViewportDebugPanel — contrato estático", () => {
  test("A. el panel no renderiza nada hasta que isIosDebugFlagEnabled(window.location.search) confirma el flag", () => {
    const source = panelSource()
    expect(source).toContain("isIosDebugFlagEnabled(window.location.search)")
    expect(source).toContain("if (!mounted || !enabled) return null")
  })

  test("B. el flag se lee una sola vez desde window.location.search, nunca desde props/SSR", () => {
    const source = panelSource()
    expect(source).toContain("setEnabled(isIosDebugFlagEnabled(window.location.search))")
    expect(source).not.toMatch(/searchParams\s*:\s*{/)
  })

  test("C. sin el flag, no se agregan listeners (el efecto de listeners está gateado por `enabled`)", () => {
    const source = panelSource()
    expect(source).toMatch(/useEffect\(\(\) => \{\s*if \(!enabled\) return/)
  })

  test("D. todos los listeners agregados tienen su remove correspondiente en el cleanup", () => {
    const source = panelSource()
    const added = [...source.matchAll(/\.addEventListener\("(\w[\w-]*)"/g)].map((m) => m[1])
    const removed = [...source.matchAll(/\.removeEventListener\("(\w[\w-]*)"/g)].map((m) => m[1])
    expect(added.length).toBeGreaterThan(0)
    expect(new Set(removed)).toEqual(new Set(added))
  })

  test("E. cancela el rAF pendiente en el cleanup", () => {
    const source = panelSource()
    expect(source).toContain("if (rafRef.current) window.cancelAnimationFrame(rafRef.current)")
  })

  test("F. no realiza ningún fetch/XHR/WebSocket/sendBeacon — sin telemetría ni endpoint de subida", () => {
    const source = panelCodeOnly()
    expect(source).not.toMatch(/\bfetch\(/)
    expect(source).not.toMatch(/XMLHttpRequest/)
    expect(source).not.toMatch(/new WebSocket/)
    expect(source).not.toMatch(/sendBeacon/)
  })

  test("G. nunca lee input.value, localStorage, document.cookie, ni contenido de mensajes", () => {
    const source = panelCodeOnly()
    expect(source).not.toMatch(/\.value\b/)
    expect(source).not.toMatch(/localStorage/)
    expect(source).not.toMatch(/document\.cookie/)
    expect(source).not.toMatch(/textContent|innerText|innerHTML/)
  })

  test("H. exportar JSON usa navigator.clipboard, nunca un endpoint propio ni descarga automática", () => {
    const source = panelSource()
    expect(source).toContain("navigator.clipboard.writeText")
    expect(source).not.toMatch(/<a[^>]*download/)
  })

  test("I. no importa ni modifica el restore de scroll existente (ios-keyboard-fix / ios-scroll-restore-decision)", () => {
    const source = panelCodeOnly()
    expect(source).not.toMatch(/ios-keyboard-fix|ios-scroll-restore-decision|preFocusScrollY/)
  })

  test("J. usa los mismos data-ios-debug-role/data-slot ya expuestos por BottomNav/ChatFab/ChatSheet/composer, no nombres nuevos inventados", () => {
    const source = panelSource()
    expect(source).toContain('[data-ios-debug-role="bottom-nav"]')
    expect(source).toContain('[data-ios-debug-role="chat-fab"]')
    expect(source).toContain('[data-ios-debug-role="chat-sheet"]')
    expect(source).toContain('[data-ios-debug-role="chat-composer"]')
    expect(source).toContain('[data-slot="sheet-overlay"]')
  })

  test("K. está montado en el root layout, no dentro de una ruta específica", () => {
    const layoutSource = readFileSync(
      resolve(import.meta.dir, "..", "..", "app", "layout.tsx"),
      "utf8"
    ).replace(/\r\n/g, "\n")
    expect(layoutSource).toContain("<IOSViewportDebugPanel />")
  })
})
