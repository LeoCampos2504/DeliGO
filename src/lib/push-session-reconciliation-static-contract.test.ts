/// <reference types="bun-types" />
// P2-T40-R1: these P2-T31-R5/R5A invariants were extracted VERBATIM from
// src/components/shared/permission-prompt.tsx's old inline handleAccept
// subscribe logic into activatePushAfterGesture() here, so that Ajustes
// (via handleAccept) and the new M2 reactivation offer
// (PushReenableOffer) share exactly one implementation — never two
// divergent copies (P2-T40-R1 prompt §26). Re-asserted here, unchanged,
// against their new home. Same style as
// src/components/shared/permission-prompt-static-contract.test.ts (no React
// Testing Library in this repo — contracts asserted against source text).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("P2-T31-R5/R5A (ported) — activatePushAfterGesture validates an existing subscription's VAPID key before reusing it", () => {
  const src = read("src/lib/push-session-reconciliation.ts")
  const fnStart = src.indexOf("export async function activatePushAfterGesture")
  const fnEnd = src.indexOf("export interface PushSessionReconciliationResult")
  const fnBody = src.slice(fnStart, fnEnd)

  test("imports the real shared helpers from push-subscription-key.ts, never a local reimplementation", () => {
    expect(src).toContain('from "@/lib/push-subscription-key"')
    expect(src).toContain("applicationServerKeyMatches")
    expect(src).toContain("urlBase64ToUint8Array")
    expect(src).toContain("unsubscribeStalePushSubscription")
  })

  test("the VAPID key is fetched BEFORE getSubscription() — not gated behind whether a subscription already exists", () => {
    const vapidFetchIdx = fnBody.indexOf('await fetch("/api/push/vapid-key")')
    const getSubscriptionIdx = fnBody.indexOf("await registration.pushManager.getSubscription()")
    expect(vapidFetchIdx).toBeGreaterThan(-1)
    expect(getSubscriptionIdx).toBeGreaterThan(vapidFetchIdx)
  })

  test("a null publicKey returns false immediately, before getSubscription() is even called (ABORT_WITHOUT_REUSE_OR_DESTRUCTION)", () => {
    const publicKeyCheckIdx = fnBody.indexOf("if (!publicKey) return false")
    const getSubscriptionIdx = fnBody.indexOf("await registration.pushManager.getSubscription()")
    expect(publicKeyCheckIdx).toBeGreaterThan(-1)
    expect(getSubscriptionIdx).toBeGreaterThan(publicKeyCheckIdx)
    const beforeGuard = fnBody.slice(0, publicKeyCheckIdx)
    expect(beforeGuard).not.toContain("unsubscribe")
  })

  test("an existing physical subscription's key is compared against the current key before deciding whether to reuse it", () => {
    expect(fnBody).toContain("applicationServerKeyMatches(subscription.options.applicationServerKey, applicationServerKey)")
  })

  test("a stale (mismatched) existing subscription goes through CONFIRMED removal before a fresh one is created — never silently reused", () => {
    const guardIdx = fnBody.indexOf(
      "if (subscription && !applicationServerKeyMatches(subscription.options.applicationServerKey, applicationServerKey))"
    )
    const removalCallIdx = fnBody.indexOf("await unsubscribeStalePushSubscription(subscription")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(removalCallIdx).toBeGreaterThan(guardIdx)
  })

  test("createdSubscription is tracked and gates rollback — a backend failure never rolls back a pre-existing healthy subscription", () => {
    const assignments = [...fnBody.matchAll(/createdSubscription = true/g)]
    expect(assignments.length).toBe(2) // stale-replacement branch AND absent-subscription branch — never healthy-reuse
    expect(fnBody).toContain("let createdSubscription = false")
    const rollbackGuardIdx = fnBody.indexOf("if (!saved && createdSubscription)")
    expect(rollbackGuardIdx).toBeGreaterThan(-1)
    expect(fnBody.slice(rollbackGuardIdx)).toContain("await subscription.unsubscribe().catch(() => undefined)")
  })

  test("the resolved subscription is saved via silentlyRebindCurrentOwner (same code path as the silent auto-rebind), and the REAL boolean result decides rollback", () => {
    expect(fnBody).toContain("const saved = await silentlyRebindCurrentOwner(family, JSON.stringify(subscription))")
  })

  test("never calls Notification.requestPermission() itself — that gesture belongs to the caller (CASE C is decided by the caller, not this function)", () => {
    expect(fnBody).not.toContain("requestPermission")
  })
})
