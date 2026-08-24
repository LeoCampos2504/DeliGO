import { describe, expect, test } from "bun:test"
import type { ChatMessage } from "@/store/chat-store"
import type { RealtimeResyncReason } from "./realtime-types"
import {
  ACTIVE_HISTORY_SAFETY_INTERVAL_MS,
  ACTIVE_HISTORY_SINGLE_REQUEST_DEADLINE_MS,
  ACTIVE_HISTORY_CONFIGURED_SAFETY_CADENCE_SECONDS,
  ACTIVE_HISTORY_SAFETY_ATTEMPT_START_BOUND_SECONDS,
  ACTIVE_HISTORY_FIRST_SUCCESSFUL_SAFETY_ATTEMPT_RECOVERY_BOUND_SECONDS,
  buildHistoryRequestQuery,
  buildLocalIdSet,
  buildLocalIndexMap,
  createCoverageToken,
  createHistoryCoordinatorState,
  evaluateHistoryResponse,
  isFreshCoverageSignal,
  isHistoryResyncReasonAllowed,
  reconcileHistoryMessages,
  resetHistoryCoordinatorState,
  resolveCoverageBaseline,
  runHistoryRequestWithDeadline,
  settleHistoryFetch,
  triggerSafetyIntervalTick,
  triggerSemanticHistoryFetch,
  type RequestDeadlineDeps,
} from "./chat-history-resync"

// Every scenario below is a pure function/state-machine of explicit inputs
// — no real sleeps, no DOM, no new test dependency. Timer-dependent
// behavior (the deadline mechanism) uses an injected fake clock instead of
// real setTimeout. See CODEX_REPORT.md, "SHARED REALTIME — CHAT
// ACTIVE-MESSAGE RESYNC — V6 LOCAL IMPLEMENTATION FINAL".

