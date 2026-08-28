/// <reference types="bun-types" />
// P2-T18-BLOCKER-AUTH2-R8 (Phase 2) — static-contract test — WIRING
// evidence only (same pattern as use-push-notifications-static-contract.test.ts):
// proves the actor-family selector wiring in src/hooks/use-auth.ts matches
// the exact contract frozen in
// codex-reports/archive/P2-T18-BLOCKER-AUTH2-R7.md §USE_AUTH/§LOGOUT by
// reading its literal source text rather than executing it (avoids mocking
// next/navigation's useRouter for a full render).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

const src = read("src/hooks/use-auth.ts")

describe("AUTH_ME_SELECTOR — syncSession() adjunta ?actorFamily= derivado del pathname", () => {
  const syncSessionBody = src.slice(
    src.indexOf("const syncSession = useCallback"),
    src.indexOf("useEffect(() => {\n    if (!autoSync)")
  )

  test("family se deriva de activeSessionFamily(window.location.pathname), nunca de localStorage ni de un valor arbitrario", () => {
    expect(syncSessionBody).toContain("activeSessionFamily(window.location.pathname)")
  })

  test("la llamada a /api/auth/me pasa por withActorFamily con la family recién derivada", () => {
    expect(syncSessionBody).toContain('withActorFamily("/api/auth/me", family)')
  })

  test("family se calcula ANTES del fetch, no después", () => {
    const familyIdx = syncSessionBody.indexOf("activeSessionFamily(window.location.pathname)")
    const fetchIdx = syncSessionBody.indexOf("await fetch(withActorFamily")
    expect(familyIdx).toBeGreaterThan(-1)
    expect(fetchIdx).toBeGreaterThan(familyIdx)
  })
})

describe("withActorFamily — transporte exacto ya certificado en Fase 1 (query param, nunca header nuevo)", () => {
  test("construye la URL con ?actorFamily=<family> sólo cuando family no es null", () => {
    const helperBody = src.slice(src.indexOf("function withActorFamily"), src.indexOf("function withActorFamily") + 300)
    expect(helperBody).toContain("?actorFamily=")
    expect(helperBody).toMatch(/family\s*\?\s*`\$\{path\}\?actorFamily=\$\{family\}`\s*:\s*path/)
  })

  test("nunca introduce un header de familia nuevo (grep negativo sobre el archivo completo)", () => {
    expect(src).not.toMatch(/x-actor-family/i)
    expect(src).not.toMatch(/actorFamily["'\s]*:/i) // ningún objeto {actorFamily: ...} en headers/body
  })
})

describe("LOGOUT_FAMILY_CAPTURE_POINT — family se captura de userType() ANTES de logout()", () => {
  const handleLogoutBody = src.slice(
    src.indexOf("const handleLogout = useCallback"),
    src.indexOf("}, [logout, userType, router])") + 30
  )

  test("captura `const family = userType()`", () => {
    expect(handleLogoutBody).toContain("const family = userType()")
  })

  test("family se captura ANTES de invocar logout() — nunca después (se perdería)", () => {
    const familyIdx = handleLogoutBody.indexOf("const family = userType()")
    const logoutCallIdx = handleLogoutBody.indexOf("\n    logout()\n")
    expect(familyIdx).toBeGreaterThan(-1)
    expect(logoutCallIdx).toBeGreaterThan(familyIdx)
  })

  test("selectorFamily queda acotado a cliente|negocio|repartidor — superadmin/null nunca envían selector", () => {
    expect(handleLogoutBody).toMatch(
      /family === "cliente" \|\| family === "negocio" \|\| family === "repartidor" \? family : null/
    )
  })

  test("la llamada a /api/auth/logout pasa por withActorFamily con selectorFamily, no con family crudo", () => {
    expect(handleLogoutBody).toContain('withActorFamily("/api/auth/logout", selectorFamily)')
  })

  test("LOCAL_LOGOUT_ORDER preservado: unlinkCurrentPushSubscription y el fetch de logout siguen después de logout()", () => {
    const logoutCallIdx = handleLogoutBody.indexOf("\n    logout()\n")
    const pushIdx = handleLogoutBody.indexOf("unlinkCurrentPushSubscription()")
    const fetchIdx = handleLogoutBody.indexOf("await fetch(withActorFamily")
    expect(pushIdx).toBeGreaterThan(logoutCallIdx)
    expect(fetchIdx).toBeGreaterThan(pushIdx)
  })

  test("el token/sid nunca aparece en el cuerpo de handleLogout (sin fuga de secretos client-side)", () => {
    expect(handleLogoutBody.toLowerCase()).not.toMatch(/token|jwt|secret/)
  })
})
