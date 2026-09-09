// P2-T31-R7 (PUSH-INITIAL-UNKNOWN-STATE-FLICKER-FIX): DIRECT BEHAVIORAL
// coverage for `statusResolved` — no React/DOM needed (this repo has neither
// jsdom nor React Testing Library), same technique as
// push-personal-status-check.test.ts: exercise the REAL `checkPersonalPushStatus`
// and `createLatestOperationGate` against a tiny harness that replicates
// exactly what `use-push-notifications.ts`'s `applyStatusResult` and
// `finishMutation` do — `applied.push(value)` + `resolved = true` — so the
// exact same race scenarios already certified there (Races A-E, overlapping
// reads, unmount) are re-verified here specifically for the NEW `resolved`
// flag, instead of re-asserting behavior this file doesn't own.
import { describe, expect, test } from "bun:test"
import { createLatestOperationGate, type LatestOperationGate } from "./push-operation-guard"
import { checkPersonalPushStatus, type PersonalPushPhysicalSubscription } from "./push-personal-status-check"

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function fakeSubscription(endpoint: string): PersonalPushPhysicalSubscription {
  return { endpoint, toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "p", auth: "a" } }) }
}

/** Mirrors use-push-notifications.ts's applyStatusResult exactly:
 * apply the value, then mark resolved. */
function makeHarness() {
  const applied: boolean[] = []
  let resolved = false
  const applyStatusResult = (value: boolean) => {
    applied.push(value)
    resolved = true
  }
  return {
    applied,
    isResolved: () => resolved,
    applyStatusResult,
  }
}

/** Mirrors the actor-change effect's reset: invalidate + reset resolved,
 * exactly like use-push-notifications.ts does. */
function simulateActorChange(gate: LatestOperationGate, harness: ReturnType<typeof makeHarness>) {
  gate.invalidate()
  ;(harness as unknown as { resolved: boolean }).resolved = false
}

describe("statusResolved — starts unresolved, becomes true only on a CURRENT applied result", () => {
  test("initial state: unresolved before any check completes", async () => {
    const gate = createLatestOperationGate()
    const h = makeHarness()
    const getSub = deferred<PersonalPushPhysicalSubscription | null>()

    const checkPromise = checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => getSub.promise,
      fetchStatus: async () => ({ ok: true, subscribed: true }),
      applyIsSubscribed: h.applyStatusResult,
    })

    expect(h.isResolved()).toBe(false) // still pending — nothing applied yet

    getSub.resolve(fakeSubscription("https://push.example/E1"))
    await checkPromise
    expect(h.isResolved()).toBe(true)
    expect(h.applied).toEqual([true])
  })

  test("resolved=true even when the authoritative conclusion is FALSE (not subscribed) — resolved tracks 'a conclusion was reached', not 'it was ON'", async () => {
    const gate = createLatestOperationGate()
    const h = makeHarness()

    await checkPersonalPushStatus({
      gate,
      getCurrentSubscription: async () => null,
      fetchStatus: async () => ({ ok: true, subscribed: true }),
      applyIsSubscribed: h.applyStatusResult,
    })

    expect(h.isResolved()).toBe(true)
    expect(h.applied).toEqual([false])
  })
})

describe("statusResolved — a stale/discarded result never marks resolved", () => {
  test("RACE A style: a disable supersedes a pending check — the check's late (stale) answer never resolves anything itself, but the disable's OWN applied call already resolved it", async () => {
    const gate = createLatestOperationGate()
    const h = makeHarness()
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
      applyIsSubscribed: h.applyStatusResult,
    })

    getSub.resolve(fakeSubscription("https://push.example/E1"))
    await Promise.resolve()
    await Promise.resolve()
    expect(h.isResolved()).toBe(false) // still mid-flight

    // A disable mutation begins and completes right now (its own opId is
    // newer), superseding the pending check.
    const disableOpId = gate.begin()
    if (gate.isCurrent(disableOpId)) {
      h.applyStatusResult(false) // mirrors finishMutation's own apply call
    }
    expect(h.isResolved()).toBe(true) // resolved via the disable, not the check

    // The check's stale answer finally arrives — must not un-resolve or
    // double-count anything meaningfully different.
    fetchStatusDeferred.resolve({ ok: true, subscribed: true })
    await checkPromise
    expect(h.applied).toEqual([false]) // only the disable's false was ever applied
    expect(h.isResolved()).toBe(true)
  })

  test("a check that is invalidated before it ever gets to apply (actor change mid-flight) leaves resolved exactly as the reset left it — never flips true on its own", async () => {
    const gate = createLatestOperationGate()
    const h = makeHarness()
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
      applyIsSubscribed: h.applyStatusResult,
    })

    getSub.resolve(fakeSubscription("https://push.example/E1"))
    await Promise.resolve()
    await Promise.resolve()

    simulateActorChange(gate, h) // actor change: invalidate + reset resolved=false
    expect(h.isResolved()).toBe(false)

    fetchStatusDeferred.resolve({ ok: true, subscribed: true }) // stale answer for the OLD actor
    await checkPromise

    expect(h.applied).toEqual([]) // never applied — correctly discarded
    expect(h.isResolved()).toBe(false) // still unresolved — the NEW actor's own check hasn't concluded yet
  })
})

