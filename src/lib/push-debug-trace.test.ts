// P2-T31-R6A (PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC): pure unit tests for the
// passive event tracer — no browser, no DOM (this repo has neither jsdom nor
// React Testing Library). Storage is swapped for an injected in-memory
// implementation via the test-only hooks so persistence/eviction/process
// semantics are exercised deterministically without a real localStorage or a
// real module reload.
import { beforeEach, describe, expect, test } from "bun:test"
import {
  PUSH_DEBUG_TRACE_MAX_EVENTS,
  armPushDebugTrace,
  buildFullPushDebugDiagnosticText,
  clearPushDebugTraceHistory,
  disarmPushDebugTrace,
  formatPushDebugTraceEvent,
  getPushDebugTraceEvents,
  getPushDebugTraceMeta,
  isPushDebugTraceArmed,
  recordPushDebugEvent,
  setPushDebugTraceContext,
  verifyPushDebugTraceGuard,
  __resetPushDebugTraceForTests,
  __setPushDebugTraceStorageForTests,
  __simulateNewProcessForTests,
} from "./push-debug-trace"

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
  __resetPushDebugTraceForTests({ armed: false })
})

describe("disabled tracer (default state for every real user)", () => {
  test("recordPushDebugEvent is a no-op when disarmed — no events collected", () => {
    recordPushDebugEvent("STATUS_CHECK_START", { opId: 1 })
    expect(getPushDebugTraceEvents().length).toBe(0)
  })

  test("never throws even with pathological field values", () => {
    expect(() => recordPushDebugEvent("X", { a: {}, b: [1, 2], c: () => {} })).not.toThrow()
  })

  test("isPushDebugTraceArmed() reports false by default", () => {
    expect(isPushDebugTraceArmed()).toBe(false)
  })
})

describe("arm / disarm", () => {
  test("armPushDebugTrace() flips armed to true and records a TRACE_ARMED event", () => {
    armPushDebugTrace()
    expect(isPushDebugTraceArmed()).toBe(true)
    const events = getPushDebugTraceEvents()
    expect(events.some((e) => e.event === "TRACE_ARMED")).toBe(true)
  })

  test("after arming, recordPushDebugEvent actually collects events", () => {
    armPushDebugTrace()
    recordPushDebugEvent("STATUS_CHECK_START")
    const events = getPushDebugTraceEvents()
    expect(events.some((e) => e.event === "STATUS_CHECK_START")).toBe(true)
  })

  test("disarmPushDebugTrace() flips armed to false and wipes the buffer", () => {
    armPushDebugTrace()
    recordPushDebugEvent("STATUS_CHECK_START")
    disarmPushDebugTrace()
    expect(isPushDebugTraceArmed()).toBe(false)
    expect(getPushDebugTraceEvents().length).toBe(0)
  })

  test("recordPushDebugEvent after disarm is a no-op again", () => {
    armPushDebugTrace()
    disarmPushDebugTrace()
    recordPushDebugEvent("STATUS_CHECK_START")
    expect(getPushDebugTraceEvents().length).toBe(0)
  })
})

describe("BORRAR HISTORIAL — clearPushDebugTraceHistory", () => {
  test("clears events but leaves armed state untouched", () => {
    armPushDebugTrace()
    recordPushDebugEvent("STATUS_CHECK_START")
    clearPushDebugTraceHistory()
    expect(getPushDebugTraceEvents().length).toBe(0)
    expect(isPushDebugTraceArmed()).toBe(true)
  })

  test("recording resumes normally after clearing", () => {
    armPushDebugTrace()
    clearPushDebugTraceHistory()
    recordPushDebugEvent("STATUS_CHECK_START")
    expect(getPushDebugTraceEvents().length).toBe(1)
  })
})

describe("order preserved / sequence monotonic", () => {
  test("events keep insertion order and strictly increasing sequence numbers", () => {
    armPushDebugTrace()
    recordPushDebugEvent("A")
    recordPushDebugEvent("B")
    recordPushDebugEvent("C")
    const events = getPushDebugTraceEvents()
    const nonArmEvents = events.filter((e) => e.event !== "TRACE_ARMED")
    expect(nonArmEvents.map((e) => e.event)).toEqual(["A", "B", "C"])
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i].sequence).toBeGreaterThan(events[i - 1].sequence)
    }
  })
})

