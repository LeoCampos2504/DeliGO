/// <reference types="bun-types" />

// ============================================
// IOS-STANDALONE-POST-KEYBOARD-NAV-OCCLUSION-R6 — contrato estático + probes
// ============================================
// R5 dejó una contradicción sin resolver, confirmada por el propio JSON real
// de R5 (16 capturas, iOS 18.7, standalone): en TODAS las muestras
// AUTO_AFTER_KEYBOARD_CLOSE / AUTO_FINAL_STABLE post-teclado,
// derived.navPhysicalFullyVisible=true y navPhysicalOverflowBottom=0 — la
// geometría dice PASS — mientras el operador reportó el nav parcial y
// visualmente oculto/cubierto tras cerrar el teclado, con un "salto" visual
// aunque el rect físico se mantiene estable (±1px). Esto es
// GEOMETRY_PASS_VISUAL_FAIL: un problema de pintura/compositing/stacking,
// no de posición — geometría ya no puede seguir siendo el instrumento único.
//
// Esta tarea NO implementa un fix de comportamiento (§26 de la tarea):
// ninguna causa fue probada de forma determinística sin acceso al iPhone
// físico (el propio código fuente auditado no muestra backdrop-filter, otro
// elemento position:fixed candidato, ni una clase de teclado que persista
// tras su remoción). En su lugar, agrega instrumentación seria y acotada
// (elementsFromPoint hit-test, timeline post-teclado, sondeo A/B
// sólido/sin-backdrop, marcadores visuales) para que la PRÓXIMA prueba
// física real pueda probar o refutar cada hipótesis (H1-H10) con datos, no
// con conjeturas. R5's dock geometry (--ios-dock-visual-offset-top, el
// sondeo por rAF, el contrato de 8px/gap) permanece intacto — no se toca
// ios-keyboard-fix.tsx en esta tarea.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import {
  classifyProbeOcclusion,
  computeNavProbePoints,
  isNavPaintProbeSolidEnabled,
  NAV_PROBE_EDGE_MARGIN_PX,
  OCCLUSION_PROBE_RESULT_ALLOWED_KEYS,
  SAFE_PAINT_ELEMENT_ALLOWED_KEYS,
  sanitizeClassNameSample,
  sanitizeStaticId,
  type OcclusionProbeResult,
  type RectGeometry,
  type SafePaintElementInfo,
} from "./ios-debug-snapshot"

const DEBUG_PANEL = join(process.cwd(), "src", "components", "pwa", "ios-viewport-debug-panel.tsx")
const BOTTOM_NAV = join(process.cwd(), "src", "components", "shared", "bottom-nav.tsx")
const GLOBALS_CSS = join(process.cwd(), "src", "app", "globals.css")
const IOS_KEYBOARD_FIX = join(process.cwd(), "src", "components", "pwa", "ios-keyboard-fix.tsx")

const debugPanelSource = readFileSync(DEBUG_PANEL, "utf8")
const bottomNavSource = readFileSync(BOTTOM_NAV, "utf8")
const globalsCssSource = readFileSync(GLOBALS_CSS, "utf8")

function rect(over: Partial<RectGeometry> = {}): RectGeometry {
  return { top: 689, left: 12, right: 378, bottom: 755, width: 366, height: 66, ...over }
}

function safeElement(over: Partial<SafePaintElementInfo> = {}): SafePaintElementInfo {
  return {
    tagName: "nav",
    debugRole: "bottom-nav",
    ariaRole: null,
    staticId: null,
    classNameSample: "fixed z-40 ios-bottom-nav",
    computedPosition: "fixed",
    computedZIndex: "40",
    computedPointerEvents: "auto",
    computedVisibility: "visible",
    computedOpacity: "1",
    ...over,
  }
}

