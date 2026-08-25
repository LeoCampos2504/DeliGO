// P2-T05 Stage3R2 (F-P2-T05-14): DIRECT BEHAVIORAL evidence for the async
// staleness races — exercises real out-of-order Promise resolution against
// the exact orchestration `use-push-notifications.ts` uses, via dependency
// injection. No React/DOM needed (this repo has neither jsdom nor React
// Testing Library) since `checkPersonalPushStatus` + `LatestOperationGate`
// are pure and framework-agnostic — this is not a static/grep-only proof.
import { describe, expect, test } from "bun:test"
import { createLatestOperationGate, type LatestOperationGate } from "./push-operation-guard"
import { checkPersonalPushStatus, type PersonalPushPhysicalSubscription } from "./push-personal-status-check"

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
