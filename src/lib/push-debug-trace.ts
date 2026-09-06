// P2-T31-R6A (PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC): passive, fail-safe event
// tracer for the push subscription lifecycle. Extends R6's snapshot-only
// diagnostic (push-debug-snapshot.ts) with a CHRONOLOGICAL record of what
// happened and in what order — a snapshot taken after the fact cannot show a
// timing race that already resolved (e.g. auth hydration finishing before
// Leonardo opens the panel).
//
// Design constraints (see the R6A report §15 for the full analysis): this
// module is imported from real product code (use-push-notifications.ts,
// push-personal-status-check.ts, the 3 profile UI components) that runs for
// EVERY real user, not just the tiny fraction who ever arm diagnostics:
//   - `recordPushDebugEvent` is synchronous, wrapped in try/catch, and NEVER
//     throws or blocks the caller, never awaits anything.
//   - When NOT armed (the default for every real user, including everyone in
//     Production and every un-opted-in TESTING session), it is a single
//     boolean check — no array push, no serialization, no I/O.
//   - When armed, cost is still bounded: the ring buffer never exceeds
//     PUSH_DEBUG_TRACE_MAX_EVENTS, so both the in-memory push and the
//     localStorage write it triggers are O(max events), never unbounded.
//
// Persistence is synchronous-per-event (not batched/deferred) by deliberate
// choice: iOS gives no reliable "about to be killed" event
// (`IOS_PROCESS_TERMINATION_EVENT_GUARANTEE=NO`), so any buffering window is
// a window where exactly the trailing events that matter most for a
// cold-launch/full-reopen repro (C4/C5) could be silently lost. Event volume
// for one push lifecycle pass is a few dozen calls at most, not a hot loop,
// so per-event localStorage.setItem of a <=100-entry JSON array is cheap
// enough not to meaningfully perturb the very timing being diagnosed.
import { fingerprintPushEndpoint } from "./push-debug-snapshot"

export const PUSH_DEBUG_TRACE_MAX_EVENTS = 100
const STORAGE_KEY = "deligo_push_debug_trace_v1"
const ARMED_KEY = "deligo_push_debug_armed_v1"
const GUARD_URL = "/api/push/debug-guard"

export interface PushDebugTraceEvent {
  sequence: number
  wallClockTimestamp: string
  performanceOffsetMs: number | null
  processInstanceId: string
  event: string
  actorFamily: string | null
  authHasHydrated: boolean | null
  path: string
  visibility: string
  fields: Record<string, string | number | boolean | null>
}

export type PushDebugTraceFn = (event: string, fields?: Record<string, unknown>) => void

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function memoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

function resolveDefaultStorage(): StorageLike {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage
    }
  } catch {
    // Safari private mode / disabled storage — fall through to memory-only.
  }
  return memoryStorage()
}

function makeProcessInstanceId(): string {
  return Math.random().toString(36).slice(2, 8)
}

let storage: StorageLike = resolveDefaultStorage()
let processInstanceId = makeProcessInstanceId()
let sequenceCounter = 0
let events: PushDebugTraceEvent[] = []
let armed = readArmedFlag()
let context: { actorFamily: string | null; authHasHydrated: boolean } = {
  actorFamily: null,
  authHasHydrated: false,
}
let listenersAttached = false

function readArmedFlag(): boolean {
  try {
    return storage.getItem(ARMED_KEY) === "true"
  } catch {
    return false
  }
}

function loadPersistedEvents(): PushDebugTraceEvent[] {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as PushDebugTraceEvent[]
  } catch {
    return []
  }
}

function persist(): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    // Bounded (<=MAX_EVENTS entries) — a quota/private-mode failure here is
    // safe to swallow: the in-memory buffer for THIS process still works,
    // only cross-reopen persistence is lost for this one write.
  }
}

function attachLifecycleListenersOnce(): void {
  if (listenersAttached) return
  if (typeof window === "undefined") return
  listenersAttached = true
  try {
    window.addEventListener("pageshow", () => recordPushDebugEvent("APP_PAGE_SHOW"))
    window.addEventListener("pagehide", () => recordPushDebugEvent("APP_PAGE_HIDE"))
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        recordPushDebugEvent(document.visibilityState === "visible" ? "VISIBILITY_VISIBLE" : "VISIBILITY_HIDDEN")
      })
    }
  } catch {
    // Never let listener wiring break the app.
  }
}

function currentPath(): string {
  try {
    return typeof window !== "undefined" ? window.location.pathname : "n/a"
  } catch {
    return "n/a"
  }
}

function currentVisibility(): string {
  try {
    return typeof document !== "undefined" ? document.visibilityState : "n/a"
  } catch {
    return "n/a"
  }
}

