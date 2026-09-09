// P2-T31-R2 (FIRST-SUBSCRIBE-REMOUNT-STATE): module-scoped registry of
// in-flight personal push mutations (subscribe()/unsubscribe()), keyed by
// actor (`${actorType}:${actorId}`).
//
// Why this needs to live OUTSIDE React state: `usePushNotifications()`'s own
// `gateRef` (see push-operation-guard.ts) is a `useRef` — scoped to ONE
// component instance, destroyed the instant that instance unmounts. On the
// Cliente/Negocio/Repartidor panels, navigating away from the tab that hosts
// the push switch (e.g. Perfil -> Favoritos) fully unmounts that component;
// navigating back mounts a BRAND NEW instance with its own brand-new gate,
// starting from generation 0 — it has zero knowledge of anything the
// PREVIOUS instance was doing, including a subscribe()/unsubscribe() that
// was still running in the background when the unmount happened.
//
// A first-ever activation is the slowest possible path through subscribe()
// (permission prompt, fresh Service Worker registration/ready, a VAPID key
// fetch, and a fresh handshake with the browser's push service to mint a
// physical PushSubscription) — realistically slow enough that a user can
// navigate away and back before it settles. When that happens, the NEW
// instance's mount-time status check calls `getCurrentSubscription()`
// (`PushManager.getSubscription()`) and — truthfully, for that exact
// instant — finds nothing yet, because the orphaned subscribe() from the
// PREVIOUS instance hasn't created the physical subscription yet. The new
// instance has no way to tell "not subscribed" apart from "a subscribe is
// still landing" and permanently applies `false`, with nothing left to ever
// re-check it (the orphaned mutation's own `finishMutation` call, once it
// finally does complete, is gated by ITS OWN already-unmounted instance's
// gate and mutates nothing anyone can see).
//
// This registry closes that gap: subscribe()/unsubscribe() register their
// own in-flight promise here BEFORE their async work starts, and any status
// check (mount, actor-change) for the SAME actor key awaits it before doing
// its own physical read — so the read only ever happens once any mutation
// the user is actually waiting on has truthfully settled, regardless of
// which component instance started it or is still around to observe it.
//
// Deliberately pure/framework-agnostic (like push-operation-guard.ts) so it
// stays directly unit-testable without jsdom/React Testing Library (this
// repo has neither).
//
// P2-T31-R12 (ANDROID-FIRST-SUBSCRIBE-PHYSICAL-CREATION-FAILURE-DIAGNOSTIC):
// a physical Android trace showed `waitForInFlightPersonalPushMutation`
// resolving near-instantly on a same-process remount right after a
// `subscribe()` whose own physical creation never completed (no
// SUBSCRIBE_NEW_PHYSICAL_RESULT/SUBSCRIBE_FINISH ever recorded) — meaning
// the registry had nothing to wait for. The diagnostic trace calls below
// (`MUTATION_REGISTRY_SET/RELEASE/WAIT_FOUND/WAIT_NOT_FOUND`) exist so the
// NEXT physical capture can show directly whether a registration ever
// happened for that mutation's key at all, rather than requiring this to be
// inferred indirectly. `trace` stays an optional, DI'd dependency (never a
// direct import of push-debug-trace.ts) so this module keeps working exactly
// as before for every existing caller/test that doesn't pass it, and stays
// testable with a plain mock instead of the real trace module's armed state.
type MutationRegistryTraceFn = (event: string, fields?: Record<string, unknown>) => void

interface InFlightMutationEntry {
  promise: Promise<unknown>
  opId?: number
}

const inFlightMutations = new Map<string, InFlightMutationEntry>()

// Never the actor DB id — only the family/role portion of `${actorType}:${actorId}`.
function actorFamilyFromKey(key: string): string {
  const separatorIndex = key.indexOf(":")
  return separatorIndex === -1 ? key : key.slice(0, separatorIndex)
}

/**
 * Registers `promise` as the current in-flight mutation for `key`. If a
 * newer mutation for the same key is registered before this one settles,
 * this entry is simply overwritten — the newer one is authoritative and a
 * status check should wait for IT instead. On settlement (success or
 * failure — this registry does not care which), the entry is removed, but
 * only if it is still THIS promise (a newer one may have already replaced
 * it), so cleanup never destroys a newer mutation's entry.
 */
export function registerInFlightPersonalPushMutation(
  key: string | null,
  promise: Promise<unknown>,
  opId?: number,
  trace?: MutationRegistryTraceFn
): void {
  if (!key) return
  const entry: InFlightMutationEntry = { promise, opId }
  inFlightMutations.set(key, entry)
  trace?.("MUTATION_REGISTRY_SET", { actorFamily: actorFamilyFromKey(key), opId: opId ?? null })
  promise.then(
    () => {
      if (inFlightMutations.get(key) === entry) {
        inFlightMutations.delete(key)
        trace?.("MUTATION_REGISTRY_RELEASE", { actorFamily: actorFamilyFromKey(key), opId: opId ?? null })
      }
    },
    () => {
      if (inFlightMutations.get(key) === entry) {
        inFlightMutations.delete(key)
        trace?.("MUTATION_REGISTRY_RELEASE", { actorFamily: actorFamilyFromKey(key), opId: opId ?? null })
      }
    }
  )
}

/**
 * Resolves once any mutation currently registered for `key` has settled —
 * immediately (next microtask) if none is registered. Never rejects and
 * never exposes whether the awaited mutation succeeded or failed: a caller
 * doing a status check must always follow up with its own authoritative
 * read of physical/server state afterwards, never adopt the mutation's own
 * outcome directly.
 */
export function waitForInFlightPersonalPushMutation(key: string | null, trace?: MutationRegistryTraceFn): Promise<void> {
  if (!key) return Promise.resolve()
  const pending = inFlightMutations.get(key)
  if (!pending) {
    trace?.("MUTATION_REGISTRY_WAIT_NOT_FOUND", { actorFamily: actorFamilyFromKey(key) })
    return Promise.resolve()
  }
  trace?.("MUTATION_REGISTRY_WAIT_FOUND", { actorFamily: actorFamilyFromKey(key), opId: pending.opId ?? null })
  return pending.promise.then(
    () => undefined,
    () => undefined
  )
}

/** Test-only: clears all entries so tests don't leak state across files/runs. */
export function __resetInFlightPersonalPushMutationsForTests(): void {
  inFlightMutations.clear()
}

/**
 * P2-T31-R6 (INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC): read-only
 * diagnostic accessor — reports whether a mutation is CURRENTLY registered
 * for `key`, without waiting for it, consuming it, or touching the registry
 * in any way. Exists solely so the push debug panel can display
 * `mutationInFlight` as one field of a snapshot; never used by real
 * subscribe()/unsubscribe()/status-check lifecycle code, which must keep
 * using `waitForInFlightPersonalPushMutation` instead.
 */
export function hasInFlightPersonalPushMutationForDebug(key: string | null): boolean {
  if (!key) return false
  return inFlightMutations.has(key)
}