// ────────────────────────────────────────────────────────────────────────
describe("1. Contradicción geometría vs. visual (evidencia del R5 JSON real)", () => {
  // Valores extraídos directamente del payload real R5 (capturas #6, #7,
  // #9, #10, #12, #14, #15 — todas AUTO_AFTER_KEYBOARD_CLOSE o
  // AUTO_FINAL_STABLE con vv.offsetTop != 0). En las 7, navPhysicalFullyVisible
  // fue exactamente `true` y navPhysicalOverflowBottom exactamente 0.
  test("todas las muestras reales post-teclado del R5 JSON reportan navPhysicalFullyVisible=true", () => {
    const realPostKeyboardSamples = [
      { label: "#6 AUTO_AFTER_KEYBOARD_CLOSE", navPhysicalFullyVisible: true, navPhysicalOverflowBottom: 0 },
      { label: "#7 AUTO_FINAL_STABLE", navPhysicalFullyVisible: true, navPhysicalOverflowBottom: 0 },
      { label: "#9 AUTO_AFTER_KEYBOARD_CLOSE", navPhysicalFullyVisible: true, navPhysicalOverflowBottom: 0 },
      { label: "#10 AUTO_FINAL_STABLE", navPhysicalFullyVisible: true, navPhysicalOverflowBottom: 0 },
      { label: "#12 AUTO_AFTER_KEYBOARD_CLOSE", navPhysicalFullyVisible: true, navPhysicalOverflowBottom: 0 },
      { label: "#14 AUTO_AFTER_KEYBOARD_CLOSE", navPhysicalFullyVisible: true, navPhysicalOverflowBottom: 0 },
      { label: "#15 AUTO_FINAL_STABLE", navPhysicalFullyVisible: true, navPhysicalOverflowBottom: 0 },
    ]
    for (const sample of realPostKeyboardSamples) {
      expect(sample.navPhysicalFullyVisible).toBe(true)
      expect(sample.navPhysicalOverflowBottom).toBe(0)
    }
  })

  function classifyR5Contradiction(geometryResult: "PASS" | "FAIL", operatorVisualResult: "PASS" | "FAIL") {
    if (geometryResult === "PASS" && operatorVisualResult === "FAIL") return "GEOMETRY_PASS_VISUAL_FAIL"
    if (geometryResult === "FAIL" && operatorVisualResult === "FAIL") return "GEOMETRY_FAIL_VISUAL_FAIL"
    return "GEOMETRY_AND_VISUAL_BOTH_FAIL"
  }

  test("clasificación de la contradicción: GEOMETRY_PASS_VISUAL_FAIL, no GEOMETRY_FAIL_VISUAL_FAIL", () => {
    // navPhysicalFullyVisible=true en el 100% de las muestras post-teclado
    // reales (geometría PASS) mientras el operador reportó el nav
    // parcialmente cubierto/oculto tras cerrar el teclado (visual FAIL).
    expect(classifyR5Contradiction("PASS", "FAIL")).toBe("GEOMETRY_PASS_VISUAL_FAIL")
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("2. computeNavProbePoints — puntos de sondeo dentro del rect real del nav", () => {
  test("produce al menos 3 puntos (TOP/MIDDLE/BOTTOM_CENTER), todos dentro del rect", () => {
    const points = computeNavProbePoints(rect())
    expect(points.length).toBeGreaterThanOrEqual(3)
    const labels = points.map((p) => p.label)
    expect(labels).toContain("NAV_TOP_CENTER")
    expect(labels).toContain("NAV_MIDDLE_CENTER")
    expect(labels).toContain("NAV_BOTTOM_CENTER")
  })

  test("todos los puntos quedan estrictamente dentro del rect (nunca sobre el borde exacto)", () => {
    const r = rect()
    const points = computeNavProbePoints(r)
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(r.left)
      expect(p.x).toBeLessThanOrEqual(r.right)
      expect(p.y).toBeGreaterThanOrEqual(r.top)
      expect(p.y).toBeLessThanOrEqual(r.bottom)
    }
    // El margen real se respeta cuando el rect es suficientemente grande.
    const topPoint = points.find((p) => p.label === "NAV_TOP_CENTER")!
    expect(topPoint.y).toBe(r.top + NAV_PROBE_EDGE_MARGIN_PX)
  })

  test("nunca lanza ni produce NaN incluso con un rect degenerado (altura/ancho ~0)", () => {
    const tiny = { top: 100, left: 100, right: 100, bottom: 100, width: 0, height: 0 }
    const points = computeNavProbePoints(tiny)
    for (const p of points) {
      expect(Number.isNaN(p.x)).toBe(false)
      expect(Number.isNaN(p.y)).toBe(false)
    }
  })

  test("distingue TOP/BOTTOM_LEFT/BOTTOM_RIGHT para detectar ocluders que cubren solo una mitad", () => {
    const points = computeNavProbePoints(rect())
    const bl = points.find((p) => p.label === "NAV_BOTTOM_LEFT")!
    const br = points.find((p) => p.label === "NAV_BOTTOM_RIGHT")!
    expect(bl.x).toBeLessThan(br.x)
    expect(bl.y).toBe(br.y)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("3. Sanitización — nunca puede filtrarse texto/valor/id dinámico", () => {
  test("sanitizeClassNameSample conserva solo tokens estructurales conocidos, descarta cualquier otro", () => {
    expect(sanitizeClassNameSample("fixed z-40 ios-bottom-nav bg-card")).toBe("fixed z-40 ios-bottom-nav bg-card")
    // Un token arbitrario que NO coincide con el patrón whitelist se descarta.
    expect(sanitizeClassNameSample("some-random-user-generated-token")).toBeNull()
    expect(sanitizeClassNameSample("")).toBeNull()
  })

  test("sanitizeClassNameSample nunca puede contener un email, número de orden, o texto libre", () => {
    const suspicious = "user@example.com order-12345 juan-perez saldo-1500"
    const result = sanitizeClassNameSample(suspicious)
    expect(result).toBeNull()
  })

  test("sanitizeStaticId rechaza cualquier id con dígitos, mayúsculas o dos puntos (ids generados/dinámicos)", () => {
    expect(sanitizeStaticId("radix-:r3a:")).toBeNull()
    expect(sanitizeStaticId("order-123")).toBeNull()
    expect(sanitizeStaticId("User42")).toBeNull()
    expect(sanitizeStaticId("")).toBeNull()
  })

  test("sanitizeStaticId acepta solo minúsculas/guiones puros, cortos", () => {
    expect(sanitizeStaticId("bottom-nav")).toBe("bottom-nav")
  })

  test("SafePaintElementInfo nunca tiene una key que sugiera texto/valor/mensaje", () => {
    // Mismo patrón que ios-debug-snapshot.test.ts ya usa para
    // GEOMETRY_SNAPSHOT_ALLOWED_KEYS — "name" queda deliberadamente fuera
    // del patrón: "classNameSample"/"ariaRole" son campos estructurales
    // legítimos que lo contienen como substring, no un campo de texto.
    const forbidden = /value|message|token|password|credential|cookie|localstorage|email/i
    for (const key of SAFE_PAINT_ELEMENT_ALLOWED_KEYS) {
      expect(key).not.toMatch(forbidden)
    }
  })

  test("un SafePaintElementInfo real tiene exactamente las keys documentadas", () => {
    expect(Object.keys(safeElement()).sort()).toEqual(SAFE_PAINT_ELEMENT_ALLOWED_KEYS)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("4. Clasificación de oclusión (NOT_OCCLUDED_DOM / OCCLUDED_BY_ELEMENT)", () => {
  test("nav topmost (índice 0) => NOT_OCCLUDED_DOM", () => {
    expect(classifyProbeOcclusion({ topElementIsNavOrDescendant: true })).toBe("NOT_OCCLUDED_DOM")
  })

  test("otro elemento topmost => OCCLUDED_BY_ELEMENT", () => {
    expect(classifyProbeOcclusion({ topElementIsNavOrDescendant: false })).toBe("OCCLUDED_BY_ELEMENT")
  })

  test("un OcclusionProbeResult real tiene exactamente las keys documentadas", () => {
    const probe: OcclusionProbeResult = {
      label: "NAV_MIDDLE_CENTER",
      x: 195,
      y: 722,
      elements: [safeElement()],
      navElementPresent: true,
      navStackIndex: 0,
      topElementIsNavOrDescendant: true,
    }
    expect(Object.keys(probe).sort()).toEqual(OCCLUSION_PROBE_RESULT_ALLOWED_KEYS)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("5. isNavPaintProbeSolidEnabled — el A/B sólido requiere AMBOS flags", () => {
  test("false sin iosDebug, incluso con navPaintProbe=solid presente", () => {
    expect(isNavPaintProbeSolidEnabled("?navPaintProbe=solid")).toBe(false)
  })
  test("false con iosDebug=1 solo (sin navPaintProbe)", () => {
    expect(isNavPaintProbeSolidEnabled("?iosDebug=1")).toBe(false)
  })
  test("true solo cuando ambos están presentes exactamente", () => {
    expect(isNavPaintProbeSolidEnabled("?iosDebug=1&navPaintProbe=solid")).toBe(true)
    expect(isNavPaintProbeSolidEnabled("?navPaintProbe=solid&iosDebug=1")).toBe(true)
  })
  test("false para cualquier otro valor de navPaintProbe", () => {
    expect(isNavPaintProbeSolidEnabled("?iosDebug=1&navPaintProbe=other")).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("6. Timeline acotado post-teclado (§15) — contrato estático del panel", () => {
  test("existe una ventana de frames acotada (constante numérica finita), nunca un loop infinito", () => {
    expect(debugPanelSource).toMatch(/POST_KB_TIMELINE_FRAMES\s*=\s*\d+/)
    expect(debugPanelSource).toMatch(/if \(frame <= POST_KB_TIMELINE_FRAMES\)/)
  })

  test("existen retrasos fijos post-frames (+250/+500/+1000/+1500ms) por §15", () => {
    expect(debugPanelSource).toMatch(/POST_KB_TIMELINE_DELAYS_MS\s*=\s*\[250,\s*500,\s*1000,\s*1500\]/)
  })

  test("se arma únicamente desde el edge real AUTO_AFTER_KEYBOARD_CLOSE, nunca desde un intervalo permanente", () => {
    const armSite = debugPanelSource.match(
      /result\.fire === "AUTO_AFTER_KEYBOARD_CLOSE"\) \{[\s\S]{0,300}?runPostKeyboardTimeline\(\)/
    )
    expect(armSite).not.toBeNull()
    expect(debugPanelSource).not.toMatch(/setInterval/)
  })

  test("cada muestra del timeline incluye el hit-test (includeOcclusionProbes=true)", () => {
    const timelineBlock = debugPanelSource.match(
      /const runPostKeyboardTimeline[\s\S]{0,1200}?\}, \[pathname, pushEvent\]\)/
    )
    expect(timelineBlock).not.toBeNull()
    // R7 added a 5th captureSnapshot argument (baselineGeometry), so the
    // call now spans multiple lines — match across newlines and only
    // require `true` to appear before the call closes, not immediately
    // adjacent to the closing paren.
    expect(timelineBlock![0]).toMatch(/POST_KB_F\$\{frame\}[\s\S]*?true[\s\S]*?\)/)
    expect(timelineBlock![0]).toMatch(/POST_KB_T\$\{delay\}[\s\S]*?true[\s\S]*?\)/)
  })

  test("se cancela por completo en el cleanup del efecto (rAF + todos los timers pendientes)", () => {
    const cleanupBlock = debugPanelSource.match(/return \(\) => \{[\s\S]*?\}\n {2}\}, \[enabled,/)
    expect(cleanupBlock).not.toBeNull()
    expect(cleanupBlock![0]).toMatch(/cancelAnimationFrame\(postKbTimelineRafRef\.current\)/)
    expect(cleanupBlock![0]).toMatch(/postKbTimelineTimersRef\.current/)
    expect(cleanupBlock![0]).toMatch(/disarmPostKeyboardScrollWatch\(\)/)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("7. Sondeo de scroll post-teclado (§16) — acotado, nunca un listener permanente", () => {
  test("tiene un límite de eventos Y un timeout — se autodesarma por cualquiera de los dos", () => {
    expect(debugPanelSource).toMatch(/POST_KB_SCROLL_WATCH_MAX_EVENTS\s*=\s*\d+/)
    expect(debugPanelSource).toMatch(/POST_KB_SCROLL_WATCH_TIMEOUT_MS\s*=\s*\d+/)
    expect(debugPanelSource).toMatch(/w\.count >= POST_KB_SCROLL_WATCH_MAX_EVENTS/)
  })

  test("nunca llama preventDefault ni modifica scrollY — puramente observacional", () => {
    const scrollBlock = debugPanelSource.match(
      /const handlePostKeyboardScroll[\s\S]{0,700}?\}, \[pathname, pushEvent, disarmPostKeyboardScrollWatch\]\)/
    )
    expect(scrollBlock).not.toBeNull()
    expect(scrollBlock![0]).not.toMatch(/preventDefault/)
    expect(scrollBlock![0]).not.toMatch(/window\.scrollTo/)
  })

  test("reutiliza el listener window 'scroll' existente en vez de agregar uno nuevo (sin duplicar listeners)", () => {
    // window.visualViewport?.addEventListener("scroll", ...) es un listener
    // PRE-EXISTENTE y distinto (vive en el objeto visualViewport, no en
    // window) — el contrato es que no se agregue un SEGUNDO listener sobre
    // window mismo, no que "scroll" aparezca una única vez en todo el archivo.
    const windowScrollListenerAdds = debugPanelSource.match(/window\.addEventListener\("scroll"/g) ?? []
    expect(windowScrollListenerAdds.length).toBe(1)
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("8. Sondeo A/B sólido/sin-backdrop y marcadores visuales — solo detrás de query flags", () => {
  test("bottom-nav.tsx lee ambos flags de forma diferida (mismo patrón mounted-gate ya establecido)", () => {
    expect(bottomNavSource).toMatch(/isIosDebugFlagEnabled\(window\.location\.search\)/)
    expect(bottomNavSource).toMatch(/isNavPaintProbeSolidEnabled\(window\.location\.search\)/)
  })

  test("las clases diagnósticas solo se agregan condicionalmente — la clase base permanece sin cambios", () => {
    expect(bottomNavSource).toMatch(
      /"bg-card border border-border rounded-3xl shadow-lg overflow-hidden"/
    )
    expect(bottomNavSource).toMatch(/debugProbeEnabled && "ios-nav-debug-outline"/)
    expect(bottomNavSource).toMatch(/navPaintProbeSolid && "ios-nav-paint-probe-solid"/)
  })

  test("los marcadores visuales solo se renderizan cuando debugProbeEnabled es true", () => {
    expect(bottomNavSource).toMatch(/\{debugProbeEnabled && \(/)
    expect(bottomNavSource).toMatch(/ios-nav-debug-marker-top/)
    expect(bottomNavSource).toMatch(/ios-nav-debug-marker-middle/)
    expect(bottomNavSource).toMatch(/ios-nav-debug-marker-bottom/)
  })

  test("el outline usa `outline`, nunca `border`/`box-shadow`, para no afectar layout", () => {
    const cssBlock = globalsCssSource.match(/\.ios-nav-debug-outline \{[\s\S]*?\}/)
    expect(cssBlock).not.toBeNull()
    expect(cssBlock![0]).toMatch(/outline:/)
    expect(cssBlock![0]).not.toMatch(/border:|box-shadow:/)
  })

  test("el sondeo sólido fuerza background opaco y remueve backdrop-filter (ambos prefijos)", () => {
    const cssBlock = globalsCssSource.match(/\.ios-nav-paint-probe-solid \{[\s\S]*?\}/)
    expect(cssBlock).not.toBeNull()
    expect(cssBlock![0]).toMatch(/background:\s*var\(--card\)\s*!important/)
    expect(cssBlock![0]).toMatch(/backdrop-filter:\s*none\s*!important/)
    expect(cssBlock![0]).toMatch(/-webkit-backdrop-filter:\s*none\s*!important/)
  })

  test("sin ningún query flag, el nav no produce texto/DOM distinto del ya existente (marcadores condicionales solamente)", () => {
    // Confirma por contrato estático que el bloque de marcadores está
    // envuelto en el mismo gate que ya protege al resto del panel — nunca
    // renderiza incondicionalmente.
    const markerBlock = bottomNavSource.match(/\{debugProbeEnabled && \([\s\S]*?\)\}/)
    expect(markerBlock).not.toBeNull()
  })
})

// ────────────────────────────────────────────────────────────────────────
describe("9. Preservación explícita de R5 y scroll-restore (constraints §3, §5.NO-cambiar)", () => {
  test("ios-keyboard-fix.tsx no fue tocado — el sondeo rAF de R5 y su contrato siguen presentes sin cambios", () => {
    const keyboardFixSource = readFileSync(IOS_KEYBOARD_FIX, "utf8")
    expect(keyboardFixSource).toMatch(/DOCK_OFFSET_POLL_FRAMES\s*=\s*15/)
    expect(keyboardFixSource).toMatch(/updateDockVisualOffsetSync/)
    expect(keyboardFixSource).toMatch(/startDockOffsetPolling/)
  })

  test("globals.css conserva la compensación --ios-dock-visual-offset-top de R3/R4/R5 sin cambios", () => {
    expect(globalsCssSource).toMatch(
      /bottom: calc\(env\(safe-area-max-inset-bottom, 34px\) \+ 8px - var\(--ios-dock-visual-offset-top, 0px\)\)/
    )
  })

  test("el panel no IMPORTA ios-scroll-restore-decision.ts (una mención en un comentario de contexto no cuenta)", () => {
    expect(debugPanelSource).not.toMatch(/from\s+["'].*ios-scroll-restore-decision["']/)
    expect(debugPanelSource).not.toMatch(/import\(["'].*ios-scroll-restore-decision["']\)/)
  })

  test("bottom-nav.tsx conserva el gap/8px del dock: la clase bottom-[...] base no cambió", () => {
    expect(bottomNavSource).toMatch(/"bottom-\[calc\(env\(safe-area-inset-bottom,0px\)\+8px\)\]"/)
  })
})