function msg(id: string, fecha: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    pedidoId: "pedido-1",
    remitente: "cliente",
    texto: `text-${id}`,
    imagenUrl: null,
    archivoUrl: null,
    archivoNombre: null,
    archivoTipo: null,
    leido: false,
    fecha,
    clienteId: null,
    ...extra,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface FakeTimer {
  id: number
  ms: number
  cb: () => void
}

function createFakeClock() {
  let scheduled: FakeTimer[] = []
  let nextId = 1
  const deps: RequestDeadlineDeps = {
    setTimeoutImpl: (cb, ms) => {
      const id = nextId++
      scheduled.push({ id, ms, cb })
      return id
    },
    clearTimeoutImpl: (handle) => {
      scheduled = scheduled.filter((t) => t.id !== handle)
    },
  }
  return {
    deps,
    scheduledCount: () => scheduled.length,
    scheduledDelays: () => scheduled.map((t) => t.ms),
    fireAll: () => {
      for (const t of [...scheduled]) t.cb()
    },
  }
}

// ============================================
// 1. Constants
// ============================================
describe("frozen V6 constants", () => {
  test("1. safety interval is exactly 90000ms and request deadline is exactly 10000ms", () => {
    expect(ACTIVE_HISTORY_SAFETY_INTERVAL_MS).toBe(90000)
    expect(ACTIVE_HISTORY_SINGLE_REQUEST_DEADLINE_MS).toBe(10000)
  })

  test("corrected liveness terminology: cadence 90s, attempt-start bound 100s (P+T), completion bound 110s (P+2T)", () => {
    expect(ACTIVE_HISTORY_CONFIGURED_SAFETY_CADENCE_SECONDS).toBe(90)
    expect(ACTIVE_HISTORY_SAFETY_ATTEMPT_START_BOUND_SECONDS).toBe(100)
    expect(ACTIVE_HISTORY_FIRST_SUCCESSFUL_SAFETY_ATTEMPT_RECOVERY_BOUND_SECONDS).toBe(110)
  })
})

// ============================================
// 2-9. Resync-reason allowlist
// ============================================
describe("isHistoryResyncReasonAllowed — explicit fail-closed policy", () => {
  const allReasons: RealtimeResyncReason[] = [
    "initial-connect",
    "reconnect",
    "reauth",
    "room-rejoin",
    "foreground",
    "online",
    "suspected-gap",
    "manual",
  ]

  test("2. before exact coverage: only online is allowed", () => {
    const allowedBefore = allReasons.filter((r) => isHistoryResyncReasonAllowed(r, false))
    expect(allowedBefore).toEqual(["online"])
  })

  test("3. after exact coverage: online and room-rejoin are allowed", () => {
    const allowedAfter = allReasons.filter((r) => isHistoryResyncReasonAllowed(r, true))
    const expected: RealtimeResyncReason[] = ["online", "room-rejoin"]
    expect([...allowedAfter].sort()).toEqual([...expected].sort())
  })

  test("4. initial-connect denied before and after exact coverage", () => {
    expect(isHistoryResyncReasonAllowed("initial-connect", false)).toBe(false)
    expect(isHistoryResyncReasonAllowed("initial-connect", true)).toBe(false)
  })

  test("5. reauth denied before and after exact coverage", () => {
    expect(isHistoryResyncReasonAllowed("reauth", false)).toBe(false)
    expect(isHistoryResyncReasonAllowed("reauth", true)).toBe(false)
  })

  test("6. online allowed before and after exact coverage", () => {
    expect(isHistoryResyncReasonAllowed("online", false)).toBe(true)
    expect(isHistoryResyncReasonAllowed("online", true)).toBe(true)
  })

  test("7. room-rejoin denied before exact coverage", () => {
    expect(isHistoryResyncReasonAllowed("room-rejoin", false)).toBe(false)
  })

  test("8. room-rejoin allowed after exact coverage", () => {
    expect(isHistoryResyncReasonAllowed("room-rejoin", true)).toBe(true)
  })

  test("9. suspected-gap, manual, reconnect, and foreground denied regardless of coverage state", () => {
    for (const reason of ["suspected-gap", "manual", "reconnect", "foreground"] as RealtimeResyncReason[]) {
      expect(isHistoryResyncReasonAllowed(reason, false)).toBe(false)
      expect(isHistoryResyncReasonAllowed(reason, true)).toBe(false)
    }
  })
})

// ============================================
// 10-18. Semantic single-flight + queued catch-up coordinator
// ============================================
describe("history coordinator — single-flight and queued semantic catch-up", () => {
  test("10. semantic signal while idle -> request wanted (start)", () => {
    const state = createHistoryCoordinatorState<number>()
    const { state: next, action } = triggerSemanticHistoryFetch(state, 1)
    expect(action).toEqual({ type: "start", token: 1 })
    expect(next.currentToken).toBe(1)
    expect(next.pendingSemantic).toBe(false)
  })

  test("11. semantic signal while busy -> queued, exactly one pending, no parallel start", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    const { state: next, action } = triggerSemanticHistoryFetch(state, 2)
    expect(action).toEqual({ type: "queue" })
    expect(next.currentToken).toBe(1) // unchanged — no parallel request
    expect(next.pendingSemantic).toBe(true)
  })

  test("12. many semantic signals while busy coalesce into ONE pending flag, not a count", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    state = triggerSemanticHistoryFetch(state, 2).state
    state = triggerSemanticHistoryFetch(state, 3).state
    state = triggerSemanticHistoryFetch(state, 4).state
    expect(state.pendingSemantic).toBe(true)
    expect(state.currentToken).toBe(1)
    // settling now must launch exactly one follow-up
    const { action } = settleHistoryFetch(state, 1, 5)
    expect(action).toEqual({ type: "start", token: 5 })
  })

  test("13. current success (settle) + pending -> exactly one follow-up", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    state = triggerSemanticHistoryFetch(state, 2).state // pending=true
    const { state: next, action } = settleHistoryFetch(state, 1, 3)
    expect(action).toEqual({ type: "start", token: 3 })
    expect(next.currentToken).toBe(3)
    expect(next.pendingSemantic).toBe(false)
  })

  test("14. current failure (settle) + pending -> exactly one follow-up (TO1: identical to success path)", () => {
    // settleHistoryFetch takes no outcome parameter at all — proving the
    // pure contract structurally cannot distinguish success/failure/timeout.
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    state = triggerSemanticHistoryFetch(state, 2).state
    const { action } = settleHistoryFetch(state, 1, 3)
    expect(action).toEqual({ type: "start", token: 3 })
  })

  test("15. current failure (settle) with no pending -> no follow-up, fully idle", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    const { state: next, action } = settleHistoryFetch(state, 1, 2)
    expect(action).toEqual({ type: "noop" })
    expect(next.currentToken).toBeNull()
    expect(next.pendingSemantic).toBe(false)
  })

  test("16. 90s interval tick while busy -> skipped, never sets pending, never queues a follow-up", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    const { state: next, action } = triggerSafetyIntervalTick(state, 99)
    expect(action).toEqual({ type: "noop" })
    expect(next).toEqual(state) // completely untouched
    expect(next.pendingSemantic).toBe(false)
    // settling afterwards produces NO follow-up attributable to the skipped tick
    const settled = settleHistoryFetch(next, 1, 2)
    expect(settled.action).toEqual({ type: "noop" })
  })

  test("90s interval tick while idle -> starts a request", () => {
    const state = createHistoryCoordinatorState<number>()
    const { action } = triggerSafetyIntervalTick(state, 1)
    expect(action).toEqual({ type: "start", token: 1 })
  })

  test("17. a second semantic signal arriving during the follow-up queues exactly one more follow-up", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    state = triggerSemanticHistoryFetch(state, 2).state // pending
    state = settleHistoryFetch(state, 1, 3).state // follow-up R2 (token=3) starts
    expect(state.currentToken).toBe(3)
    // a fresh signal arrives while R2 is in flight
    state = triggerSemanticHistoryFetch(state, 4).state
    expect(state.pendingSemantic).toBe(true)
    const { action } = settleHistoryFetch(state, 3, 5)
    expect(action).toEqual({ type: "start", token: 5 }) // exactly one R3, never more
  })

  test("18. lifecycle invalidation (reset) clears pending, and any later stale settlement is ignored", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    state = triggerSemanticHistoryFetch(state, 2).state // pending=true, request token=1 in flight
    const reset = resetHistoryCoordinatorState<number>()
    expect(reset.currentToken).toBeNull()
    expect(reset.pendingSemantic).toBe(false)
    // the OLD request (token=1) later settles against the NEW (reset) state -> stale, ignored
    const { action } = settleHistoryFetch(reset, 1, 6)
    expect(action).toEqual({ type: "stale" })
  })

  test("a stale settlement from a superseded request never mutates the newer request's ownership", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state // R1 (token=1)
    // R1's own late/stale settlement arrives AFTER something else already
    // replaced state.currentToken with a different token (e.g. a fresh
    // lifecycle's own mount request) — simulate that directly:
    const superseded: typeof state = { currentToken: 42, pendingSemantic: false }
    const { state: next, action } = settleHistoryFetch(superseded, 1, 7)
    expect(action).toEqual({ type: "stale" })
    expect(next).toEqual(superseded) // untouched
  })
})

