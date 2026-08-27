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

  test("2. the handler checks event.key === \"deligo-auth\" before acting", () => {
    const source = readSource(PROVIDER_PATH)
    const effectBody = extractStorageEffectBody(source)

    expect(effectBody).toMatch(/event\.key\s*!==\s*"deligo-auth"|event\.key\s*===\s*"deligo-auth"/)
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
})