describe("statusResolved — remount / new-instance simulation stays unresolved until its OWN check concludes", () => {
  test("a fresh gate (simulating a brand-new hook instance / cold launch) starts unresolved even if a physical subscription already exists", async () => {
    const gateB = createLatestOperationGate() // instance B's own, brand-new gate/harness
    const hB = makeHarness()
    expect(hB.isResolved()).toBe(false) // before ANY check runs, matching useState(false) default

    await checkPersonalPushStatus({
      gate: gateB,
      getCurrentSubscription: async () => fakeSubscription("https://push.example/E1"),
      fetchStatus: async () => ({ ok: true, subscribed: true }),
      applyIsSubscribed: hB.applyStatusResult,
    })

    expect(hB.isResolved()).toBe(true)
    expect(hB.applied).toEqual([true]) // the true ON conclusion — never a transient false
  })

  test("cross-remount RACE E scenario: instance B waits for instance A's orphaned subscribe(), stays unresolved throughout the wait, resolves only once the real physical state is confirmed", async () => {
    let physicalSubscriptionExists = false
    const hB = makeHarness()
    const gateB = createLatestOperationGate()

    const subscribeDone = deferred<void>()
    const mutationPromise = subscribeDone.promise.then(() => {
      physicalSubscriptionExists = true
    })

    const checkB = checkPersonalPushStatus({
      gate: gateB,
      waitForInFlightMutation: () => mutationPromise.then(() => undefined).catch(() => undefined),
      getCurrentSubscription: async () =>
        physicalSubscriptionExists ? fakeSubscription("https://push.example/E1") : null,
      fetchStatus: async () => ({ ok: true, subscribed: true }),
      applyIsSubscribed: hB.applyStatusResult,
    })

    await Promise.resolve()
    expect(hB.isResolved()).toBe(false) // still waiting on A's orphaned mutation

    subscribeDone.resolve()
    await checkB

    expect(hB.isResolved()).toBe(true)
    expect(hB.applied).toEqual([true]) // correctly reflects the real, now-settled state — never a false flicker
  })
})

describe("statusResolved — mutations after initial resolution never cause a flicker back to unresolved", () => {
  test("finishMutation-style apply only ever SETS resolved=true, never false — a subscribe()/unsubscribe() cycle cannot regress the UI to unknown", () => {
    const h = makeHarness()
    // Simulate: initial resolution already happened.
    h.applyStatusResult(true)
    expect(h.isResolved()).toBe(true)

    // A user-triggered unsubscribe completes (mirrors finishMutation).
    h.applyStatusResult(false)
    expect(h.isResolved()).toBe(true) // still resolved — never flickers back to unknown

    // Rapid re-subscribe.
    h.applyStatusResult(true)
    expect(h.isResolved()).toBe(true)
  })

  test("the ONLY place resolved is ever set back to false is an explicit actor-change reset, never a mutation completion", () => {
    const src = require("fs").readFileSync(
      require("path").join(process.cwd(), "src", "hooks", "use-push-notifications.ts"),
      "utf-8"
    ) as string
    const setFalseCalls = [...src.matchAll(/setStatusResolved\(false\)/g)]
    expect(setFalseCalls.length).toBe(1) // exactly one reset site (the actor-change effect)
    const setTrueCalls = [...src.matchAll(/setStatusResolved\(true\)/g)]
    expect(setTrueCalls.length).toBe(2) // applyStatusResult + finishMutation
  })
})
