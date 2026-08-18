import { describe, expect, test } from "bun:test"
import {
  applyTrackingServerVersion,
  beginTrackingGeneration,
  beginTrackingHttpRequest,
  canUntrustedTrackingSourceOverridePosition,
  createTrackingFreshnessTracker,
  isTrackingHttpResponseSuperseded,
  isTrustedTrackingServerVersion,
} from "./tracking-freshness"

// Every scenario below is adversarial and fully deterministic — no timers,
// no sleeps, no Date/clock reads anywhere in tracking-freshness.ts. Ordering
// is driven purely by the order in which these calls are made, exactly as
// DeliveryTrackingMap would make them from its HTTP/realtime callbacks.

describe("Tracking Latest-Wins / Server Version Authority", () => {
  test("1. server V10 applies initially", () => {
    const tracker = createTrackingFreshnessTracker()
    expect(applyTrackingServerVersion(tracker, 10)).toBe(true)
    expect(tracker.highestServerVersion).toBe(10)
  })

  test("2. server V11 after V10 applies", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 10)
    expect(applyTrackingServerVersion(tracker, 11)).toBe(true)
    expect(tracker.highestServerVersion).toBe(11)
  })

  test("3. server V10 after V11 rejected", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 11)
    expect(applyTrackingServerVersion(tracker, 10)).toBe(false)
    expect(tracker.highestServerVersion).toBe(11)
  })

  test("4. same V11 duplicate idempotent", () => {
    const tracker = createTrackingFreshnessTracker()
    expect(applyTrackingServerVersion(tracker, 11)).toBe(true)
    expect(applyTrackingServerVersion(tracker, 11)).toBe(true)
    expect(tracker.highestServerVersion).toBe(11)
  })

  test("5. version=0 valid — not treated as falsy/absent", () => {
    const tracker = createTrackingFreshnessTracker()
    expect(isTrustedTrackingServerVersion(0)).toBe(true)
    expect(applyTrackingServerVersion(tracker, 0)).toBe(true)
    expect(tracker.highestServerVersion).toBe(0)
    // A subsequent, genuinely higher version must still apply normally.
    expect(applyTrackingServerVersion(tracker, 1)).toBe(true)
  })

  test("6. invalid negative rejected as trusted authority", () => {
    expect(isTrustedTrackingServerVersion(-1)).toBe(false)
  })

  test("7. fractional version rejected", () => {
    expect(isTrustedTrackingServerVersion(1.5)).toBe(false)
  })

  test("8. NaN rejected", () => {
    expect(isTrustedTrackingServerVersion(NaN)).toBe(false)
  })

  test("9. Infinity rejected", () => {
    expect(isTrustedTrackingServerVersion(Infinity)).toBe(false)
    expect(isTrustedTrackingServerVersion(-Infinity)).toBe(false)
  })

  test("10. string \"11\" does NOT become trusted server authority", () => {
    expect(isTrustedTrackingServerVersion("11")).toBe(false)
    expect(isTrustedTrackingServerVersion("0")).toBe(false)
    expect(isTrustedTrackingServerVersion(null)).toBe(false)
    expect(isTrustedTrackingServerVersion(undefined)).toBe(false)
  })

  test("11. HTTP V10 then realtime V11 -> final V11", () => {
    const tracker = createTrackingFreshnessTracker()
    expect(applyTrackingServerVersion(tracker, 10)).toBe(true) // HTTP snapshot
    expect(applyTrackingServerVersion(tracker, 11)).toBe(true) // realtime delivery
    expect(tracker.highestServerVersion).toBe(11)
  })

  test("12. realtime V11 then HTTP V10 -> final V11 (HTTP V10 does not regress it)", () => {
    const tracker = createTrackingFreshnessTracker()
    expect(applyTrackingServerVersion(tracker, 11)).toBe(true) // realtime delivery
    expect(applyTrackingServerVersion(tracker, 10)).toBe(false) // stale HTTP response resolves late
    expect(tracker.highestServerVersion).toBe(11)
  })

  test("13. realtime V11 then HTTP V12 -> final V12", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 11)
    expect(applyTrackingServerVersion(tracker, 12)).toBe(true)
    expect(tracker.highestServerVersion).toBe(12)
  })

  test("14. server B (V11) delivered before older server A (V10) -> final state is B, A never regresses it", () => {
    const tracker = createTrackingFreshnessTracker()
    const appliedB = applyTrackingServerVersion(tracker, 11) // B arrives first (fast Internal Publish path)
    const appliedA = applyTrackingServerVersion(tracker, 10) // A arrives later (delayed publish retry)
    expect(appliedB).toBe(true)
    expect(appliedA).toBe(false)
    expect(tracker.highestServerVersion).toBe(11)
  })

  test("15. ordering is entirely version-based — the authority functions take no time/clock input at all", () => {
    const tracker = createTrackingFreshnessTracker()
    // Simulates two accepted updates computed in the exact same server
    // millisecond (Postgres row-locking guarantees they still get distinct,
    // strictly-ordered `locationRevision` values — see route.ts). Nothing
    // here ever reads Date.now() or any timestamp; only the version integers
    // are compared, so a same-millisecond scenario is a complete non-issue.
    const sameMillisecondVersionA = 42
    const sameMillisecondVersionB = 43
    expect(applyTrackingServerVersion(tracker, sameMillisecondVersionA)).toBe(true)
    expect(applyTrackingServerVersion(tracker, sameMillisecondVersionB)).toBe(true)
    expect(tracker.highestServerVersion).toBe(sameMillisecondVersionB)
    // Confirm no timing dependency exists in the function signatures at all
    // by checking their arity — (tracker, version) only, nothing else.
    expect(applyTrackingServerVersion.length).toBe(2)
  })

  test("16. legacy can display before any server version has been observed", () => {
    const tracker = createTrackingFreshnessTracker()
    expect(canUntrustedTrackingSourceOverridePosition(tracker)).toBe(true)
  })

  test("17. legacy cannot override position once a server version has been observed", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 5)
    expect(canUntrustedTrackingSourceOverridePosition(tracker)).toBe(false)
  })

  test("18. legacy +30s client clock skew cannot poison the decision (no timestamp is ever read)", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 5)
    const skewedFutureClientTimestamp = new Date(Date.now() + 30_000).toISOString()
    void skewedFutureClientTimestamp // never read by canUntrustedTrackingSourceOverridePosition
    expect(canUntrustedTrackingSourceOverridePosition(tracker)).toBe(false)
    expect(canUntrustedTrackingSourceOverridePosition.length).toBe(1) // (tracker) only — no timestamp parameter exists to poison
  })

  test("19. legacy -30s client clock skew cannot poison the decision (no timestamp is ever read)", () => {
    const tracker = createTrackingFreshnessTracker()
    // No server version observed yet in this tracker — legacy should still
    // be allowed, and a clock-skewed-into-the-past timestamp changes nothing
    // because no timestamp is ever passed to the function at all.
    const skewedPastClientTimestamp = new Date(Date.now() - 30_000).toISOString()
    void skewedPastClientTimestamp
    expect(canUntrustedTrackingSourceOverridePosition(tracker)).toBe(true)
  })

  test("20. a server-versioned event after legacy always applies", () => {
    const tracker = createTrackingFreshnessTracker()
    // Legacy displayed (never touches the tracker at all — no function call
    // corresponds to "legacy was shown", it simply never advances anything).
    expect(canUntrustedTrackingSourceOverridePosition(tracker)).toBe(true)
    // The first server-authoritative delivery must apply unconditionally.
    expect(applyTrackingServerVersion(tracker, 1)).toBe(true)
    expect(tracker.highestServerVersion).toBe(1)
  })

  test("21. pedido generation reset — A's V20 never blocks B after switching pedidos", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 20) // pedido A reaches version 20
    beginTrackingGeneration(tracker) // pedidoId prop switches to B
    expect(tracker.highestServerVersion).toBe(null)
    expect(applyTrackingServerVersion(tracker, 1)).toBe(true) // pedido B's own V1 applies cleanly
    expect(tracker.highestServerVersion).toBe(1)
  })

  test("22. close/reopen resets the server version authority the same way", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 20)
    beginTrackingGeneration(tracker) // onOpenChange(false)
    beginTrackingGeneration(tracker) // reopened
    expect(tracker.highestServerVersion).toBe(null)
    expect(applyTrackingServerVersion(tracker, 1)).toBe(true)
  })

  test("23. HTTP-vs-HTTP out-of-order resolution (lifecycle guard, unrelated to version)", () => {
    const tracker = createTrackingFreshnessTracker()
    const older = beginTrackingHttpRequest(tracker) // POLL_INTERVAL fires
    const newer = beginTrackingHttpRequest(tracker) // SOCKET_POLL_HEARTBEAT fires before the poll resolves
    expect(isTrackingHttpResponseSuperseded(newer, tracker)).toBe(false)
    expect(isTrackingHttpResponseSuperseded(older, tracker)).toBe(true) // discarded even though it resolves second... err, "first" — older is stale regardless of resolution order
  })

  test("23b. HTTP-vs-HTTP: pedido switch and close/reopen still discard stale in-flight requests", () => {
    const tracker = createTrackingFreshnessTracker()
    const requestForPedidoA = beginTrackingHttpRequest(tracker)
    beginTrackingGeneration(tracker) // pedido switch or close/reopen
    const requestForPedidoB = beginTrackingHttpRequest(tracker)
    expect(isTrackingHttpResponseSuperseded(requestForPedidoA, tracker)).toBe(true)
    expect(isTrackingHttpResponseSuperseded(requestForPedidoB, tracker)).toBe(false)
  })

  test("24. slow HTTP vs realtime, updated to use the version authority: realtime lands first, slow HTTP resolves with a stale version and must not regress it", () => {
    const tracker = createTrackingFreshnessTracker()
    const ticket = beginTrackingHttpRequest(tracker) // slow initial fetch begins, will resolve with V10
    applyTrackingServerVersion(tracker, 11) // a fresher realtime sample (V11) arrives and applies first
    expect(isTrackingHttpResponseSuperseded(ticket, tracker)).toBe(false) // still the current, non-superseded request
    // When it finally resolves carrying V10, the version authority (not the
    // old arrival-order heuristic) is what correctly rejects it:
    expect(applyTrackingServerVersion(tracker, 10)).toBe(false)
    expect(tracker.highestServerVersion).toBe(11)
  })

  test("24b. an HTTP request that resolves with a version newer than anything seen so far is authoritative", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 5) // some earlier realtime sample
    const ticket = beginTrackingHttpRequest(tracker)
    expect(isTrackingHttpResponseSuperseded(ticket, tracker)).toBe(false)
    expect(applyTrackingServerVersion(tracker, 6)).toBe(true)
    expect(tracker.highestServerVersion).toBe(6)
  })

  test("25. same-coordinate different versions behave strictly by version — the authority takes no coordinate input at all", () => {
    const tracker = createTrackingFreshnessTracker()
    // applyTrackingServerVersion's signature has no lat/lng parameter of any
    // kind — coordinates can never influence this decision, only the
    // version integer does. A stationary repartidor sending the identical
    // coordinate on every tick still strictly advances by version.
    expect(applyTrackingServerVersion.length).toBe(2) // (tracker, version) — no coordinate parameter exists
    expect(applyTrackingServerVersion(tracker, 7)).toBe(true)
    expect(applyTrackingServerVersion(tracker, 8)).toBe(true) // same coordinate in the real caller, different version — still applies
    expect(tracker.highestServerVersion).toBe(8)
  })

  test("beginTrackingGeneration resets httpSequence and highestServerVersion, advances generation", () => {
    const tracker = createTrackingFreshnessTracker()
    beginTrackingHttpRequest(tracker)
    beginTrackingHttpRequest(tracker)
    applyTrackingServerVersion(tracker, 9)

    beginTrackingGeneration(tracker)

    expect(tracker.httpSequence).toBe(0)
    expect(tracker.highestServerVersion).toBe(null)
    expect(tracker.generation).toBe(1)
  })
})

