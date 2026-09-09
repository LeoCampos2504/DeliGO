/// <reference types="bun-types" />

// ============================================
// IOS-MOBILE-FIX-AND-REAL-DEVICE-INSTRUMENTATION-R1 — contrato estático focal
// (corregido por IOS-PWA-DEBUG-LAUNCH-FIX-R2A)
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
//
// IOS-PWA-DEBUG-LAUNCH-FIX-R2A quitó la persistencia por localStorage que
// R2 había agregado para intentar llevar el flag de Safari a la PWA
// instalada — Safari y una PWA instalada son contextos de storage
// separados en WebKit/iOS, así que esa persistencia nunca pudo funcionar
// cruzando ese límite (confirmado por el propio dispositivo real del
// operador). El fix real es que `public/manifest-cliente.json` ahora
// declara `start_url` con `?iosDebug=1` incluido, sólo en TESTING.
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

  test("B. el flag se lee una sola vez desde window.location.search, nunca desde props/SSR ni localStorage", () => {
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

  // IOS-PWA-DEBUG-LAUNCH-FIX-R2A: localStorage ya no tiene ningún propósito
  // (el fix real es manifest-cliente.json's start_url) — se volvió a la
  // prohibición estricta de R1 en vez de la excepción acotada que R2 había
  // introducido para IOS_DEBUG_STORAGE_KEY.
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

  // IOS-STANDALONE-REAL-DEVICE-FIX-R3 §18: el panel ahora LEE (nunca
  // escribe, nunca importa) el espejo de diagnóstico
  // window.__iosScrollRestoreDebug que ios-keyboard-fix.tsx publica — una
  // relación deliberada y unidireccional, no una reintroducción del
  // acoplamiento que este test originalmente prohibía. La invariante real
  // ("el panel no puede llegar a INFLUIR el restore") se prueba abajo con
  // más precisión que la prohibición total de R1.
  test("I. no importa src/lib/ios-scroll-restore-decision ni src/components/pwa/ios-keyboard-fix — sólo lee su espejo de diagnóstico vía window", () => {
    const source = panelCodeOnly()
    expect(source).not.toMatch(/from ["']@\/lib\/ios-scroll-restore-decision["']/)
    expect(source).not.toMatch(/from ["']@\/components\/pwa\/ios-keyboard-fix["']/)
    expect(source).not.toMatch(/decideScrollRestore|resolveCycleStart/)
  })

  test("I2. sólo LEE window.__iosScrollRestoreDebug — nunca lo asigna/escribe (nunca podría alterar la decisión real)", () => {
    const source = panelCodeOnly()
    expect(source).toContain("window as unknown as {")
    expect(source).toContain("__iosScrollRestoreDebug")
    expect(source).not.toMatch(/window\.__iosScrollRestoreDebug\s*=/)
    expect(source).not.toMatch(/\.__iosScrollRestoreDebug\s*=(?!=)/)
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

  test("L. feedMilestoneClassifier corre tanto en el live-update normal como en la ventana de settling — cubre ambos caminos de captura automática", () => {
    const source = panelSource()
    const occurrences = source.match(/feedMilestoneClassifier\(/g) ?? []
    // 1 definición (useCallback) + al menos 2 usos (scheduleLiveUpdate y runSettlingCapture x2 llamadas)
    expect(occurrences.length).toBeGreaterThanOrEqual(3)
  })

  test("M. el timer de AUTO_FINAL_STABLE se cancela en el cleanup del efecto de listeners", () => {
    const source = panelSource()
    expect(source).toContain("if (finalStableTimerRef.current) window.clearTimeout(finalStableTimerRef.current)")
  })
})
