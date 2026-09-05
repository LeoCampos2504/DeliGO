// P2-T05 Stage3R2 (F-P2-T05-14): DIRECT BEHAVIORAL evidence for the async
// staleness races — exercises real out-of-order Promise resolution against
// the exact orchestration `use-push-notifications.ts` uses, via dependency
// injection. No React/DOM needed (this repo has neither jsdom nor React
// Testing Library) since `checkPersonalPushStatus` + `LatestOperationGate`
// are pure and framework-agnostic — this is not a static/grep-only proof.
import { afterEach, describe, expect, test } from "bun:test"
import { createLatestOperationGate, type LatestOperationGate } from "./push-operation-guard"
import { checkPersonalPushStatus, type PersonalPushPhysicalSubscription } from "./push-personal-status-check"
import {
  __resetInFlightPersonalPushMutationsForTests,
  registerInFlightPersonalPushMutation,
  waitForInFlightPersonalPushMutation,
} from "./push-mutation-in-flight-registry"

afterEach(() => {
  __resetInFlightPersonalPushMutationsForTests()
})

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function fakeSubscription(endpoint: string): PersonalPushPhysicalSubscription {
  return { endpoint, toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "p", auth: "a" } }) }
}

// Simulates exactly what use-push-notifications.ts's subscribe()/
// unsubscribe() do: begin() synchronously, then — once their own async work
// resolves — apply only if still current.
function simulateGuardedMutation(gate: LatestOperationGate, applyIsSubscribed: (v: boolean) => void, value: boolean) {
  const opId = gate.begin()
  return {
    resolve: () => {
      if (gate.isCurrent(opId)) applyIsSubscribed(value)
    },
  }
}

describe("RACE A — check-then-disable: a stale true response cannot revert a newer disable", () => {
  test("RACE_A_CHECK_THEN_DISABLE", async () => {
    const gate = createLatestOperationGate()
    const applied: boolean[] = []
    let getSubCallCount = 0
    const getSub = deferred<PersonalPushPhysicalSubscription | null>()
    const fetchStatusDeferred = deferred<{ ok: boolean; subscribed: boolean }>()

    const checkPromise = checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => {
        getSubCallCount += 1
        if (getSubCallCount === 1) return getSub.promise
        return fakeSubscription("https://push.example/E1") // endpoint recheck: unchanged
      },
      fetchStatus: async () => fetchStatusDeferred.promise,
      applyIsSubscribed: (v) => applied.push(v),
    })

    // T0: check's first getCurrentSubscription resolves, it moves on to fetchStatus (still pending).
    getSub.resolve(fakeSubscription("https://push.example/E1"))
    await Promise.resolve()
    await Promise.resolve()

    // T1: user clicks "Desactivar" — unsubscribe's own guarded mutation begins and resolves NOW,
    // synchronously invalidating the pending check.
    const disable = simulateGuardedMutation(gate, (v) => applied.push(v), false)
    disable.resolve()

    // T2: the STALE check's server answer arrives late, saying "true" (the pre-disable state).
    fetchStatusDeferred.resolve({ ok: true, subscribed: true })
    await checkPromise

    expect(applied).toEqual([false]) // only the disable's false was ever applied
  })
})

describe("RACE B — check-then-enable: a stale false response cannot revert a newer enable", () => {
  test("RACE_B_CHECK_THEN_ENABLE", async () => {
    const gate = createLatestOperationGate()
    const applied: boolean[] = []
    let getSubCallCount = 0
    const getSub = deferred<PersonalPushPhysicalSubscription | null>()
    const fetchStatusDeferred = deferred<{ ok: boolean; subscribed: boolean }>()

    const checkPromise = checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => {
        getSubCallCount += 1
        if (getSubCallCount === 1) return getSub.promise
        return fakeSubscription("https://push.example/E1")
      },
      fetchStatus: async () => fetchStatusDeferred.promise,
      applyIsSubscribed: (v) => applied.push(v),
    })

    getSub.resolve(fakeSubscription("https://push.example/E1"))
    await Promise.resolve()
    await Promise.resolve()

    const enable = simulateGuardedMutation(gate, (v) => applied.push(v), true)
    enable.resolve()

    fetchStatusDeferred.resolve({ ok: true, subscribed: false }) // stale pre-enable answer
    await checkPromise

    expect(applied).toEqual([true])
  })
})