function currentPerfOffset(): number | null {
  try {
    return typeof performance !== "undefined" ? Math.round(performance.now()) : null
  } catch {
    return null
  }
}

// Defense in depth (see §7 of the R6A task): even though every real call
// site is expected to only ever pass sanitized primitives, this strips
// anything that LOOKS like it could carry a secret by field name, drops
// non-primitive values entirely, and truncates long strings — so a mistake
// at a future call site degrades to "REDACTED"/"[unsupported]" instead of
// silently persisting something sensitive.
const SECRET_FIELD_NAME_PATTERN = /cookie|token|secret|password|authorization|p256dh|vapid.?private|jwt|session|email/i

function sanitizeFields(fields: Record<string, unknown> | undefined): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  if (!fields) return out
  for (const [key, value] of Object.entries(fields)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes("endpoint") && lowerKey !== "endpointfingerprint") {
      out[key] = "REDACTED"
      continue
    }
    if (SECRET_FIELD_NAME_PATTERN.test(key)) {
      out[key] = "REDACTED"
      continue
    }
    if (value === null) {
      out[key] = null
    } else if (typeof value === "string") {
      out[key] = value.length > 64 ? `${value.slice(0, 64)}…` : value
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value
    } else {
      out[key] = "[unsupported]"
    }
  }
  return out
}

/** Purely observational context — never read by any decision logic, only by
 * `recordPushDebugEvent` to stamp each event. Safe to call from product code
 * on every render/effect; it is a plain object assignment. */
export function setPushDebugTraceContext(ctx: Partial<{ actorFamily: string | null; authHasHydrated: boolean }>): void {
  try {
    context = { ...context, ...ctx }
  } catch {
    // Never throw into product code.
  }
}

/** The single instrumentation entry point. Synchronous, never throws, never
 * awaits, and is a near-zero-cost no-op unless a TESTING session has
 * explicitly armed tracing (see armPushDebugTrace). */
export function recordPushDebugEvent(event: string, fields?: Record<string, unknown>): void {
  try {
    if (!armed) return
    const entry: PushDebugTraceEvent = {
      sequence: sequenceCounter,
      wallClockTimestamp: new Date().toISOString(),
      performanceOffsetMs: currentPerfOffset(),
      processInstanceId,
      event,
      actorFamily: context.actorFamily,
      authHasHydrated: context.authHasHydrated,
      path: currentPath(),
      visibility: currentVisibility(),
      fields: sanitizeFields(fields),
    }
    sequenceCounter += 1
    events.push(entry)
    if (events.length > PUSH_DEBUG_TRACE_MAX_EVENTS) {
      events = events.slice(events.length - PUSH_DEBUG_TRACE_MAX_EVENTS)
    }
    persist()
  } catch {
    // Fail-safe: tracing must never break the real push lifecycle.
  }
}

export function isPushDebugTraceArmed(): boolean {
  return armed
}

/** Requires the caller to have ALREADY confirmed both R6 gates (?pushDebug=1
 * + server-side TESTING guard) — this function itself does not re-check
 * them, it only persists the marker so the NEXT cold launch of this same
 * TESTING origin can start recording before the async guard re-check
 * resolves (see verifyPushDebugTraceGuard). */
export function armPushDebugTrace(): void {
  try {
    armed = true
    storage.setItem(ARMED_KEY, "true")
    attachLifecycleListenersOnce()
    recordPushDebugEvent("TRACE_ARMED")
  } catch {
    // no-op on failure — arming is best-effort
  }
}

export function disarmPushDebugTrace(): void {
  try {
    if (armed) recordPushDebugEvent("TRACE_DISARMED")
  } catch {
    // ignore
  }
  try {
    armed = false
    storage.removeItem(ARMED_KEY)
    storage.removeItem(STORAGE_KEY)
    events = []
  } catch {
    // ignore
  }
}