// ============================================
// 19-30. Reconciliation V3 / ORDER3_A
// ============================================
describe("reconcileHistoryMessages — V3 / ORDER3_A", () => {
  test("19. cross-fecha: server fecha ASC authority is never violated by client stability", () => {
    const previousLocalIndexMap = buildLocalIndexMap([
      msg("A", "2024-01-01T10:00:00.000Z"),
      msg("B", "2024-01-01T10:02:00.000Z"),
    ])
    const serverMessages = [
      msg("A", "2024-01-01T10:00:00.000Z"),
      msg("N", "2024-01-01T10:01:00.000Z"),
      msg("B", "2024-01-01T10:02:00.000Z"),
    ]
    const result = reconcileHistoryMessages({
      serverMessages,
      requestStartIds: new Set(["A", "B"]),
      previousLocalIndexMap,
      liveLocalMessages: serverMessages,
    })
    expect(result.map((m) => m.id)).toEqual(["A", "N", "B"])
  })

  test("20. equal-fecha known ordering is preserved across a refetch that reorders the server response", () => {
    const previousLocalIndexMap = buildLocalIndexMap([
      msg("K2", "2024-01-01T10:00:00.000Z"),
      msg("N1", "2024-01-01T10:00:00.000Z"),
      msg("K1", "2024-01-01T10:00:00.000Z"),
      msg("N2", "2024-01-01T10:00:00.000Z"),
      msg("K3", "2024-01-01T10:00:00.000Z"),
    ])
    // Server group order: [K1,N1,K2,N2,K3]; previous local order: K2<K1<K3.
    const serverMessages = [
      msg("K1", "2024-01-01T10:00:00.000Z"),
      msg("N1", "2024-01-01T10:00:00.000Z"),
      msg("K2", "2024-01-01T10:00:00.000Z"),
      msg("N2", "2024-01-01T10:00:00.000Z"),
      msg("K3", "2024-01-01T10:00:00.000Z"),
    ]
    const result = reconcileHistoryMessages({
      serverMessages,
      requestStartIds: new Set(["K1", "K2", "K3", "N1", "N2"]),
      previousLocalIndexMap,
      liveLocalMessages: serverMessages,
    })
    expect(result.map((m) => m.id)).toEqual(["K2", "N1", "K1", "N2", "K3"])
  })

  test("21. equal-fecha new server slots are retained exactly where the server placed them on first sighting", () => {
    const result = reconcileHistoryMessages({
      serverMessages: [msg("A", "2024-01-01T10:00:00.000Z"), msg("B", "2024-01-01T10:00:00.000Z")],
      requestStartIds: new Set(),
      previousLocalIndexMap: new Map(),
      liveLocalMessages: [],
    })
    expect(result.map((m) => m.id)).toEqual(["A", "B"])
  })

  test("22. successive equal-fecha refetch stability: once all group members are known, order becomes fully stable", () => {
    const firstServer = [
      msg("K1", "2024-01-01T10:00:00.000Z"),
      msg("N1", "2024-01-01T10:00:00.000Z"),
      msg("K2", "2024-01-01T10:00:00.000Z"),
    ]
    const firstResult = reconcileHistoryMessages({
      serverMessages: firstServer,
      requestStartIds: new Set(["K1", "K2"]),
      previousLocalIndexMap: buildLocalIndexMap([msg("K2", "x"), msg("K1", "x")]),
      liveLocalMessages: firstServer,
    })
    expect(firstResult.map((m) => m.id)).toEqual(["K2", "N1", "K1"])

    // Next refetch, server returns a totally different order for the SAME group.
    const secondServer = [
      msg("N1", "2024-01-01T10:00:00.000Z"),
      msg("K1", "2024-01-01T10:00:00.000Z"),
      msg("K2", "2024-01-01T10:00:00.000Z"),
    ]
    const secondResult = reconcileHistoryMessages({
      serverMessages: secondServer,
      requestStartIds: new Set(["K1", "K2", "N1"]),
      previousLocalIndexMap: buildLocalIndexMap(firstResult),
      liveLocalMessages: secondServer,
    })
    // Full stability now that every id in the group is "known".
    expect(secondResult.map((m) => m.id)).toEqual(["K2", "N1", "K1"])
  })

  test("23. realtime-during-fetch: a message that arrives after the request started survives the stale snapshot", () => {
    const requestStartSnapshot = [msg("M1", "2024-01-01T09:00:00.000Z")]
    const requestStartIds = buildLocalIdSet(requestStartSnapshot)
    // M11 arrived via realtime while R1 was in flight — R1's own server
    // snapshot predates it and does not include it.
    const liveLocalMessages = [...requestStartSnapshot, msg("M11", "2024-01-01T09:05:00.000Z")]
    const result = reconcileHistoryMessages({
      serverMessages: requestStartSnapshot,
      requestStartIds,
      previousLocalIndexMap: buildLocalIndexMap(requestStartSnapshot),
      liveLocalMessages,
    })
    expect(result.map((m) => m.id)).toEqual(["M1", "M11"])
  })

  test("24. the next server response including that same realtime id is deduped to exactly one copy", () => {
    const serverMessages = [
      msg("M1", "2024-01-01T09:00:00.000Z"),
      msg("M11", "2024-01-01T09:05:00.000Z", { texto: "server-authoritative" }),
    ]
    const result = reconcileHistoryMessages({
      serverMessages,
      requestStartIds: new Set(["M1", "M11"]),
      previousLocalIndexMap: buildLocalIndexMap(serverMessages),
      liveLocalMessages: serverMessages,
    })
    expect(result.map((m) => m.id)).toEqual(["M1", "M11"])
    expect(result.filter((m) => m.id === "M11")).toHaveLength(1)
    expect(result.find((m) => m.id === "M11")?.texto).toBe("server-authoritative")
  })

  test("25. pre-request local-only message absent from server is removed (hard-delete convergence)", () => {
    const requestStartSnapshot = [msg("A", "2024-01-01T09:00:00.000Z"), msg("DELETED", "2024-01-01T09:01:00.000Z")]
    const result = reconcileHistoryMessages({
      serverMessages: [msg("A", "2024-01-01T09:00:00.000Z")], // server no longer returns DELETED
      requestStartIds: buildLocalIdSet(requestStartSnapshot),
      previousLocalIndexMap: buildLocalIndexMap(requestStartSnapshot),
      liveLocalMessages: requestStartSnapshot,
    })
    expect(result.map((m) => m.id)).toEqual(["A"])
  })

  test("26. post-request local-only message is retained, not silently dropped", () => {
    const result = reconcileHistoryMessages({
      serverMessages: [msg("A", "2024-01-01T09:00:00.000Z")],
      requestStartIds: new Set(["A"]),
      previousLocalIndexMap: buildLocalIndexMap([msg("A", "x")]),
      liveLocalMessages: [msg("A", "2024-01-01T09:00:00.000Z"), msg("LATE", "2024-01-01T09:10:00.000Z")],
    })
    expect(result.map((m) => m.id)).toContain("LATE")
  })

  test("27. a retained post-request local-only message is inserted by fecha position, not blindly appended", () => {
    const serverMessages = [
      msg("A", "2024-01-01T10:00:00.000Z"),
      msg("C", "2024-01-01T10:10:00.000Z"),
    ]
    // Retained realtime message's server-assigned fecha is EARLIER than the
    // last server-snapshot row, due to concurrent commit/evaluation timing.
    const result = reconcileHistoryMessages({
      serverMessages,
      requestStartIds: new Set(["A", "C"]),
      previousLocalIndexMap: buildLocalIndexMap(serverMessages),
      liveLocalMessages: [...serverMessages, msg("B", "2024-01-01T10:05:00.000Z")],
    })
    expect(result.map((m) => m.id)).toEqual(["A", "B", "C"]) // fecha-correct, not appended after C
  })

  test("28. a retained equal-fecha first appearance is placed at the end of that fecha group", () => {
    const serverMessages = [msg("A", "2024-01-01T10:00:00.000Z"), msg("B", "2024-01-01T10:00:00.000Z")]
    const result = reconcileHistoryMessages({
      serverMessages,
      requestStartIds: new Set(["A", "B"]),
      previousLocalIndexMap: buildLocalIndexMap(serverMessages),
      liveLocalMessages: [...serverMessages, msg("C", "2024-01-01T10:00:00.000Z")],
    })
    expect(result.map((m) => m.id)).toEqual(["A", "B", "C"])
  })

  test("29. server fields are authoritative for any id it returns", () => {
    const previous = [msg("A", "2024-01-01T10:00:00.000Z", { texto: "stale-local-text", leido: false })]
    const result = reconcileHistoryMessages({
      serverMessages: [msg("A", "2024-01-01T10:00:00.000Z", { texto: "fresh-server-text", leido: true })],
      requestStartIds: buildLocalIdSet(previous),
      previousLocalIndexMap: buildLocalIndexMap(previous),
      liveLocalMessages: previous,
    })
    expect(result[0].texto).toBe("fresh-server-text")
    expect(result[0].leido).toBe(true)
  })

  test("30. no CUID/id lexical chronology is ever used — reversed alphabetical ids do not affect fecha ordering", () => {
    // Ids deliberately reverse-alphabetical relative to chronological fecha
    // order — if the algorithm ever fell back to lexical id comparison this
    // would fail.
    const serverMessages = [
      msg("zzz", "2024-01-01T10:00:00.000Z"),
      msg("aaa", "2024-01-01T10:01:00.000Z"),
    ]
    const result = reconcileHistoryMessages({
      serverMessages,
      requestStartIds: new Set(),
      previousLocalIndexMap: new Map(),
      liveLocalMessages: serverMessages,
    })
    expect(result.map((m) => m.id)).toEqual(["zzz", "aaa"])
  })
})