describe("RACE C — actor A to B: a stale response for A cannot mutate B's UI", () => {
  test("RACE_C_ACTOR_A_TO_B", async () => {
    const gate = createLatestOperationGate()
    const applied: boolean[] = []
    let getSubCallCount = 0
    const getSub = deferred<PersonalPushPhysicalSubscription | null>()
    const fetchStatusDeferred = deferred<{ ok: boolean; subscribed: boolean }>()

    const checkPromiseForA = checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => {
        getSubCallCount += 1
        if (getSubCallCount === 1) return getSub.promise
        return fakeSubscription("https://push.example/E1")
      },
      fetchStatus: async () => fetchStatusDeferred.promise,
      applyIsSubscribed: (v) => applied.push(v),
    })

    getSub.resolve(fakeSubscription("https://push.example/E1"))
    await Promise.resolve()
    await Promise.resolve()

    // Actor switches A -> B: the hook's actor-key effect calls gate.invalidate()
    // (no new "current" operation of its own is minted by the switch itself).
    gate.invalidate()

    // A's stale status response finally arrives.
    fetchStatusDeferred.resolve({ ok: true, subscribed: true })
    await checkPromiseForA

    expect(applied).toEqual([]) // A's response never applied to any UI state
  })
})

describe("RACE D — physical endpoint E1 to E2: a stale E1 response cannot mutate E2's UI", () => {
  test("RACE_D_ENDPOINT_E1_TO_E2", async () => {
    const gate = createLatestOperationGate()
    const applied: boolean[] = []
    let getSubCallCount = 0
    const getSub = deferred<PersonalPushPhysicalSubscription | null>()
    const fetchStatusDeferred = deferred<{ ok: boolean; subscribed: boolean }>()

    const checkPromise = checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => {
        getSubCallCount += 1
        if (getSubCallCount === 1) return getSub.promise
        // Second call = the pre-apply endpoint recheck: the browser's
        // relevant physical subscription has since become E2, with no
        // explicit operation ever having been begun for it.
        return fakeSubscription("https://push.example/E2")
      },
      fetchStatus: async () => fetchStatusDeferred.promise,
      applyIsSubscribed: (v) => applied.push(v),
    })

    getSub.resolve(fakeSubscription("https://push.example/E1"))
    await Promise.resolve()
    await Promise.resolve()

    fetchStatusDeferred.resolve({ ok: true, subscribed: true }) // E1's true answer
    await checkPromise

    expect(applied).toEqual([]) // E1's stale answer never applied once E2 became relevant
  })
})

describe("OVERLAPPING_STATUS_READ_TEST — two concurrent checks, the earlier-started one cannot win", () => {
  test("resolves out of order: check #2 (latest) resolves first, check #1 (stale) resolves last and cannot overwrite", async () => {
    const gate = createLatestOperationGate()
    const applied: boolean[] = []

    const getSub1 = deferred<PersonalPushPhysicalSubscription | null>()
    const fetch1 = deferred<{ ok: boolean; subscribed: boolean }>()
    const check1 = checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => getSub1.promise,
      fetchStatus: async () => fetch1.promise,
      applyIsSubscribed: (v) => applied.push(v),
    })
    getSub1.resolve(fakeSubscription("https://push.example/E1"))
    await Promise.resolve()

    // Check #2 starts (a second checkSubscription() call) before #1 has resolved.
    const check2 = checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => fakeSubscription("https://push.example/E1"),
      fetchStatus: async () => ({ ok: true, subscribed: true }),
      applyIsSubscribed: (v) => applied.push(v),
    })
    await check2 // #2 (latest) resolves first and applies.

    fetch1.resolve({ ok: true, subscribed: false }) // #1's (stale) answer resolves last.
    await check1

    expect(applied).toEqual([true]) // only #2's result was ever applied
  })
})

