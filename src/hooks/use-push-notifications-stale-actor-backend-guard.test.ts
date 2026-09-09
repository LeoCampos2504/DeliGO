// P2-T31-R19R (ABORTERROR-RETRY-STALE-ACTOR-BACKEND-GUARD): DIRECT and
// COMPOSED behavioral tests proving that a `subscribe()` operation that
// becomes stale (actor change / logout / a newer mutation) — at ANY point
// before the backend bind, including mid-flight during R19's AbortError
// retry window — never writes a `PushSubscription` binding to the backend.
// Same style as the rest of this suite (no jsdom/React Testing Library): a
// plain fake object stands in for `ServiceWorkerRegistration`, and the REAL
// `LatestOperationGate` (from push-operation-guard.ts, not a mock) drives
// staleness — exactly the same object `subscribe()` itself uses.
import { beforeEach, describe, expect, test } from "bun:test"
import { createLatestOperationGate, type LatestOperationGate } from "./push-operation-guard"
import {
  __resetInFlightPersonalPushMutationsForTests,
  hasInFlightPersonalPushMutationForDebug,
  registerInFlightPersonalPushMutation,
} from "./push-mutation-in-flight-registry"
import {
  bindPhysicalPushSubscriptionToBackend,
  createPhysicalPushSubscriptionWithAbortRecovery,
} from "./use-push-notifications"
import {
  __resetPushDebugTraceForTests,
  __setPushDebugTraceStorageForTests,
  getPushDebugTraceEvents,
  recordPushDebugEvent,
} from "@/lib/push-debug-trace"

function freshStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
  }
}

beforeEach(() => {
  __setPushDebugTraceStorageForTests(freshStorage())
  __resetPushDebugTraceForTests({ armed: true })
  __resetInFlightPersonalPushMutationsForTests()
})

const KEY_A = new Uint8Array([1, 2, 3, 4])

function abortError(message = "Registration failed - push service error") {
  return Object.assign(new Error(message), { name: "AbortError" })
}

/** Counts `begin()` calls on a REAL gate, without changing its behavior —
 * used to prove neither helper ever mints a second high-level operation. */
function spyOnGateBegin(gate: LatestOperationGate): { gate: LatestOperationGate; beginCallCount: () => number } {
  let count = 0
  return {
    gate: {
      begin: () => {
        count += 1
        return gate.begin()
      },
      isCurrent: (id: number) => gate.isCurrent(id),
      invalidate: () => gate.invalidate(),
    },
    beginCallCount: () => count,
  }
}

function backendSpy(result: { ok: boolean; status: number } = { ok: true, status: 200 }) {
  const calls: Array<{ url: string; body: string }> = []
  return {
    postSubscribe: async (url: string, body: string) => {
      calls.push({ url, body })
      return result
    },
    calls,
  }
}

/** Counts MUTATION_REGISTRY_SET/RELEASE trace events emitted by the REAL
 * `push-mutation-in-flight-registry.ts` (never a mock of that module) —
 * used to assert SET/RELEASE counts directly instead of only inferring them
 * from `gate.begin()` counts. */
function countingRegistryTrace() {
  let setCount = 0
  let releaseCount = 0
  const events: string[] = []
  const trace = (event: string, _fields?: Record<string, unknown>) => {
    events.push(event)
    if (event === "MUTATION_REGISTRY_SET") setCount += 1
    if (event === "MUTATION_REGISTRY_RELEASE") releaseCount += 1
  }
  return { trace, setCount: () => setCount, releaseCount: () => releaseCount, events }
}

/**
 * P2-T31-R19R1 (EXPLICIT-MUTATION-REGISTRY-SET-RELEASE-COVERAGE): a
 * minimal TEST-ONLY harness that composes the SAME real, already-exported
 * production functions `subscribe()` itself calls, in the SAME order —
 * `createPhysicalPushSubscriptionWithAbortRecovery` (R19) →
 * `bindPhysicalPushSubscriptionToBackend` (R19R) →
 * `registerInFlightPersonalPushMutation` (R2, real registry, never mocked)
 * — so the registry's SET/RELEASE lifecycle can be observed directly for
 * the exact composed scenario TEST 8 of the R19R mandate asked for,
 * without needing React/DOM to exercise the real `subscribe()` closure
 * (this repo has neither jsdom nor React Testing Library). This is
 * deliberately NOT a mock that only reproduces the desired outcome — every
 * function it calls is the real, already-tested production implementation;
 * this harness only supplies the glue `subscribe()`'s own `run()` provides
 * for free inside its closure. No production code was changed to make this
 * possible — all 3 composed functions were already exported.
 */