// ============================================
// Coverage token identity/baseline
// ============================================
describe("coverage token identity and baseline", () => {
  test("createCoverageToken produces the exact shape, no extra fields", () => {
    const token = createCoverageToken("cliente:u1", "pedido-1", 3)
    expect(token).toEqual({ actorKey: "cliente:u1", pedidoId: "pedido-1", generation: 3 })
  })

  test("isFreshCoverageSignal: null token is never fresh", () => {
    expect(isFreshCoverageSignal(null, "cliente:u1", "pedido-1", null)).toBe(false)
  })

  test("isFreshCoverageSignal: mismatched pedidoId is ignored", () => {
    const token = createCoverageToken("cliente:u1", "pedido-A", 1)
    expect(isFreshCoverageSignal(token, "cliente:u1", "pedido-B", null)).toBe(false)
  })

  test("isFreshCoverageSignal: mismatched actorKey is ignored", () => {
    const token = createCoverageToken("cliente:u1", "pedido-1", 1)
    expect(isFreshCoverageSignal(token, "cliente:u2", "pedido-1", null)).toBe(false)
  })

  test("isFreshCoverageSignal: matching identity with a stale baseline generation is NOT fresh (same-pedido reopen case)", () => {
    const token = createCoverageToken("cliente:u1", "pedido-1", 5)
    expect(isFreshCoverageSignal(token, "cliente:u1", "pedido-1", 5)).toBe(false)
  })

  test("isFreshCoverageSignal: matching identity with a genuinely new generation IS fresh", () => {
    const token = createCoverageToken("cliente:u1", "pedido-1", 6)
    expect(isFreshCoverageSignal(token, "cliente:u1", "pedido-1", 5)).toBe(true)
  })

  test("isFreshCoverageSignal: first-ever matching token (baseline null) is fresh", () => {
    const token = createCoverageToken("cliente:u1", "pedido-1", 1)
    expect(isFreshCoverageSignal(token, "cliente:u1", "pedido-1", null)).toBe(true)
  })

  test("resolveCoverageBaseline: matching identity seeds the token's generation", () => {
    const token = createCoverageToken("cliente:u1", "pedido-1", 5)
    expect(resolveCoverageBaseline(token, "cliente:u1", "pedido-1")).toBe(5)
  })

  test("resolveCoverageBaseline: non-matching identity seeds null (no baseline)", () => {
    const token = createCoverageToken("cliente:u1", "pedido-A", 5)
    expect(resolveCoverageBaseline(token, "cliente:u1", "pedido-B")).toBeNull()
    expect(resolveCoverageBaseline(null, "cliente:u1", "pedido-B")).toBeNull()
  })

  test("token contains no secret/auth material — only actorKey/pedidoId/generation", () => {
    const token = createCoverageToken("cliente:u1", "pedido-1", 1)
    expect(Object.keys(token).sort()).toEqual(["actorKey", "generation", "pedidoId"])
  })
})

