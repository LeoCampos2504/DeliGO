// Pure, browser-agnostic decision/reconciliation helpers for Chat's
// active-message resync recovery — the V6 final design. See CODEX_REPORT.md,
// "SHARED REALTIME — CHAT ACTIVE-MESSAGE RESYNC" (design review through
// Focal Design Correction #6) for the full rationale. Every export here is a
// pure function/state-machine of its explicit inputs: no fetch(), no
// cookies, no JWT/capability, no Socket.IO, no RealtimeManager instance, no
// React hooks. Actual HTTP calls, cookies, and the real AbortController
// identity/timer lifetime are owned by ChatView; this module only owns the
// deadline-wrapping mechanics, the resync-reason policy, the coverage-token
// identity/baseline rules, the semantic single-flight/catch-up state
// machine, and the V3/ORDER3_A reconciliation algorithm.

import type { ChatMessage, PedidoInfo } from "@/store/chat-store"
import type { RealtimeResyncReason } from "@/lib/realtime-types"

// ============================================
// Frozen V6 constants
// ============================================
// Recurring active-visible full-history safety cadence — TIMER_A fixed
// setInterval, ticks skipped (not queued) while a request is already in
// flight. This is a CADENCE, not a recovery guarantee — see
// ACTIVE_HISTORY_SAFETY_ATTEMPT_START_BOUND_SECONDS below.
export const ACTIVE_HISTORY_SAFETY_INTERVAL_MS = 90_000

// Application-level per-request deadline. Applies uniformly to every
// productive history request path (mount, exact-coverage catch-up,
// room-rejoin catch-up, online catch-up, foreground catch-up, safety
// tick) — see runHistoryRequestWithDeadline. This is a liveness bound,
// not a scale optimization; the full-history response remains technically
// UNBOUNDED (ACTIVE_HISTORY_PROD_SCALE_REVIEW_REQUIRED=SI).
export const ACTIVE_HISTORY_SINGLE_REQUEST_DEADLINE_MS = 10_000

// Honest, corrected liveness terminology (Focal Design Correction #6).
// 90 remains the CONFIGURED recurring cadence under healthy/no-overlap
// steady state — it is NOT a maximum-recovery guarantee. Because TIMER_A
// can legally skip one scheduled tick while a request already consumes up
// to its own deadline, the conservative bound for a GUARANTEED fresh
// safety-attempt START is P+T, and — conditional on that fresh attempt
// itself succeeding — P+2T for completion. No unconditional recovery bound
// exists: persistent server/network failure can defeat every attempt.
export const ACTIVE_HISTORY_CONFIGURED_SAFETY_CADENCE_SECONDS = 90
export const ACTIVE_HISTORY_SAFETY_ATTEMPT_START_BOUND_SECONDS =
  ACTIVE_HISTORY_CONFIGURED_SAFETY_CADENCE_SECONDS + ACTIVE_HISTORY_SINGLE_REQUEST_DEADLINE_MS / 1000
export const ACTIVE_HISTORY_FIRST_SUCCESSFUL_SAFETY_ATTEMPT_RECOVERY_BOUND_SECONDS =
  ACTIVE_HISTORY_CONFIGURED_SAFETY_CADENCE_SECONDS + (2 * ACTIVE_HISTORY_SINGLE_REQUEST_DEADLINE_MS) / 1000

// ============================================
// Exact Chat room coverage token (Model B — identity-keyed, not a raw
// counter). Correlation metadata only — never authorization, never a room
// capability, never persisted, never sent to the server.
// ============================================
export interface ChatRoomCoverageToken {
  readonly actorKey: string
  readonly pedidoId: string
  readonly generation: number
}

export function createCoverageToken(
  actorKey: string,
  pedidoId: string,
  generation: number,
): ChatRoomCoverageToken {
  return { actorKey, pedidoId, generation }
}

// True only when `token` both (a) matches the CURRENT ChatView lifecycle's
// actor+pedido identity and (b) carries a generation different from the
// last one this lifecycle has already observed (its seeded baseline, or a
// previously-consumed fresh generation). A stale token already held by
// ChatSheet when a fresh ChatView mounts is correctly treated as a
// baseline (lastSeenGeneration seeded from it), never as a "new event",
// because this function only reports "fresh" on a generation CHANGE.
export function isFreshCoverageSignal(
  token: ChatRoomCoverageToken | null,
  actorKey: string,
  pedidoId: string,
  lastSeenGeneration: number | null,
): boolean {
  if (!token) return false
  if (token.actorKey !== actorKey || token.pedidoId !== pedidoId) return false
  return token.generation !== lastSeenGeneration
}

