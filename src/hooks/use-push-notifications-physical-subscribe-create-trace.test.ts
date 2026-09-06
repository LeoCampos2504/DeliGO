// P2-T31-R12 (ANDROID-FIRST-SUBSCRIBE-PHYSICAL-CREATION-FAILURE-DIAGNOSTIC):
// DIRECT behavioral tests for the two helpers this diagnostic task added —
// `classifyPushSubscribeError` (pure) and `createPhysicalPushSubscription`
// (brackets the exact `PushManager.subscribe()` call a physical Android
// trace proved can go dark with no result AND no error ever recorded). No
// React/DOM needed (this repo has neither jsdom nor React Testing Library):
// `createPhysicalPushSubscription` only ever touches the narrow
// `registration.pushManager.subscribe(...)` shape passed to it, so a plain
// fake object stands in for a real ServiceWorkerRegistration.
import { beforeEach, describe, expect, test } from "bun:test"
import { classifyPushSubscribeError, createPhysicalPushSubscription } from "./use-push-notifications"
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

function fakeRegistration(subscribeImpl: () => Promise<unknown>): ServiceWorkerRegistration {
  return {
    pushManager: { subscribe: subscribeImpl },
  } as unknown as ServiceWorkerRegistration
}

describe("classifyPushSubscribeError — bounded to the 6 safe categories, never raw message text", () => {
  test.each([
    ["NotAllowedError", "NotAllowedError"],
    ["AbortError", "AbortError"],
    ["InvalidStateError", "InvalidStateError"],
    ["NotSupportedError", "NotSupportedError"],
    ["NetworkError", "NetworkError"],
  ] as const)("maps a DOMException-like error named %s to itself", (name, expected) => {
    const error = Object.assign(new Error("some detail that must never leak"), { name })
    expect(classifyPushSubscribeError(error)).toBe(expected)
  })

  test("an unrecognized Error name falls back to Other", () => {
    const error = Object.assign(new Error("secret detail"), { name: "SomeWeirdNativeName" })
    expect(classifyPushSubscribeError(error)).toBe("Other")
  })

  test("a non-Error throw falls back to Other", () => {
    expect(classifyPushSubscribeError("a plain string throw")).toBe("Other")
    expect(classifyPushSubscribeError(undefined)).toBe("Other")
  })
})

describe("createPhysicalPushSubscription — success path", () => {
  test("records START then RESULT (no ERROR), and returns the subscription unchanged", async () => {
    const fakeSubscription = { endpoint: "https://push.example/abc" }
    const registration = fakeRegistration(async () => fakeSubscription)

    const result = await createPhysicalPushSubscription(registration, new Uint8Array([1, 2, 3]), 7)

    expect(result).toBe(fakeSubscription as unknown as PushSubscription)
    const events = getPushDebugTraceEvents().map((e) => e.event)
    expect(events).toEqual(["SUBSCRIBE_PHYSICAL_CREATE_START", "SUBSCRIBE_PHYSICAL_CREATE_RESULT"])
    expect(getPushDebugTraceEvents()[0].fields.opId).toBe(7)
    expect(getPushDebugTraceEvents()[1].fields.opId).toBe(7)
  })
})

describe("createPhysicalPushSubscription — throw path", () => {
  test("records START then ERROR with a safe error class, rethrows the ORIGINAL error unchanged, and never records RESULT", async () => {
    const original = Object.assign(new Error("push service unreachable"), { name: "NetworkError" })
    const registration = fakeRegistration(async () => {
      throw original
    })

    let caught: unknown
    try {
      await createPhysicalPushSubscription(registration, new Uint8Array([1, 2, 3]), 9)
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(original)
    const events = getPushDebugTraceEvents()
    expect(events.map((e) => e.event)).toEqual(["SUBSCRIBE_PHYSICAL_CREATE_START", "SUBSCRIBE_PHYSICAL_CREATE_ERROR"])
    expect(events[1].fields.errorClass).toBe("NetworkError")
    expect(events[1].fields.opId).toBe(9)
    // P2-T31-R12 §17: proves "no backend call if physical creation fails" —
    // the caller's own SUBSCRIBE_BACKEND_START only ever fires AFTER this
    // helper resolves; a throw here never reaches that point structurally,
    // and this trace confirms no RESULT (the only signal the caller uses to
    // continue toward the backend fetch) was ever recorded either.
    expect(events.some((e) => e.event === "SUBSCRIBE_PHYSICAL_CREATE_RESULT")).toBe(false)
  })

  test("P2-T31-R13: a real PushManager AbortError rejection classifies exactly as AbortError, matching the physical Android capture", async () => {
    // Mirrors the exact DOMException shape the browser raised in the R13
    // physical trace: SUBSCRIBE_PHYSICAL_CREATE_START -> ERROR (errorClass=
    // AbortError) in ~287ms, no RESULT, no backend call ever attempted.
    const domExceptionLike = Object.assign(new Error("Registration failed - push service error"), {
      name: "AbortError",
    })
    const registration = fakeRegistration(async () => {
      throw domExceptionLike
    })

    let caught: unknown
    try {
      await createPhysicalPushSubscription(registration, new Uint8Array([1, 2, 3]), 2)
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(domExceptionLike)
    const events = getPushDebugTraceEvents()
    expect(events.map((e) => e.event)).toEqual(["SUBSCRIBE_PHYSICAL_CREATE_START", "SUBSCRIBE_PHYSICAL_CREATE_ERROR"])
    expect(events[1].fields.errorClass).toBe("AbortError")
    // Never the raw message — bounded to the safe class only.
    expect(JSON.stringify(events[1])).not.toContain("Registration failed")
  })

  test("pending forever (never settles) never records RESULT or ERROR — matches the exact unexplained gap from the Android physical trace", async () => {
    const registration = fakeRegistration(() => new Promise(() => {}))

    const promise = createPhysicalPushSubscription(registration, new Uint8Array([1, 2, 3]), 3)

    await Promise.resolve()
    await Promise.resolve()
    const events = getPushDebugTraceEvents().map((e) => e.event)
    expect(events).toEqual(["SUBSCRIBE_PHYSICAL_CREATE_START"])
    // Never resolved deliberately — nothing left to await; the point of this
    // test is only the trace state while it is genuinely still pending.
    void promise
  })
})
