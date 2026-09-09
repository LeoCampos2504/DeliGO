/// <reference types="bun-types" />
// P2-T05 Stage3R1 (F-P2-T05-12): static-contract test — proves the
// mount-time auto-resync no longer mutates the server-side push binding.
// Same style as src/hooks/use-push-notifications-static-contract.test.ts
// (no React Testing Library in this repo — component contracts are asserted
// against the actual source text).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("F-P2-T05-12 — PermissionPrompt never auto-mutates the server push binding", () => {
  const src = read("src/components/shared/permission-prompt.tsx")
  // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): syncExistingPushSubscription
  // now also depends on `uType` (the actorFamily selector source) — the
  // slice boundary below was updated to match the real deps array exactly;
  // the sync path's own behavior (still read-only, still never subscribes)
  // is unchanged and re-asserted below.
  const syncBody = src.slice(
    src.indexOf("const syncExistingPushSubscription"),
    src.indexOf("}, [isMozo, uType])") + "}, [isMozo, uType])".length
  )

  test("F_P2_T05_12_TEST: the granted-permission mount path never calls savePushSubscription", () => {
    expect(syncBody).not.toContain("savePushSubscription")
  })

  test("the granted-permission mount path never POSTs to /api/push/subscribe", () => {
    expect(syncBody).not.toContain("/api/push/subscribe")
  })

  test("AUTOMATIC_PERSONAL_PUSH_SUBSCRIBE_PATH_COUNT=0: the only CALL to savePushSubscription left in the file is inside handleAccept (USER_EXPLICIT_ENABLE)", () => {
    const callSites = [...src.matchAll(/await savePushSubscription\(/g)]
    expect(callSites.length).toBe(1) // exactly one call site (the function definition itself doesn't match "await ...(")
    const handleAcceptStart = src.indexOf("const handleAccept")
    const handleAcceptEnd = src.indexOf("const handleDismiss")
    const handleAcceptBody = src.slice(handleAcceptStart, handleAcceptEnd)
    expect(handleAcceptBody).toContain("savePushSubscription(subscription, uType)")
  })

  test("AUTOMATIC_PERSONAL_PUSH_STATUS_CHECK_PATH_COUNT=1: the mount path performs a read-only status check instead", () => {
    expect(syncBody).toContain("checkExistingPushSubscriptionStatus(subscription, uType)")
  })

  test("the status check function itself only reads — never calls savePushSubscription internally", () => {
    const statusFnStart = src.indexOf("async function checkExistingPushSubscriptionStatus")
    const statusFnEnd = src.indexOf("export function PermissionPrompt")
    const statusFnBody = src.slice(statusFnStart, statusFnEnd)
    expect(statusFnBody).toContain('fetch(url')
    expect(statusFnBody).toContain('"/api/push/status"')
    expect(statusFnBody).not.toContain("savePushSubscription")
    expect(statusFnBody).not.toContain("/api/push/subscribe")
  })

  test("EXPLICIT_REENABLE_PATH_PRESERVED=SI: handleAccept (the modal's explicit button) is untouched and still subscribes on click", () => {
    const handleAcceptStart = src.indexOf("const handleAccept")
    const handleAcceptEnd = src.indexOf("const handleDismiss")
    const handleAcceptBody = src.slice(handleAcceptStart, handleAcceptEnd)
    expect(handleAcceptBody).toContain('result === "granted"')
    expect(handleAcceptBody).toContain("savePushSubscription(subscription, uType)")
  })

  test("PERMISSION_GRANTED_EQUALS_PUSH_ENABLED=NO: granted permission still only marks the prompt as shown, never flips any enabled/subscribed state", () => {
    const effectStart = src.indexOf("useEffect(() => {")
    const effectEnd = src.indexOf("[isMozo, isAuth, uType, checkPermission, syncExistingPushSubscription]")
    const effectBody = src.slice(effectStart, effectEnd)
    const grantedBranch = effectBody.slice(effectBody.indexOf('if (perm === "granted")'))
    expect(grantedBranch).toContain("syncExistingPushSubscription()")
    expect(grantedBranch).not.toMatch(/setIsSubscribed|setEnabled/)
  })
})

