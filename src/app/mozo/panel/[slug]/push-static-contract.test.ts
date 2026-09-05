/// <reference types="bun-types" />
// P2-T31-R5 (VAPID-STALE-SUBSCRIPTION-VALIDATION-EXTENSION): static-contract
// test locking in the VAPID-staleness fix ported to Mozo's inline push
// subscribe (handleEnablePush), mirroring use-operativo-salon-push.test.ts —
// R4 confirmed this is a structural copy of the Salón hook, not a shared
// implementation, so it needs its own independent lock-in test. This repo
// has neither jsdom nor React Testing Library, so this asserts on the real
// product source directly.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("P2-T31-R5 — Mozo (app/mozo/panel/[slug]/page.tsx) validates an existing subscription's VAPID key before reusing it", () => {
  const src = read("src/app/mozo/panel/[slug]/page.tsx")
  const handleEnableStart = src.indexOf("const handleEnablePush = async")
  const handleEnableEnd = src.indexOf("const handleDisablePush = async")
  const handleEnableBody = src.slice(handleEnableStart, handleEnableEnd)

  test("imports the real shared helpers from push-subscription-key.ts, never a local reimplementation", () => {
    expect(src).toContain('from "@/lib/push-subscription-key"')
    expect(src).toContain("applicationServerKeyMatches")
    expect(src).toContain("urlBase64ToUint8Array")
    expect(src).toContain("unsubscribeStalePushSubscription") // P2-T31-R5A
  })

  test("the VAPID key is converted once via urlBase64ToUint8Array and reused for both comparison and a fresh subscribe()", () => {
    expect(handleEnableBody).toContain("const applicationServerKey = urlBase64ToUint8Array(publicKey)")
  })

  test("an existing physical subscription's key is compared against the current key before deciding whether to reuse it", () => {
    expect(handleEnableBody).toContain("applicationServerKeyMatches(subscription.options.applicationServerKey, applicationServerKey)")
  })

  test("a stale (mismatched) existing subscription goes through confirmed removal (P2-T31-R5A) before a fresh one is created — never silently reused", () => {
    const codeOnly = handleEnableBody
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
    const codeOnly = handleEnableBody
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
    const removalCallIdx = codeOnly.indexOf("await unsubscribeStalePushSubscription(subscription")
    const throwIdx = codeOnly.indexOf("throw new Error(", removalCallIdx)
    expect(removalCallIdx).toBeGreaterThan(-1)
    expect(throwIdx).toBeGreaterThan(removalCallIdx)
  })

  test("recreating a stale subscription marks createdSubscription=true, so the PRE-EXISTING backend-failure rollback covers it without any new/duplicated rollback logic", () => {
    const codeOnly = handleEnableBody
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
    const assignments = [...codeOnly.matchAll(/createdSubscription = true/g)]
    expect(assignments.length).toBe(1)
    const rollbackIdx = handleEnableBody.indexOf("if (createdSubscription) {")
    expect(rollbackIdx).toBeGreaterThan(-1)
    expect(handleEnableBody.slice(rollbackIdx)).toContain("await subscription.unsubscribe().catch(() => undefined)")
  })

  test("this implementation is still an independent copy, not delegating to use-operativo-salon-push.ts (R4 finding, unchanged by this fix)", () => {
    expect(src).not.toContain("useOperativoSalonPush")
  })

  test("the disable path (handleDisablePush) is untouched — still SERVER_DETACH_ONLY, no physical unsubscribe added there", () => {
    const handleDisableStart = src.indexOf("const handleDisablePush = async")
    const handleDisableEnd = src.indexOf("const handleSendTestPush")
    const handleDisableBody = src.slice(handleDisableStart, handleDisableEnd)
    expect(handleDisableBody).not.toContain(".unsubscribe()")
    expect(handleDisableBody).toContain('method: "DELETE"')
  })
})