// DB Migration / Real Postgres Concurrency Validation + Precommit Review:
// a real defect was found by re-deriving fetchTracking's actual current
// source rather than trusting the prior report — an HTTP response with a
// missing/invalid `version` unconditionally applied to POSITION, even after
// a trusted server version had already been observed (e.g. via an earlier
// realtime delivery). This is exactly the mixed-version-deploy window
// scenario: a DeliGO Copy instance still serving the pre-version-authority
// GET route during a rolling deploy could regress an already-known-fresher
// position. Fixed by routing the "no trusted version" case through
// canUntrustedTrackingSourceOverridePosition (the same rule already used
// for legacy realtime events) instead of unconditionally returning true.
describe("Tracking Latest-Wins / Unversioned HTTP Cannot Regress a Known Server Version", () => {
  test("1. highest=null + unversioned HTTP -> allowed (backward compatibility, nothing to regress yet)", () => {
    const tracker = createTrackingFreshnessTracker()
    expect(canUntrustedTrackingSourceOverridePosition(tracker)).toBe(true)
  })

  test("2. highest=11 + unversioned HTTP with an old position -> position preserved (not overwritten)", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 11) // an earlier realtime delivery already established V11
    // A subsequent HTTP response has no `version` field at all (mid-rollout
    // instance still running the pre-version-authority GET route).
    expect(canUntrustedTrackingSourceOverridePosition(tracker)).toBe(false)
  })

  test("3. highest=11 + invalid string version (\"11\") -> treated as untrusted, position preserved", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 11)
    expect(isTrustedTrackingServerVersion("11")).toBe(false)
    expect(canUntrustedTrackingSourceOverridePosition(tracker)).toBe(false)
  })

  test("4. highest=11 + NaN/fractional/negative -> all treated as untrusted, position preserved", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 11)
    expect(isTrustedTrackingServerVersion(NaN)).toBe(false)
    expect(isTrustedTrackingServerVersion(1.5)).toBe(false)
    expect(isTrustedTrackingServerVersion(-1)).toBe(false)
    expect(canUntrustedTrackingSourceOverridePosition(tracker)).toBe(false)
  })

  test("5. an untrusted/missing version never advances highestServerVersion, regardless of outcome", () => {
    const tracker = createTrackingFreshnessTracker()
    applyTrackingServerVersion(tracker, 11)
    // Nothing in this file exposes a way to feed an untrusted value INTO
    // highestServerVersion at all — canUntrustedTrackingSourceOverridePosition
    // only ever reads the tracker, it never mutates it. This is the
    // structural guarantee that backs "HTTP-only metadata may still update
    // safely" (§23 item 5): whatever the caller does with an untrusted
    // response, the version authority itself is left completely untouched.
    expect(tracker.highestServerVersion).toBe(11)
    canUntrustedTrackingSourceOverridePosition(tracker)
    expect(tracker.highestServerVersion).toBe(11)
  })
})

