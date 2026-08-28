// P2-T11 Phase C — static-contract test — WIRING evidence only (same pattern
// as src/lib/operativo-logout-wiring-static-contract.test.ts). Proves the
// cross-tab logout listener in src/providers/realtime-provider.tsx matches
// the exact CLIENT_TESTS contract frozen in codex-reports/archive/P2-T11-STAGE2.md
// by reading its literal source text rather than executing it (no jsdom/RTL).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
}

const PROVIDER_PATH = "src/providers/realtime-provider.tsx"

function extractStorageEffectBody(source: string): string {
  const effectStart = source.indexOf('window.addEventListener("storage"')
  expect(effectStart).toBeGreaterThan(-1)
  const useEffectStart = source.lastIndexOf("useEffect(", effectStart)
  expect(useEffectStart).toBeGreaterThan(-1)
  const nextUseEffectStart = source.indexOf("useEffect(", effectStart)
  expect(nextUseEffectStart).toBeGreaterThan(effectStart)
  return source.slice(useEffectStart, nextUseEffectStart)
}

describe("CROSS_TAB_LOGOUT_STORAGE_LISTENER_CONTRACT", () => {
  test("1. window.addEventListener('storage', ...) is registered inside a useEffect", () => {
    const source = readSource(PROVIDER_PATH)
    const effectBody = extractStorageEffectBody(source)

    expect(effectBody).toContain('window.addEventListener("storage",')
  })

  test("2. the handler checks event.key against THIS tab's active-family key before acting (P2-T18-BLOCKER-AUTH2-R8, Phase 2 namespacing — no longer the fixed literal \"deligo-auth\")", () => {
    const source = readSource(PROVIDER_PATH)
    const effectBody = extractStorageEffectBody(source)

    // La familia activa se deriva de window.location.pathname en CADA
    // evento (nunca cacheada), y la clave esperada cae de vuelta a la
    // clave legacy plana "deligo-auth" cuando no hay familia — preserva
    // el comportamiento anterior fuera de /cliente|/negocio|/repartidor.
    expect(effectBody).toContain("activeSessionFamily(window.location.pathname)")
    expect(effectBody).toMatch(/family\s*\?\s*`deligo-auth:\$\{family\}`\s*:\s*"deligo-auth"/)
    expect(effectBody).toMatch(/event\.key\s*!==\s*expectedKey/)
  })

  test("3. JSON.parse of the payload is wrapped in try/catch", () => {
    const source = readSource(PROVIDER_PATH)
    const effectBody = extractStorageEffectBody(source)

    const tryIndex = effectBody.indexOf("try {")
    expect(tryIndex).toBeGreaterThan(-1)
    const catchIndex = effectBody.indexOf("catch", tryIndex)
    expect(catchIndex).toBeGreaterThan(tryIndex)
    const tryCatchBlock = effectBody.slice(tryIndex, catchIndex)
    expect(tryCatchBlock).toContain("JSON.parse(")
  })

  test("4. logout() is invoked only when the parsed user is null", () => {
    const source = readSource(PROVIDER_PATH)
    const effectBody = extractStorageEffectBody(source)

    expect(effectBody).toContain("useAuthStore.getState().logout()")
    const logoutCallIndex = effectBody.indexOf("useAuthStore.getState().logout()")
    const guardStart = effectBody.lastIndexOf("if (", logoutCallIndex)
    expect(guardStart).toBeGreaterThan(-1)
    const guardCondition = effectBody.slice(guardStart, logoutCallIndex)
    expect(guardCondition).toMatch(/nextUser\s*===\s*null/)
  })

  test("5. the effect returns a cleanup function that removes the storage listener", () => {
    const source = readSource(PROVIDER_PATH)
    const effectBody = extractStorageEffectBody(source)

    expect(effectBody).toMatch(/return\s*\(\)\s*=>\s*window\.removeEventListener\("storage",/)
  })

  test("6. the handler never references token/JWT/secret fields", () => {
    const source = readSource(PROVIDER_PATH)
    const effectBody = extractStorageEffectBody(source)

    expect(effectBody.toLowerCase()).not.toMatch(/token|jwt|secret|cookie/)
  })

  // P2-T18-BLOCKER-AUTH2-R9-R1 — cierra el gap de cobertura encontrado por
  // mutation testing en R9 (mutante #12): assertion #2 de arriba sólo prueba
  // PRESENCIA del patrón "event.key !== expectedKey" vía toContain/toMatch —
  // no prueba AUSENCIA de una condición adicional que permita también la
  // clave legacy plana "deligo-auth" (p. ej.
  // "event.key !== expectedKey && event.key !== \"deligo-auth\"", que sigue
  // conteniendo el substring buscado y por lo tanto no rompe test #2). Este
  // test aísla el guard EXACTO (la línea completa del if) y exige que sea
  // ÚNICAMENTE esa comparación — cualquier ||/&& adicional, o una segunda
  // referencia a event.key en la misma línea, lo hace fallar.
  test("7. the event.key guard is a single exact-equality check — no additional clause admits the legacy flat key 'deligo-auth' as a bypass", () => {
    const source = readSource(PROVIDER_PATH)
    const effectBody = extractStorageEffectBody(source)

    const guardStart = effectBody.indexOf("if (event.key !== expectedKey")
    expect(guardStart).toBeGreaterThan(-1)
    const guardLineEnd = effectBody.indexOf("\n", guardStart)
    expect(guardLineEnd).toBeGreaterThan(guardStart)
    const guardLine = effectBody.slice(guardStart, guardLineEnd).trim()

    expect(guardLine).toBe("if (event.key !== expectedKey) return")
    expect(guardLine).not.toContain("||")
    expect(guardLine).not.toContain("&&")
    expect(guardLine.match(/event\.key/g)?.length).toBe(1)
  })
})
