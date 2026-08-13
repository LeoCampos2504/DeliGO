/// <reference types="bun-types" />

// ============================================
// ANDROID-PWA-INSTALL-STATUS — contrato estático focal
// ============================================
// Protege que "App instalada" sólo aparezca vía el evento autoritativo
// `appinstalled` — nunca por aceptar el diálogo nativo (`userChoice`) — y
// que ese éxito sea idempotente (máximo una vez por ciclo). No hay entorno
// DOM configurado en este repo (sin happy-dom/jsdom), así que — igual que
// el resto de los contratos IOS-24 sobre código dependiente de APIs de
// navegador — esto es lectura de texto sobre el código fuente real, no un
// parser de JS/TSX completo ni una simulación de beforeinstallprompt real.
// REAL_ANDROID_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const HOOK = join(process.cwd(), "src", "hooks", "use-install-prompt.ts")
const INSTALL_PROMPT = join(process.cwd(), "src", "components", "shared", "install-prompt.tsx")
const LAYOUT = join(process.cwd(), "src", "app", "layout.tsx")

function extractFunctionBody(source: string, signature: string): string {
  const start = source.indexOf(signature)
  expect(start).toBeGreaterThan(-1)
  // Balance braces from the first `{` after the signature to find the
  // function's own body, without depending on exact indentation.
  const braceStart = source.indexOf("{", start)
  let depth = 0
  let i = braceStart
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++
    else if (source[i] === "}") {
      depth--
      if (depth === 0) break
    }
  }
  return source.slice(braceStart, i + 1)
}

