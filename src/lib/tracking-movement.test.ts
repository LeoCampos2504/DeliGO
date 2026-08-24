// ============================================
// P2-T02 (P2T02-MODEL-E1) — tracking-movement.ts pure logic tests
// ============================================
import { describe, expect, test } from "bun:test"
import {
  INVALID_ACCURACY_FALLBACK_METERS,
  MOVEMENT_BASE_DISTANCE_METERS,
  SAMPLE_REUSE_MAX_AGE_MS,
  buildSampleFromPosition,
  effectiveMovementThresholdMeters,
  haversineDistanceMeters,
  isCandidateSampleNewer,
  isSampleFresh,
  isSignificantMovement,
  sanitizeAccuracy,
  type TrackingLocationSample,
} from "./tracking-movement"

function sample(overrides: Partial<TrackingLocationSample> = {}): TrackingLocationSample {
  return { lat: -34.6, lng: -58.4, accuracy: 10, capturedAt: 1_000_000, ...overrides }
}

describe("haversineDistanceMeters", () => {
  test("T-HAV-01: zero distance between identical points", () => {
    expect(haversineDistanceMeters({ lat: -34.6, lng: -58.4 }, { lat: -34.6, lng: -58.4 })).toBe(0)
  })

  test("T-HAV-02: known distance — Buenos Aires to a point ~1.1km north", () => {
    // 0.01 deg of latitude is ~1111m — well-known approximation.
    const distance = haversineDistanceMeters({ lat: -34.6, lng: -58.4 }, { lat: -34.59, lng: -58.4 })
    expect(distance).toBeGreaterThan(1000)
    expect(distance).toBeLessThan(1200)
  })
})

describe("sanitizeAccuracy", () => {
  test("finite non-negative number passes through unchanged", () => {
    expect(sanitizeAccuracy(25)).toBe(25)
    expect(sanitizeAccuracy(0)).toBe(0)
  })

  test("invalid accuracy (NaN/negative/non-number/undefined) falls back to the conservative constant", () => {
    expect(sanitizeAccuracy(NaN)).toBe(INVALID_ACCURACY_FALLBACK_METERS)
    expect(sanitizeAccuracy(-5)).toBe(INVALID_ACCURACY_FALLBACK_METERS)
    expect(sanitizeAccuracy("50")).toBe(INVALID_ACCURACY_FALLBACK_METERS)
    expect(sanitizeAccuracy(undefined)).toBe(INVALID_ACCURACY_FALLBACK_METERS)
    expect(sanitizeAccuracy(Infinity)).toBe(INVALID_ACCURACY_FALLBACK_METERS)
  })
})

describe("effectiveMovementThresholdMeters", () => {
  test("never below MOVEMENT_BASE_DISTANCE_METERS even with excellent accuracy on both samples", () => {
    expect(effectiveMovementThresholdMeters(1, 1)).toBe(MOVEMENT_BASE_DISTANCE_METERS)
  })

  test("sum-of-accuracy dominates once accuracy is poor enough", () => {
    expect(effectiveMovementThresholdMeters(40, 30)).toBe(70)
  })

  test("invalid accuracy on either side falls back to the conservative constant before summing", () => {
    expect(effectiveMovementThresholdMeters(NaN, 5)).toBe(Math.max(MOVEMENT_BASE_DISTANCE_METERS, INVALID_ACCURACY_FALLBACK_METERS + 5))
  })
})

describe("isSignificantMovement", () => {
  test("no previous sample -> trivially significant (initial-send path, not a real distance comparison)", () => {
    expect(isSignificantMovement(null, { lat: 0, lng: 0, accuracy: 10 })).toBe(true)
  })

  test("below the effective threshold (excellent accuracy) -> not significant", () => {
    const previous = { lat: -34.6, lng: -58.4, accuracy: 5 }
    // ~5m north — well under max(15, 5+5)=15
    const next = { lat: -34.59996, lng: -58.4, accuracy: 5 }
    expect(isSignificantMovement(previous, next)).toBe(false)
  })

  test("above the effective threshold -> significant", () => {
    const previous = { lat: -34.6, lng: -58.4, accuracy: 5 }
    // ~1.1km north — well over the threshold
    const next = { lat: -34.59, lng: -58.4, accuracy: 5 }
    expect(isSignificantMovement(previous, next)).toBe(true)
  })

  test("apparent movement fully explained by poor accuracy on both sides -> suppressed", () => {
    const previous = { lat: -34.6, lng: -58.4, accuracy: 40 }
    // ~5m north with accuracy 40+40=80 threshold — well under
    const next = { lat: -34.59996, lng: -58.4, accuracy: 40 }
    expect(isSignificantMovement(previous, next)).toBe(false)
  })
})

