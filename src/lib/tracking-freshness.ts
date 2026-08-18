// Clock-independent freshness/causality guard for DeliveryTrackingMap.
//
// Two independent local authorities decide whether an inbound HTTP tracking
// response or realtime event is allowed to update the on-screen repartidor
// position — neither ever compares a wall-clock timestamp:
//
// - generation / httpSequence: lifecycle/ordering guards, unrelated to WHERE
//   a location came from. `generation` is bumped whenever the map is
//   closed/reopened or the tracked pedidoId changes; any HTTP response
//   tagged with an older generation is fully superseded (covers the
//   close/reopen and pedido-switch races). `httpSequence` is bumped once per
//   HTTP request dispatched within the current generation; a response is
//   only applied if it is still tagged with the CURRENT sequence number —
//   i.e. no newer HTTP request has been dispatched since this one started
//   (covers HTTP-vs-HTTP out-of-order resolution, regardless of which
//   request's network round-trip happens to finish first).
// - highestServerVersion: the DB-backed, per-pedido monotonic authority
//   (Pedido.locationRevision, echoed to the browser as `version` on both the
//   realtime `tracking.location.updated` payload and the HTTP tracking GET
//   response — see Tracking Latest-Wins Focal Design Correction #2). This is
//   the ONLY thing that governs realtime-vs-realtime and HTTP-vs-realtime
//   POSITION freshness: whichever accepted server-authoritative delivery
//   (HTTP or realtime) carries the higher `version` wins, regardless of
//   arrival order. Any source that does not carry a trusted version — a
//   legacy stale-PWA `repartidor-location` event, OR an HTTP tracking
//   response with a missing/invalid `version` (e.g. a mid-rollout instance
//   still serving the pre-version-authority route, or a corrupted response)
//   — may only move the position while no trusted server version has ever
//   been observed yet for the current pedido/lifecycle generation
//   (canUntrustedTrackingSourceOverridePosition), and can never itself
//   advance highestServerVersion.
//
// A prior revision of this file tracked realtime freshness via a third,
// purely arrival-order counter (`realtimeRevision`). That counter is
// removed here: it could only ever compare "did a realtime event arrive
// since this HTTP request started," which cannot distinguish a genuinely
// newer server-authoritative event from an older, merely-later-arriving
// one — exactly the realtime-vs-realtime gap Focal Design Correction #1
// identified. `highestServerVersion` supersedes it entirely and correctly
// for every case it used to handle (HTTP responses now always carry a
// `version`, defaulting to 0), so keeping both would only leave a second,
// weaker, confusing authority around for no benefit.
//
// None of this compares timestamps or trusts any client/device clock — see
// Tracking Latest-Wins / Freshness Race design notes in CODEX_REPORT.md for
// why a "highest timestamp wins" policy is unsafe (the legacy stale-PWA
// producer path's timestamp is client-controlled).

export interface TrackingFreshnessTracker {
  generation: number
  httpSequence: number
  highestServerVersion: number | null
}

export interface TrackingHttpRequestTicket {
  generation: number
  sequence: number
}

export function createTrackingFreshnessTracker(): TrackingFreshnessTracker {
  return { generation: 0, httpSequence: 0, highestServerVersion: null }
}

// Call once whenever the tracked pedido or the open/closed lifecycle
// changes. Resets the per-generation counters — including the server
// version authority — so an old in-flight request or a version observed for
// a previous pedido/session can never leak into the new one.
export function beginTrackingGeneration(tracker: TrackingFreshnessTracker): void {
  tracker.generation += 1
  tracker.httpSequence = 0
  tracker.highestServerVersion = null
}

// Call synchronously right before dispatching an HTTP tracking request.
export function beginTrackingHttpRequest(tracker: TrackingFreshnessTracker): TrackingHttpRequestTicket {
  tracker.httpSequence += 1
  return { generation: tracker.generation, sequence: tracker.httpSequence }
}

// True when the response for this ticket must be discarded entirely: either
// the pedido/open lifecycle moved on (generation mismatch), or a newer HTTP
// request has since been dispatched for the same generation (sequence
// mismatch) and therefore supersedes this one regardless of arrival order.
export function isTrackingHttpResponseSuperseded(
  ticket: TrackingHttpRequestTicket,
  tracker: TrackingFreshnessTracker,
): boolean {
  return ticket.generation !== tracker.generation || ticket.sequence !== tracker.httpSequence
}

// A `version` value only counts as a trusted server authority when it is
// exactly a non-negative safe integer. This is intentionally strict: the
// wire type has always allowed `number | string` for forward/legacy
// compatibility, but only a real, in-range integer number can ever have
// come from Pedido.locationRevision — a string, NaN, Infinity, a fractional
// number, or a negative number is never trusted, silently treated the same
// as "no version at all" (never advances highestServerVersion, never
// blocks a legitimate update, never crashes the UI).
export function isTrustedTrackingServerVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

// Call for any accepted delivery (HTTP response or realtime event) that
// carries a trusted server version (see isTrustedTrackingServerVersion —
// callers must validate before calling this). Advances the tracked highest
// version whenever this one is not older, and returns whether the caller
// should apply it to the POSITION fields specifically. A version equal to
// the current highest still returns true (idempotent re-apply — harmless
// for identical coordinates) so callers never need a separate equality
// branch. HTTP-only fields (estado, trackingDisabled, negocio metadata, …)
// are never gated by this — callers apply those unconditionally regardless
// of this function's return value, exactly as before.
export function applyTrackingServerVersion(
  tracker: TrackingFreshnessTracker,
  version: number,
): boolean {
  const highest = tracker.highestServerVersion
  if (highest !== null && version < highest) return false
  if (highest === null || version > highest) tracker.highestServerVersion = version
  return true
}

// True only while no trusted server version has ever been observed for the
// current pedido/lifecycle generation — the sole window in which a source
// carrying NO trusted version is allowed to move the displayed position.
// Two distinct callers share this exact rule (Tracking Latest-Wins Focal
// Design Correction #2, legacy policy; DB Migration / Precommit Review,
// unversioned-HTTP fix):
//   - a legacy (no-version) stale-PWA realtime event;
//   - an HTTP tracking response whose `version` is missing or fails
//     isTrustedTrackingServerVersion (e.g. a mid-rollout DeliGO Copy
//     instance still serving the pre-version-authority GET route during a
//     mixed-version deploy window, or a corrupted response).
// Once any trusted server version has been recorded, either kind of
// untrusted source may still be received/applied for its OWN non-position
// fields (HTTP-only metadata, or nothing at all for realtime) without
// error, but must never move the position again — the server-authoritative
// producer is now known to exist for this pedido, and an
// authorized-but-stale or version-blind source must never be allowed to
// visually regress state the system already knows is more current.
export function canUntrustedTrackingSourceOverridePosition(
  tracker: TrackingFreshnessTracker,
): boolean {
  return tracker.highestServerVersion === null
}