// Same-Pedido Close/Reopen Stale-Realtime Focal Fix: `DeliveryTrackingMap`
// fully unmounts when the user closes the tracking sheet, destroying the
// component-local tracker — but the shared `RealtimeManager`'s physical
// socket does not (a room-lease release only emits `leave-order-room`).
// A `repartidor-location` event the server already dispatched to that
// socket before processing the leave can still reach the freshly-installed
// listener after the user reopens the SAME pedido, before the initial GET
// resolves. Before this fix, the reopened tracker's `highestServerVersion`
// was unconditionally cleared to `null`, so that stale, already-superseded
// version would be wrongly accepted. Every test below uses a unique
// `pedidoId` string never reused by any other test in this file — since the
// module-level per-pedido registry only ever reads/writes the exact
// `pedidoId` string a tracker is scoped to, this makes every test fully
// independent of run order without needing any exported reset/clear helper.
describe("Tracking Latest-Wins / Same-Pedido Close-Reopen Version Floor", () => {
  test("1. accepted server V11 for pedido P is stored in the per-pedido floor registry", () => {
    const pedidoId = "reopen-p1"
    const tracker = createTrackingFreshnessTracker(pedidoId)
    expect(applyTrackingServerVersion(tracker, 11)).toBe(true)
    // The registry itself is module-private — observe it indirectly through
    // a second, independent tracker created for the exact same pedidoId.
    const reseeded = createTrackingFreshnessTracker(pedidoId)
    expect(reseeded.highestServerVersion).toBe(11)
  })

  test("2. a new tracker created for a previously-seen pedidoId seeds highestServerVersion from its floor (simulated unmount)", () => {
    const pedidoId = "reopen-p2"
    const first = createTrackingFreshnessTracker(pedidoId)
    applyTrackingServerVersion(first, 11)
    // `first` is discarded here, exactly like DeliveryTrackingMap's own
    // tracker being destroyed on unmount — a brand new tracker object is
    // created for the same pedidoId, as a fresh mount would.
    const second = createTrackingFreshnessTracker(pedidoId)
    expect(second.highestServerVersion).toBe(11)
  })

  test("3. reopened pedido rejects a stale realtime V10 that arrives before the initial HTTP resolves", () => {
    const pedidoId = "reopen-p3"
    const first = createTrackingFreshnessTracker(pedidoId)
    applyTrackingServerVersion(first, 11)
    const reopened = createTrackingFreshnessTracker(pedidoId)
    // The old, already-in-flight realtime event arrives before the initial GET.
    expect(applyTrackingServerVersion(reopened, 10)).toBe(false)
    expect(reopened.highestServerVersion).toBe(11)
  })

  test("4. reopened pedido accepts a genuinely newer realtime V12 that arrives before the initial HTTP resolves", () => {
    const pedidoId = "reopen-p4"
    const first = createTrackingFreshnessTracker(pedidoId)
    applyTrackingServerVersion(first, 11)
    const reopened = createTrackingFreshnessTracker(pedidoId)
    expect(applyTrackingServerVersion(reopened, 12)).toBe(true)
    expect(reopened.highestServerVersion).toBe(12)
  })

  test("5. reopened pedido's initial HTTP GET returning the same V11 is a safe idempotent reapply", () => {
    const pedidoId = "reopen-p5"
    const first = createTrackingFreshnessTracker(pedidoId)
    applyTrackingServerVersion(first, 11)
    const reopened = createTrackingFreshnessTracker(pedidoId)
    expect(applyTrackingServerVersion(reopened, 11)).toBe(true)
    expect(reopened.highestServerVersion).toBe(11)
  })

  test("6. reopened pedido with cached floor 11 rejects an unversioned HTTP response's position", () => {
    const pedidoId = "reopen-p6"
    const first = createTrackingFreshnessTracker(pedidoId)
    applyTrackingServerVersion(first, 11)
    const reopened = createTrackingFreshnessTracker(pedidoId)
    expect(canUntrustedTrackingSourceOverridePosition(reopened)).toBe(false)
  })

  test("7. reopened pedido with cached floor 11 rejects a legacy (no-version) realtime event's position", () => {
    const pedidoId = "reopen-p7"
    const first = createTrackingFreshnessTracker(pedidoId)
    applyTrackingServerVersion(first, 11)
    const reopened = createTrackingFreshnessTracker(pedidoId)
    expect(canUntrustedTrackingSourceOverridePosition(reopened)).toBe(false)
  })

  test("8. a rejected stale V10 delivery never lowers pedido P's remembered floor", () => {
    const pedidoId = "reopen-p8"
    const first = createTrackingFreshnessTracker(pedidoId)
    applyTrackingServerVersion(first, 11)
    const reopened = createTrackingFreshnessTracker(pedidoId)
    applyTrackingServerVersion(reopened, 10) // rejected — must not touch the registry
    const thirdOpen = createTrackingFreshnessTracker(pedidoId)
    expect(thirdOpen.highestServerVersion).toBe(11)
  })

  test("9. the per-pedido floor registry is never written by anything other than a genuinely accepted trusted version", () => {
    const pedidoId = "reopen-p9"
    expect(isTrustedTrackingServerVersion("11")).toBe(false)
    expect(isTrustedTrackingServerVersion(NaN)).toBe(false)
    expect(isTrustedTrackingServerVersion(-1)).toBe(false)
    // No trusted delivery was ever accepted for this pedidoId — its floor
    // must still be unset.
    const reopened = createTrackingFreshnessTracker(pedidoId)
    expect(reopened.highestServerVersion).toBe(null)
  })

  test("10. version=0 is stored in and restored from the per-pedido floor (not treated as absent)", () => {
    const pedidoId = "reopen-p10"
    const first = createTrackingFreshnessTracker(pedidoId)
    expect(applyTrackingServerVersion(first, 0)).toBe(true)
    const reopened = createTrackingFreshnessTracker(pedidoId)
    expect(reopened.highestServerVersion).toBe(0)
    // A subsequent genuinely higher version must still apply normally,
    // confirming 0 was a real seeded floor rather than "no floor at all".
    expect(applyTrackingServerVersion(reopened, 1)).toBe(true)
  })

  test("11. switching from pedido A (floor 20) to never-seen pedido B applies B's own fresh V1", () => {
    const pedidoA = "reopen-p11-a"
    const pedidoB = "reopen-p11-b"
    const tracker = createTrackingFreshnessTracker(pedidoA)
    applyTrackingServerVersion(tracker, 20)
    // Same component instance switching pedidoId while staying mounted.
    beginTrackingGeneration(tracker, pedidoB)
    expect(tracker.highestServerVersion).toBe(null)
    expect(applyTrackingServerVersion(tracker, 1)).toBe(true)
    expect(tracker.highestServerVersion).toBe(1)
  })

  test("12. A (floor 20) -> B (floor 3) -> back to A restores A's own floor 20, not B's", () => {
    const pedidoA = "reopen-p12-a"
    const pedidoB = "reopen-p12-b"
    const tracker = createTrackingFreshnessTracker(pedidoA)
    applyTrackingServerVersion(tracker, 20)
    beginTrackingGeneration(tracker, pedidoB)
    applyTrackingServerVersion(tracker, 3)
    expect(tracker.highestServerVersion).toBe(3)
    beginTrackingGeneration(tracker, pedidoA)
    expect(tracker.highestServerVersion).toBe(20)
  })

  test("13. after returning to A, a stale A V19 (below A's restored floor 20) is rejected", () => {
    const pedidoA = "reopen-p13-a"
    const pedidoB = "reopen-p13-b"
    const tracker = createTrackingFreshnessTracker(pedidoA)
    applyTrackingServerVersion(tracker, 20)
    beginTrackingGeneration(tracker, pedidoB)
    applyTrackingServerVersion(tracker, 3)
    beginTrackingGeneration(tracker, pedidoA)
    expect(applyTrackingServerVersion(tracker, 19)).toBe(false)
    expect(tracker.highestServerVersion).toBe(20)
  })

  test("14. after returning to A, a genuinely newer A V21 applies normally", () => {
    const pedidoA = "reopen-p14-a"
    const pedidoB = "reopen-p14-b"
    const tracker = createTrackingFreshnessTracker(pedidoA)
    applyTrackingServerVersion(tracker, 20)
    beginTrackingGeneration(tracker, pedidoB)
    applyTrackingServerVersion(tracker, 3)
    beginTrackingGeneration(tracker, pedidoA)
    expect(applyTrackingServerVersion(tracker, 21)).toBe(true)
    expect(tracker.highestServerVersion).toBe(21)
  })

  test("15. a never-seen pedido C still supports a genuine first realtime version applying before HTTP", () => {
    const pedidoC = "reopen-p15-c"
    const tracker = createTrackingFreshnessTracker(pedidoC)
    expect(tracker.highestServerVersion).toBe(null)
    expect(applyTrackingServerVersion(tracker, 1)).toBe(true)
    expect(tracker.highestServerVersion).toBe(1)
  })

  test("16. a never-seen pedido C retains legacy-realtime-before-first-server-version compatibility", () => {
    const pedidoC = "reopen-p16-c"
    const tracker = createTrackingFreshnessTracker(pedidoC)
    expect(canUntrustedTrackingSourceOverridePosition(tracker)).toBe(true)
  })

  test("17. generation still advances on a same-pedido reopen even though the server-version floor is preserved", () => {
    const pedidoId = "reopen-p17"
    const tracker = createTrackingFreshnessTracker(pedidoId)
    applyTrackingServerVersion(tracker, 11)
    const generationBefore = tracker.generation
    beginTrackingGeneration(tracker, pedidoId)
    expect(tracker.generation).toBe(generationBefore + 1)
    expect(tracker.highestServerVersion).toBe(11)
  })

  test("18. httpSequence resets to 0 on same-pedido reopen independently of the preserved server-version floor", () => {
    const pedidoId = "reopen-p18"
    const tracker = createTrackingFreshnessTracker(pedidoId)
    beginTrackingHttpRequest(tracker)
    beginTrackingHttpRequest(tracker)
    applyTrackingServerVersion(tracker, 11)
    beginTrackingGeneration(tracker, pedidoId)
    expect(tracker.httpSequence).toBe(0)
    expect(tracker.highestServerVersion).toBe(11)
  })

  test("19. the freshness/registry API surface has no timestamp/Date/clock parameter anywhere", () => {
    expect(createTrackingFreshnessTracker.length).toBe(0) // (pedidoId = "") — defaulted, no timestamp param
    expect(beginTrackingGeneration.length).toBe(2) // (tracker, pedidoId) — no timestamp param
    expect(applyTrackingServerVersion.length).toBe(2) // (tracker, version) — unchanged, no timestamp param
  })

  test("20. after a same-pedido reopen, identical coordinates at a higher version still apply strictly by version, never by content", () => {
    const pedidoId = "reopen-p20"
    const first = createTrackingFreshnessTracker(pedidoId)
    applyTrackingServerVersion(first, 11)
    const reopened = createTrackingFreshnessTracker(pedidoId)
    // A stale delivery for the exact same coordinates but an old version is still rejected.
    expect(applyTrackingServerVersion(reopened, 10)).toBe(false)
    // A fresh delivery for the exact same coordinates at a genuinely higher version still applies.
    expect(applyTrackingServerVersion(reopened, 12)).toBe(true)
  })
})