async function runLikeSubscribeHighLevelOperation(opts: {
  gate: LatestOperationGate
  opId: number
  actorKey: string | null
  actorType: string | null
  registration: ServiceWorkerRegistration
  applicationServerKey: Uint8Array
  postSubscribe: (url: string, body: string) => Promise<{ ok: boolean; status: number }>
  trace: (event: string, fields?: Record<string, unknown>) => void
}): Promise<{ current: boolean; subscribed: boolean }> {
  const run = async (): Promise<{ current: boolean; subscribed: boolean }> => {
    try {
      const subscription = await createPhysicalPushSubscriptionWithAbortRecovery(
        opts.registration,
        opts.applicationServerKey,
        opts.opId
      )
      const bindResult = await bindPhysicalPushSubscriptionToBackend({
        gate: opts.gate,
        opId: opts.opId,
        actorType: opts.actorType,
        subscription,
        postSubscribe: opts.postSubscribe,
        trace: opts.trace,
      })
      if (!bindResult.posted) return { current: false, subscribed: false }
      if (!bindResult.ok) throw new Error("backend rejected")
      return { current: opts.gate.isCurrent(opts.opId), subscribed: true }
    } catch {
      return { current: opts.gate.isCurrent(opts.opId), subscribed: false }
    }
  }

  const mutationPromise = run()
  registerInFlightPersonalPushMutation(opts.actorKey, mutationPromise, opts.opId, opts.trace)
  return mutationPromise
}

describe("MUTATION_REGISTRY_SET_RELEASE — explicit real-registry coverage (R19R1, TEST 8 of the R19R mandate)", () => {
  test("stale-during-AbortError-retry composed flow: SET count=1, RELEASE count=1, final entry absent, backend call count still 0", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin()
    const actorKey = "negocio:actor-r19r1-stale"

    let resolveRetry!: (value: unknown) => void
    const retryPending = new Promise((resolve) => {
      resolveRetry = resolve
    })
    let subscribeCalls = 0
    const registration = {
      pushManager: {
        subscribe: async () => {
          subscribeCalls += 1
          if (subscribeCalls === 1) throw abortError() // physical attempt 1 -> AbortError
          return retryPending // physical attempt 2 -> genuinely pending
        },
        getSubscription: async () => null, // post-abort recheck -> null
      },
    } as unknown as ServiceWorkerRegistration

    const backend = backendSpy()
    const { trace, setCount, releaseCount } = countingRegistryTrace()

    const mutationPromise = runLikeSubscribeHighLevelOperation({
      gate,
      opId,
      actorKey,
      actorType: "negocio",
      registration,
      applicationServerKey: KEY_A,
      postSubscribe: backend.postSubscribe,
      trace,
    })

    // Let the AbortError + recheck + retry-start sequence run up to the
    // point where the retry's own subscribe() promise is genuinely pending.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(subscribeCalls).toBe(2) // the retry has started, is now pending
    expect(setCount()).toBe(1) // SET already fired synchronously when the high-level operation began
    expect(hasInFlightPersonalPushMutationForDebug(actorKey)).toBe(true) // still in flight

    // The actor/operation becomes stale WHILE the retry is still pending.
    gate.invalidate()

    // The retry NOW resolves with a genuinely valid physical subscription.
    resolveRetry({ endpoint: "https://push.example/r19r1-post-stale-retry-success" })
    const result = await mutationPromise

    expect(backend.calls.length).toBe(0) // STALE_DURING_ABORT_RETRY_BACKEND_CALL_COUNT preserved
    expect(result).toEqual({ current: false, subscribed: false })
    expect(setCount()).toBe(1) // MUTATION_REGISTRY_SET_COUNT_STALE_ABORT_RETRY
    expect(releaseCount()).toBe(1) // MUTATION_REGISTRY_RELEASE_COUNT_STALE_ABORT_RETRY
    expect(hasInFlightPersonalPushMutationForDebug(actorKey)).toBe(false) // MUTATION_REGISTRY_FINAL_ENTRY_EXISTS = NO
  })

  test("normal successful high-level subscribe: SET count=1, RELEASE count=1, final entry absent", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin()
    const actorKey = "cliente:actor-r19r1-normal"

    const registration = {
      pushManager: {
        subscribe: async () => ({ endpoint: "https://push.example/r19r1-normal-success" }),
        getSubscription: async () => null,
      },
    } as unknown as ServiceWorkerRegistration
    const backend = backendSpy({ ok: true, status: 200 })
    const { trace, setCount, releaseCount } = countingRegistryTrace()

    const result = await runLikeSubscribeHighLevelOperation({
      gate,
      opId,
      actorKey,
      actorType: "cliente",
      registration,
      applicationServerKey: KEY_A,
      postSubscribe: backend.postSubscribe,
      trace,
    })

    expect(result).toEqual({ current: true, subscribed: true })
    expect(backend.calls.length).toBe(1)
    expect(setCount()).toBe(1) // MUTATION_REGISTRY_SET_COUNT_NORMAL_SUCCESS
    expect(releaseCount()).toBe(1) // MUTATION_REGISTRY_RELEASE_COUNT_NORMAL_SUCCESS
    expect(hasInFlightPersonalPushMutationForDebug(actorKey)).toBe(false) // MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_NORMAL_SUCCESS = NO
  })
})

