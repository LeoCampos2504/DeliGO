// P2-T31-R19 (ANDROID-PUSHMANAGER-ABORTERROR-SINGLE-RETRY-HARDENING): DIRECT
// behavioral tests for `createPhysicalPushSubscriptionWithAbortRecovery` —
// the AT-MOST-ONE-retry wrapper added after a physical Android trace proved
// `PushManager.subscribe()` can reject with `AbortError` twice in a row,
// cross-role (R13: Cliente, R18: Negocio), before ever reaching the backend.
// Same style as `use-push-notifications-physical-subscribe-create-trace.
// test.ts` (this repo has neither jsdom nor React Testing Library): a plain
// fake object stands in for `ServiceWorkerRegistration`, since the function
// only ever touches the narrow `registration.pushManager.{subscribe,
// getSubscription}` shape.
import { beforeEach, describe, expect, test } from "bun:test"
import {
  createPhysicalPushSubscriptionWithAbortRecovery,
  MAX_PHYSICAL_SUBSCRIBE_ATTEMPTS_PER_USER_ACTION,
} from "./use-push-notifications"
import { __resetPushDebugTraceForTests, __setPushDebugTraceStorageForTests, getPushDebugTraceEvents } from "@/lib/push-debug-trace"

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
})

const KEY_A = new Uint8Array([1, 2, 3, 4])
const KEY_B = new Uint8Array([9, 9, 9, 9])

function abortError(message = "Registration failed - push service error") {
  return Object.assign(new Error(message), { name: "AbortError" })
}

function networkError(message = "push service unreachable") {
  return Object.assign(new Error(message), { name: "NetworkError" })
}

/** Builds a fake registration whose `subscribe` and `getSubscription` are
 * driven by ordered queues — `subscribeQueue[0]` answers the first
 * `subscribe()` call, `subscribeQueue[1]` the second (the retry), etc. */
function fakeRegistration(opts: {
  subscribeQueue: Array<() => Promise<unknown>>
  getSubscription?: () => Promise<unknown>
}): { registration: ServiceWorkerRegistration; subscribeCallCount: () => number } {
  let subscribeCalls = 0
  const registration = {
    pushManager: {
      subscribe: async () => {
        const impl = opts.subscribeQueue[subscribeCalls]
        subscribeCalls += 1
        if (!impl) throw new Error("test setup error: no more queued subscribe() responses")
        return impl()
      },
      getSubscription: opts.getSubscription ?? (async () => null),
    },
  } as unknown as ServiceWorkerRegistration
  return { registration, subscribeCallCount: () => subscribeCalls }
}

describe("MAX_PHYSICAL_SUBSCRIBE_ATTEMPTS_PER_USER_ACTION", () => {
  test("is bounded to exactly 2 — never a loop, never a third attempt", () => {
    expect(MAX_PHYSICAL_SUBSCRIBE_ATTEMPTS_PER_USER_ACTION).toBe(2)
  })
})

describe("TEST 1 — first physical subscribe SUCCESS", () => {
  test("subscribe call count = 1, no abort recheck, no retry, success unchanged", async () => {
    const fakeSubscription = { endpoint: "https://push.example/first-success" }
    const { registration, subscribeCallCount } = fakeRegistration({
      subscribeQueue: [async () => fakeSubscription],
    })

    const result = await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, 1)

    expect(result).toBe(fakeSubscription as unknown as PushSubscription)
    expect(subscribeCallCount()).toBe(1)
    const events = getPushDebugTraceEvents().map((e) => e.event)
    expect(events).toEqual(["SUBSCRIBE_PHYSICAL_CREATE_START", "SUBSCRIBE_PHYSICAL_CREATE_RESULT"])
    expect(events.some((e) => e.includes("RECHECK") || e.includes("RETRY"))).toBe(false)
  })
})

