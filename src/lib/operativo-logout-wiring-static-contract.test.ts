// Logout-B1 (P0 rollout-safe Phase O2): static-contract test — WIRING
// evidence only (same pattern as src/lib/chat-consumer-static-contract.test.ts).
// Core helper security/behavior semantics are covered directly by
// src/lib/operativo-logout.test.ts; this file proves the exact productive
// files actually USE the canonical helper, reading their literal source
// text rather than executing them.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8")
}

const LOGOUT_CALL_SITES = [
  "src/app/mozo/panel/[slug]/page.tsx",
  "src/app/mozo/page.tsx",
  "src/app/operaciones/cuenta/page.tsx",
] as const

const NAVIGATION_AFTER_LOGOUT: Record<(typeof LOGOUT_CALL_SITES)[number], string> = {
  "src/app/mozo/panel/[slug]/page.tsx": "router.replace(nav.loginHref)",
  "src/app/mozo/page.tsx": "router.replace(nav.loginHref)",
  "src/app/operaciones/cuenta/page.tsx": 'router.replace("/operaciones/ingresar")',
}

describe("THREE_LOGOUT_CALL_SITES_CANONICAL — all three operative logout pages use the canonical helper", () => {
  for (const path of LOGOUT_CALL_SITES) {
    test(`${path} imports and invokes performOperativeLogout, never fetches the endpoint directly, and keeps its navigation`, () => {
      const source = readSource(path)

      expect(source).toContain('from "@/lib/operativo-logout"')
      expect(source).toMatch(/import\s*{[^}]*\bperformOperativeLogout\b[^}]*}\s*from\s*"@\/lib\/operativo-logout"/)
      expect(source).toContain("performOperativeLogout(")
      expect(source).not.toContain('"/api/operativo/logout"')
      expect(source).toContain(NAVIGATION_AFTER_LOGOUT[path])
    })
  }
})

describe("MOZO_MANUAL_DISABLE_O2_WIRING", () => {
  test("src/app/mozo/panel/[slug]/page.tsx: manual disable captures the exact subscription and never sends a bodyless DELETE", () => {
    const source = readSource("src/app/mozo/panel/[slug]/page.tsx")

    expect(source).toMatch(/import\s*{[^}]*\bgetCurrentOperativePushSubscription\b[^}]*}\s*from\s*"@\/lib\/operativo-logout"/)

    const handleDisableStart = source.indexOf("const handleDisablePush")
    expect(handleDisableStart).toBeGreaterThan(-1)
    const nextFunctionStart = source.indexOf("const handleSendTestPush", handleDisableStart)
    expect(nextFunctionStart).toBeGreaterThan(handleDisableStart)
    const handleDisableBody = source.slice(handleDisableStart, nextFunctionStart)

    // Captures the exact subscription before doing anything destructive.
    expect(handleDisableBody).toContain("getCurrentOperativePushSubscription()")
    // The DELETE request always supplies a JSON body containing `subscription` —
    // no bodyless DELETE fallback remains in this handler.
    expect(handleDisableBody).toMatch(/method:\s*"DELETE"/)
    expect(handleDisableBody).toContain("body: JSON.stringify({ subscription })")
    // Must not add physical browser unsubscribe to this flow (Policy A) — the
    // existing `.unsubscribe()` call belongs only to handleEnablePush's
    // failed-registration rollback, outside this handler's body.
    expect(handleDisableBody).not.toContain(".unsubscribe(")
  })
})

describe("SALON_MANUAL_DISABLE_O2_WIRING", () => {
  test("src/hooks/use-operativo-salon-push.ts: manual disable captures the exact subscription and never sends a bodyless DELETE", () => {
    const source = readSource("src/hooks/use-operativo-salon-push.ts")

    expect(source).toMatch(/import\s*{[^}]*\bgetCurrentOperativePushSubscription\b[^}]*}\s*from\s*"@\/lib\/operativo-logout"/)

    const unsubscribeStart = source.indexOf("const unsubscribe = useCallback")
    expect(unsubscribeStart).toBeGreaterThan(-1)
    const unsubscribeBody = source.slice(unsubscribeStart)

    expect(unsubscribeBody).toContain("getCurrentOperativePushSubscription()")
    expect(unsubscribeBody).toMatch(/method:\s*"DELETE"/)
    expect(unsubscribeBody).toContain("body: JSON.stringify({ subscription })")
    // The enable-registration rollback's `.unsubscribe()` lives earlier in the
    // file (inside `subscribe`), outside this handler's own body — this proves
    // the manual-disable action itself never adds a physical unsubscribe call.
    expect(unsubscribeBody).not.toContain(".unsubscribe(")
  })
})

describe("OPERATIVE_LOGOUT_SERVER_REQUEST_OWNER — single canonical owner", () => {
  test("src/lib/operativo-logout.ts is the only productive client file that fetches /api/operativo/logout directly", () => {
    const helperSource = readSource("src/lib/operativo-logout.ts")
    expect(helperSource).toContain('"/api/operativo/logout"')
    expect(helperSource).toContain("export async function performOperativeLogout")
    expect(helperSource).toContain("export async function getCurrentOperativePushSubscription")

    for (const path of LOGOUT_CALL_SITES) {
      expect(readSource(path)).not.toContain('"/api/operativo/logout"')
    }
  })
})
