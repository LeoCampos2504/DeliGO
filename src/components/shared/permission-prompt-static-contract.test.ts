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
  const syncBody = src.slice(
    src.indexOf("const syncExistingPushSubscription"),
    src.indexOf("}, [isMozo])") + "}, [isMozo])".length
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
    expect(handleAcceptBody).toContain("savePushSubscription(subscription)")
  })

  test("AUTOMATIC_PERSONAL_PUSH_STATUS_CHECK_PATH_COUNT=1: the mount path performs a read-only status check instead", () => {
    expect(syncBody).toContain("checkExistingPushSubscriptionStatus(subscription)")
  })

  test("the status check function itself only reads — never calls savePushSubscription internally", () => {
    const statusFnStart = src.indexOf("async function checkExistingPushSubscriptionStatus")
    const statusFnEnd = src.indexOf("export function PermissionPrompt")
    const statusFnBody = src.slice(statusFnStart, statusFnEnd)
    expect(statusFnBody).toContain('fetch("/api/push/status"')
    expect(statusFnBody).not.toContain("savePushSubscription")
    expect(statusFnBody).not.toContain("/api/push/subscribe")
  })

  test("EXPLICIT_REENABLE_PATH_PRESERVED=SI: handleAccept (the modal's explicit button) is untouched and still subscribes on click", () => {
    const handleAcceptStart = src.indexOf("const handleAccept")
    const handleAcceptEnd = src.indexOf("const handleDismiss")
    const handleAcceptBody = src.slice(handleAcceptStart, handleAcceptEnd)
    expect(handleAcceptBody).toContain('result === "granted"')
    expect(handleAcceptBody).toContain("savePushSubscription(subscription)")
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