describe("isSampleFresh", () => {
  test("null/undefined sample is never fresh", () => {
    expect(isSampleFresh(null, 1_000_000)).toBe(false)
    expect(isSampleFresh(undefined, 1_000_000)).toBe(false)
  })

  test("age within the window is fresh", () => {
    const s = sample({ capturedAt: 1_000_000 })
    expect(isSampleFresh(s, 1_000_000 + SAMPLE_REUSE_MAX_AGE_MS)).toBe(true)
  })

  test("exact boundary (age === maxAgeMs) is still fresh (inclusive)", () => {
    const s = sample({ capturedAt: 1_000_000 })
    expect(isSampleFresh(s, 1_000_000 + SAMPLE_REUSE_MAX_AGE_MS, SAMPLE_REUSE_MAX_AGE_MS)).toBe(true)
  })

  test("one ms past the boundary is stale", () => {
    const s = sample({ capturedAt: 1_000_000 })
    expect(isSampleFresh(s, 1_000_000 + SAMPLE_REUSE_MAX_AGE_MS + 1, SAMPLE_REUSE_MAX_AGE_MS)).toBe(false)
  })

  test("stale sample (age well past the window) is not fresh", () => {
    const s = sample({ capturedAt: 1_000_000 })
    expect(isSampleFresh(s, 1_000_000 + 120_000)).toBe(false)
  })

  test("a capturedAt in the future relative to now is never treated as fresh", () => {
    const s = sample({ capturedAt: 2_000_000 })
    expect(isSampleFresh(s, 1_000_000)).toBe(false)
  })

  test("non-finite capturedAt or now never reuses as fresh", () => {
    expect(isSampleFresh(sample({ capturedAt: NaN }), 1_000_000)).toBe(false)
    expect(isSampleFresh(sample({ capturedAt: 1_000_000 }), NaN)).toBe(false)
  })
})

describe("isCandidateSampleNewer", () => {
  test("any candidate is newer than a null current", () => {
    expect(isCandidateSampleNewer(sample({ capturedAt: 1 }), null)).toBe(true)
  })

  test("a strictly newer candidate wins", () => {
    expect(isCandidateSampleNewer(sample({ capturedAt: 2000 }), sample({ capturedAt: 1000 }))).toBe(true)
  })

  test("an older candidate never overwrites a newer current (late one-shot vs newer watch callback)", () => {
    expect(isCandidateSampleNewer(sample({ capturedAt: 1000 }), sample({ capturedAt: 2000 }))).toBe(false)
  })

  test("equal capturedAt counts as newer-or-equal (candidate wins ties)", () => {
    expect(isCandidateSampleNewer(sample({ capturedAt: 1000 }), sample({ capturedAt: 1000 }))).toBe(true)
  })
})

describe("buildSampleFromPosition", () => {
  test("uses GeolocationPosition.timestamp when it is a finite number", () => {
    const s = buildSampleFromPosition({ coords: { latitude: 1, longitude: 2, accuracy: 10 }, timestamp: 12345 })
    expect(s.capturedAt).toBe(12345)
    expect(s.lat).toBe(1)
    expect(s.lng).toBe(2)
    expect(s.accuracy).toBe(10)
  })

  test("falls back to the injected now() only when timestamp is not finite", () => {
    const s = buildSampleFromPosition(
      { coords: { latitude: 1, longitude: 2, accuracy: 10 }, timestamp: NaN },
      () => 99999
    )
    expect(s.capturedAt).toBe(99999)
  })

  test("sanitizes accuracy the same way as sanitizeAccuracy", () => {
    const s = buildSampleFromPosition({ coords: { latitude: 1, longitude: 2, accuracy: -1 }, timestamp: 1 })
    expect(s.accuracy).toBe(INVALID_ACCURACY_FALLBACK_METERS)
  })
})