// Exact timeline reproduction of ChatView's own coverage-consumption
// effect (chat-view.tsx: `lastSeenCoverageGenerationRef.current ===
// undefined` means "not yet observed this lifecycle"; the FIRST
// observation always calls resolveCoverageBaseline and assigns its
// result — `number | null`, NEVER `undefined` — so the ref can never
// remain stuck at the "unobserved" sentinel after seeing even a null
// token). This directly answers the audited counterexample: does a null
// coverageToken at mount cause generation 1's later arrival to be
// mistaken for "just another first observation" and swallowed?
describe("coverage token — exact null-baseline timeline (pre-commit audit)", () => {
  function simulateChatViewCoverageEffect(
    lastSeen: number | null | undefined,
    token: ReturnType<typeof createCoverageToken> | null,
    actorKey: string,
    pedidoId: string,
  ): { nextLastSeen: number | null | undefined; triggered: boolean } {
    if (lastSeen === undefined) {
      return { nextLastSeen: resolveCoverageBaseline(token, actorKey, pedidoId), triggered: false }
    }
    if (token && isFreshCoverageSignal(token, actorKey, pedidoId, lastSeen)) {
      return { nextLastSeen: token.generation, triggered: true }
    }
    return { nextLastSeen: lastSeen, triggered: false }
  }

  test("T0-T3: null token at mount seeds baseline=null (not undefined); generation 1 arriving later IS observed as fresh, exactly once", () => {
    let lastSeen: number | null | undefined = undefined // ref's real initial value
    // T1: coverage-baseline effect runs with coverageToken=null (acquire hasn't resolved yet).
    let step = simulateChatViewCoverageEffect(lastSeen, null, "cliente:u1", "pedido-1")
    lastSeen = step.nextLastSeen
    expect(lastSeen).toBeNull() // NOT undefined — the sentinel is consumed exactly once
    expect(step.triggered).toBe(false)

    // T2: ChatSheet's acquire succeeds — coverageToken becomes generation 1.
    const tokenGen1 = createCoverageToken("cliente:u1", "pedido-1", 1)

    // T3: effect re-runs.
    step = simulateChatViewCoverageEffect(lastSeen, tokenGen1, "cliente:u1", "pedido-1")
    lastSeen = step.nextLastSeen
    expect(step.triggered).toBe(true) // MUST fire — this is the required post-coverage R2
    expect(lastSeen).toBe(1)

    // A subsequent re-render with the SAME token (no new acquire) must not re-trigger.
    step = simulateChatViewCoverageEffect(lastSeen, tokenGen1, "cliente:u1", "pedido-1")
    expect(step.triggered).toBe(false)
  })

  test("old token generation 7 (reopen case) seeds baseline only; generation 7 repeated never triggers; generation 8 triggers exactly once", () => {
    let lastSeen: number | null | undefined = undefined
    const tokenGen7 = createCoverageToken("cliente:u1", "pedido-1", 7)

    // Initial observation: an OLD, already-stale token generation is present at mount.
    let step = simulateChatViewCoverageEffect(lastSeen, tokenGen7, "cliente:u1", "pedido-1")
    lastSeen = step.nextLastSeen
    expect(lastSeen).toBe(7)
    expect(step.triggered).toBe(false) // baseline only, never a trigger on first observation

    // Same generation observed again (re-render, no new acquire) — never fresh.
    step = simulateChatViewCoverageEffect(lastSeen, tokenGen7, "cliente:u1", "pedido-1")
    expect(step.triggered).toBe(false)

    // A fresh acquire succeeds: generation 8.
    const tokenGen8 = createCoverageToken("cliente:u1", "pedido-1", 8)
    step = simulateChatViewCoverageEffect(lastSeen, tokenGen8, "cliente:u1", "pedido-1")
    lastSeen = step.nextLastSeen
    expect(step.triggered).toBe(true)
    expect(lastSeen).toBe(8)
  })
})

