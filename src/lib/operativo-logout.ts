// Logout-B1 (P0 rollout-safe Phase O2): browser-only client utility for the
// operative (mozo/salon) push-ownership flows. No React/Zustand dependency,
// no actor identity/slug argument — the server (O1, already deployed)
// derives all authority from the authenticated operative session. This file
// only captures the current browser subscription and owns the single
// canonical POST /api/operativo/logout request; it never performs a
// physical PushSubscription.unsubscribe() (OPERATIVE_PHYSICAL_UNSUBSCRIBE_POLICY=A).

/**
 * Best-effort capture of the current browser PushSubscription, serialized
 * EXACTLY like the existing operative subscribe flows already do
 * (`JSON.stringify(subscription)` on the raw PushSubscription object — see
 * handleEnablePush in src/app/mozo/panel/[slug]/page.tsx and `subscribe()`
 * in src/hooks/use-operativo-salon-push.ts) so it byte-matches whatever O1
 * has stored for exact-match comparison. Never throws; returns null on any
 * unsupported API, missing registration/subscription, or unexpected error.
 */
export async function getCurrentOperativePushSubscription(): Promise<string | null> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration("/")
    const subscription = await registration?.pushManager.getSubscription()
    return subscription ? JSON.stringify(subscription) : null
  } catch {
    return null
  }
}

/**
 * Owns the ENTIRE operative logout server request — exactly one
 * POST /api/operativo/logout per call, with the current browser
 * subscription attached when available so O1 can perform its exact-match
 * account-scoped detach. Never sends actor/account identity (server-derived
 * only), never retries, never throws to the caller: local logout UX/
 * navigation must proceed regardless of capture or network failure.
 */
export async function performOperativeLogout(): Promise<void> {
  const subscription = await getCurrentOperativePushSubscription()

  try {
    await fetch("/api/operativo/logout", {
      method: "POST",
      cache: "no-store",
      ...(subscription
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription }),
          }
        : {}),
    })
  } catch {
    // Best-effort: an unreachable server must never block local logout.
  }
}