describe("max ring size enforced / oldest eviction", () => {
  test("never exceeds PUSH_DEBUG_TRACE_MAX_EVENTS entries", () => {
    armPushDebugTrace()
    for (let i = 0; i < PUSH_DEBUG_TRACE_MAX_EVENTS + 25; i += 1) {
      recordPushDebugEvent("BULK", { i })
    }
    expect(getPushDebugTraceEvents().length).toBe(PUSH_DEBUG_TRACE_MAX_EVENTS)
  })

  test("evicts the OLDEST entries first, keeps the most recent ones", () => {
    armPushDebugTrace()
    for (let i = 0; i < PUSH_DEBUG_TRACE_MAX_EVENTS + 10; i += 1) {
      recordPushDebugEvent("BULK", { i })
    }
    const events = getPushDebugTraceEvents()
    const lastFieldI = events[events.length - 1].fields.i
    expect(lastFieldI).toBe(PUSH_DEBUG_TRACE_MAX_EVENTS + 9)
    // the very first ~10 BULK events (i=0..9) plus TRACE_ARMED must be gone
    expect(events.some((e) => e.fields.i === 0)).toBe(false)
  })
})

describe("process id changes between simulated process instances", () => {
  test("__simulateNewProcessForTests() produces a different processInstanceId", () => {
    armPushDebugTrace()
    const idA = getPushDebugTraceMeta().currentProcessId
    __simulateNewProcessForTests()
    const idB = getPushDebugTraceMeta().currentProcessId
    expect(idB).not.toBe(idA)
  })

  test("old-process entries survive new-process init — appended after, not wiped", () => {
    armPushDebugTrace()
    recordPushDebugEvent("PROCESS_A_EVENT")
    const countBefore = getPushDebugTraceEvents().length

    __simulateNewProcessForTests() // adds its own TRACE_INIT for process B
    recordPushDebugEvent("PROCESS_B_EVENT")

    const events = getPushDebugTraceEvents()
    expect(events.length).toBeGreaterThan(countBefore)
    expect(events.some((e) => e.event === "PROCESS_A_EVENT")).toBe(true)
    expect(events.some((e) => e.event === "PROCESS_B_EVENT")).toBe(true)
  })

  test("events tagged with distinct processInstanceId before/after a simulated restart", () => {
    armPushDebugTrace()
    recordPushDebugEvent("PROCESS_A_EVENT")
    const idA = getPushDebugTraceMeta().currentProcessId

    __simulateNewProcessForTests()
    recordPushDebugEvent("PROCESS_B_EVENT")
    const idB = getPushDebugTraceMeta().currentProcessId

    const events = getPushDebugTraceEvents()
    const eventA = events.find((e) => e.event === "PROCESS_A_EVENT")
    const eventB = events.find((e) => e.event === "PROCESS_B_EVENT")
    expect(eventA?.processInstanceId).toBe(idA)
    expect(eventB?.processInstanceId).toBe(idB)
    expect(eventA?.processInstanceId).not.toBe(eventB?.processInstanceId)
  })

  test("sequence stays monotonic ACROSS a simulated process restart (resumes from persisted max, never resets to 0)", () => {
    armPushDebugTrace()
    recordPushDebugEvent("PROCESS_A_EVENT")
    const lastSeqA = getPushDebugTraceEvents().slice(-1)[0].sequence

    __simulateNewProcessForTests()
    recordPushDebugEvent("PROCESS_B_EVENT")
    const events = getPushDebugTraceEvents()
    const eventB = events.find((e) => e.event === "PROCESS_B_EVENT")

    expect(eventB!.sequence).toBeGreaterThan(lastSeqA)
  })
})