describe("PRE_BACKEND_STALE_OPERATION_GUARD_EXISTS_BEFORE_R19R — direct unit tests of bindPhysicalPushSubscriptionToBackend", () => {
  test("current operation: posts to backend exactly once, correct trace, result carries ok/status", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin()
    const backend = backendSpy({ ok: true, status: 200 })
    const subscription = { endpoint: "https://push.example/current" } as unknown as PushSubscription

    const result = await bindPhysicalPushSubscriptionToBackend({
      gate,
      opId,
      actorType: "cliente",
      subscription,
      postSubscribe: backend.postSubscribe,
    })

    expect(result).toEqual({ posted: true, ok: true, status: 200 })
    expect(backend.calls.length).toBe(1)
    expect(backend.calls[0].url).toBe("/api/push/subscribe?actorFamily=cliente")
  })

  test("stale operation (gate already invalidated): NEVER calls postSubscribe — backend call count = 0", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin()
    gate.invalidate() // a newer operation/actor superseded this one
    const backend = backendSpy()
    const subscription = { endpoint: "https://push.example/stale" } as unknown as PushSubscription

    const result = await bindPhysicalPushSubscriptionToBackend({
      gate,
      opId,
      actorType: "cliente",
      subscription,
      postSubscribe: backend.postSubscribe,
      trace: recordPushDebugEvent,
    })

    expect(result).toEqual({ posted: false, ok: false })
    expect(backend.calls.length).toBe(0)
    const events = getPushDebugTraceEvents()
    expect(events.map((e) => e.event)).toEqual(["SUBSCRIBE_BACKEND_SKIPPED_STALE"])
    expect(events[0].fields.actorFamily).toBe("cliente")
    expect(events[0].fields.opId).toBe(opId)
  })

  test("backend rejects (non-ok): posted=true so the caller can throw PushMutationHttpError with the real status", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin()
    const backend = backendSpy({ ok: false, status: 500 })
    const subscription = { endpoint: "https://push.example/reject" } as unknown as PushSubscription

    const result = await bindPhysicalPushSubscriptionToBackend({
      gate,
      opId,
      actorType: null,
      subscription,
      postSubscribe: backend.postSubscribe,
    })

    expect(result).toEqual({ posted: true, ok: false, status: 500 })
    expect(backend.calls.length).toBe(1)
    expect(backend.calls[0].url).toBe("/api/push/subscribe") // no actorFamily selector when actorType is null
  })
})

