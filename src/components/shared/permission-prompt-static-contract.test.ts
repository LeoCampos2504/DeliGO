/// <reference types="bun-types" />
// P2-T40-R1: rewritten for the corrected push session-reconciliation
// architecture (see codex-reports/P2_T40_A1_STALE_OWNER_AND_MANUAL_OPTOUT_AUTHORITY.md).
// The old `syncExistingPushSubscription`/`checkExistingPushSubscriptionStatus`
// pair this file used to assert on was pure inert telemetry — confirmed as
// BUG-2 by P2_T40_A0 (it fetched a status but never acted on it) — and has
// been REPLACED by a real reconciliation call
// (runPushSessionReconciliation, @/lib/push-session-reconciliation) that can
// actually detach a stale previous owner and silently rebind the current
// one. The VAPID-key-validation contracts P2-T31-R5/R5A locked in for
// handleAccept's inline subscribe logic were extracted verbatim into the
// same shared module (activatePushAfterGesture) so Ajustes and the new
// reactivation offer share one implementation — those invariants are
// re-asserted, unchanged, in src/lib/push-session-reconciliation-static-contract.test.ts.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("P2-T40-R1 — PermissionPrompt's mount effect reconciles for EVERY permission state, never only telemetry", () => {
  const src = read("src/components/shared/permission-prompt.tsx")

  test("imports the real reconciliation entry point from the shared module, never a local reimplementation", () => {
    expect(src).toContain('from "@/lib/push-session-reconciliation"')
    expect(src).toContain("runPushSessionReconciliation")
  })

  test("the mount effect calls reconcile() unconditionally — not gated behind perm === \"granted\"", () => {
    const effectStart = src.indexOf("useEffect(() => {")
    const effectEnd = src.indexOf("[isMozo, isAuth, uType, ownerId, checkPermission, reconcile]")
    expect(effectStart).toBeGreaterThan(-1)
    expect(effectEnd).toBeGreaterThan(effectStart)
    const effectBody = src.slice(effectStart, effectEnd)
    const permCheckIdx = effectBody.indexOf('if (perm === "granted")')
    const reconcileCallIdx = effectBody.indexOf("void reconcile(")
    expect(reconcileCallIdx).toBeGreaterThan(-1)
    expect(permCheckIdx).toBeGreaterThan(-1)
    // The reconcile() call must appear BEFORE the granted-only branch — it
    // must not live inside it (STALE_PREVIOUS_OWNER_RULE cleanup is a
    // security fix, not gated behind whether the CURRENT actor wants push).
    expect(reconcileCallIdx).toBeLessThan(permCheckIdx)
  })

  test("SUPERADMIN_PUSH_LIFECYCLE_APPLICABLE=NO: the reconcilable-actor guard explicitly excludes superadmin", () => {
    expect(src).toContain('uType === "cliente" || uType === "negocio" || uType === "repartidor"')
  })

  test("the old inert telemetry functions are gone as callable code, not just renamed (a historical comment referencing the old name is fine)", () => {
    expect(src).not.toContain("const syncExistingPushSubscription")
    expect(src).not.toContain("async function checkExistingPushSubscriptionStatus")
    expect(src).not.toContain("async function savePushSubscription")
  })
})

describe("P2-T40-R1 — handleAccept reuses the shared activation helper (never a divergent local implementation)", () => {
  const src = read("src/components/shared/permission-prompt.tsx")
  const handleAcceptStart = src.indexOf("const handleAccept")
  const handleAcceptEnd = src.indexOf("const handleDismiss")
  const handleAcceptBody = src.slice(handleAcceptStart, handleAcceptEnd)

  test("handleAccept calls activatePushAfterGesture only after Notification.requestPermission() resolves granted", () => {
    expect(handleAcceptBody).toContain('const result = await Notification.requestPermission()')
    expect(handleAcceptBody).toContain('result === "granted"')
    expect(handleAcceptBody).toContain("activatePushAfterGesture(uType as PushSubscriptionOwnerType)")
  })

  test("handleAccept never calls the native permission API a second time and never contains its own VAPID fetch (that logic lives in the shared helper now)", () => {
    const requestPermissionCalls = [...handleAcceptBody.matchAll(/requestPermission\(\)/g)]
    expect(requestPermissionCalls.length).toBe(1)
    expect(handleAcceptBody).not.toContain("vapid-key")
    expect(handleAcceptBody).not.toContain("pushManager.subscribe")
  })
})

describe("P2-T40-R1 — PushReenableOffer is rendered from PermissionPrompt, scoped to the reconcilable actor", () => {
  const src = read("src/components/shared/permission-prompt.tsx")

  test("imports and renders PushReenableOffer, gated on showReenableOffer + a known actor", () => {
    expect(src).toContain('from "@/components/shared/push-reenable-offer"')
    expect(src).toContain("showReenableOffer && uType && ownerId")
    expect(src).toContain("<PushReenableOffer")
  })

  test("dismissing the offer only flips local state — never touches localStorage/opt-out directly from this file", () => {
    const offerBlockStart = src.indexOf("{showReenableOffer && uType && ownerId && (")
    const offerBlockEnd = src.indexOf("/>", offerBlockStart)
    const offerBlock = src.slice(offerBlockStart, offerBlockEnd)
    expect(offerBlock).toContain("onDismissed={() => setShowReenableOffer(false)}")
    expect(src).not.toContain("setPushManualOptOut(")
    expect(src).not.toContain("clearPushManualOptOut(")
  })
})

// P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): the actorFamily selector
// propagation invariant is preserved — it now lives in the shared
// reconciliation module's fetch calls (reconcileStaleOwner,
// silentlyRebindCurrentOwner) rather than locally in this file, since both
// PermissionPrompt and mozo/page.tsx call the SAME functions.
describe("PermissionPrompt — the family source is still uType (useAuthStore), never window.location.pathname", () => {
  const src = read("src/components/shared/permission-prompt.tsx")

  test("the family source is uType (useAuthStore().user?.type), never activeSessionFamily/pathname", () => {
    expect(src).toContain("const uType = useAuthStore((s) => s.user?.type ?? null)")
    expect(src).not.toContain("activeSessionFamily(")
    expect(src).not.toContain("window.location.pathname")
  })

  test("ownerId is sourced from the same store, never a separate/stale identity", () => {
    expect(src).toContain("const ownerId = useAuthStore((s) => s.user?.id ?? null)")
  })
})
