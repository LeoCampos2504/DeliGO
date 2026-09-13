import { describe, expect, test } from "bun:test"
import { evaluateMapMatching, isRawMatchingCandidate, matchingEligibilityReason } from "@/lib/map-matching-policy"
import { isMatchedRealtimePayloadWithinLimit, serializedUtf8Bytes } from "@/lib/map-matching-provider"
import type { MapMatchingResult, RawMatchingPoint } from "@/lib/map-matching-provider"

const raw: RawMatchingPoint[] = [
  { lat: 52.517037, lng: 13.38886, offsetMs: 0, accuracy: 5 },
  { lat: 52.5172, lng: 13.3892, offsetMs: 1_000, accuracy: 5 },
  { lat: 52.5174, lng: 13.3895, offsetMs: 2_000, accuracy: 5 },
]

function matched(overrides: Partial<Extract<MapMatchingResult, { status: "matched" }>> = {}): Extract<MapMatchingResult, { status: "matched" }> {
  return {
    status: "matched",
    provider: "osrm",
    rawPointCount: raw.length,
    tracepoints: raw.map((point, index) => ({
      lat: point.lat, lng: point.lng, matchingIndex: 0, waypointIndex: index,
      alternativesCount: 0, snapDistanceMeters: 0,
    })),
    matchings: [{ matchingIndex: 0, confidence: 0.91, geometry: {
      type: "LineString", coordinates: raw.map((point) => [point.lng, point.lat]),
    }}],
    matchedTrajectory: raw.map(({ lat, lng, offsetMs }) => ({ lat, lng, offsetMs })),
    snapDistancesMeters: [0, 0, 0],
    ...overrides,
  }
}

function rejection(result: ReturnType<typeof evaluateMapMatching>): string {
  if (result.decision !== "REJECT_MATCH") throw new Error("expected rejection")
  return result.reason
}