describe("TEST 9 — stale during the R19 AbortError retry window (composed, real gate + real retry helper)", () => {
  test("A-K: current start, AbortError, recheck-null, retry PENDING, actor goes stale mid-flight, retry resolves SUCCESS -> backend call count = 0, no success feedback signal, gate correctly reports stale", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin() // A: operation begins current

    let resolveRetry!: (value: unknown) => void
    const retryPending = new Promise((resolve) => {
      resolveRetry = resolve
    })
    let subscribeCalls = 0
    const registration = {
      pushManager: {
        subscribe: async () => {
          subscribeCalls += 1
          if (subscribeCalls === 1) {
            throw abortError() // B: first physical attempt -> AbortError
          }
          // D: second physical attempt (the retry) does not resolve yet.
          return retryPending
        },
        getSubscription: async () => null, // C: post-abort recheck confirms null
      },
    } as unknown as ServiceWorkerRegistration

    const createPromise = createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, opId)

    // Let the AbortError + recheck + retry-start sequence run up to the
    // point where the retry's own subscribe() promise is genuinely pending.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(subscribeCalls).toBe(2) // the retry has started, is now pending

    // E: the actor/operation becomes stale WHILE the retry is still pending
    // — e.g. a logout, an actor switch, or a newer mutation starting.
    gate.invalidate()
    expect(gate.isCurrent(opId)).toBe(false)

    // F: the retry NOW resolves with a genuinely valid physical subscription.
    const secondSubscription = { endpoint: "https://push.example/post-stale-retry-success" }
    resolveRetry(secondSubscription)
    const subscription = await createPromise
    expect(subscription).toBe(secondSubscription as unknown as PushSubscription)

    // Backend bind must see the operation is stale and refuse to post.
    const backend = backendSpy()
    const bindResult = await bindPhysicalPushSubscriptionToBackend({
      gate,
      opId,
      actorType: "negocio",
      subscription,
      postSubscribe: backend.postSubscribe,
      trace: recordPushDebugEvent,
    })

    // G: backend subscribe call count = 0.
    expect(backend.calls.length).toBe(0)
    // H/I: no success signal of any kind — `posted:false` is the ONLY
    // outcome; the caller (subscribe()'s real code) never reaches the
    // toast.success/applySubscribed(true) branch when `posted` is false.
    expect(bindResult).toEqual({ posted: false, ok: false })
    // K: the gate's own stale contract — a result "for" the actor that owned
    // this opId is definitively not current.
    expect(gate.isCurrent(opId)).toBe(false)

    const events = getPushDebugTraceEvents().map((e) => e.event)
    expect(events).toEqual([
      "SUBSCRIBE_PHYSICAL_CREATE_START",
      "SUBSCRIBE_PHYSICAL_CREATE_ERROR",
      "SUBSCRIBE_ABORT_RECHECK_START",
      "SUBSCRIBE_ABORT_RECHECK_RESULT",
      "SUBSCRIBE_PHYSICAL_RETRY_START",
      "SUBSCRIBE_PHYSICAL_RETRY_RESULT",
      "SUBSCRIBE_BACKEND_SKIPPED_STALE",
    ])
  })

  test("J: no new high-level operation is ever minted across creation + bind — gate.begin() is called exactly once (by the test itself)", async () => {
    const realGate = createLatestOperationGate()
    const { gate, beginCallCount } = spyOnGateBegin(realGate)
    const opId = gate.begin() // the ONE high-level mutation begin() — TEST harness itself
    expect(beginCallCount()).toBe(1)

    const fakeSubscription = { endpoint: "https://push.example/single-op" }
    const registration = {
      pushManager: {
        subscribe: async () => fakeSubscription,
        getSubscription: async () => null,
      },
    } as unknown as ServiceWorkerRegistration

    const subscription = await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, opId)
    const backend = backendSpy()
    await bindPhysicalPushSubscriptionToBackend({ gate, opId, actorType: "cliente", subscription, postSubscribe: backend.postSubscribe })

    // Neither helper ever calls gate.begin() — proves MUTATION_REGISTRY_
    // SINGLE_HIGH_LEVEL_OPERATION: both physical attempts and the backend
    // bind belong to the SAME opId the caller minted once.
    expect(beginCallCount()).toBe(1)
    expect(backend.calls.length).toBe(1)
  })
})

