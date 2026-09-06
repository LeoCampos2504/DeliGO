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

// P2-T31-R12 (ANDROID-FIRST-SUBSCRIBE-PHYSICAL-CREATION-FAILURE-DIAGNOSTIC):
// a physical Android trace showed `waitForInFlightPersonalPushMutation`
// resolving near-instantly right after a subscribe() whose own physical
// creation never completed — leaving no way to tell, from that trace alone,
// whether a registration ever actually happened for the key being waited
// on. These tests certify the new (optional, DI'd, never a hidden import)
// trace calls directly against a plain mock — never touching the real
// push-debug-trace module's armed state.
describe("optional trace wiring — MUTATION_REGISTRY_SET/RELEASE/WAIT_FOUND/WAIT_NOT_FOUND", () => {
  function collectingTrace() {
    const calls: Array<{ event: string; fields?: Record<string, unknown> }> = []
    return { calls, trace: (event: string, fields?: Record<string, unknown>) => calls.push({ event, fields }) }
  }

  test("register() with a trace fn records MUTATION_REGISTRY_SET with actor family + opId, never the actor id", () => {
    const { calls, trace } = collectingTrace()
    registerInFlightPersonalPushMutation("cliente:c1", Promise.resolve(), 5, trace)

    expect(calls).toEqual([{ event: "MUTATION_REGISTRY_SET", fields: { actorFamily: "cliente", opId: 5 } }])
  })

  test("no trace fn passed is a safe no-op (every existing caller/test keeps working unmodified)", () => {
    expect(() => registerInFlightPersonalPushMutation("cliente:c1", Promise.resolve())).not.toThrow()
  })

  test("settling the registered promise records MUTATION_REGISTRY_RELEASE with the SAME actor family + opId", async () => {
    const { calls, trace } = collectingTrace()
    const d = deferred<void>()
    registerInFlightPersonalPushMutation("negocio:n9", d.promise, 12, trace)
    d.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(calls).toEqual([
      { event: "MUTATION_REGISTRY_SET", fields: { actorFamily: "negocio", opId: 12 } },
      { event: "MUTATION_REGISTRY_RELEASE", fields: { actorFamily: "negocio", opId: 12 } },
    ])
  })

  test("an OLDER promise settling after being overwritten records NO release (only the current entry's settlement releases)", async () => {
    const { calls, trace } = collectingTrace()
    const first = deferred<void>()
    registerInFlightPersonalPushMutation("cliente:c1", first.promise, 1, trace)
    registerInFlightPersonalPushMutation("cliente:c1", Promise.resolve(), 2, trace)
    first.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(calls.filter((c) => c.event === "MUTATION_REGISTRY_RELEASE")).toEqual([
      { event: "MUTATION_REGISTRY_RELEASE", fields: { actorFamily: "cliente", opId: 2 } },
    ])
  })

  test("waiting with nothing registered records WAIT_NOT_FOUND, never WAIT_FOUND", async () => {
    const { calls, trace } = collectingTrace()
    await waitForInFlightPersonalPushMutation("cliente:c1", trace)

    expect(calls).toEqual([{ event: "MUTATION_REGISTRY_WAIT_NOT_FOUND", fields: { actorFamily: "cliente" } }])
  })

  test("waiting on a real pending mutation records WAIT_FOUND with the REGISTERED mutation's own opId — proves whether a wait actually had something to wait on", async () => {
    const { calls, trace } = collectingTrace()
    const d = deferred<void>()
    registerInFlightPersonalPushMutation("repartidor:r3", d.promise, 42)

    const waitPromise = waitForInFlightPersonalPushMutation("repartidor:r3", trace)
    expect(calls).toEqual([{ event: "MUTATION_REGISTRY_WAIT_FOUND", fields: { actorFamily: "repartidor", opId: 42 } }])

    d.resolve()
    await waitPromise
  })

  test("actor family extraction never includes the actor DB id portion of the key", () => {
    const { calls, trace } = collectingTrace()
    registerInFlightPersonalPushMutation("negocio:actual-db-id-12345", Promise.resolve(), undefined, trace)

    const setCall = calls.find((c) => c.event === "MUTATION_REGISTRY_SET")
    expect(setCall?.fields?.actorFamily).toBe("negocio")
    expect(JSON.stringify(setCall)).not.toContain("actual-db-id-12345")
  })
})