// ============================================
// Timeout integration — deterministic fake clock, no real sleeps
// ============================================
describe("runHistoryRequestWithDeadline — deterministic 10s liveness deadline", () => {
  test("A/B. controller is not aborted before the deadline timer fires, and is aborted exactly when it does", async () => {
    const clock = createFakeClock()
    const controller = new AbortController()
    const deferred = createDeferred<string>()
    const resultPromise = runHistoryRequestWithDeadline(controller, 10000, () => deferred.promise, clock.deps)
    expect(clock.scheduledCount()).toBe(1)
    expect(clock.scheduledDelays()).toEqual([10000])
    expect(controller.signal.aborted).toBe(false)
    clock.fireAll()
    expect(controller.signal.aborted).toBe(true)
    deferred.reject(new DOMException("aborted", "AbortError"))
    const result = await resultPromise
    expect(result.ok).toBe(false)
  })

  test("C/D. deadline timer remains armed through body/json consumption, not just header arrival — body hang cannot hold the coordinator forever", async () => {
    const clock = createFakeClock()
    const controller = new AbortController()
    const headers = createDeferred<void>()
    const body = createDeferred<string>()
    const operation = async () => {
      await headers.promise
      return body.promise
    }
    const resultPromise = runHistoryRequestWithDeadline(controller, 10000, operation, clock.deps)
    expect(clock.scheduledCount()).toBe(1)
    headers.resolve()
    await Promise.resolve()
    await Promise.resolve()
    // Headers "arrived" but the timer must still be armed — body is unresolved.
    expect(clock.scheduledCount()).toBe(1)
    expect(controller.signal.aborted).toBe(false)
    clock.fireAll()
    expect(controller.signal.aborted).toBe(true)
    body.reject(new DOMException("aborted", "AbortError"))
    const result = await resultPromise
    expect(result.ok).toBe(false)
    expect(clock.scheduledCount()).toBe(0)
  })

  test("successful settlement clears the deadline timer", async () => {
    const clock = createFakeClock()
    const controller = new AbortController()
    const result = await runHistoryRequestWithDeadline(controller, 10000, async () => "ok", clock.deps)
    expect(result).toEqual({ ok: true, value: "ok" })
    expect(clock.scheduledCount()).toBe(0)
  })

  test("ordinary failure (unrelated to the deadline) also clears the timer", async () => {
    const clock = createFakeClock()
    const controller = new AbortController()
    const result = await runHistoryRequestWithDeadline(
      controller,
      10000,
      async () => {
        throw new Error("network down")
      },
      clock.deps,
    )
    expect(result.ok).toBe(false)
    expect(clock.scheduledCount()).toBe(0)
  })

  test("E/G. current-lifecycle failure (timeout or ordinary) with pending semantic -> coordinator starts exactly one follow-up", () => {
    // Proves the coordinator transition is identical regardless of why the
    // request settled (TO1) — this test exercises the coordinator directly
    // against both an ordinary-failure-shaped and a timeout-shaped caller.
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    state = triggerSemanticHistoryFetch(state, 2).state // pending
    const afterTimeout = settleHistoryFetch(state, 1, 3)
    expect(afterTimeout.action).toEqual({ type: "start", token: 3 })

    let state2 = createHistoryCoordinatorState<number>()
    state2 = triggerSemanticHistoryFetch(state2, 1).state
    state2 = triggerSemanticHistoryFetch(state2, 2).state
    const afterOrdinaryFailure = settleHistoryFetch(state2, 1, 3)
    expect(afterOrdinaryFailure.action).toEqual(afterTimeout.action)
  })

  test("F/H. current-lifecycle failure (timeout or ordinary) without pending -> no follow-up", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    const result = settleHistoryFetch(state, 1, 2)
    expect(result.action).toEqual({ type: "noop" })
  })

  test("I. a late/stale timeout from a superseded request cannot abort or affect the newer request", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state // R1
    // R2 already replaced R1 as current (e.g. lifecycle continued differently)
    const withR2: typeof state = { currentToken: 2, pendingSemantic: false }
    const staleSettle = settleHistoryFetch(withR2, 1, 3) // R1's late timeout settlement
    expect(staleSettle.action).toEqual({ type: "stale" })
    expect(staleSettle.state.currentToken).toBe(2) // R2 untouched
  })

  test("J. unmount before timeout -> reset clears ownership, no follow-up when the late settlement arrives", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    state = triggerSemanticHistoryFetch(state, 2).state // pending=true before unmount
    const afterUnmount = resetHistoryCoordinatorState<number>()
    const lateSettle = settleHistoryFetch(afterUnmount, 1, 3)
    expect(lateSettle.action).toEqual({ type: "stale" })
  })

  test("K. actor/pedido switch before timeout -> old lifecycle's follow-up never launches into the new one", () => {
    let state = createHistoryCoordinatorState<number>()
    state = triggerSemanticHistoryFetch(state, 1).state
    state = triggerSemanticHistoryFetch(state, 2).state // pending for the OLD lifecycle
    // actor/pedido switch: fresh reset, then the new lifecycle starts its own mount request
    const freshLifecycle = triggerSemanticHistoryFetch(resetHistoryCoordinatorState<number>(), 100).state
    // the OLD request's timeout settlement arrives late
    const staleSettle = settleHistoryFetch(freshLifecycle, 1, 101)
    expect(staleSettle.action).toEqual({ type: "stale" })
    expect(staleSettle.state.currentToken).toBe(100) // new lifecycle's own request untouched
  })
})