describe("TEST 2 — first subscribe AbortError, recheck finds a valid/current subscription", () => {
  test("physical subscribe call count stays 1 (no second subscribe), reuses the recovered subscription, correct trace", async () => {
    const recovered = {
      endpoint: "https://push.example/recovered",
      options: { applicationServerKey: KEY_A.buffer },
    }
    const { registration, subscribeCallCount } = fakeRegistration({
      subscribeQueue: [async () => { throw abortError() }],
      getSubscription: async () => recovered,
    })

    const result = await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, 5)

    expect(result).toBe(recovered as unknown as PushSubscription)
    expect(subscribeCallCount()).toBe(1) // never a second subscribe() call
    const events = getPushDebugTraceEvents()
    expect(events.map((e) => e.event)).toEqual([
      "SUBSCRIBE_PHYSICAL_CREATE_START",
      "SUBSCRIBE_PHYSICAL_CREATE_ERROR",
      "SUBSCRIBE_ABORT_RECHECK_START",
      "SUBSCRIBE_ABORT_RECHECK_RESULT",
    ])
    const recheckResult = events[3]
    expect(recheckResult.fields.found).toBe(true)
    expect(recheckResult.fields.keyIsCurrent).toBe(true)
    // Never the raw endpoint.
    expect(JSON.stringify(recheckResult)).not.toContain("push.example/recovered")
  })
})

describe("TEST 3 — first subscribe AbortError, recheck null, second subscribe SUCCESS", () => {
  test("physical subscribe call count = 2, final success, no error feedback signal (no throw)", async () => {
    const secondSubscription = { endpoint: "https://push.example/retry-success" }
    const { registration, subscribeCallCount } = fakeRegistration({
      subscribeQueue: [async () => { throw abortError() }, async () => secondSubscription],
      getSubscription: async () => null,
    })

    const result = await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, 8)

    expect(result).toBe(secondSubscription as unknown as PushSubscription)
    expect(subscribeCallCount()).toBe(2)
    const events = getPushDebugTraceEvents().map((e) => e.event)
    expect(events).toEqual([
      "SUBSCRIBE_PHYSICAL_CREATE_START",
      "SUBSCRIBE_PHYSICAL_CREATE_ERROR",
      "SUBSCRIBE_ABORT_RECHECK_START",
      "SUBSCRIBE_ABORT_RECHECK_RESULT",
      "SUBSCRIBE_PHYSICAL_RETRY_START",
      "SUBSCRIBE_PHYSICAL_RETRY_RESULT",
    ])
  })
})

describe("TEST 4 — first subscribe AbortError, recheck null, second subscribe AbortError (matches R18's exact physical trace)", () => {
  test("physical subscribe call count = 2, final throw (never a 3rd attempt), correct trace for R13A's failure-state contract downstream", async () => {
    const { registration, subscribeCallCount } = fakeRegistration({
      subscribeQueue: [async () => { throw abortError() }, async () => { throw abortError("second attempt also rejected") }],
      getSubscription: async () => null,
    })

    let caught: unknown
    try {
      await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, 2)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).name).toBe("AbortError")
    expect(subscribeCallCount()).toBe(2) // never a 3rd attempt
    const events = getPushDebugTraceEvents().map((e) => e.event)
    expect(events).toEqual([
      "SUBSCRIBE_PHYSICAL_CREATE_START",
      "SUBSCRIBE_PHYSICAL_CREATE_ERROR",
      "SUBSCRIBE_ABORT_RECHECK_START",
      "SUBSCRIBE_ABORT_RECHECK_RESULT",
      "SUBSCRIBE_PHYSICAL_RETRY_START",
      "SUBSCRIBE_PHYSICAL_RETRY_ERROR",
    ])
    const retryError = getPushDebugTraceEvents()[5]
    expect(retryError.fields.errorClass).toBe("AbortError")
  })
})