// The exact baseline to seed on first observation of `token` for a fresh
// ChatView lifecycle: the token's own generation if it already matches this
// lifecycle's identity, otherwise `null` (no matching baseline yet).
export function resolveCoverageBaseline(
  token: ChatRoomCoverageToken | null,
  actorKey: string,
  pedidoId: string,
): number | null {
  if (!token) return null
  if (token.actorKey !== actorKey || token.pedidoId !== pedidoId) return null
  return token.generation
}

// ============================================
// Manager resync-reason policy — explicit fail-closed allowlist, never
// default-allow. `hasExactCoverage` reflects whether THIS ChatView
// lifecycle has already observed its first fresh matching coverage token
// (see isFreshCoverageSignal) — before that point, the manager's global
// `room-rejoin` can be a false positive for this specific Chat room (it
// fires whenever ANY leased room's rejoin sequence settles, success or
// failure, not specifically this one) and is denied; after that point it
// is the correct signal for later transport reconnects and is allowed.
// `online` is retained unconditionally: it is the ONLY signal available
// when the shared socket never actually disconnected. `foreground` is
// denied here because Chat owns foreground catch-up LOCALLY (visibility/
// focus listeners in ChatView), exactly mirroring the established
// chat-polling.ts convention for the conversations list. `initial-connect`
// and `reauth` are denied because they are always strictly preceded by,
// and therefore redundant with, `room-rejoin` in the same physical
// connection cycle. `reconnect`, `suspected-gap`, and `manual` have no
// current call site in realtime-manager.ts and default to false so a
// future unrelated call site cannot silently start Chat HTTP traffic.
export function isHistoryResyncReasonAllowed(
  reason: RealtimeResyncReason,
  hasExactCoverage: boolean,
): boolean {
  switch (reason) {
    case "online":
      return true
    case "room-rejoin":
      return hasExactCoverage
    case "initial-connect":
    case "reauth":
    case "foreground":
    case "reconnect":
    case "suspected-gap":
    case "manual":
      return false
    default: {
      const exhaustive: never = reason
      return exhaustive
    }
  }
}

// ============================================
// Semantic single-flight + queued post-flight catch-up coordinator.
//
// `Token` is an opaque per-request identity supplied by the caller (in
// ChatView this is the request's own AbortController instance) — the
// state machine never inspects it, only compares it by `===`, which is
// exactly the "stale finally/timeout cannot mutate a newer request's
// ownership" guard already proven throughout this workstream, expressed
// here as a pure, fully-testable transition instead of a React ref
// comparison.
//
// TO1 (frozen, Focal Design Correction #6): `settleHistoryFetch` takes NO
// outcome parameter. Success, ordinary network/HTTP/JSON failure, and a
// 10s deadline timeout are ALL, structurally, the exact same transition —
// no coordinator behavior branch has ever depended on distinguishing them.
// ============================================
export interface HistoryCoordinatorState<Token> {
  readonly currentToken: Token | null
  readonly pendingSemantic: boolean
}

export function createHistoryCoordinatorState<Token>(): HistoryCoordinatorState<Token> {
  return { currentToken: null, pendingSemantic: false }
}

export function resetHistoryCoordinatorState<Token>(): HistoryCoordinatorState<Token> {
  return createHistoryCoordinatorState<Token>()
}

export type HistoryCoordinatorAction<Token> =
  | { type: "start"; token: Token }
  | { type: "queue" }
  | { type: "noop" }
  | { type: "stale" }

export interface HistoryCoordinatorTransition<Token> {
  state: HistoryCoordinatorState<Token>
  action: HistoryCoordinatorAction<Token>
}

// A semantic trigger: exact coverage token, an allowed room-rejoin, online,
// or local foreground. If a request is already in flight, coalesces into a
// single pending flag (idempotent — multiple signals produce ONE
// follow-up, never one per reason) and does NOT start a parallel request.
export function triggerSemanticHistoryFetch<Token>(
  state: HistoryCoordinatorState<Token>,
  nextToken: Token,
): HistoryCoordinatorTransition<Token> {
  if (state.currentToken !== null) {
    return { state: { ...state, pendingSemantic: true }, action: { type: "queue" } }
  }
  return {
    state: { currentToken: nextToken, pendingSemantic: false },
    action: { type: "start", token: nextToken },
  }
}

