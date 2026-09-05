// P2-T05 Stage3R2 (F-P2-T05-14): pure orchestration of a single personal
// push status read, with dependency injection so the exact async-ordering
// races (stale response after a newer mutation/actor-change/endpoint-change)
// can be exercised directly in tests without a browser or React — this repo
// has neither jsdom nor React Testing Library. `use-push-notifications.ts`
// is the only real caller; it supplies the real `navigator`/`fetch`-backed
// dependencies and a shared `LatestOperationGate` also used by its own
// subscribe()/unsubscribe() mutations.
import type { LatestOperationGate } from "./push-operation-guard"

export interface PersonalPushPhysicalSubscription {
  endpoint: string
  toJSON(): unknown
}

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
  const opId = gate.begin()

  // P2-T31-R2: wait out any mutation already in flight for this actor
  // BEFORE touching physical state — a `subscribe()` that hasn't created
  // its PushSubscription yet is indistinguishable, to a plain physical
  // read, from "never subscribed". Doesn't consume the mutation's own
  // outcome: once it settles (whatever the outcome), the normal
  // authoritative read below still runs and decides for itself.
  if (waitForInFlightMutation) {
    await waitForInFlightMutation()
  }

  let subscription: PersonalPushPhysicalSubscription | null
  try {
    subscription = await getCurrentSubscription()
  } catch {
    if (gate.isCurrent(opId)) applyIsSubscribed(false)
    return
  }

  if (!subscription) {
    if (gate.isCurrent(opId)) applyIsSubscribed(false)
    return
  }

  const endpoint = subscription.endpoint

  let result: { ok: boolean; subscribed: boolean }
  try {
    result = await fetchStatus(JSON.stringify(subscription.toJSON()))
  } catch {
    if (gate.isCurrent(opId)) applyIsSubscribed(false)
    return
  }

  if (!result.ok) {
    if (gate.isCurrent(opId)) applyIsSubscribed(false)
    return
  }

  let currentSubscription: PersonalPushPhysicalSubscription | null
  try {
    currentSubscription = await getCurrentSubscription()
  } catch {
    // Cannot confirm the endpoint is still relevant — discard silently
    // rather than risk applying a possibly-stale result.
    return
  }
  if (currentSubscription?.endpoint !== endpoint) return

  if (gate.isCurrent(opId)) {
    applyIsSubscribed(result.subscribed === true)
  }
}