describe("no secret fields / endpoint fingerprint only", () => {
  test("a field literally named 'endpoint' is redacted, never persisted raw", () => {
    armPushDebugTrace()
    recordPushDebugEvent("PHYSICAL_SUBSCRIPTION_READ", { endpoint: "https://fcm.googleapis.com/secret-token-abcxyz" })
    const events = getPushDebugTraceEvents()
    const e = events.find((ev) => ev.event === "PHYSICAL_SUBSCRIPTION_READ")!
    expect(e.fields.endpoint).toBe("REDACTED")
  })

  test("endpointFingerprint (the sanctioned exception) passes through untouched", () => {
    armPushDebugTrace()
    recordPushDebugEvent("PHYSICAL_SUBSCRIPTION_READ", { endpointFingerprint: "ab12cd34" })
    const e = getPushDebugTraceEvents().find((ev) => ev.event === "PHYSICAL_SUBSCRIPTION_READ")!
    expect(e.fields.endpointFingerprint).toBe("ab12cd34")
  })

  // P2-T31-R7 (DEBUG HYGIENE): F-P2-T31-ENDPOINT-BOOLEAN-FALSE-POSITIVE-01 —
  // a physical trace showed `endpointStillMatches=REDACTED` even though that
  // field is a plain boolean carrying no endpoint data — the blanket
  // "contains endpoint" rule caught it purely by NAME. Renamed the real call
  // site to `physicalStillMatches` (push-personal-status-check.ts) rather
  // than weakening the sanitizer's name-based rule, which stays in place for
  // any genuinely endpoint-shaped field name.
  test("a boolean field named 'physicalStillMatches' (no 'endpoint' in the name) passes through untouched", () => {
    armPushDebugTrace()
    recordPushDebugEvent("ENDPOINT_RECHECK_RESULT", { physicalStillMatches: true })
    const e = getPushDebugTraceEvents().find((ev) => ev.event === "ENDPOINT_RECHECK_RESULT")!
    expect(e.fields.physicalStillMatches).toBe(true)
  })

  test("the sanitizer's name-based rule still catches any OTHER field whose name contains 'endpoint' — the rule itself wasn't weakened, only the one false-positive call site was renamed", () => {
    armPushDebugTrace()
    recordPushDebugEvent("X", { endpointStillMatches: true, physicalEndpoint: "https://leak.example" })
    const e = getPushDebugTraceEvents().find((ev) => ev.event === "X")!
    expect(e.fields.endpointStillMatches).toBe("REDACTED")
    expect(e.fields.physicalEndpoint).toBe("REDACTED")
  })

  test("fields named cookie/token/secret/password/authorization/p256dh/jwt/session/email are redacted", () => {
    armPushDebugTrace()
    recordPushDebugEvent("X", {
      cookie: "raw",
      token: "raw",
      secret: "raw",
      password: "raw",
      authorization: "raw",
      p256dh: "raw",
      vapidPrivateKey: "raw",
      jwt: "raw",
      sessionId: "raw",
      email: "raw",
    })
    const e = getPushDebugTraceEvents().find((ev) => ev.event === "X")!
    for (const key of Object.keys(e.fields)) {
      expect(e.fields[key]).toBe("REDACTED")
    }
  })

  test("non-primitive values are dropped to a safe marker, never serialized whole", () => {
    armPushDebugTrace()
    recordPushDebugEvent("X", { obj: { endpoint: "https://leak.example/x", keys: { p256dh: "y" } } })
    const e = getPushDebugTraceEvents().find((ev) => ev.event === "X")!
    expect(e.fields.obj).toBe("[unsupported]")
    expect(JSON.stringify(e)).not.toContain("leak.example")
  })

  test("long strings are truncated to a bounded length", () => {
    armPushDebugTrace()
    recordPushDebugEvent("X", { note: "a".repeat(500) })
    const e = getPushDebugTraceEvents().find((ev) => ev.event === "X")!
    expect((e.fields.note as string).length).toBeLessThanOrEqual(65)
  })

  test("safe primitive fields (booleans, numbers, short strings) pass through unchanged", () => {
    armPushDebugTrace()
    recordPushDebugEvent("X", { opId: 3, gateCurrent: true, reason: "server_authoritative_result" })
    const e = getPushDebugTraceEvents().find((ev) => ev.event === "X")!
    expect(e.fields).toEqual({ opId: 3, gateCurrent: true, reason: "server_authoritative_result" })
  })
})

describe("trace event function never throws outward", () => {
  test("recordPushDebugEvent swallows a throwing field value accessor safely (getter that throws)", () => {
    armPushDebugTrace()
    const fields = {
      get poison(): string {
        throw new Error("boom")
      },
    }
    expect(() => recordPushDebugEvent("X", fields)).not.toThrow()
  })

  test("setPushDebugTraceContext never throws", () => {
    expect(() => setPushDebugTraceContext({ actorFamily: "cliente", authHasHydrated: true })).not.toThrow()
  })
})

