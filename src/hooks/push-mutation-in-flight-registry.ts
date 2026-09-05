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
const inFlightMutations = new Map<string, Promise<unknown>>()

/**
 * Registers `promise` as the current in-flight mutation for `key`. If a
 * newer mutation for the same key is registered before this one settles,
 * this entry is simply overwritten — the newer one is authoritative and a
 * status check should wait for IT instead. On settlement (success or
 * failure — this registry does not care which), the entry is removed, but
 * only if it is still THIS promise (a newer one may have already replaced
 * it), so cleanup never destroys a newer mutation's entry.
 */
export function registerInFlightPersonalPushMutation(key: string | null, promise: Promise<unknown>): void {
  if (!key) return
  inFlightMutations.set(key, promise)
  promise.then(
    () => {
      if (inFlightMutations.get(key) === promise) inFlightMutations.delete(key)
    },
    () => {
      if (inFlightMutations.get(key) === promise) inFlightMutations.delete(key)
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
export function waitForInFlightPersonalPushMutation(key: string | null): Promise<void> {
  if (!key) return Promise.resolve()
  const pending = inFlightMutations.get(key)
  if (!pending) return Promise.resolve()
  return pending.then(
    () => undefined,
    () => undefined
  )
}

/** Test-only: clears all entries so tests don't leak state across files/runs. */
export function __resetInFlightPersonalPushMutationsForTests(): void {
  inFlightMutations.clear()
}