export function clearPushDebugTraceHistory(): void {
  try {
    events = []
    sequenceCounter = 0
    storage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function getPushDebugTraceEvents(): ReadonlyArray<PushDebugTraceEvent> {
  return events.slice()
}

export interface PushDebugTraceMeta {
  armed: boolean
  eventCount: number
  currentProcessId: string
  oldest: string | null
  newest: string | null
}

export function getPushDebugTraceMeta(): PushDebugTraceMeta {
  return {
    armed,
    eventCount: events.length,
    currentProcessId: processInstanceId,
    oldest: events.length > 0 ? events[0].wallClockTimestamp : null,
    newest: events.length > 0 ? events[events.length - 1].wallClockTimestamp : null,
  }
}

/**
 * Safety net for early/local arming (§5 of the R6A task): re-confirms with
 * the real server-side guard shortly after a process starts recording based
 * only on the LOCAL persisted marker, and disarms + wipes immediately if the
 * server does not confirm TESTING. A network hiccup does not disarm a
 * legitimate TESTING session — fail-safe means "don't crash", not "assume
 * the worst on every blip".
 */
export async function verifyPushDebugTraceGuard(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!armed) return
  try {
    const res = await fetchImpl(GUARD_URL)
    if (!res.ok) {
      disarmPushDebugTrace()
      return
    }
    const data: unknown = await res.json().catch(() => ({}))
    const allowed = typeof data === "object" && data !== null && (data as { allowed?: unknown }).allowed === true
    if (!allowed) {
      disarmPushDebugTrace()
    }
  } catch {
    // Network hiccup — leave armed state as-is.
  }
}

export function formatPushDebugTraceEvent(e: PushDebugTraceEvent): string {
  const fieldsText = Object.entries(e.fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ")
  const seq = String(e.sequence).padStart(4, "0")
  return `${seq} ts=${e.wallClockTimestamp} perfMs=${e.performanceOffsetMs ?? "n/a"} proc=${e.processInstanceId} event=${e.event} actorFamily=${e.actorFamily ?? "null"} authHasHydrated=${e.authHasHydrated ?? "null"} path=${e.path} visibility=${e.visibility}${fieldsText ? ` ${fieldsText}` : ""}`
}

/** Combines an already-formatted snapshot (from push-debug-snapshot.ts) with
 * the trace meta + timeline into the exact `PUSH_DEBUG_VERSION=2` clipboard
 * format from the R6A spec. Timeline is oldest-first, explicitly labeled. */
export function buildFullPushDebugDiagnosticText(
  snapshotText: string,
  meta: PushDebugTraceMeta,
  eventsList: ReadonlyArray<PushDebugTraceEvent>
): string {
  const timelineLines = eventsList.map(formatPushDebugTraceEvent)
  return [
    "PUSH_DEBUG_VERSION=2",
    "",
    "=== CURRENT SNAPSHOT ===",
    snapshotText,
    "",
    "=== TRACE META ===",
    `armed=${meta.armed}`,
    `eventCount=${meta.eventCount}`,
    `currentProcessId=${meta.currentProcessId}`,
    `oldest=${meta.oldest ?? "n/a"}`,
    `newest=${meta.newest ?? "n/a"}`,
    "",
    "=== TIMELINE (oldest first) ===",
    ...timelineLines,
  ].join("\n")
}

export { fingerprintPushEndpoint }

// --- Module init -------------------------------------------------------
// Mirrors a real cold launch: if a previous confirmed-TESTING session on
// this SAME origin already armed tracing, start recording (and load its
// persisted history) immediately and synchronously — before any network
// round trip, so the very first milliseconds of this process are captured.
// verifyPushDebugTraceGuard() re-confirms with the server right after and
// disarms + wipes if this origin does not actually confirm TESTING.
if (armed) {
  events = loadPersistedEvents().slice(-PUSH_DEBUG_TRACE_MAX_EVENTS)
  sequenceCounter = events.length > 0 ? events[events.length - 1].sequence + 1 : 0
  attachLifecycleListenersOnce()
  recordPushDebugEvent("TRACE_INIT")
  void verifyPushDebugTraceGuard()
}

// --- Test-only hooks -----------------------------------------------------
// Never imported by product code. Let push-debug-trace.test.ts exercise
// persistence/eviction/process-instance behavior deterministically without a
// real browser or a real module reload.
export function __setPushDebugTraceStorageForTests(customStorage?: StorageLike): void {
  storage = customStorage ?? memoryStorage()
}

export function __resetPushDebugTraceForTests(options?: { armed?: boolean }): void {
  processInstanceId = makeProcessInstanceId()
  context = { actorFamily: null, authHasHydrated: false }
  if (options?.armed !== undefined) {
    armed = options.armed
    try {
      if (armed) storage.setItem(ARMED_KEY, "true")
      else storage.removeItem(ARMED_KEY)
    } catch {
      // ignore
    }
  } else {
    armed = readArmedFlag()
  }
  events = armed ? loadPersistedEvents().slice(-PUSH_DEBUG_TRACE_MAX_EVENTS) : []
  sequenceCounter = events.length > 0 ? events[events.length - 1].sequence + 1 : 0
}

/** Simulates a brand-new JS process starting on the SAME (test) storage
 * backend — a fresh processInstanceId, but events already persisted from a
 * "previous process" are loaded first, exactly like a real cold PWA reopen. */
export function __simulateNewProcessForTests(): void {
  processInstanceId = makeProcessInstanceId()
  events = armed ? loadPersistedEvents().slice(-PUSH_DEBUG_TRACE_MAX_EVENTS) : []
  sequenceCounter = events.length > 0 ? events[events.length - 1].sequence + 1 : 0
  if (armed) recordPushDebugEvent("TRACE_INIT")
}