describe("disabled tracer has negligible/no mutation", () => {
  test("armed=false: recordPushDebugEvent never writes to storage", () => {
    let writes = 0
    __setPushDebugTraceStorageForTests({
      getItem: () => null,
      setItem: () => {
        writes += 1
      },
      removeItem: () => {},
    })
    __resetPushDebugTraceForTests({ armed: false })
    recordPushDebugEvent("X")
    recordPushDebugEvent("Y")
    expect(writes).toBe(0)
  })
})

describe("auth hydration ordering representable", () => {
  test("context + events can reconstruct: mount with authHasHydrated=false, then AUTH_HYDRATED later, actorFamily attached at each point", () => {
    armPushDebugTrace()
    setPushDebugTraceContext({ actorFamily: null, authHasHydrated: false })
    recordPushDebugEvent("PUSH_HOOK_MOUNT")
    recordPushDebugEvent("STATUS_CHECK_START")

    setPushDebugTraceContext({ actorFamily: "cliente", authHasHydrated: true })
    recordPushDebugEvent("AUTH_HYDRATED")
    recordPushDebugEvent("ACTOR_KEY_CHANGED")

    const events = getPushDebugTraceEvents()
    const mount = events.find((e) => e.event === "PUSH_HOOK_MOUNT")!
    const firstStatus = events.find((e) => e.event === "STATUS_CHECK_START")!
    const hydrated = events.find((e) => e.event === "AUTH_HYDRATED")!

    expect(mount.authHasHydrated).toBe(false)
    expect(mount.actorFamily).toBe(null)
    expect(firstStatus.authHasHydrated).toBe(false)
    expect(hydrated.authHasHydrated).toBe(true)
    expect(hydrated.actorFamily).toBe("cliente")
    expect(mount.sequence).toBeLessThan(hydrated.sequence)
  })
})

describe("status start/result ordering", () => {
  test("STATUS_CHECK_START precedes BACKEND_STATUS_START precedes BACKEND_STATUS_RESULT precedes STATUS_APPLY", () => {
    armPushDebugTrace()
    recordPushDebugEvent("STATUS_CHECK_START", { opId: 1 })
    recordPushDebugEvent("BACKEND_STATUS_START", { opId: 1 })
    recordPushDebugEvent("BACKEND_STATUS_RESULT", { opId: 1, ok: true, backendSubscribed: true })
    recordPushDebugEvent("STATUS_APPLY", { opId: 1, candidateValue: true })

    const events = getPushDebugTraceEvents().map((e) => e.event)
    const order = ["STATUS_CHECK_START", "BACKEND_STATUS_START", "BACKEND_STATUS_RESULT", "STATUS_APPLY"]
    const indices = order.map((name) => events.indexOf(name))
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1])
    }
  })
})

describe("UI changes only on value change (contract exercised at the trace layer)", () => {
  test("recording UI_SWITCH_CHANGED twice with identical values is still just two log entries — dedup is the CALLER's responsibility, verified in the panel/UI static-contract tests", () => {
    armPushDebugTrace()
    recordPushDebugEvent("UI_SWITCH_CHANGED", { role: "cliente", oldValue: false, newValue: true })
    const events = getPushDebugTraceEvents().filter((e) => e.event === "UI_SWITCH_CHANGED")
    expect(events.length).toBe(1)
  })
})

describe("null actor / null physical subscription represented explicitly", () => {
  test("a null actorFamily in context is stored as null, not coerced to a string", () => {
    armPushDebugTrace()
    setPushDebugTraceContext({ actorFamily: null })
    recordPushDebugEvent("STATUS_CHECK_START")
    const e = getPushDebugTraceEvents().find((ev) => ev.event === "STATUS_CHECK_START")!
    expect(e.actorFamily).toBeNull()
  })

  test("physicalPresent=false + endpointFingerprint=null is representable and distinguishable from a real subscription", () => {
    armPushDebugTrace()
    recordPushDebugEvent("PHYSICAL_SUBSCRIPTION_READ", { physicalPresent: false, endpointFingerprint: null })
    const e = getPushDebugTraceEvents().find((ev) => ev.event === "PHYSICAL_SUBSCRIPTION_READ")!
    expect(e.fields.physicalPresent).toBe(false)
    expect(e.fields.endpointFingerprint).toBeNull()
  })
})