describe("PREEXISTING_STALE_BACKEND_BIND_GAP_EXPOSED_DURING_R19_REVIEW — stale AFTER a normal, single-attempt physical SUCCESS (no AbortError at all)", () => {
  test("STALE_AFTER_FIRST_PHYSICAL_SUCCESS_BACKEND_CALL_COUNT=0 — proves the guard is not artificially tied to the R19 retry path", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin()

    const fakeSubscription = { endpoint: "https://push.example/plain-success" }
    const registration = {
      pushManager: {
        subscribe: async () => fakeSubscription, // succeeds on the FIRST attempt — no AbortError involved at all
        getSubscription: async () => null,
      },
    } as unknown as ServiceWorkerRegistration

    const subscription = await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, opId)

    // The actor/operation becomes stale AFTER the physical subscription
    // already exists, but BEFORE the backend bind — the exact same window
    // that existed in this codebase before R19 ever introduced a retry
    // (this gap is not new; R19 only made the window longer for the
    // AbortError case — see TEST 9 above).
    gate.invalidate()

    const backend = backendSpy()
    const bindResult = await bindPhysicalPushSubscriptionToBackend({
      gate,
      opId,
      actorType: "repartidor",
      subscription,
      postSubscribe: backend.postSubscribe,
    })

    expect(backend.calls.length).toBe(0)
    expect(bindResult).toEqual({ posted: false, ok: false })
  })
})

describe("Backend call counts — every scenario asserted explicitly, not just by inspection", () => {
  test("FIRST_SUCCESS_BACKEND_CALL_COUNT=1", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin()
    const registration = {
      pushManager: { subscribe: async () => ({ endpoint: "https://push.example/a" }), getSubscription: async () => null },
    } as unknown as ServiceWorkerRegistration
    const subscription = await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, opId)
    const backend = backendSpy()
    const result = await bindPhysicalPushSubscriptionToBackend({ gate, opId, actorType: "cliente", subscription, postSubscribe: backend.postSubscribe })
    expect(backend.calls.length).toBe(1)
    expect(result.posted).toBe(true)
  })

  test("ABORT_RECHECK_FOUND_VALID_BACKEND_CALL_COUNT=1", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin()
    const recovered = { endpoint: "https://push.example/b", options: { applicationServerKey: KEY_A.buffer } }
    let subscribeCalls = 0
    const registration = {
      pushManager: {
        subscribe: async () => {
          subscribeCalls += 1
          throw abortError()
        },
        getSubscription: async () => recovered,
      },
    } as unknown as ServiceWorkerRegistration
    const subscription = await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, opId)
    expect(subscribeCalls).toBe(1) // recovered via recheck, never a 2nd subscribe()
    const backend = backendSpy()
    const result = await bindPhysicalPushSubscriptionToBackend({ gate, opId, actorType: "cliente", subscription, postSubscribe: backend.postSubscribe })
    expect(backend.calls.length).toBe(1)
    expect(result.posted).toBe(true)
  })

  test("ABORT_RETRY_SUCCESS_BACKEND_CALL_COUNT=1", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin()
    let subscribeCalls = 0
    const registration = {
      pushManager: {
        subscribe: async () => {
          subscribeCalls += 1
          if (subscribeCalls === 1) throw abortError()
          return { endpoint: "https://push.example/c" }
        },
        getSubscription: async () => null,
      },
    } as unknown as ServiceWorkerRegistration
    const subscription = await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, opId)
    expect(subscribeCalls).toBe(2)
    const backend = backendSpy()
    const result = await bindPhysicalPushSubscriptionToBackend({ gate, opId, actorType: "cliente", subscription, postSubscribe: backend.postSubscribe })
    expect(backend.calls.length).toBe(1)
    expect(result.posted).toBe(true)
  })

  test("ABORT_RETRY_DOUBLE_FAIL_BACKEND_CALL_COUNT=0 — creation throws, bind is never even reached", async () => {
    const gate = createLatestOperationGate()
    const opId = gate.begin()
    const registration = {
      pushManager: {
        subscribe: async () => {
          throw abortError()
        },
        getSubscription: async () => null,
      },
    } as unknown as ServiceWorkerRegistration
    const backend = backendSpy()
    let caught: unknown
    try {
      const subscription = await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, opId)
      // Structurally unreachable if creation throws — asserted below anyway.
      await bindPhysicalPushSubscriptionToBackend({ gate, opId, actorType: "cliente", subscription, postSubscribe: backend.postSubscribe })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(Error)
    expect(backend.calls.length).toBe(0) // bind's postSubscribe was never invoked
  })
})
