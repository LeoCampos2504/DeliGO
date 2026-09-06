// P2-T31-R6 (INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC): pure orchestration
// of a single push-debug snapshot, with every browser/network/state read
// injected as a dependency — same style as push-personal-status-check.ts —
// so the exact field-by-field behavior is directly unit-testable without a
// real browser, real Service Worker, or real backend (this repo has neither
// jsdom nor React Testing Library).
//
// This module NEVER subscribes, unsubscribes, or writes anything — every
// dependency it calls is a READ. It exists solely so Leonardo can capture,
// from the real iPhone Home-Screen PWA, which of the layers listed in the R6
// task (UI / permission / SW registration / physical subscription / VAPID
// match / backend binding / mutation arbitration / actor identity) disagrees
// with the others at the exact moment a flaky switch state is observed.

/** Small non-cryptographic fingerprint — FNV-1a 32-bit, 8 hex chars. */
function fnv1aFingerprint(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/** Lets two snapshots be compared ("did the physical endpoint change?")
 * without ever displaying the real push endpoint URL (which would leak
 * enough to send a push to this exact device from outside this app). */
export function fingerprintPushEndpoint(endpoint: string): string {
  return fnv1aFingerprint(endpoint)
}

/**
 * P2-T31-R7 (DEBUG HYGIENE): lets two snapshots be compared ("did the
 * signed-in actor change?") without ever displaying the raw DB id — a
 * physical trace Leonardo copied showed `actorFamily=cliente:<raw id>`
 * because the panel was passing a composite `${family}:${id}` key straight
 * into the snapshot's `actorFamily` field. `actorFamily` must only ever
 * carry the role name (`"cliente"` / `"negocio"` / `"repartidor"`); this
 * fingerprint is the ONLY safe way to still distinguish "same actor" from "a
 * different actor of the same role" across two captures.
 */
export function fingerprintActorId(actorId: string): string {
  return fnv1aFingerprint(actorId)
}

export interface PushDebugPhysicalSubscription {
  endpoint: string
  options: { applicationServerKey: ArrayBuffer | null }
  // Same contract the real backend already requires (endpoint + keys.p256dh
  // + keys.auth — see push-subscription-http.ts::parsePushSubscriptionShape).
  // A real browser `PushSubscription` satisfies this natively; tests supply
  // a plain object instead.
  toJSON(): unknown
}

export interface PushDebugRegistrationInfo {
  exists: boolean
  activeState: string | null
}

export interface PushDebugBackendStatusResult {
  httpStatus: number
  subscribed: boolean
}

export interface PushDebugSnapshotDeps {
  now: () => string
  // P2-T31-R7 (DEBUG HYGIENE): role name ONLY ("cliente"/"negocio"/
  // "repartidor") — NEVER a raw actor id or a composite `${family}:${id}`
  // key. Use `actorFingerprint` below to distinguish actors safely.
  actorFamily: string | null
  actorFingerprint?: string | null
  authHasHydrated: boolean
  pathname: string
  visibilityState: string
  permission: NotificationPermission | "unsupported"
  serviceWorkerSupported: boolean
  pushManagerSupported: boolean
  getRegistrationInfo: () => Promise<PushDebugRegistrationInfo | null>
  getCurrentSubscription: () => Promise<PushDebugPhysicalSubscription | null>
  fetchVapidKey: () => Promise<string | null>
  applicationServerKeyMatches: (existing: ArrayBuffer | null, expectedKey: string) => boolean
  fetchBackendStatus: (subscriptionJson: string) => Promise<PushDebugBackendStatusResult | null>
  mutationInFlight: boolean
  hookIsSubscribed: boolean
  hookLoading: boolean
  uiSwitch: boolean
}

export interface PushDebugSnapshot {
  timestamp: string
  actorFamily: string
  actorFingerprint: string
  authHasHydrated: boolean
  path: string
  visibility: string
  permission: string
  swSupported: boolean
  registrationExists: boolean
  registrationActiveState: string
  pushManagerSupported: boolean
  physicalSubscription: boolean
  endpointFingerprint: string
  existingKeyPresent: boolean
  vapidFetched: boolean
  vapidMatch: string
  backendStatusHttp: string
  backendSubscribed: string
  hookSubscribed: boolean
  hookLoading: boolean
  mutationInFlight: boolean
  uiSwitch: boolean
  error: string
}

/**
 * Collects one snapshot. Every step degrades independently on failure — one
 * layer being unreadable (e.g. the backend call rejecting) never prevents the
 * others from being reported, and any thrown error is captured into the
 * `error` field rather than aborting the whole snapshot, so a genuinely
 * broken layer is itself diagnostic signal instead of a blank screen.
 */
export async function collectPushDebugSnapshot(deps: PushDebugSnapshotDeps): Promise<PushDebugSnapshot> {
  const errors: string[] = []

  let registrationExists = false
  let registrationActiveState: string | null = null
  if (deps.serviceWorkerSupported) {
    try {
      const info = await deps.getRegistrationInfo()
      registrationExists = info?.exists === true
      registrationActiveState = info?.activeState ?? null
    } catch (e) {
      errors.push(`registration:${describeError(e)}`)
    }
  }

  let subscription: PushDebugPhysicalSubscription | null = null
  if (deps.pushManagerSupported) {
    try {
      subscription = await deps.getCurrentSubscription()
    } catch (e) {
      errors.push(`subscription:${describeError(e)}`)
    }
  }

  const existingKeyPresent = subscription?.options.applicationServerKey != null

  let vapidKey: string | null = null
  try {
    vapidKey = await deps.fetchVapidKey()
  } catch (e) {
    errors.push(`vapid:${describeError(e)}`)
  }
  const vapidFetched = typeof vapidKey === "string" && vapidKey.length > 0

  let vapidMatch: string = "n/a"
  if (subscription && vapidFetched) {
    try {
      vapidMatch = String(
        deps.applicationServerKeyMatches(subscription.options.applicationServerKey, vapidKey as string)
      )
    } catch (e) {
      errors.push(`vapid-match:${describeError(e)}`)
      vapidMatch = "error"
    }
  }

  let backendStatusHttp = "n/a"
  let backendSubscribed = "n/a"
  if (subscription) {
    try {
      const result = await deps.fetchBackendStatus(JSON.stringify(subscription.toJSON()))
      if (result) {
        backendStatusHttp = String(result.httpStatus)
        backendSubscribed = String(result.subscribed)
      } else {
        backendStatusHttp = "no-response"
      }
    } catch (e) {
      errors.push(`backend:${describeError(e)}`)
      backendStatusHttp = "error"
    }
  }

  return {
    timestamp: deps.now(),
    actorFamily: deps.actorFamily ?? "null",
    actorFingerprint: deps.actorFingerprint ?? "n/a",
    authHasHydrated: deps.authHasHydrated,
    path: deps.pathname,
    visibility: deps.visibilityState,
    permission: deps.permission,
    swSupported: deps.serviceWorkerSupported,
    registrationExists,
    registrationActiveState: registrationActiveState ?? "null",
    pushManagerSupported: deps.pushManagerSupported,
    physicalSubscription: subscription !== null,
    endpointFingerprint: subscription ? fingerprintPushEndpoint(subscription.endpoint) : "n/a",
    existingKeyPresent,
    vapidFetched,
    vapidMatch,
    backendStatusHttp,
    backendSubscribed,
    hookSubscribed: deps.hookIsSubscribed,
    hookLoading: deps.hookLoading,
    mutationInFlight: deps.mutationInFlight,
    uiSwitch: deps.uiSwitch,
    error: errors.length > 0 ? errors.join("; ") : "none",
  }
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.name
  return "unknown"
}

/** Plain `KEY=value` text, one per line, matching the format in the R6 task
 * spec exactly so it can be pasted directly into a chat with Claude/ChatGPT
 * for follow-up diagnosis. No secrets: the physical endpoint is never
 * included, only its short fingerprint. */
export function formatPushDebugSnapshot(snapshot: PushDebugSnapshot): string {
  return [
    "PUSH_DEBUG_VERSION=1",
    `timestamp=${snapshot.timestamp}`,
    `actorFamily=${snapshot.actorFamily}`,
    `actorFingerprint=${snapshot.actorFingerprint}`,
    `authHasHydrated=${snapshot.authHasHydrated}`,
    `path=${snapshot.path}`,
    `visibility=${snapshot.visibility}`,
    `permission=${snapshot.permission}`,
    `swSupported=${snapshot.swSupported}`,
    `registrationExists=${snapshot.registrationExists}`,
    `registrationActiveState=${snapshot.registrationActiveState}`,
    `pushManagerSupported=${snapshot.pushManagerSupported}`,
    `physicalSubscription=${snapshot.physicalSubscription}`,
    `endpointFingerprint=${snapshot.endpointFingerprint}`,
    `existingKeyPresent=${snapshot.existingKeyPresent}`,
    `vapidFetched=${snapshot.vapidFetched}`,
    `vapidMatch=${snapshot.vapidMatch}`,
    `backendStatusHttp=${snapshot.backendStatusHttp}`,
    `backendSubscribed=${snapshot.backendSubscribed}`,
    `hookSubscribed=${snapshot.hookSubscribed}`,
    `hookLoading=${snapshot.hookLoading}`,
    `mutationInFlight=${snapshot.mutationInFlight}`,
    `uiSwitch=${snapshot.uiSwitch}`,
    `error=${snapshot.error}`,
  ].join("\n")
}