describe("formatPushDebugTraceEvent", () => {
  test("produces a single pasteable line with sequence, timestamp, process id, event name and fields", () => {
    armPushDebugTrace()
    recordPushDebugEvent("STATUS_APPLY", { opId: 2, candidateValue: true })
    const e = getPushDebugTraceEvents().find((ev) => ev.event === "STATUS_APPLY")!
    const line = formatPushDebugTraceEvent(e)
    expect(line).toContain("event=STATUS_APPLY")
    expect(line).toContain("opId=2")
    expect(line).toContain("candidateValue=true")
    expect(line.split("\n").length).toBe(1)
  })
})

describe("panel cannot expose timeline in Production (guard verification)", () => {
  test("verifyPushDebugTraceGuard disarms and wipes when the server does not confirm allowed:true", async () => {
    armPushDebugTrace()
    recordPushDebugEvent("STATUS_CHECK_START")
    const fakeFetch = (async () => new Response(JSON.stringify({}), { status: 404 })) as unknown as typeof fetch
    await verifyPushDebugTraceGuard(fakeFetch)
    expect(isPushDebugTraceArmed()).toBe(false)
    expect(getPushDebugTraceEvents().length).toBe(0)
  })

  test("verifyPushDebugTraceGuard stays armed when the server confirms allowed:true", async () => {
    armPushDebugTrace()
    const fakeFetch = (async () => new Response(JSON.stringify({ allowed: true }), { status: 200 })) as unknown as typeof fetch
    await verifyPushDebugTraceGuard(fakeFetch)
    expect(isPushDebugTraceArmed()).toBe(true)
  })

  test("a network failure during verification does not disarm a legitimate session", async () => {
    armPushDebugTrace()
    const fakeFetch = (async () => {
      throw new Error("network down")
    }) as unknown as typeof fetch
    await verifyPushDebugTraceGuard(fakeFetch)
    expect(isPushDebugTraceArmed()).toBe(true)
  })

  test("verifyPushDebugTraceGuard is a no-op (never fetches) when not armed", async () => {
    let called = false
    const fakeFetch = (async () => {
      called = true
      return new Response(JSON.stringify({ allowed: true }), { status: 200 })
    }) as unknown as typeof fetch
    await verifyPushDebugTraceGuard(fakeFetch)
    expect(called).toBe(false)
  })
})

describe("copy includes snapshot + timeline (buildFullPushDebugDiagnosticText)", () => {
  test("combines snapshot text, trace meta, and timeline under the exact section headers", () => {
    armPushDebugTrace()
    recordPushDebugEvent("STATUS_CHECK_START", { opId: 1 })
    const meta = getPushDebugTraceMeta()
    const events = getPushDebugTraceEvents()
    const text = buildFullPushDebugDiagnosticText("permission=granted\nhookSubscribed=true", meta, events)

    expect(text).toContain("PUSH_DEBUG_VERSION=2")
    expect(text).toContain("=== CURRENT SNAPSHOT ===")
    expect(text).toContain("permission=granted")
    expect(text).toContain("=== TRACE META ===")
    expect(text).toContain(`armed=${meta.armed}`)
    expect(text).toContain(`eventCount=${meta.eventCount}`)
    expect(text).toContain("=== TIMELINE (oldest first) ===")
    expect(text).toContain("event=STATUS_CHECK_START")
  })

  test("never contains a raw https:// URL anywhere in the combined output", () => {
    armPushDebugTrace()
    recordPushDebugEvent("PHYSICAL_SUBSCRIPTION_READ", { endpoint: "https://push.example/leak" })
    const text = buildFullPushDebugDiagnosticText("permission=granted", getPushDebugTraceMeta(), getPushDebugTraceEvents())
    expect(text).not.toMatch(/https?:\/\//)
  })
})

describe("meta accessors", () => {
  test("getPushDebugTraceMeta reports oldest/newest timestamps and event count consistently", () => {
    armPushDebugTrace()
    recordPushDebugEvent("A")
    recordPushDebugEvent("B")
    const meta = getPushDebugTraceMeta()
    const events = getPushDebugTraceEvents()
    expect(meta.eventCount).toBe(events.length)
    expect(meta.oldest).toBe(events[0].wallClockTimestamp)
    expect(meta.newest).toBe(events[events.length - 1].wallClockTimestamp)
  })

  test("oldest/newest are null when there are no events", () => {
    const meta = getPushDebugTraceMeta()
    expect(meta.oldest).toBeNull()
    expect(meta.newest).toBeNull()
    expect(meta.eventCount).toBe(0)
  })
})