// The 90s safety interval tick. Deliberately NOT a semantic trigger: while
// busy it is silently skipped — it must never set `pendingSemantic`, never
// queue a follow-up, and never restart the interval. TIMER_A stays frozen.
export function triggerSafetyIntervalTick<Token>(
  state: HistoryCoordinatorState<Token>,
  nextToken: Token,
): HistoryCoordinatorTransition<Token> {
  if (state.currentToken !== null) {
    return { state, action: { type: "noop" } }
  }
  return {
    state: { currentToken: nextToken, pendingSemantic: false },
    action: { type: "start", token: nextToken },
  }
}

// The current request has settled — for ANY reason (TO1: success, ordinary
// failure, or timeout are indistinguishable here). `settledToken` is the
// identity of the request that just finished; `nextToken` is the identity
// to use IF a follow-up is started. If `settledToken` no longer matches
// `state.currentToken` (lifecycle teardown already invalidated ownership,
// or this settlement is a stale straggler superseded by a newer request),
// the action is "stale" and the caller MUST perform no store/UI mutation
// for it. Otherwise: a pending semantic signal launches exactly one
// follow-up; no pending signal returns to fully idle.
export function settleHistoryFetch<Token>(
  state: HistoryCoordinatorState<Token>,
  settledToken: Token,
  nextToken: Token,
): HistoryCoordinatorTransition<Token> {
  if (state.currentToken !== settledToken) {
    return { state, action: { type: "stale" } }
  }
  if (state.pendingSemantic) {
    return {
      state: { currentToken: nextToken, pendingSemantic: false },
      action: { type: "start", token: nextToken },
    }
  }
  return { state: { currentToken: null, pendingSemantic: false }, action: { type: "noop" } }
}

// ============================================
// Per-request application-level deadline. Never calls fetch/cookies/JWT
// itself — `operation` (supplied by the caller) owns the real HTTP call
// and must not resolve until it has fully consumed the productive
// response (status check AND body/json parse), so the deadline genuinely
// bounds body consumption, not merely the initial fetch() promise. Timer
// primitives are injectable so the exact 10s boundary is deterministically
// testable without real sleeps.
// ============================================
export interface RequestDeadlineDeps {
  setTimeoutImpl: (callback: () => void, ms: number) => unknown
  clearTimeoutImpl: (handle: unknown) => void
}

const defaultRequestDeadlineDeps: RequestDeadlineDeps = {
  setTimeoutImpl: (callback, ms) => setTimeout(callback, ms),
  clearTimeoutImpl: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export type RequestDeadlineResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown }

export async function runHistoryRequestWithDeadline<T>(
  controller: AbortController,
  deadlineMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
  deps: RequestDeadlineDeps = defaultRequestDeadlineDeps,
): Promise<RequestDeadlineResult<T>> {
  const timer = deps.setTimeoutImpl(() => controller.abort(), deadlineMs)
  try {
    const value = await operation(controller.signal)
    return { ok: true, value }
  } catch (error) {
    return { ok: false, error }
  } finally {
    deps.clearTimeoutImpl(timer)
  }
}

// ============================================
// V3 reconciliation — ORDER3_A intra-equal-fecha stabilization, server
// field/presence authority, pre-request local-only hard-delete
// convergence, post-request local-only retention inserted by fecha
// position (never a blind append), no CUID/id chronology anywhere.
// ============================================
export function buildLocalIdSet(messages: readonly ChatMessage[]): Set<string> {
  return new Set(messages.map((m) => m.id))
}

export function buildLocalIndexMap(messages: readonly ChatMessage[]): Map<string, number> {
  const map = new Map<string, number>()
  messages.forEach((m, index) => map.set(m.id, index))
  return map
}

function fechaTime(message: ChatMessage): number {
  return new Date(message.fecha).getTime()
}

