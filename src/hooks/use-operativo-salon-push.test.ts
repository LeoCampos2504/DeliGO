/// <reference types="bun-types" />
// P2-T31-R5 (VAPID-STALE-SUBSCRIPTION-VALIDATION-EXTENSION): static-contract
// test locking in the VAPID-staleness fix ported from
// use-push-notifications.ts (R3) — same style as
// config-tab-push-static-contract.test.ts / use-push-notifications-static-
// contract.test.ts. This repo has neither jsdom nor React Testing Library,
// so this asserts on the real product source directly.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("P2-T31-R5 — Salón (use-operativo-salon-push.ts) validates an existing subscription's VAPID key before reusing it", () => {
  const src = read("src/hooks/use-operativo-salon-push.ts")
  const subscribeBody = src.slice(src.indexOf("const subscribe = useCallback"), src.indexOf("const unsubscribe = useCallback"))

  test("imports the real shared helpers from push-subscription-key.ts, never a local reimplementation", () => {
    expect(src).toContain('from "@/lib/push-subscription-key"')
    expect(src).toContain("applicationServerKeyMatches")
    expect(src).toContain("urlBase64ToUint8Array")
    expect(src).toContain("unsubscribeStalePushSubscription") // P2-T31-R5A
  })

  test("the VAPID key is converted once via urlBase64ToUint8Array and reused for both comparison and a fresh subscribe()", () => {
    expect(subscribeBody).toContain("const applicationServerKey = urlBase64ToUint8Array(publicKey)")
  })

  test("an existing physical subscription's key is compared against the current key before deciding whether to reuse it", () => {
    expect(subscribeBody).toContain("applicationServerKeyMatches(subscription.options.applicationServerKey, applicationServerKey)")
  })

  test("a stale (mismatched) existing subscription goes through confirmed removal (P2-T31-R5A) before a fresh one is created — never silently reused", () => {
    const codeOnly = subscribeBody
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
    const guardIdx = codeOnly.indexOf(
      "if (subscription && !applicationServerKeyMatches(subscription.options.applicationServerKey, applicationServerKey))"
    )
    const removalCallIdx = codeOnly.indexOf("await unsubscribeStalePushSubscription(subscription")
    const nullOutIdx = codeOnly.indexOf("subscription = null")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(removalCallIdx).toBeGreaterThan(guardIdx)
    expect(nullOutIdx).toBeGreaterThan(removalCallIdx)
  })

  test("P2-T31-R5A: an unconfirmed removal aborts (throws) instead of proceeding to create a subscription on top of a possibly-still-live one", () => {
    const codeOnly = subscribeBody
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
    const removalCallIdx = codeOnly.indexOf("await unsubscribeStalePushSubscription(subscription")
    const throwIdx = codeOnly.indexOf("throw new Error(", removalCallIdx)
    expect(removalCallIdx).toBeGreaterThan(-1)
    expect(throwIdx).toBeGreaterThan(removalCallIdx)
  })

  test("recreating a stale subscription marks createdSubscription=true, so the PRE-EXISTING backend-failure rollback covers it without any new/duplicated rollback logic", () => {
    // The `if (!subscription) { ... createdSubscription = true }` branch must
    // run for BOTH "never existed" and "just nulled out because stale" —
    // i.e. there must be exactly ONE such assignment, reused by both paths.
    const codeOnly = subscribeBody
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
    const assignments = [...codeOnly.matchAll(/createdSubscription = true/g)]
    expect(assignments.length).toBe(1)
    const rollbackIdx = subscribeBody.indexOf("if (createdSubscription) {")
    expect(rollbackIdx).toBeGreaterThan(-1)
    expect(subscribeBody.slice(rollbackIdx)).toContain("await subscription.unsubscribe().catch(() => undefined)")
  })

  test("the disable path (unsubscribe()) is untouched — still SERVER_DETACH_ONLY, no physical unsubscribe added there", () => {
    const unsubscribeBody = src.slice(src.indexOf("const unsubscribe = useCallback"), src.lastIndexOf("return {"))
    expect(unsubscribeBody).not.toContain(".unsubscribe()")
    expect(unsubscribeBody).toContain('method: "DELETE"')
  })
})