describe("P2-T24 map matching pure policy", () => {
  test("accepts a complete high-confidence single matching", () => {
    const result = evaluateMapMatching(raw, matched())
    expect(result.decision).toBe("ACCEPT_MATCH")
  })

  test("requires at least three raw points", () => {
    const candidate = raw.slice(0, 2)
    expect(isRawMatchingCandidate(candidate)).toBe(false)
    expect(matchingEligibilityReason(candidate)).toBe("insufficient_raw_points")
    expect(matchingEligibilityReason(raw.slice(0, 1))).toBe("insufficient_raw_points")
  })

  test("requires two non-zero movement segments", () => {
    const stationary = raw.map((point) => ({ ...point, lat: raw[0].lat, lng: raw[0].lng }))
    expect(isRawMatchingCandidate(stationary)).toBe(false)
    expect(matchingEligibilityReason(stationary)).toBe("insufficient_movement_segments")
  })

  test("rejects invalid coordinates and non-monotonic offsets", () => {
    expect(matchingEligibilityReason([{ ...raw[0], lat: 91 }, ...raw.slice(1)])).toBe("invalid_raw_points")
    expect(matchingEligibilityReason([raw[0], { ...raw[1], offsetMs: -1 }, raw[2]])).toBe("invalid_raw_points")
    expect(isRawMatchingCandidate([raw[0], { ...raw[1], offsetMs: 2_001 }, { ...raw[2], offsetMs: 2_000 }])).toBe(false)
    expect(matchingEligibilityReason(raw.map((point) => ({ ...point, accuracy: 101 })))).toBe("invalid_raw_points")
  })

  test("accepts a snap within the accuracy-derived 15m floor", () => {
    expect(evaluateMapMatching(raw, matched({ snapDistancesMeters: [14.99, 0, 0] })).decision).toBe("ACCEPT_MATCH")
  })

  test("rejects a snap beyond the accuracy-derived limit", () => {
    expect(rejection(evaluateMapMatching(raw, matched({ snapDistancesMeters: [15.01, 0, 0] })))).toBe("snap_distance_exceeded")
  })

  test("uses the conservative 15m limit when accuracy is absent", () => {
    const noAccuracy = raw.map(({ accuracy: _accuracy, ...point }) => point)
    expect(evaluateMapMatching(noAccuracy, matched({ snapDistancesMeters: [15, 0, 0] })).decision).toBe("ACCEPT_MATCH")
    expect(rejection(evaluateMapMatching(noAccuracy, matched({ snapDistancesMeters: [15.01, 0, 0] })))).toBe("snap_distance_exceeded")
  })

  test("rejects low confidence", () => {
    expect(rejection(evaluateMapMatching(raw, matched({ matchings: [{ ...matched().matchings[0], confidence: 0.749 }] })))).toBe("low_confidence")
  })

  test("rejects provider timeout and provider errors", () => {
    expect(rejection(evaluateMapMatching(raw, { status: "timeout", provider: "osrm" }))).toBe("provider_timeout")
    expect(rejection(evaluateMapMatching(raw, { status: "error", provider: "osrm", reason: "network_error" }))).toBe("provider_error")
  })

  test("rejects split or ambiguous matchings", () => {
    const base = matched()
    expect(rejection(evaluateMapMatching(raw, { ...base, matchings: [base.matchings[0], base.matchings[0]] }))).toBe("multiple_or_missing_matchings")
    expect(rejection(evaluateMapMatching(raw, { ...base, tracepoints: [base.tracepoints[0], null, base.tracepoints[2]] }))).toBe("null_tracepoint")
    expect(rejection(evaluateMapMatching(raw, { ...base, tracepoints: base.tracepoints.map((point) => point && { ...point, alternativesCount: 1 }) }))).toBe("ambiguous_tracepoints")
  })

  test("rejects out-of-order tracepoints and mismatched matching indexes", () => {
    const base = matched()
    expect(rejection(evaluateMapMatching(raw, { ...base, tracepoints: base.tracepoints.map((point, index) => point && { ...point, waypointIndex: index === 1 ? 2 : index === 2 ? 1 : index }) }))).toBe("ambiguous_tracepoints")
    expect(rejection(evaluateMapMatching(raw, { ...base, tracepoints: base.tracepoints.map((point, index) => point && { ...point, matchingIndex: index === 1 ? 1 : 0 }) }))).toBe("ambiguous_tracepoints")
  })

  test("rejects incomplete, overlong, or time-misaligned matched trajectories", () => {
    expect(rejection(evaluateMapMatching(raw, matched({ matchedTrajectory: [raw[0]] })))).toBe("invalid_matched_trajectory")
    expect(rejection(evaluateMapMatching(raw, matched({ matchedTrajectory: Array.from({ length: 49 }, (_, index) => ({ ...raw[0], offsetMs: index })) })))).toBe("invalid_matched_trajectory")
    expect(rejection(evaluateMapMatching(raw, matched({ matchedTrajectory: raw.map((point, index) => ({ ...point, offsetMs: index === 0 ? 1 : point.offsetMs })) })))).toBe("invalid_matched_trajectory")
  })

  test("rejects count mismatches and non-finite snap distances", () => {
    expect(rejection(evaluateMapMatching(raw, matched({ rawPointCount: 2 })))).toBe("raw_point_count_mismatch")
    expect(rejection(evaluateMapMatching(raw, matched({ snapDistancesMeters: [0, 0] })))).toBe("snap_distance_count_mismatch")
    expect(rejection(evaluateMapMatching(raw, matched({ snapDistancesMeters: [Number.NaN, 0, 0] })))).toBe("snap_distance_exceeded")
  })

  test("accepts zero-duration duplicate timestamps while preserving endpoints", () => {
    const duplicateTime = raw.map((point) => ({ ...point, offsetMs: 0 }))
    expect(evaluateMapMatching(duplicateTime, matched({ matchedTrajectory: duplicateTime.map(({ lat, lng, offsetMs }) => ({ lat, lng, offsetMs })) })).decision).toBe("ACCEPT_MATCH")
  })

  test("exposes the future realtime payload bound without coupling to a publisher", () => {
    expect(serializedUtf8Bytes({ points: raw })).toBeGreaterThan(0)
    expect(isMatchedRealtimePayloadWithinLimit({ points: raw })).toBe(true)
    expect(isMatchedRealtimePayloadWithinLimit({ points: "x".repeat(16_500) })).toBe(false)
  })
})
