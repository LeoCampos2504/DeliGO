/// <reference types="bun-types" />

// ============================================
// ANDROID-PWA-INSTALL-STATUS — contrato estático focal
// ============================================
// Protege que aceptar el diálogo ni recibir `appinstalled` se anuncien como
// launcher-ready. Sólo la observación real de standalone confirma uso como
// app instalada. No hay entorno DOM configurado en este repo (sin
// happy-dom/jsdom), así que — igual que
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

  test("CASE 3/4 — userChoice no escribe isInstalledValue ni confirma launcher-ready", () => {
    const hookSource = readFileSync(HOOK, "utf-8")
    const promptInstallBody = extractFunctionBody(hookSource, "const promptInstall = useCallback(async () => {")
    expect(promptInstallBody).toContain("await prompt.userChoice")
    expect(promptInstallBody).not.toMatch(/isInstalledValue\s*=\s*true/)
    expect(promptInstallBody).not.toMatch(/installedListeners\.forEach/)
  })

  test("CASE 3c — accepted pasa a espera indeterminada, dismissed no; el evento consumido se limpia", () => {
    const hookSource = readFileSync(HOOK, "utf-8")
    const promptInstallBody = extractFunctionBody(hookSource, "const promptInstall = useCallback(async () => {")
    expect(promptInstallBody).toContain('outcome === "accepted" ? "prompt-accepted" : "prompt-dismissed"')
    expect(promptInstallBody).toContain('updateInstallationState("prompt-started")')

    const componentSource = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(componentSource).toContain('state === "installing-background"')
    expect(componentSource).toContain('state === "browser-install-event-received"')
    expect(componentSource).toContain("Chrome está terminando de agregar ${config.name}")
    expect(componentSource).not.toMatch(/\b(?:25|50|75|90|100)%/)
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

  test("CASE 5 — appinstalled registra el evento, pero no marca launcher-ready", () => {
    const hookSource = readFileSync(HOOK, "utf-8")
    const appinstalledBlock = hookSource.slice(
      hookSource.indexOf('window.addEventListener("appinstalled"'),
      hookSource.indexOf('window.addEventListener("appinstalled"') + 400
    )
    expect(appinstalledBlock).toContain('updateInstallationState("app-installed")')
    expect(appinstalledBlock).not.toContain("isInstalledValue = true")
    expect(appinstalledBlock).not.toContain("installedListeners.forEach")

    expect(hookSource).toMatch(/standaloneQuery\.addEventListener\("change"[\s\S]*?isInstalledValue = true[\s\S]*?updateInstallationState\("standalone-detected"\)/)
  })

  test("CASE 5b — appinstalled no monta un toast de éxito ni duplica la confirmación", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).not.toContain('"¡App instalada!"')
    expect(source).not.toContain("setShowSuccess")
    expect(source).not.toContain('window.addEventListener("appinstalled"')
  })

  test("CASE 6 — pending UX es estática, descartable y no bloquea navegación", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).toContain('"Instalación iniciada"')
    expect(source).toContain("Podés seguir usando esta pestaña.")
    expect(source).toContain('aria-label="Cerrar aviso de instalación"')
    const pendingComponent = source.split("function AndroidInstallPending")[1]?.split("function AndroidInstallBanner")[0] ?? ""
    expect(pendingComponent).not.toContain("animate=")
    expect(pendingComponent).not.toContain("repeat: Infinity")
    expect(source).not.toMatch(/\b(?:25|50|75|90|100)%/)
    const pendingGuard = source.indexOf("isAndroidInstallPending(installationState)")
    const nativeInstallCta = source.indexOf('platform === "android" && isInstallable && !bannerDismissed')
    expect(pendingGuard).toBeGreaterThan(-1)
    expect(nativeInstallCta).toBeGreaterThan(pendingGuard)
  })

  test("CASE 7 — appinstalled no depende de deferredPromptValue y sólo pasa a aviso informativo", () => {
    const hookSource = readFileSync(HOOK, "utf-8")
    const appinstalledBlock = hookSource.slice(
      hookSource.indexOf('window.addEventListener("appinstalled"'),
      hookSource.indexOf('window.addEventListener("appinstalled"') + 400
    )
    expect(appinstalledBlock).not.toMatch(/if\s*\(\s*deferredPromptValue\s*\)/)
    expect(appinstalledBlock).not.toContain("isInstalledValue = true")
  })

  test("CASE 8 — flujo iOS usa el tutorial guiado y aclara variaciones por versión", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).toMatch(/shouldShowManualPrompt && platform === "ios"/)
    expect(source).toContain("<IOSInstallBanner")
    expect(source).toContain("Agregar a pantalla de inicio")
    expect(source).toContain("Los nombres o la ubicación de estas opciones pueden variar según tu versión de iOS.")
    expect(source).toContain("isSafari={isIosSafari}")
  })

  test("CASE 9 — detección iPhone/iPadOS Safari se alinea a PWA capabilities y no confunde Mac sin touch", () => {
    const hookSource = readFileSync(HOOK, "utf-8")
    const capabilitiesSource = readFileSync(join(process.cwd(), "src", "lib", "pwa-capabilities.ts"), "utf-8")
    expect(hookSource).toContain('import { getPwaCapabilities } from "@/lib/pwa-capabilities"')
    expect(hookSource).toContain("getPwaCapabilities().isIosSafari")
    expect(hookSource).toContain("getPwaCapabilities().isStandalone")
    expect(hookSource).toContain("[isInstalled, isInstallable, manualPromptNeeded]")
    expect(capabilitiesSource).toContain("/iphone|ipad|ipod/i.test(userAgent) || isIpadOS")
    expect(capabilitiesSource).toMatch(/platformName === "MacIntel" &&\s+navigator\.maxTouchPoints > 1/)
    expect(capabilitiesSource).toContain('!/crios|fxios|edgios|opr|opera|chrome|chromium/i.test(userAgent)')
  })

  test("CASE 9b — la guía se oculta cuando la autoridad detecta standalone", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    const installedGuard = source.indexOf("if (isInstalled) {")
    const iosTutorial = source.indexOf('shouldShowManualPrompt && platform === "ios"')
    expect(installedGuard).toBeGreaterThan(-1)
    expect(iosTutorial).toBeGreaterThan(installedGuard)
  })

  test("CASE 10 — beforeinstallprompt sólo muestra CTA nativo en Android", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).toMatch(/platform === "android" && isInstallable && !bannerDismissed/)
    expect(source).toMatch(/platform === "android" && isInstallable && bannerDismissed/)
  })

  test("no existe un claim de éxito en el flujo shared de instalación", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).not.toContain("¡App instalada!")
  })

  test("InstallPrompt no crea un segundo listener de appinstalled", () => {
    const source = readFileSync(INSTALL_PROMPT, "utf-8")
    expect(source).not.toContain('window.addEventListener("appinstalled"')
  })

  test("SSR-safe: los listeners del ciclo de instalación están bajo guard client-only", () => {
    const source = readFileSync(HOOK, "utf-8")
    expect(source).toMatch(/if \(typeof window !== "undefined"\) \{[\s\S]*?window\.addEventListener\("appinstalled"/)
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