// Partitions an already fecha-ASC-ordered array into contiguous runs of
// exactly-equal canonical timestamps. Never reorders across a partition
// boundary — that boundary IS the server's global fecha ASC authority.
function groupByEqualFecha(messages: readonly ChatMessage[]): ChatMessage[][] {
  const groups: ChatMessage[][] = []
  let current: ChatMessage[] = []
  let currentTime: number | null = null
  for (const message of messages) {
    const time = fechaTime(message)
    if (currentTime === null || time === currentTime) {
      current.push(message)
      currentTime = time
    } else {
      groups.push(current)
      current = [message]
      currentTime = time
    }
  }
  if (current.length) groups.push(current)
  return groups
}

// Within ONE equal-fecha group: the SET of slot positions occupied by
// already-known messages stays fixed; only WHICH known message occupies
// which of those slots is reassigned, ordered by prior local index.
// Genuinely new messages (no prior index) keep the exact slot/order the
// server supplied for their first appearance.
function stabilizeEqualFechaGroup(
  group: readonly ChatMessage[],
  previousLocalIndexMap: ReadonlyMap<string, number>,
): ChatMessage[] {
  if (group.length <= 1) return group.slice()
  const knownPositions: number[] = []
  group.forEach((message, index) => {
    if (previousLocalIndexMap.has(message.id)) knownPositions.push(index)
  })
  if (knownPositions.length <= 1) return group.slice()

  const knownSorted = knownPositions
    .map((index) => group[index])
    .sort((a, b) => previousLocalIndexMap.get(a.id)! - previousLocalIndexMap.get(b.id)!)

  const result = group.slice()
  knownPositions.forEach((position, i) => {
    result[position] = knownSorted[i]
  })
  return result
}

function applyOrder3A(
  serverMessages: readonly ChatMessage[],
  previousLocalIndexMap: ReadonlyMap<string, number>,
): ChatMessage[] {
  return groupByEqualFecha(serverMessages).flatMap((group) =>
    stabilizeEqualFechaGroup(group, previousLocalIndexMap),
  )
}

// Inserts `message` into `array` (assumed fecha-ASC) at its fecha-correct
// position — never a blind append. A tie with an existing equal-fecha
// group places the new arrival at the END of that group (a safe,
// arbitrary choice for a genuine first sighting; the next refetch's
// ORDER3_A stabilization will then treat it as "known" and preserve
// whatever position it lands in).
function insertByFechaPosition(array: readonly ChatMessage[], message: ChatMessage): ChatMessage[] {
  const time = fechaTime(message)
  let insertAt = array.length
  for (let i = 0; i < array.length; i++) {
    if (fechaTime(array[i]) > time) {
      insertAt = i
      break
    }
  }
  const copy = array.slice()
  copy.splice(insertAt, 0, message)
  return copy
}

export interface ReconcileHistoryInput {
  // Server's response, already fecha ASC — authoritative for the fields
  // and presence of every id it returns.
  serverMessages: readonly ChatMessage[]
  // Local message ids known at the exact moment this request STARTED.
  requestStartIds: ReadonlySet<string>
  // Local array index (at request start) for messages known then — used
  // ONLY for intra-equal-fecha stabilization, never to cross fecha groups.
  previousLocalIndexMap: ReadonlyMap<string, number>
  // The LIVE local array at merge time (now), used to detect messages that
  // arrived via realtime strictly after this request started.
  liveLocalMessages: readonly ChatMessage[]
}

export function reconcileHistoryMessages(input: ReconcileHistoryInput): ChatMessage[] {
  const { serverMessages, requestStartIds, previousLocalIndexMap, liveLocalMessages } = input
  const stabilized = applyOrder3A(serverMessages, previousLocalIndexMap)

  const serverIds = new Set(serverMessages.map((m) => m.id))
  // Pre-request local-only messages absent from the server response are
  // implicitly dropped (hard-delete convergence) simply by never being
  // part of `stabilized`. Post-request local-only messages — present now
  // but absent from BOTH the server response and the request-start
  // snapshot — arrived via realtime while this request was in flight and
  // must be retained, inserted at their own fecha-correct position.
  const postRequestLocalOnly = liveLocalMessages.filter(
    (m) => !serverIds.has(m.id) && !requestStartIds.has(m.id),
  )

  let result = stabilized
  for (const message of postRequestLocalOnly) {
    result = insertByFechaPosition(result, message)
  }
  return result
}

export type { ChatMessage, PedidoInfo }
