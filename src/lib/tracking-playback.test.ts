import { describe, expect, test } from "bun:test"
import {
  clampPlaybackProgress,
  getTrackingPlaybackDurationMs,
  interpolateTrackingPoint,
  sameTrackingPlaybackCoordinate,
  shouldSnapForTrackingGap,
  T23_INTERPOLATION_MAX_DURATION_MS,
  T23_INTERPOLATION_MIN_DURATION_MS,
  T23_LARGE_GAP_SNAP_THRESHOLD_MS,
} from "@/lib/tracking-playback"

describe("tracking playback policy", () => {
  test("clamps progress and never overshoots", () => {
    expect(clampPlaybackProgress(-1)).toBe(0)
    expect(clampPlaybackProgress(0.5)).toBe(0.5)
    expect(clampPlaybackProgress(2)).toBe(1)
    expect(interpolateTrackingPoint({ lat: 0, lng: 0 }, { lat: 10, lng: 20 }, 2)).toEqual({ lat: 10, lng: 20 })
  })

  test("interpolates only between the confirmed endpoints", () => {
    expect(interpolateTrackingPoint({ lat: 0, lng: 0 }, { lat: 10, lng: 20 }, 0)).toEqual({ lat: 0, lng: 0 })
    expect(interpolateTrackingPoint({ lat: 0, lng: 0 }, { lat: 10, lng: 20 }, 0.5)).toEqual({ lat: 5, lng: 10 })
    expect(interpolateTrackingPoint({ lat: 0, lng: 0 }, { lat: 10, lng: 20 }, 1)).toEqual({ lat: 10, lng: 20 })
  })

  test("recognizes same-coordinate heartbeats as non-animated", () => {
    expect(sameTrackingPlaybackCoordinate({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(true)
    expect(sameTrackingPlaybackCoordinate({ lat: 1, lng: 2 }, { lat: 1, lng: 2.000001 })).toBe(false)
    expect(sameTrackingPlaybackCoordinate(null, { lat: 1, lng: 2 })).toBe(false)
  })

  test("uses short bounded catch-up durations", () => {
    expect(getTrackingPlaybackDurationMs(null)).toBe(T23_INTERPOLATION_MIN_DURATION_MS)
    expect(getTrackingPlaybackDurationMs(100)).toBe(T23_INTERPOLATION_MIN_DURATION_MS)
    expect(getTrackingPlaybackDurationMs(2_000)).toBe(500)
    expect(getTrackingPlaybackDurationMs(5_000)).toBe(T23_INTERPOLATION_MAX_DURATION_MS)
    expect(getTrackingPlaybackDurationMs(60_000)).toBe(T23_INTERPOLATION_MAX_DURATION_MS)
    expect(T23_INTERPOLATION_MAX_DURATION_MS).toBeLessThan(5_000)
  })

  test("snaps only when a finite arrival gap exceeds the large-gap threshold", () => {
    expect(shouldSnapForTrackingGap(null)).toBe(false)
    expect(shouldSnapForTrackingGap(T23_LARGE_GAP_SNAP_THRESHOLD_MS)).toBe(false)
    expect(shouldSnapForTrackingGap(T23_LARGE_GAP_SNAP_THRESHOLD_MS + 1)).toBe(true)
    expect(shouldSnapForTrackingGap(120_000)).toBe(true)
  })

  test("clamps NaN and infinity to a safe starting progress", () => {
    expect(clampPlaybackProgress(Number.NaN)).toBe(0)
    expect(clampPlaybackProgress(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampPlaybackProgress(Number.NEGATIVE_INFINITY)).toBe(0)
  })

  test("progress is monotonic for a positive segment", () => {
    const start = { lat: -26, lng: -58 }
    const target = { lat: -25, lng: -57 }
    const samples = [0, 0.25, 0.5, 0.75, 1].map((progress) => interpolateTrackingPoint(start, target, progress))
    expect(samples.map((point) => point.lat)).toEqual([-26, -25.75, -25.5, -25.25, -25])
    expect(samples.map((point) => point.lng)).toEqual([-58, -57.75, -57.5, -57.25, -57])
  })

  test("progress below zero stays at the confirmed start", () => {
    expect(interpolateTrackingPoint({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, -1)).toEqual({ lat: 1, lng: 2 })
  })

  test("progress beyond one stays at the confirmed target", () => {
    expect(interpolateTrackingPoint({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, 5)).toEqual({ lat: 3, lng: 4 })
  })

  test("a zero arrival gap uses the minimum animation duration", () => {
    expect(getTrackingPlaybackDurationMs(0)).toBe(T23_INTERPOLATION_MIN_DURATION_MS)
  })

  test("a short arrival gap scales to a short catch-up duration", () => {
    expect(getTrackingPlaybackDurationMs(1_000)).toBe(250)
    expect(getTrackingPlaybackDurationMs(3_000)).toBe(750)
  })

  test("a very large arrival gap does not create a long animation", () => {
    expect(getTrackingPlaybackDurationMs(Number.MAX_SAFE_INTEGER)).toBe(T23_INTERPOLATION_MAX_DURATION_MS)
  })

  test("negative arrival gaps remain bounded and do not extrapolate", () => {
    expect(getTrackingPlaybackDurationMs(-5_000)).toBe(T23_INTERPOLATION_MIN_DURATION_MS)
    expect(shouldSnapForTrackingGap(-5_000)).toBe(false)
  })

  test("same-coordinate comparison is exact and deterministic", () => {
    expect(sameTrackingPlaybackCoordinate({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(true)
    expect(sameTrackingPlaybackCoordinate({ lat: 1, lng: 2 }, { lat: 1, lng: 2 + 1e-12 })).toBe(false)
  })
})
