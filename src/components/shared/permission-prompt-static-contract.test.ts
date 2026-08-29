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