// P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): /api/push/subscribe y
// /api/push/status son endpoints compartidos sin familia derivable de su
// propio path — bajo 2+ cookies de familia coexistiendo, resolveActorSession()
// no puede resolverlos sin un selector explícito. Ambas funciones module-level
// ahora reciben `family` como parámetro (no leen el store directamente, no
// son componentes) y el caller (PermissionPrompt) siempre les pasa `uType`.
describe("PermissionPrompt — F-P2-T18-AUTH02 actorFamily selector propagation", () => {
  const src = read("src/components/shared/permission-prompt.tsx")

  test("savePushSubscription accepts an explicit family parameter and appends it as ?actorFamily= when present", () => {
    const fnStart = src.indexOf("async function savePushSubscription")
    const fnEnd = src.indexOf("async function checkExistingPushSubscriptionStatus")
    const fnBody = src.slice(fnStart, fnEnd)
    expect(fnBody).toContain("family: string | null")
    expect(fnBody).toContain("`/api/push/subscribe?actorFamily=${family}`")
    // P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1 (M19-NEW gap closure): the check
    // above only proved `url` is DECLARED — mirroring the consumption check
    // that already exists for checkExistingPushSubscriptionStatus's `url`
    // (`fetch(url`, test below), this proves the productive fetch actually
    // CONSUMES `url` rather than a bare literal (R13-R3-RETRY mutant
    // M19-NEW survived because this was missing).
    expect(fnBody).toContain("fetch(url")
  })

  test("checkExistingPushSubscriptionStatus accepts an explicit family parameter and appends it as ?actorFamily= when present", () => {
    const fnStart = src.indexOf("async function checkExistingPushSubscriptionStatus")
    const fnEnd = src.indexOf("export function PermissionPrompt")
    const fnBody = src.slice(fnStart, fnEnd)
    expect(fnBody).toContain("family: string | null")
    expect(fnBody).toContain("`/api/push/status?actorFamily=${family}`")
  })

  test("the family source is uType (useAuthStore().user?.type), never window.location.pathname (PermissionPrompt is mounted from the root layout)", () => {
    expect(src).toContain("const uType = useAuthStore((s) => s.user?.type ?? null)")
    expect(src).not.toContain("activeSessionFamily(")
    expect(src).not.toContain("window.location.pathname")
  })

  test("a missing family (uType null) falls back to the bare endpoint path — never an empty/undefined selector value", () => {
    const src2 = src
    expect(src2).toContain('const url = family ? `/api/push/subscribe?actorFamily=${family}` : "/api/push/subscribe"')
    expect(src2).toContain('const url = family ? `/api/push/status?actorFamily=${family}` : "/api/push/status"')
  })
})

