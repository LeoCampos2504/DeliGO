// P2-T05 Stage3R2 (F-P2-T05-14): pure orchestration of a single personal
// push status read, with dependency injection so the exact async-ordering
// races (stale response after a newer mutation/actor-change/endpoint-change)
// can be exercised directly in tests without a browser or React — this repo
// has neither jsdom nor React Testing Library. `use-push-notifications.ts`
// is the only real caller; it supplies the real `navigator`/`fetch`-backed
// dependencies and a shared `LatestOperationGate` also used by its own
// subscribe()/unsubscribe() mutations.
import type { LatestOperationGate } from "./push-operation-guard"
import { fingerprintPushEndpoint } from "@/lib/push-debug-snapshot"

export interface PersonalPushPhysicalSubscription {
  endpoint: string
  toJSON(): unknown
}

export type PushDebugTraceFn = (event: string, fields?: Record<string, unknown>) => void

export interface PersonalPushStatusCheckDeps {
  gate: LatestOperationGate
  getCurrentSubscription: () => Promise<PersonalPushPhysicalSubscription | null>
  // P2-T31-R8 (PUSH-RATE-LIMIT-429-STATE-CONSISTENCY-FIX): `httpStatus`/
  // `retryAfterMs` are optional, diagnostic-only additions — never read by
  // any decision below, only forwarded to `trace`. Every existing caller
  // that returns just `{ok, subscribed}` keeps working unmodified.
  fetchStatus: (
    subscriptionJson: string
  ) => Promise<{ ok: boolean; subscribed: boolean; httpStatus?: number; retryAfterMs?: number }>
  applyIsSubscribed: (value: boolean) => void
  // P2-T31-R8: optional — called instead of `applyIsSubscribed` whenever
  // this check reaches an INCONCLUSIVE outcome (a thrown exception reading
  // the physical subscription, a thrown exception calling the backend, or
  // the backend responding with a non-2xx status — most notably 429). None
  // of those are evidence the actor is NOT subscribed; physical evidence
  // (P2-T31-R8 physical trace) showed a real 429 backend rejection while
  // the actor's server-side binding remained genuinely `true` the whole
  // time. Only called when this operation is still current (a stale/
  // superseded check calls neither this nor `applyIsSubscribed`). Optional
  // and defaulted to a no-op so every existing caller/test keeps working
  // unmodified without passing this field.
  applyStatusUnresolved?: (reason: string, detail?: { httpStatus?: number; retryAfterMs?: number }) => void
  // P2-T31-R2 (FIRST-SUBSCRIBE-REMOUNT-STATE): optional — when provided,
  // awaited BEFORE the first physical read. Lets a status check for a given
  // actor wait out a subscribe()/unsubscribe() still in flight for that same
  // actor from a DIFFERENT (possibly already-unmounted) component instance,
  // so `getCurrentSubscription()` never races ahead of a mutation the user
  // is genuinely waiting on — see push-mutation-in-flight-registry.ts for
  // why this can't be solved by `gate` alone. Optional and defaulted to a
  // no-op wait so every existing caller/test keeps its exact prior behavior.
  waitForInFlightMutation?: () => Promise<void>
  // P2-T31-R6A (PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC): optional, diagnostic-only.
  // Synchronous, never awaited, never allowed to influence any branch below
  // — see push-debug-trace.ts::recordPushDebugEvent, which is itself a
  // fail-safe no-op unless a TESTING session has explicitly armed tracing.
  // Defaulted to a no-op so every existing caller/test keeps working
  // unmodified without passing this field.
  trace?: PushDebugTraceFn
}

/**
 * Resolves whether the browser's CURRENT physical push subscription is
 * bound server-side to the current actor, then applies the result — but
 * only if this operation is still the latest relevant one by the time every
 * async step completes. Two independent staleness guards protect the final
 * `applyIsSubscribed` call:
 *
 * 1. `gate.isCurrent(opId)` — rejects the result if a NEWER operation
 *    (another status check, an explicit enable/disable, an actor change, or
 *    an unmount) has started since this one began (Races A/B/C).
 * 2. A fresh `getCurrentSubscription()` re-check right before applying —
 *    rejects the result if the browser's relevant physical endpoint has
 *    changed since this read started, even without any tracked "operation"
 *    marking that change (Race D).
 *
 * Never infers `subscribed=true` from physical existence alone, and never
 * mutates server state.
 */
