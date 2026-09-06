// P2-T31-R6B (STANDALONE-PWA-DEBUG-ACCESS-AND-COLD-BOOTSTRAP): static-contract
// tests for the cold-launch tracer bootstrap — no jsdom/React Testing
// Library in this repo, so the component's safety contract is asserted
// against its actual source text, same style as push-debug-panel-static-
// contract.test.ts.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

function stripComments(src: string): string {
  return src
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n")
}

const src = read("src/components/shared/push-debug-trace-bootstrap.tsx")
const code = stripComments(src)

describe("PushDebugTraceBootstrap — never renders anything", () => {
  test("always returns null — no JSX, no UI", () => {
    expect(code).toContain("return null")
    expect(code).not.toMatch(/return\s*\(/)
    expect(code).not.toContain("<div")
    expect(code).not.toContain("<button")
  })
})

describe("PushDebugTraceBootstrap — never touches the real push lifecycle", () => {
  test("never calls subscribe/unsubscribe", () => {
    expect(code).not.toContain(".subscribe(")
    expect(code).not.toContain(".unsubscribe(")
  })

  test("never performs any fetch (no Push status/vapid/backend calls)", () => {
    expect(code).not.toContain("fetch(")
  })

  test("never imports or calls usePushNotifications/checkPersonalPushStatus", () => {
    expect(code).not.toContain("usePushNotifications")
    expect(code).not.toContain("checkPersonalPushStatus")
  })

  test("never mutates auth state — only reads via useAuthStore selectors, no setUser/setHasHydrated/login/logout calls", () => {
    expect(code).not.toMatch(/\.setUser\(/)
    expect(code).not.toMatch(/\.setHasHydrated\(/)
    expect(code).not.toContain("login(")
    expect(code).not.toContain("logout(")
  })
})

describe("PushDebugTraceBootstrap — cheap no-op when disarmed", () => {
  test("the very first line of the effect body checks isPushDebugTraceArmed() and returns early", () => {
    const effectOpenIdx = code.indexOf("useEffect(() => {") + "useEffect(() => {".length
    const effectBody = code.slice(effectOpenIdx, code.indexOf("}, [actorType, authHasHydrated])"))
    const guardIdx = effectBody.indexOf("if (!isPushDebugTraceArmed()) return")
    expect(guardIdx).toBeGreaterThan(-1)
    // Nothing else in the effect body precedes this guard.
    const beforeGuard = effectBody.slice(0, guardIdx).trim()
    expect(beforeGuard).toBe("")
  })

  test("imports the real tracer module, never a local reimplementation", () => {
    expect(code).toContain('from "@/lib/push-debug-trace"')
    expect(code).toContain("isPushDebugTraceArmed")
    expect(code).toContain("recordPushDebugEvent")
    expect(code).toContain("setPushDebugTraceContext")
  })
})

describe("PushDebugTraceBootstrap — auth timeline events", () => {
  test("fires AUTH_STATE_OBSERVED exactly once (guarded by hasObservedInitialRef), tagged source=bootstrap", () => {
    expect(code).toContain("hasObservedInitialRef.current")
    expect(code).toContain('recordPushDebugEvent("AUTH_STATE_OBSERVED"')
    expect(code).toMatch(/AUTH_STATE_OBSERVED"[^)]*source:\s*"bootstrap"/)
  })

  test("fires AUTH_HYDRATED only on the false->true transition (guarded by wasHydratedRef), tagged source=bootstrap", () => {
    expect(code).toContain("if (authHasHydrated && !wasHydratedRef.current)")
    expect(code).toContain('recordPushDebugEvent("AUTH_HYDRATED"')
    expect(code).toMatch(/AUTH_HYDRATED"[^)]*source:\s*"bootstrap"/)
  })
})

describe("PushDebugTraceBootstrap — wired into all 3 role layouts (shared, eager mount point)", () => {
  test("Cliente layout renders it alongside children", () => {
    const layout = read("src/app/cliente/layout.tsx")
    expect(layout).toContain("PushDebugTraceBootstrap")
  })

  test("Negocio layout renders it alongside children", () => {
    const layout = read("src/app/negocio/layout.tsx")
    expect(layout).toContain("PushDebugTraceBootstrap")
  })

  test("Repartidor layout renders it alongside children", () => {
    const layout = read("src/app/repartidor/layout.tsx")
    expect(layout).toContain("PushDebugTraceBootstrap")
  })

  test("none of the 3 layouts are dynamic()-imported — the bootstrap loads as part of the eager route bundle, not behind a lazy chunk", () => {
    for (const path of ["src/app/cliente/layout.tsx", "src/app/negocio/layout.tsx", "src/app/repartidor/layout.tsx"]) {
      const layoutSrc = read(path)
      expect(layoutSrc).not.toContain("dynamic(")
    }
  })
})
