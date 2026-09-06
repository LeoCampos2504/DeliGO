// P2-T31-R2 (FIRST-SUBSCRIBE-REMOUNT-STATE): pure unit tests for the
// in-flight-mutation registry — no React/DOM needed (this repo has neither
// jsdom nor React Testing Library), same style as push-operation-guard.test.ts.
import { afterEach, describe, expect, test } from "bun:test"
import {
  __resetInFlightPersonalPushMutationsForTests,
  hasInFlightPersonalPushMutationForDebug,
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

describe("waitForInFlightPersonalPushMutation — no registration", () => {
  test("resolves immediately when nothing is registered for the key", async () => {
    let resolved = false
    await waitForInFlightPersonalPushMutation("cliente:c1").then(() => {
      resolved = true
    })
    expect(resolved).toBe(true)
  })

  test("resolves immediately for a null key (never blocks an unauthenticated/unknown actor)", async () => {
    let resolved = false
    await waitForInFlightPersonalPushMutation(null).then(() => {
      resolved = true
    })
    expect(resolved).toBe(true)
  })
})

describe("waitForInFlightPersonalPushMutation — a registered mutation is awaited", () => {
  test("does not resolve before the registered promise settles, resolves right after", async () => {
    const d = deferred<void>()
    registerInFlightPersonalPushMutation("cliente:c1", d.promise)

    let resolved = false
    const waitPromise = waitForInFlightPersonalPushMutation("cliente:c1").then(() => {
      resolved = true
    })

    await Promise.resolve()
    await Promise.resolve()
    expect(resolved).toBe(false) // still pending — the mutation hasn't settled yet

    d.resolve()
    await waitPromise
    expect(resolved).toBe(true)
  })

  test("a REJECTED mutation is still awaited without propagating the rejection", async () => {
    const d = deferred<void>()
    registerInFlightPersonalPushMutation("cliente:c1", d.promise)

    let resolved = false
    let threw = false
    const waitPromise = waitForInFlightPersonalPushMutation("cliente:c1")
      .then(() => {
        resolved = true
      })
      .catch(() => {
        threw = true
      })

    d.reject(new Error("simulated mutation failure"))
    await waitPromise

    expect(resolved).toBe(true)
    expect(threw).toBe(false)
  })

  test("a DIFFERENT key's wait is unaffected by another key's in-flight mutation", async () => {
    const d = deferred<void>()
    registerInFlightPersonalPushMutation("cliente:c1", d.promise)

    let resolvedForOtherKey = false
    await waitForInFlightPersonalPushMutation("cliente:c2").then(() => {
      resolvedForOtherKey = true
    })

    expect(resolvedForOtherKey).toBe(true) // never blocked by c1's still-pending mutation
  })
})

describe("registerInFlightPersonalPushMutation — latest-wins overwrite semantics", () => {
  test("a newer registration for the same key replaces the older one — the wait targets the newer promise", async () => {
    const first = deferred<void>()
    const second = deferred<void>()

    registerInFlightPersonalPushMutation("cliente:c1", first.promise)
    registerInFlightPersonalPushMutation("cliente:c1", second.promise)

    let resolved = false
    const waitPromise = waitForInFlightPersonalPushMutation("cliente:c1").then(() => {
      resolved = true
    })

    await Promise.resolve()
    await Promise.resolve()
    first.resolve() // resolving the OLDER promise must not unblock the wait
    await Promise.resolve()
    await Promise.resolve()
    expect(resolved).toBe(false)

    second.resolve()
    await waitPromise
    expect(resolved).toBe(true)
  })

  test("the older promise settling does not delete the newer entry (cleanup only removes an entry if it is still the exact promise registered)", async () => {
    const first = deferred<void>()
    const second = deferred<void>()

    registerInFlightPersonalPushMutation("cliente:c1", first.promise)
    registerInFlightPersonalPushMutation("cliente:c1", second.promise)
    first.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // The registry entry must still be `second` — a fresh wait must still block on it.
    let resolved = false
    const waitPromise = waitForInFlightPersonalPushMutation("cliente:c1").then(() => {
      resolved = true
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(resolved).toBe(false)

    second.resolve()
    await waitPromise
    expect(resolved).toBe(true)
  })
})

describe("registerInFlightPersonalPushMutation — self-cleanup after settling", () => {
  test("once the registered promise settles, a later wait for the same key resolves immediately (entry removed)", async () => {
    const d = deferred<void>()
    registerInFlightPersonalPushMutation("cliente:c1", d.promise)
    d.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    let resolved = false
    await waitForInFlightPersonalPushMutation("cliente:c1").then(() => {
      resolved = true
    })
    expect(resolved).toBe(true)
  })

  test("a null key is a safe no-op to register (never throws, never registers anything waitable elsewhere)", () => {
    expect(() => registerInFlightPersonalPushMutation(null, Promise.resolve())).not.toThrow()
  })
})

// P2-T31-R6 (INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC): the read-only
// debug accessor must never wait, never consume, and never mutate the
// registry — only report the current boolean.
describe("hasInFlightPersonalPushMutationForDebug — read-only, never mutates", () => {
  test("false when nothing is registered", () => {
    expect(hasInFlightPersonalPushMutationForDebug("cliente:c1")).toBe(false)
  })

  test("false for a null key", () => {
    expect(hasInFlightPersonalPushMutationForDebug(null)).toBe(false)
  })

  test("true while a mutation is registered for that exact key", () => {
    const d = deferred<void>()
    registerInFlightPersonalPushMutation("cliente:c1", d.promise)
    expect(hasInFlightPersonalPushMutationForDebug("cliente:c1")).toBe(true)
    d.resolve()
  })

  test("false for a different key even while another key has one in flight", () => {
    const d = deferred<void>()
    registerInFlightPersonalPushMutation("cliente:c1", d.promise)
    expect(hasInFlightPersonalPushMutationForDebug("cliente:c2")).toBe(false)
    d.resolve()
  })

  test("calling it repeatedly does not consume/clear the entry — a real wait still blocks afterwards", async () => {
    const d = deferred<void>()
    registerInFlightPersonalPushMutation("cliente:c1", d.promise)
    hasInFlightPersonalPushMutationForDebug("cliente:c1")
    hasInFlightPersonalPushMutationForDebug("cliente:c1")

    let resolved = false
    const waitPromise = waitForInFlightPersonalPushMutation("cliente:c1").then(() => {
      resolved = true
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(resolved).toBe(false)

    d.resolve()
    await waitPromise
    expect(resolved).toBe(true)
  })

  test("becomes false again once the mutation settles", async () => {
    const d = deferred<void>()
    registerInFlightPersonalPushMutation("cliente:c1", d.promise)
    expect(hasInFlightPersonalPushMutationForDebug("cliente:c1")).toBe(true)
    d.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(hasInFlightPersonalPushMutationForDebug("cliente:c1")).toBe(false)
  })
})
