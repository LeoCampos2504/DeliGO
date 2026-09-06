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
  fetchStatus: (subscriptionJson: string) => Promise<{ ok: boolean; subscribed: boolean }>
  applyIsSubscribed: (value: boolean) => void
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
    if (gate.isCurrent(opId)) {
      trace("STATUS_APPLY", { opId, candidateValue: false, gateCurrent: true, reason: "getCurrentSubscription_threw" })
      applyIsSubscribed(false)
    } else {
      trace("STATUS_DISCARDED_STALE", { opId, candidateValue: false, gateCurrent: false, reason: "getCurrentSubscription_threw" })
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

  let result: { ok: boolean; subscribed: boolean }
  trace("BACKEND_STATUS_START", { opId })
  try {
    result = await fetchStatus(JSON.stringify(subscription.toJSON()))
  } catch {
    trace("BACKEND_STATUS_RESULT", { opId, ok: false, error: "throw" })
    if (gate.isCurrent(opId)) {
      trace("STATUS_APPLY", { opId, candidateValue: false, gateCurrent: true, reason: "fetchStatus_threw" })
      applyIsSubscribed(false)
    } else {
      trace("STATUS_DISCARDED_STALE", { opId, candidateValue: false, gateCurrent: false, reason: "fetchStatus_threw" })
    }
    return
  }
  trace("BACKEND_STATUS_RESULT", { opId, ok: result.ok, backendSubscribed: result.subscribed })

  if (!result.ok) {
    if (gate.isCurrent(opId)) {
      trace("STATUS_APPLY", { opId, candidateValue: false, gateCurrent: true, reason: "backend_not_ok" })
      applyIsSubscribed(false)
    } else {
      trace("STATUS_DISCARDED_STALE", { opId, candidateValue: false, gateCurrent: false, reason: "backend_not_ok" })
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
  trace("ENDPOINT_RECHECK_RESULT", { opId, endpointStillMatches: currentSubscription?.endpoint === endpoint })
  if (currentSubscription?.endpoint !== endpoint) return

  if (gate.isCurrent(opId)) {
    trace("STATUS_APPLY", { opId, candidateValue: result.subscribed === true, gateCurrent: true, reason: "server_authoritative_result" })
    applyIsSubscribed(result.subscribed === true)
  } else {
    trace("STATUS_DISCARDED_STALE", { opId, candidateValue: result.subscribed === true, gateCurrent: false, reason: "server_authoritative_result" })
  }
}
