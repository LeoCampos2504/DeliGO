/// <reference types="bun-types" />
// P2-T39-R3A §6 — first opt-in contract for SuperadminPushSettings. Same
// style as src/lib/push-session-reconciliation-static-contract.test.ts /
// src/components/shared/permission-prompt-static-contract.test.ts (no React
// Testing Library in this repo — contracts asserted against source text).
//
// The underlying claim (SUPERADMIN_AUTO_ENROLL_NEVER_OPTED_IN=NO) rests on
// two independent facts, both asserted here as executable evidence rather
// than "the hook looks generic":
//  1) usePushNotifications() itself never auto-subscribes on mount for ANY
//     actorFamily — already proven generically by
//     src/hooks/use-push-notifications-static-contract.test.ts
//     ("CHECK_SUBSCRIPTION_AUTO_REGISTERS=NO"), which this file does not
//     duplicate.
//  2) SuperadminPushSettings itself never calls push.subscribe() anywhere
//     except inside the Switch's onCheckedChange handler (the explicit user
//     gesture) — asserted below directly against this component's source.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

const src = read("src/components/superadmin/superadmin-push-settings.tsx")

describe("P2-T39-R3A §6 — SuperadminPushSettings never auto-enrolls, only an explicit gesture subscribes", () => {
  test("uses the shared generic hook with actorFamily='superadmin' explicit — never inferred from useAuthStore (which has no SuperAdmin identity)", () => {
    expect(src).toContain('usePushNotifications({ actorFamily: "superadmin", actorKey: "superadmin" })')
    expect(src).not.toContain("useAuthStore")
  })

  test("push.subscribe() appears exactly once in the whole file, and only inside onCheckedChange — never in a useEffect/mount path", () => {
    const subscribeOccurrences = src.split("push.subscribe()").length - 1
    expect(subscribeOccurrences).toBe(1)
    const onCheckedIdx = src.indexOf("onCheckedChange={(val) => {")
    const subscribeIdx = src.indexOf("push.subscribe()")
    const nextClosingBraceIdx = src.indexOf("}}", onCheckedIdx)
    expect(onCheckedIdx).toBeGreaterThan(-1)
    expect(subscribeIdx).toBeGreaterThan(onCheckedIdx)
    expect(subscribeIdx).toBeLessThan(nextClosingBraceIdx)
  })

  test("no useEffect exists in this file at all — nothing here can run on mount besides the hook's own (already-audited) internal effects", () => {
    expect(src).not.toContain("useEffect")
  })

  test("no CHECK_SUBSCRIPTION/status-check call site here — status polling is entirely delegated to usePushNotifications, never duplicated locally", () => {
    expect(src).not.toContain("/api/push/status")
    expect(src).not.toContain("checkSubscription")
  })

  test("Switch's checked prop mirrors push.isSubscribed (server-authoritative), never a local optimistic default of true", () => {
    expect(src).toContain("checked={push.isSubscribed}")
  })
})
