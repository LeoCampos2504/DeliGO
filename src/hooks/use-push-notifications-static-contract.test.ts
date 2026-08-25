/// <reference types="bun-types" />
// P2-T05 Stage3 (F-P2-T05-02): static-contract test — proves
// SERVER_DETACH_ONLY without needing a real browser PushManager. Complements
// (does not replace) manual/browser verification.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("F-P2-T05-02 — PHYSICAL_UNSUBSCRIBE_POLICY_FINAL=SERVER_DETACH_ONLY", () => {
  const src = read("src/hooks/use-push-notifications.ts")

  test("PERSONAL_MANUAL_DISABLE_PHYSICAL_UNSUBSCRIBE=NO: unsubscribe() never calls subscription.unsubscribe()", () => {
    expect(src).not.toMatch(/subscription\.unsubscribe\(\)/)
  })

  test("PERSONAL_MANUAL_DISABLE_SERVER_DETACH_ONLY=SI: unsubscribe() still calls the server detach endpoint", () => {
    expect(src).toContain('fetch("/api/push/unsubscribe"')
  })

  test("no new endpoint was introduced for this — still exactly one call site to /api/push/unsubscribe", () => {
    const matches = src.match(/\/api\/push\/unsubscribe/g) ?? []
    expect(matches.length).toBe(1)
  })

  test("local state (isSubscribed/permission) is still updated after the server call, unconditionally", () => {
    const unsubscribeBody = src.slice(src.indexOf("const unsubscribe = useCallback"))
    expect(unsubscribeBody).toContain("setIsSubscribed(false)")
    expect(unsubscribeBody).toContain('setPermission("default")')
  })
})

describe("F-P2-T05-13 — PERSONAL_PUSH_UI_STATUS_SOURCE=SERVER_ACTOR_ENDPOINT_BINDING", () => {
  const src = read("src/hooks/use-push-notifications.ts")
  const checkSubscriptionBody = src.slice(
    src.indexOf("const checkSubscription ="),
    src.indexOf("const getVapidKey =")
  )
  // P2-T05 Stage3R2: the actual staleness-guarded orchestration moved into
  // push-personal-status-check.ts (see push-personal-status-check.test.ts
  // for its DIRECT_BEHAVIORAL race coverage) — this file only wires it up.
  const statusCheckSrc = read("src/hooks/push-personal-status-check.ts")

  test("F_P2_T05_13_TEST: checkSubscription never derives isSubscribed from physical existence alone", () => {
    // The exact regressed line from before Stage3R1 must never come back.
    expect(src).not.toContain("setIsSubscribed(!!subscription)")
  })

  test("checkSubscription delegates to checkPersonalPushStatus, wired to the server-authoritative status endpoint", () => {
    expect(checkSubscriptionBody).toContain("checkPersonalPushStatus({")
    expect(checkSubscriptionBody).toContain('fetch("/api/push/status"')
    expect(checkSubscriptionBody).toContain('method: "POST"')
    expect(checkSubscriptionBody).toContain("applyIsSubscribed: setIsSubscribed")
  })

  test("CHECK_SUBSCRIPTION_AUTO_REGISTERS=NO: neither checkSubscription's wiring nor the status orchestration ever calls /api/push/subscribe", () => {
    expect(checkSubscriptionBody).not.toContain("/api/push/subscribe")
    expect(statusCheckSrc).not.toContain("/api/push/subscribe")
  })

  test("no physical subscription -> applyIsSubscribed(false) without ever calling fetchStatus", () => {
    const guardIdx = statusCheckSrc.indexOf("if (!subscription)")
    const fetchCallIdx = statusCheckSrc.indexOf("fetchStatus(")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(fetchCallIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(fetchCallIdx) // physical-absence guard runs BEFORE the status call
  })

  test("STATUS_CHECK_FAILURE_CAN_ASSERT_ENABLED_FROM_PHYSICAL_ONLY=NO: every failure branch in the orchestration applies false, never a bare true", () => {
    expect(statusCheckSrc).not.toMatch(/applyIsSubscribed\(true\)/)
    const applyCalls = statusCheckSrc.match(/applyIsSubscribed\([^)]*\)/g) ?? []
    expect(applyCalls.length).toBeGreaterThan(0)
    for (const call of applyCalls) {
      expect(call === "applyIsSubscribed(false)" || call === "applyIsSubscribed(result.subscribed === true)").toBe(true)
    }
  })

  test("the server result (result.subscribed) is the ONLY expression that can apply true", () => {
    expect(statusCheckSrc).toContain("applyIsSubscribed(result.subscribed === true)")
  })
})