// P2-T31-R5 (VAPID-STALE-SUBSCRIPTION-VALIDATION-EXTENSION): R4 found that
// handleAccept's own subscribe path (the ONLY place in this file that
// creates a PushSubscription) reused an existing physical subscription
// blindly, with the exact same gap R3 confirmed live for
// use-push-notifications.ts (Apple: `VapidPkHashMismatch`). This locks in
// the ported fix — same shared helper, no duplicated comparison logic.
//
// P2-T31-R5A (PUSH-SUBSCRIPTION-FAILURE-CONTRACT-HARDENING) rewrote this
// block further: a failed VAPID fetch now ABORTS entirely instead of
// falling back to an unvalidated reuse, stale removal is CONFIRMED (not
// just the raw unsubscribe() boolean) before recreating, and the backend
// POST's real result now decides whether to roll back a subscription this
// operation itself created. The describe below reflects that final shape.
describe("P2-T31-R5/R5A — handleAccept validates an existing subscription's VAPID key before reusing it", () => {
  const src = read("src/components/shared/permission-prompt.tsx")
  const handleAcceptStart = src.indexOf("const handleAccept")
  const handleAcceptEnd = src.indexOf("const handleDismiss")
  const handleAcceptBody = src.slice(handleAcceptStart, handleAcceptEnd)
  const codeOnly = handleAcceptBody
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")

  test("imports the real shared helpers from push-subscription-key.ts, never a local reimplementation", () => {
    expect(src).toContain('from "@/lib/push-subscription-key"')
    expect(src).toContain("applicationServerKeyMatches")
    expect(src).toContain("urlBase64ToUint8Array")
    expect(src).toContain("unsubscribeStalePushSubscription") // P2-T31-R5A
  })

  test("the VAPID key is fetched BEFORE getSubscription() — the fetch is not gated behind whether a subscription already exists", () => {
    const vapidFetchIdx = codeOnly.indexOf('await fetch("/api/push/vapid-key")')
    const getSubscriptionIdx = codeOnly.indexOf("await registration.pushManager.getSubscription()")
    expect(vapidFetchIdx).toBeGreaterThan(-1)
    expect(getSubscriptionIdx).toBeGreaterThan(vapidFetchIdx)
  })

  test("an existing physical subscription's key is compared against the current key before deciding whether to reuse it", () => {
    expect(codeOnly).toContain("applicationServerKeyMatches(subscription.options.applicationServerKey, applicationServerKey)")
  })

  test("a stale (mismatched) existing subscription goes through CONFIRMED removal (unsubscribeStalePushSubscription) before a fresh one is created — never silently reused", () => {
    const guardIdx = codeOnly.indexOf(
      "if (subscription && !applicationServerKeyMatches(subscription.options.applicationServerKey, applicationServerKey))"
    )
    const removalCallIdx = codeOnly.indexOf("await unsubscribeStalePushSubscription(subscription")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(removalCallIdx).toBeGreaterThan(guardIdx)
  })

  test("EXPLICIT_REENABLE_PATH_STILL_SAVES=SI: a resolved subscription (reused or recreated) is still saved to the backend, and the REAL result decides what happens next", () => {
    expect(codeOnly).toContain("const saved = await savePushSubscription(subscription, uType)")
  })
})

// P2-T31-R5A (PUSH-SUBSCRIPTION-FAILURE-CONTRACT-HARDENING): closes 3 gaps
// found reviewing R5 before deploy — see the task's own §0 objective.
describe("P2-T31-R5A — VAPID fetch failure aborts without reuse or destruction", () => {
  const src = read("src/components/shared/permission-prompt.tsx")
  const handleAcceptStart = src.indexOf("const handleAccept")
  const handleAcceptEnd = src.indexOf("const handleDismiss")
  const handleAcceptBody = src.slice(handleAcceptStart, handleAcceptEnd)
  const codeOnly = handleAcceptBody
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")

  test("PERMISSION_PROMPT_VAPID_FETCH_FAILURE_POLICY=ABORT_WITHOUT_REUSE_OR_DESTRUCTION: a null publicKey returns immediately, before getSubscription() is even called", () => {
    const publicKeyCheckIdx = codeOnly.indexOf("if (!publicKey) return")
    const getSubscriptionIdx = codeOnly.indexOf("await registration.pushManager.getSubscription()")
    expect(publicKeyCheckIdx).toBeGreaterThan(-1)
    expect(getSubscriptionIdx).toBeGreaterThan(publicKeyCheckIdx)
  })

  test("UNVALIDATED_SUBSCRIPTION_DESTRUCTION=NO: unsubscribeStalePushSubscription/subscription.unsubscribe() are never reachable before the publicKey guard", () => {
    const publicKeyCheckIdx = codeOnly.indexOf("if (!publicKey) return")
    const beforeGuard = codeOnly.slice(0, publicKeyCheckIdx)
    expect(beforeGuard).not.toContain("unsubscribe")
  })

  test("no savePushSubscription call is reachable when publicKey is null (the early return precedes it)", () => {
    const publicKeyCheckIdx = codeOnly.indexOf("if (!publicKey) return")
    const saveCallIdx = codeOnly.indexOf("await savePushSubscription(")
    expect(publicKeyCheckIdx).toBeGreaterThan(-1)
    expect(saveCallIdx).toBeGreaterThan(publicKeyCheckIdx)
  })
})