describe("ANDROID-PWA-INSTALL-STATUS — contrato estático del flujo de instalación", () => {
  test("CASE 1 — beforeinstallprompt disponible: deferredPrompt se captura y habilita isInstallable", () => {
    const source = readFileSync(HOOK, "utf-8")
    expect(source).toMatch(/addEventListener\("beforeinstallprompt"/)
    expect(source).toContain("deferredPromptValue = e as BeforeInstallPromptEvent")
    expect(source).toContain("const isInstallable = deferredPrompt !== null")
  })

  test("CASE 2 — pulsar Instalar llama prompt(): handleNativeInstall invoca promptInstall, que invoca prompt.prompt()", () => {
    const componentSource = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(componentSource).toMatch(/async function handleNativeInstall\(\)[\s\S]*?await promptInstall\(\)/)

    const hookSource = readFileSync(HOOK, "utf-8")
    const promptInstallBody = extractFunctionBody(hookSource, "const promptInstall = useCallback(async () => {")
    expect(promptInstallBody).toMatch(/prompt\.prompt\(\)/)
  })

  test("CASE 3/4 — userChoice (accepted o dismissed) NUNCA escribe isInstalledValue: sólo appinstalled puede confirmarlo", () => {
    const hookSource = readFileSync(HOOK, "utf-8")
    const promptInstallBody = extractFunctionBody(hookSource, "const promptInstall = useCallback(async () => {")
    expect(promptInstallBody).toContain("await prompt.userChoice")
    expect(promptInstallBody).not.toMatch(/isInstalledValue\s*=\s*true/)
    expect(promptInstallBody).not.toMatch(/installedListeners\.forEach/)
  })

  test("CASE 3/4b — deferredPromptValue se limpia para ambos outcomes (antes de evaluar accepted/dismissed)", () => {
    const hookSource = readFileSync(HOOK, "utf-8")
    const promptInstallBody = extractFunctionBody(hookSource, "const promptInstall = useCallback(async () => {")
    const clearIdx = promptInstallBody.indexOf("deferredPromptValue = null")
    const outcomeCheckIdx = promptInstallBody.indexOf('outcome === "accepted"')
    expect(clearIdx).toBeGreaterThan(-1)
    expect(outcomeCheckIdx).toBeGreaterThan(-1)
    expect(clearIdx).toBeLessThan(outcomeCheckIdx)
  })

  test("CASE 5 — appinstalled es la única fuente autoritativa de isInstalledValue=true", () => {
    const hookSource = readFileSync(HOOK, "utf-8")
    const appinstalledBlock = hookSource.slice(
      hookSource.indexOf('window.addEventListener("appinstalled"'),
      hookSource.indexOf('window.addEventListener("appinstalled"') + 400
    )
    expect(appinstalledBlock).toContain("isInstalledValue = true")
    expect(appinstalledBlock).toContain("installedListeners.forEach")

    // isInstalledValue=true sólo debe aparecer en este listener (fuente única)
    const allAssignments = hookSource.match(/isInstalledValue\s*=\s*true/g) ?? []
    expect(allAssignments.length).toBe(1)
  })

  test("CASE 5b — el toast de éxito en InstallPrompt está guardado contra duplicados (ref chequeado antes de mostrar)", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).toContain("successShownRef")
    const handlerMatch = source.match(/const handler = \(\) => \{([\s\S]*?)\n    \}/)
    expect(handlerMatch).not.toBeNull()
    const handlerBody = handlerMatch?.[1] ?? ""
    const guardIdx = handlerBody.indexOf("if (successShownRef.current) return")
    const setShownIdx = handlerBody.indexOf("successShownRef.current = true")
    const setShowSuccessIdx = handlerBody.indexOf("setShowSuccess(true)")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(setShownIdx).toBeGreaterThan(-1)
    expect(setShowSuccessIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(setShownIdx)
    expect(setShownIdx).toBeLessThan(setShowSuccessIdx)
  })

  test("CASE 6 — appinstalled disparado dos veces: el guard hace que la segunda invocación retorne antes de tocar el estado", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    const handlerMatch = source.match(/const handler = \(\) => \{([\s\S]*?)\n    \}/)
    const handlerBody = handlerMatch?.[1] ?? ""
    // El guard debe ser la primera línea ejecutable del handler.
    const firstStatement = handlerBody.trim().split("\n")[0].trim()
    expect(firstStatement).toBe("if (successShownRef.current) return")
  })

  test("CASE 7 — appinstalled no depende de deferredPromptValue: se dispara igual si la instalación no vino de nuestro botón", () => {
    const hookSource = readFileSync(HOOK, "utf-8")
    const appinstalledBlock = hookSource.slice(
      hookSource.indexOf('window.addEventListener("appinstalled"'),
      hookSource.indexOf('window.addEventListener("appinstalled"') + 400
    )
    expect(appinstalledBlock).not.toMatch(/if\s*\(\s*deferredPromptValue\s*\)/)
  })

  test("CASE 8 — flujo manual de iOS no fue tocado (misma condición, mismo componente)", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).toMatch(/shouldShowManualPrompt && platform === "ios"/)
    expect(source).toContain("<IOSInstallBanner")
  })

  test("único sitio de éxito: sólo install-prompt.tsx renderiza el texto de instalación confirmada", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).toContain("¡App instalada!")
  })

  test("listener cleanup: el efecto de appinstalled en InstallPrompt limpia su listener", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).toMatch(/return \(\) => window\.removeEventListener\("appinstalled", handler\)/)
  })

  test("SSR-safe: el efecto de appinstalled no accede a window fuera de un guard client-only", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).toContain('if (typeof window === "undefined") return')
  })

  test("root layout sigue montando InstallPrompt sin cambios estructurales adicionales", () => {
    const source = readFileSync(LAYOUT, "utf-8")
    expect(source).toContain("<InstallPrompt />")
  })

  test("sanity check: extractFunctionBody aísla correctamente un bloque sintético con llaves anidadas", () => {
    const synthetic = `
const foo = () => {
  if (x) {
    bar()
  }
  return baz
}
const unrelated = 1
`
    const body = extractFunctionBody(synthetic, "const foo = () => {")
    expect(body).toContain("bar()")
    expect(body).not.toContain("unrelated")
  })
})