describe("F-P2-T05-14 — PERSONAL_PUSH_ASYNC_MODEL=LATEST_RELEVANT_OPERATION_WINS (wiring)", () => {
  const src = read("src/hooks/use-push-notifications.ts")

  test("a single shared gate instance exists per hook, used by checkSubscription/subscribe/unsubscribe", () => {
    expect(src).toContain("createLatestOperationGate()")
    const gateUsages = src.match(/gateRef\.current/g) ?? []
    // begin() x2 (subscribe, unsubscribe) + invalidate() x2 (unmount, actor change)
    // + isCurrent() x2 (subscribe, unsubscribe) + the ref creation itself + passed to checkPersonalPushStatus
    expect(gateUsages.length).toBeGreaterThanOrEqual(6)
  })

  test("subscribe() begins its own operation synchronously and guards its success apply with isCurrent", () => {
    const body = src.slice(src.indexOf("const subscribe = useCallback"), src.indexOf("const unsubscribe = useCallback"))
    const beginIdx = body.indexOf("gateRef.current.begin()")
    const awaitIdx = body.indexOf("await Notification.requestPermission()")
    expect(beginIdx).toBeGreaterThan(-1)
    expect(awaitIdx).toBeGreaterThan(-1)
    expect(beginIdx).toBeLessThan(awaitIdx) // begin() happens BEFORE the first await — synchronous invalidation
    expect(body).toContain("gateRef.current.isCurrent(opId)")
    expect(body).toContain("setIsSubscribed(true)")
  })

  test("unsubscribe() begins its own operation synchronously and guards its success apply with isCurrent", () => {
    const body = src.slice(src.indexOf("const unsubscribe = useCallback"), src.lastIndexOf("return {"))
    const beginIdx = body.indexOf("gateRef.current.begin()")
    const awaitIdx = body.indexOf("await navigator.serviceWorker.ready")
    expect(beginIdx).toBeGreaterThan(-1)
    expect(awaitIdx).toBeGreaterThan(-1)
    expect(beginIdx).toBeLessThan(awaitIdx)
    expect(body).toContain("gateRef.current.isCurrent(opId)")
    expect(body).toContain("setIsSubscribed(false)")
  })

  test("ACTOR_CHANGE_INVALIDATES_PENDING_PUSH_OPERATIONS=SI: an actorKey-dependent effect invalidates the gate and resets local state", () => {
    const effectIdx = src.indexOf("[actorKey]")
    expect(effectIdx).toBeGreaterThan(-1)
    const actorEffectBody = src.slice(src.lastIndexOf("useEffect(() => {", effectIdx), effectIdx)
    expect(actorEffectBody).toContain("gateRef.current.invalidate()")
    expect(actorEffectBody).toContain("setIsSubscribed(false)")
  })

  test("CLIENT_ACTOR_METADATA_USED_AS_SECURITY_AUTHORITY=NO: actorKey is never sent to the server, only read locally from the auth store", () => {
    expect(src).toContain("useAuthStore((s) => s.user?.id ?? null)")
    expect(src).toContain("useAuthStore((s) => s.user?.type ?? null)")
    // actorKey must never be interpolated into any fetch body/header in this file.
    const fetchBodies = [...src.matchAll(/body:\s*JSON\.stringify\(\{[^}]*\}\)/g)].map((m) => m[0])
    for (const body of fetchBodies) {
      expect(body).not.toContain("actorKey")
    }
  })

  test("UNMOUNT_INVALIDATES_PENDING_PUSH_OPERATIONS=SI: the mount effect's cleanup invalidates the gate", () => {
    const mountEffect = src.slice(src.indexOf("useEffect(() => {"), src.indexOf("}, [])") + "}, [])".length)
    expect(mountEffect).toContain("return () => {")
    expect(mountEffect).toContain("gateRef.current.invalidate()")
  })

  test("STATUS_RESULT_BOUND_TO_CURRENT_PHYSICAL_ENDPOINT=SI: the status orchestration re-verifies the physical endpoint before applying (Race D)", () => {
    const statusCheckSrc = read("src/hooks/push-personal-status-check.ts")
    expect(statusCheckSrc).toContain("currentSubscription?.endpoint !== endpoint")
  })
})