export async function checkPersonalPushStatus(deps: PersonalPushStatusCheckDeps): Promise<void> {
  const { gate, getCurrentSubscription, fetchStatus, applyIsSubscribed, waitForInFlightMutation } = deps
  const trace: PushDebugTraceFn = deps.trace ?? (() => {})
  const applyStatusUnresolved = deps.applyStatusUnresolved ?? (() => {})
  const opId = gate.begin()
  trace("STATUS_CHECK_START", { opId })

  // P2-T31-R2: wait out any mutation already in flight for this actor
  // BEFORE touching physical state — a `subscribe()` that hasn't created
  // its PushSubscription yet is indistinguishable, to a plain physical
  // read, from "never subscribed". Doesn't consume the mutation's own
  // outcome: once it settles (whatever the outcome), the normal
  // authoritative read below still runs and decides for itself.
  if (waitForInFlightMutation) {
    trace("MUTATION_WAIT_START", { opId })
    await waitForInFlightMutation()
    trace("MUTATION_WAIT_END", { opId })
  }

  let subscription: PersonalPushPhysicalSubscription | null
  try {
    subscription = await getCurrentSubscription()
  } catch {
    trace("PHYSICAL_SUBSCRIPTION_READ", { opId, physicalPresent: false, error: "throw" })
    // P2-T31-R8: a browser/SW API exception is NOT evidence of "not
    // subscribed" — it means we simply couldn't check. Stay unresolved
    // rather than assert an authoritative false with no real evidence.
    if (gate.isCurrent(opId)) {
      trace("STATUS_UNRESOLVED", { opId, gateCurrent: true, reason: "getCurrentSubscription_threw" })
      applyStatusUnresolved("getCurrentSubscription_threw")
    } else {
      trace("STATUS_DISCARDED_STALE", { opId, gateCurrent: false, reason: "getCurrentSubscription_threw" })
    }
    return
  }

  trace("PHYSICAL_SUBSCRIPTION_READ", {
    opId,
    physicalPresent: subscription !== null,
    endpointFingerprint: subscription ? fingerprintPushEndpoint(subscription.endpoint) : null,
  })

  if (!subscription) {
    if (gate.isCurrent(opId)) {
      trace("STATUS_APPLY", { opId, candidateValue: false, gateCurrent: true, reason: "no_physical_subscription" })
      applyIsSubscribed(false)
    } else {
      trace("STATUS_DISCARDED_STALE", { opId, candidateValue: false, gateCurrent: false, reason: "no_physical_subscription" })
    }
    return
  }

  const endpoint = subscription.endpoint

  let result: { ok: boolean; subscribed: boolean; httpStatus?: number; retryAfterMs?: number }
  trace("BACKEND_STATUS_START", { opId })
  try {
    result = await fetchStatus(JSON.stringify(subscription.toJSON()))
  } catch {
    // P2-T31-R8: a network exception is NOT evidence of "not subscribed" —
    // stay unresolved.
    trace("BACKEND_STATUS_RESULT", { opId, ok: false, error: "throw" })
    if (gate.isCurrent(opId)) {
      trace("STATUS_UNRESOLVED", { opId, gateCurrent: true, reason: "fetchStatus_threw" })
      applyStatusUnresolved("fetchStatus_threw")
    } else {
      trace("STATUS_DISCARDED_STALE", { opId, gateCurrent: false, reason: "fetchStatus_threw" })
    }
    return
  }
  trace("BACKEND_STATUS_RESULT", { opId, ok: result.ok, backendSubscribed: result.subscribed, httpStatus: result.httpStatus })

  if (!result.ok) {
    // P2-T31-R8 (F-P2-T31-R8-03): a non-2xx backend response — MOST
    // NOTABLY a 429 from the shared rate limiter — is NOT evidence the
    // actor is unsubscribed. Physical trace evidence showed a real 429
    // while the server-side binding remained `true` throughout. Mapping
    // this to an authoritative `false` (the pre-R8 behavior) is exactly
    // the bug: it told the user their subscription was gone when it never
    // moved. Stay unresolved instead — never worse than showing a neutral
    // "couldn't check" state, and never a false OFF.
    if (gate.isCurrent(opId)) {
      trace("STATUS_UNRESOLVED", { opId, gateCurrent: true, reason: "backend_not_ok", httpStatus: result.httpStatus, retryAfterMs: result.retryAfterMs })
      applyStatusUnresolved("backend_not_ok", { httpStatus: result.httpStatus, retryAfterMs: result.retryAfterMs })
    } else {
      trace("STATUS_DISCARDED_STALE", { opId, gateCurrent: false, reason: "backend_not_ok", httpStatus: result.httpStatus })
    }
    return
  }

  let currentSubscription: PersonalPushPhysicalSubscription | null
  try {
    currentSubscription = await getCurrentSubscription()
  } catch {
    // Cannot confirm the endpoint is still relevant — discard silently
    // rather than risk applying a possibly-stale result.
    trace("ENDPOINT_RECHECK_RESULT", { opId, error: "throw" })
    return
  }
  // P2-T31-R7 (DEBUG HYGIENE): named `physicalStillMatches`, NOT
  // `endpointStillMatches` — the tracer's sanitizer (push-debug-trace.ts)
  // redacts any field whose NAME contains "endpoint" as a blanket defense
  // against ever persisting the real endpoint, with no way to know from the
  // name alone that THIS particular field is a plain boolean carrying no
  // endpoint data at all. Renaming avoids the false-positive redaction
  // without weakening that protection for genuinely endpoint-shaped fields.
  trace("ENDPOINT_RECHECK_RESULT", { opId, physicalStillMatches: currentSubscription?.endpoint === endpoint })
  if (currentSubscription?.endpoint !== endpoint) return

  if (gate.isCurrent(opId)) {
    trace("STATUS_APPLY", { opId, candidateValue: result.subscribed === true, gateCurrent: true, reason: "server_authoritative_result" })
    applyIsSubscribed(result.subscribed === true)
  } else {
    trace("STATUS_DISCARDED_STALE", { opId, candidateValue: result.subscribed === true, gateCurrent: false, reason: "server_authoritative_result" })
  }
}