// ============================================
// P2-T04 MODEL_R — request shaping + response evaluation (pure)
// ============================================
describe("buildHistoryRequestQuery — P2-T04 MODEL_R", () => {
  test("semantic never sends mode=safety, regardless of knownRevision", () => {
    expect(buildHistoryRequestQuery({ kind: "semantic", knownRevision: undefined })).toBe("")
    expect(buildHistoryRequestQuery({ kind: "semantic", knownRevision: 7 })).toBe("")
  })

  test("safety with no known revision sends mode=safety WITHOUT inventing knownRevision=0", () => {
    expect(buildHistoryRequestQuery({ kind: "safety", knownRevision: undefined })).toBe("?mode=safety")
  })

  test("safety with a known revision sends both params", () => {
    expect(buildHistoryRequestQuery({ kind: "safety", knownRevision: 0 })).toBe("?mode=safety&knownRevision=0")
    expect(buildHistoryRequestQuery({ kind: "safety", knownRevision: 42 })).toBe("?mode=safety&knownRevision=42")
  })
})

describe("evaluateHistoryResponse — P2-T04 MODEL_R (P2T04B-R matrix)", () => {
  test("P2T04B-R01: equal revision (server unchanged:true, echo matches sent) -> outcome unchanged", () => {
    const result = evaluateHistoryResponse(5, { unchanged: true, historyRevision: 5, mensajes: [] })
    expect(result).toEqual({ outcome: "unchanged" })
  })

  test("P2T04B-R02: missed create surfaces as a revision mismatch -> full, adopts the new revision", () => {
    const result = evaluateHistoryResponse(5, {
      unchanged: false,
      historyRevision: 6,
      mensajes: [msg("missed", "2024-01-01T10:00:00.000Z")],
    })
    expect(result).toEqual({ outcome: "full", historyRevision: 6 })
  })

  test("P2T04B-R08: a mismatch full response's mensajes feed the EXISTING (unmodified) reconciler via the caller — this function only decides trust/outcome", () => {
    const response = { unchanged: false, historyRevision: 9, mensajes: [msg("a", "2024-01-01T10:00:00.000Z")] }
    const result = evaluateHistoryResponse(3, response)
    expect(result.outcome).toBe("full")
    // The evaluation never mutates/filters `mensajes` itself — reconciliation
    // is entirely the caller's responsibility (reconcileHistoryMessages).
  })

  test("P2T04B-R09: a genuinely unchanged outcome never carries reconcilable content — caller must perform 0 setMessages", () => {
    const result = evaluateHistoryResponse(5, { unchanged: true, historyRevision: 5, mensajes: [] })
    expect(result.outcome).toBe("unchanged")
  })

  test("no sent knownRevision (first-ever safety tick edge case) never trusts an unchanged claim", () => {
    const result = evaluateHistoryResponse(undefined, { unchanged: true, historyRevision: 5, mensajes: [] })
    expect(result.outcome).toBe("force-full-refetch")
  })

  test("unchanged:true with a MISMATCHED echoed revision is never trusted -> force-full-refetch, not reconciled", () => {
    const result = evaluateHistoryResponse(5, { unchanged: true, historyRevision: 6, mensajes: [] })
    expect(result).toEqual({ outcome: "force-full-refetch" })
  })

  test("unchanged:true with a missing/non-numeric historyRevision is never trusted -> force-full-refetch", () => {
    expect(evaluateHistoryResponse(5, { unchanged: true, mensajes: [] }).outcome).toBe("force-full-refetch")
    expect(evaluateHistoryResponse(5, { unchanged: true, historyRevision: undefined, mensajes: [] }).outcome).toBe(
      "force-full-refetch",
    )
  })

  test("semantic response (unchanged omitted entirely, as the real server always does) -> full, adopts revision", () => {
    const result = evaluateHistoryResponse(undefined, { historyRevision: 12, mensajes: [msg("a", "2024-01-01T10:00:00.000Z")] })
    expect(result).toEqual({ outcome: "full", historyRevision: 12 })
  })

  test("old-server rolling compatibility: full shape with no historyRevision at all -> full, does not invent a revision", () => {
    const result = evaluateHistoryResponse(5, { mensajes: [msg("a", "2024-01-01T10:00:00.000Z")], pedido: undefined })
    expect(result).toEqual({ outcome: "full", historyRevision: undefined })
  })

  test("explicit unchanged:false with valid revision -> full, adopts the new revision even if numerically equal to what was sent", () => {
    const result = evaluateHistoryResponse(5, { unchanged: false, historyRevision: 5, mensajes: [] })
    expect(result).toEqual({ outcome: "full", historyRevision: 5 })
  })

  test("duplicate/late response carrying the SAME already-known revision twice never causes a double-advance issue for the caller — evaluation is a pure function of its inputs, idempotent", () => {
    const response = { unchanged: true, historyRevision: 5, mensajes: [] }
    expect(evaluateHistoryResponse(5, response)).toEqual(evaluateHistoryResponse(5, response))
  })
})