describe("UNMOUNT_STALE_STATUS_TEST — a pending check resolving after unmount never applies", () => {
  test("UNMOUNT_STALE_STATUS_TEST", async () => {
    const gate = createLatestOperationGate()
    const applied: boolean[] = []
    const getSub = deferred<PersonalPushPhysicalSubscription | null>()
    const fetchStatusDeferred = deferred<{ ok: boolean; subscribed: boolean }>()
    let getSubCallCount = 0

    const checkPromise = checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => {
        getSubCallCount += 1
        if (getSubCallCount === 1) return getSub.promise
        return fakeSubscription("https://push.example/E1")
      },
      fetchStatus: async () => fetchStatusDeferred.promise,
      applyIsSubscribed: (v) => applied.push(v),
    })

    getSub.resolve(fakeSubscription("https://push.example/E1"))
    await Promise.resolve()
    await Promise.resolve()

    // Component unmounts — the hook's cleanup calls gate.invalidate().
    gate.invalidate()

    fetchStatusDeferred.resolve({ ok: true, subscribed: true })
    await checkPromise

    expect(applied).toEqual([])
  })
})

describe("STATUS_FAILURE_PHYSICAL_FALLBACK_REGRESSION — Stage3R1 behavior preserved", () => {
  test("a failed status fetch still applies false, never infers true from physical existence", async () => {
    const gate = createLatestOperationGate()
    const applied: boolean[] = []

    await checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => fakeSubscription("https://push.example/E1"),
      fetchStatus: async () => ({ ok: false, subscribed: false }),
      applyIsSubscribed: (v) => applied.push(v),
    })

    expect(applied).toEqual([false])
  })

  test("no physical subscription -> false, status endpoint never called", async () => {
    const gate = createLatestOperationGate()
    const applied: boolean[] = []
    let fetchCalled = false

    await checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => null,
      fetchStatus: async () => {
        fetchCalled = true
        return { ok: true, subscribed: true }
      },
      applyIsSubscribed: (v) => applied.push(v),
    })

    expect(applied).toEqual([false])
    expect(fetchCalled).toBe(false)
  })
})