describe("P2-T31-R5A — backend ACK is real, never assumed", () => {
  const src = read("src/components/shared/permission-prompt.tsx")
  const saveFnStart = src.indexOf("async function savePushSubscription")
  const saveFnEnd = src.indexOf("async function checkExistingPushSubscriptionStatus")
  const saveFnBody = src.slice(saveFnStart, saveFnEnd)

  test("PERMISSION_PROMPT_BACKEND_ACK_REQUIRED=SI: savePushSubscription now returns Promise<boolean>, derived from the REAL /api/push/subscribe contract ({ok:true} on success)", () => {
    expect(saveFnBody).toContain("Promise<boolean>")
    expect(saveFnBody).toContain("if (!res.ok) return false")
    expect(saveFnBody).toContain('return data.ok === true')
  })

  test("a thrown/rejected fetch inside savePushSubscription resolves to false, never propagates as an unhandled rejection", () => {
    expect(saveFnBody).toMatch(/catch\s*\{\s*return false\s*\}/)
  })

  test("PERMISSION_PROMPT_SUCCESS_AFTER_BACKEND_ACK=SI: handleAccept captures the real boolean result rather than firing-and-forgetting the save", () => {
    const handleAcceptStart = src.indexOf("const handleAccept")
    const handleAcceptEnd = src.indexOf("const handleDismiss")
    const handleAcceptBody = src.slice(handleAcceptStart, handleAcceptEnd)
    expect(handleAcceptBody).toContain("const saved = await savePushSubscription(subscription, uType)")
  })
})

describe("P2-T31-R5A — rollback only touches a subscription THIS operation created", () => {
  const src = read("src/components/shared/permission-prompt.tsx")
  const handleAcceptStart = src.indexOf("const handleAccept")
  const handleAcceptEnd = src.indexOf("const handleDismiss")
  const handleAcceptBody = src.slice(handleAcceptStart, handleAcceptEnd)
  const codeOnly = handleAcceptBody
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")

  test("PERMISSION_PROMPT_NEW_SUB_ROLLBACK=SI: createdSubscription is tracked and gates the rollback — a backend failure never rolls back a pre-existing healthy subscription", () => {
    const assignments = [...codeOnly.matchAll(/createdSubscription = true/g)]
    expect(assignments.length).toBe(2) // stale-replacement branch AND absent-subscription branch — never the healthy-reuse branch
    expect(codeOnly).toContain("let createdSubscription = false")
    const rollbackGuardIdx = codeOnly.indexOf("if (!saved && createdSubscription)")
    expect(rollbackGuardIdx).toBeGreaterThan(-1)
    expect(codeOnly.slice(rollbackGuardIdx)).toContain("await subscription.unsubscribe().catch(() => undefined)")
  })

  test("EXISTING_HEALTHY_SUB_BACKEND_FAILURE_POLICY: the healthy-reuse branch (key matches) never sets createdSubscription, so a backend failure there can never trigger a physical rollback", () => {
    // The healthy-reuse path is the implicit fallthrough (neither the stale
    // branch nor the `else if (!subscription)` branch runs) — it must be
    // the ONLY path that does not touch `createdSubscription` at all.
    const staleBranchIdx = codeOnly.indexOf(
      "if (subscription && !applicationServerKeyMatches(subscription.options.applicationServerKey, applicationServerKey)) {"
    )
    const elseIfAbsentIdx = codeOnly.indexOf("} else if (!subscription) {")
    const rollbackGuardIdx = codeOnly.indexOf("if (!saved && createdSubscription)")
    expect(staleBranchIdx).toBeGreaterThan(-1)
    expect(elseIfAbsentIdx).toBeGreaterThan(staleBranchIdx)
    expect(rollbackGuardIdx).toBeGreaterThan(elseIfAbsentIdx)
  })
})
