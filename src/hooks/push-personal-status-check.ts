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
  const { gate, getCurrentSubscription, fetchStatus, applyIsSubscribed } = deps
  const opId = gate.begin()

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