// P2-T31-R2 (FIRST-SUBSCRIBE-REMOUNT-STATE): Leonardo's physical Android
// certification found a DIFFERENT race from A-D above: activate -> switch
// shows ON -> navigate away -> navigate back -> switch shows OFF, on a
// FIRST-EVER activation specifically (a subscribe()->deactivate->
// subscribe() cycle does NOT reproduce it). Races A-D above are all
// SAME-instance (one shared gate) — this one is NOT: navigating away from
// the tab that hosts the switch fully unmounts `usePushNotifications()`;
// navigating back mounts a BRAND NEW instance with its OWN brand-new gate,
// generation 0, with zero knowledge of a subscribe() the PREVIOUS instance
// may still have running in the background. A first-ever activation is
// uniquely slow (permission prompt + fresh Service Worker
// register()/ready + a VAPID key fetch + a fresh handshake with the push
// service to mint a physical PushSubscription) compared to any later one
// (which reuses the already-existing physical subscription instantly) —
// slow enough that a user can plausibly navigate away and back before it
// settles.
describe("RACE E — cross-remount: a fresh mount's status check races an orphaned subscribe() from a PREVIOUS (unmounted) instance", () => {
  test("WITHOUT waitForInFlightMutation wired (exactly how 989785a calls checkPersonalPushStatus): the fresh mount's check reads 'no physical subscription yet' and applies false — permanently, since nothing ever re-checks", async () => {
    let physicalSubscriptionExists = false
    const applied: boolean[] = []
    const gateB = createLatestOperationGate() // instance B's own, brand-new gate

    // Instance B mounts and starts its status check BEFORE the orphaned
    // subscribe() (from the already-unmounted instance A) has created the
    // physical subscription.
    await checkPersonalPushStatus({
      gate: gateB,
      getCurrentSubscription: async () =>
        physicalSubscriptionExists ? fakeSubscription("https://push.example/E1") : null,
      fetchStatus: async () => ({ ok: true, subscribed: true }),
      applyIsSubscribed: (v) => applied.push(v),
      // Deliberately NOT passing `waitForInFlightMutation` — the field did
      // not exist at commit 989785a, so this IS how the pre-fix hook called
      // this function.
    })

    expect(applied).toEqual([false]) // wrong: the real subscribe() succeeds moments later

    // The orphaned subscribe() from instance A finally creates the physical
    // subscription — but too late; instance B already applied `false` and
    // nothing observes this.
    physicalSubscriptionExists = true
    expect(applied).toEqual([false]) // still stuck — this IS the physically-reported bug
  })

  test("STALE_STATUS_OVERWRITE_REPRO / WITH waitForInFlightMutation wired to the shared registry (the actual fix): the fresh mount's check waits for the orphaned mutation, then correctly reads the now-settled physical state as subscribed", async () => {
    const actorKey = "cliente:c1"
    let physicalSubscriptionExists = false
    const applied: boolean[] = []

    // Instance A: subscribe() begins (its own gate is irrelevant here — only
    // the promise it registers in the shared registry matters, exactly as
    // use-push-notifications.ts's subscribe() now does).
    const subscribeDone = deferred<void>()
    const mutationPromise = subscribeDone.promise.then(() => {
      physicalSubscriptionExists = true // the mutation's real-world side effect
    })
    registerInFlightPersonalPushMutation(actorKey, mutationPromise)

    // Instance A unmounts here (user navigates away) — its own gate becomes
    // irrelevant from this point on; the orphaned mutationPromise keeps
    // running regardless of any component's lifecycle.

    // Instance B mounts (user navigates back) and starts its OWN status
    // check, wired with waitForInFlightMutation exactly as
    // use-push-notifications.ts's checkSubscription() now does.
    const gateB = createLatestOperationGate()
    const checkB = checkPersonalPushStatus({
      gate: gateB,
      waitForInFlightMutation: () => waitForInFlightPersonalPushMutation(actorKey),
      getCurrentSubscription: async () =>
        physicalSubscriptionExists ? fakeSubscription("https://push.example/E1") : null,
      fetchStatus: async () => ({ ok: true, subscribed: true }),
      applyIsSubscribed: (v) => applied.push(v),
    })

    // The orphaned subscribe() finally settles — AFTER instance B's check
    // already started waiting on it.
    subscribeDone.resolve()
    await checkB

    expect(applied).toEqual([true]) // correctly reflects the real, now-settled state
  })

  test("STALE_STATUS_AFTER_UNSUBSCRIBE_REPRO — symmetric case: a fresh mount's check waits for an orphaned unsubscribe() before concluding subscribed=false", async () => {
    const actorKey = "cliente:c1"
    // Physical subscription still exists when instance B mounts (the
    // orphaned unsubscribe()'s SERVER_DETACH_ONLY policy never destroys it
    // physically) — the check must not conclude `true` just because the
    // physical endpoint is still there while a detach is in flight server-side.
    let backendStillBound = true
    const applied: boolean[] = []

    const unsubscribeDone = deferred<void>()
    const mutationPromise = unsubscribeDone.promise.then(() => {
      backendStillBound = false // the server-side detach's real-world effect
    })
    registerInFlightPersonalPushMutation(actorKey, mutationPromise)

    const gateB = createLatestOperationGate()
    const checkB = checkPersonalPushStatus({
      gate: gateB,
      waitForInFlightMutation: () => waitForInFlightPersonalPushMutation(actorKey),
      getCurrentSubscription: async () => fakeSubscription("https://push.example/E1"),
      fetchStatus: async () => ({ ok: true, subscribed: backendStillBound }),
      applyIsSubscribed: (v) => applied.push(v),
    })

    unsubscribeDone.resolve()
    await checkB

    expect(applied).toEqual([false])
  })

  test("no in-flight mutation for this actor: the check proceeds immediately without waiting (matches the observed passing case — activate/deactivate/activate before navigating)", async () => {
    const applied: boolean[] = []
    const gate = createLatestOperationGate()
    let waited = false

    await checkPersonalPushStatus({
      gate,
      waitForInFlightMutation: () => waitForInFlightPersonalPushMutation("cliente:c1"),
      getCurrentSubscription: async () => {
        waited = true // reached the physical read — the wait did not block anything
        return fakeSubscription("https://push.example/E1")
      },
      fetchStatus: async () => ({ ok: true, subscribed: true }),
      applyIsSubscribed: (v) => applied.push(v),
    })

    expect(waited).toBe(true)
    expect(applied).toEqual([true])
  })
})