describe("TEST 5 — first subscribe non-AbortError", () => {
  test.each(["NetworkError", "NotAllowedError", "InvalidStateError", "NotSupportedError", "SomeWeirdName"] as const)(
    "%s never triggers a retry — call count = 1, rethrows immediately, unchanged from before R19",
    async (errorName) => {
      const original = Object.assign(new Error("detail"), { name: errorName })
      const { registration, subscribeCallCount } = fakeRegistration({
        subscribeQueue: [async () => { throw original }],
      })

      let caught: unknown
      try {
        await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, 3)
      } catch (error) {
        caught = error
      }

      expect(caught).toBe(original)
      expect(subscribeCallCount()).toBe(1)
      const events = getPushDebugTraceEvents().map((e) => e.event)
      expect(events).toEqual(["SUBSCRIBE_PHYSICAL_CREATE_START", "SUBSCRIBE_PHYSICAL_CREATE_ERROR"])
    }
  )

  test("plain NetworkError case matches the exact original R12 contract", async () => {
    const original = networkError()
    const { registration, subscribeCallCount } = fakeRegistration({
      subscribeQueue: [async () => { throw original }],
    })
    let caught: unknown
    try {
      await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, 9)
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(original)
    expect(subscribeCallCount()).toBe(1)
  })
})

describe("TEST 6 — first subscribe AbortError, recheck throws", () => {
  test("second physical subscribe is NEVER attempted — fails closed with the ORIGINAL AbortError", async () => {
    const original = abortError()
    const recheckFailure = Object.assign(new Error("getSubscription unavailable"), { name: "InvalidStateError" })
    const { registration, subscribeCallCount } = fakeRegistration({
      subscribeQueue: [async () => { throw original }],
      getSubscription: async () => { throw recheckFailure },
    })

    let caught: unknown
    try {
      await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, 4)
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(original) // the ORIGINAL AbortError, not the recheck error
    expect(subscribeCallCount()).toBe(1) // fail closed — never a blind retry
    const events = getPushDebugTraceEvents()
    expect(events.map((e) => e.event)).toEqual([
      "SUBSCRIBE_PHYSICAL_CREATE_START",
      "SUBSCRIBE_PHYSICAL_CREATE_ERROR",
      "SUBSCRIBE_ABORT_RECHECK_START",
      "SUBSCRIBE_ABORT_RECHECK_ERROR",
    ])
    expect(events[3].fields.errorClass).toBe("InvalidStateError")
  })
})

describe("TEST 7 — first subscribe AbortError, recheck finds a subscription whose VAPID key does NOT match the current one", () => {
  test("fails closed: no blind retry, no double physical creation, the stale subscription is never touched/destroyed", async () => {
    const staleSubscription = {
      endpoint: "https://push.example/stale",
      options: { applicationServerKey: KEY_B.buffer },
    }
    const unsubscribeSpy = { called: false }
    Object.assign(staleSubscription, {
      unsubscribe: async () => {
        unsubscribeSpy.called = true
        return true
      },
    })
    const original = abortError()
    const { registration, subscribeCallCount } = fakeRegistration({
      subscribeQueue: [async () => { throw original }],
      getSubscription: async () => staleSubscription,
    })

    let caught: unknown
    try {
      // Validate against KEY_A while the found subscription carries KEY_B.
      await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, 6)
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(original) // DECISION: fail closed with the original AbortError
    expect(subscribeCallCount()).toBe(1) // no second subscribe() attempted
    expect(unsubscribeSpy.called).toBe(false) // the ambiguous subscription is never destroyed here
    const events = getPushDebugTraceEvents()
    expect(events.map((e) => e.event)).toEqual([
      "SUBSCRIBE_PHYSICAL_CREATE_START",
      "SUBSCRIBE_PHYSICAL_CREATE_ERROR",
      "SUBSCRIBE_ABORT_RECHECK_START",
      "SUBSCRIBE_ABORT_RECHECK_RESULT",
    ])
    expect(events[3].fields.found).toBe(true)
    expect(events[3].fields.keyIsCurrent).toBe(false)
  })
})

describe("Trace redaction — never the raw endpoint, keys, or subscription JSON", () => {
  test("across every recovery event emitted by this module", async () => {
    const recovered = {
      endpoint: "https://push.example/must-never-leak-this-endpoint",
      options: { applicationServerKey: KEY_A.buffer },
    }
    const { registration } = fakeRegistration({
      subscribeQueue: [async () => { throw abortError() }],
      getSubscription: async () => recovered,
    })

    await createPhysicalPushSubscriptionWithAbortRecovery(registration, KEY_A, 11)

    const serialized = JSON.stringify(getPushDebugTraceEvents())
    expect(serialized).not.toContain("must-never-leak-this-endpoint")
  })
})
