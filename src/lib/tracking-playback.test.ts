import { describe, expect, test } from "bun:test"
import {
  clampPlaybackProgress,
  createTrackingPlaybackController,
  getTrackingPlaybackDurationMs,
  getTrackingTrajectorySegmentDurationMs,
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

function createRafHarness(initialPoint = { lat: 0, lng: 0 }) {
  let now = 0
  let nextId = 0
  const frames = new Map<number, (timestamp: number) => void>()
  const writes: Array<[number, number]> = []
  const marker = {
    position: { ...initialPoint },
    setLatLng(position: [number, number]) {
      this.position = { lat: position[0], lng: position[1] }
      writes.push(position)
    },
    getLatLng() {
      return this.position
    },
  }
  const controller = createTrackingPlaybackController({
    marker,
    now: () => now,
    requestFrame: (callback) => {
      const id = ++nextId
      frames.set(id, callback)
      return id
    },
    cancelFrame: (id) => { frames.delete(id) },
  })
  return {
    marker,
    controller,
    writes,
    frames,
    step(timestamp: number) {
      now = timestamp
      const next = frames.entries().next().value as [number, (timestamp: number) => void] | undefined
      if (!next) throw new Error("No animation frame scheduled")
      frames.delete(next[0])
      next[1](timestamp)
    },
  }
}

const trajectory = [
  { lat: 0, lng: 0, offsetMs: 0 },
  { lat: 1, lng: 0, offsetMs: 500 },
  { lat: 1, lng: 1, offsetMs: 1_300 },
]

describe("confirmed trajectory playback controller", () => {
  test("first trajectory snaps to A and never snaps directly to the final point", () => {
    const harness = createRafHarness()
    const result = harness.controller.acceptConfirmedEvent({ point: trajectory[2], version: 1, trajectory })

    expect(result).toBe("accepted")
    expect(harness.marker.position).toEqual({ lat: 0, lng: 0 })
    expect(harness.writes[0]).toEqual([0, 0])
    expect(harness.marker.position).not.toEqual({ lat: 1, lng: 1 })
    expect(harness.controller.snapshot().authoritativePoint).toEqual({ lat: 1, lng: 1 })
  })

  test("the real marker writer receives an intermediate frame and exact B/C endpoints", () => {
    const harness = createRafHarness()
    harness.controller.acceptConfirmedEvent({ point: trajectory[2], version: 1, trajectory })

    harness.step(250)
    expect(harness.marker.position.lat).toBeGreaterThan(0)
    expect(harness.marker.position.lat).toBeLessThan(1)

    harness.step(500)
    expect(harness.marker.position).toEqual({ lat: 1, lng: 0 })

    harness.step(1_250)
    expect(harness.marker.position).toEqual({ lat: 1, lng: 1 })
    expect(harness.writes).toContainEqual([1, 0])
    expect(harness.writes).toContainEqual([1, 1])
  })

  test("does not write the final point synchronously before trajectory playback", () => {
    const harness = createRafHarness()
    harness.controller.acceptConfirmedEvent({ point: trajectory[2], version: 1, trajectory })

    expect(harness.writes).not.toContainEqual([1, 1])
    expect(harness.frames.size).toBe(1)
  })

  test("uses relative offsets with defensive 80–750ms segment limits", () => {
    expect(getTrackingTrajectorySegmentDurationMs(0, 500)).toBe(500)
    expect(getTrackingTrajectorySegmentDurationMs(500, 1_300)).toBe(750)
    expect(getTrackingTrajectorySegmentDurationMs(0, 5_000, 2)).toBe(750)
    expect(getTrackingTrajectorySegmentDurationMs(0, 10)).toBe(80)
  })

  test("keeps one active batch plus one pending batch and replaces only pending overflow", () => {
    const harness = createRafHarness()
    harness.controller.seedRenderedPoint({ lat: 0, lng: 0 }, 0)
    const batch1 = trajectory
    const batch2 = [
      { lat: 1, lng: 0, offsetMs: 0 },
      { lat: 2, lng: 0, offsetMs: 500 },
    ]
    const batch3 = [
      { lat: 2, lng: 0, offsetMs: 0 },
      { lat: 3, lng: 0, offsetMs: 500 },
    ]
    harness.controller.acceptConfirmedEvent({ point: batch1[2], version: 1, trajectory: batch1 })
    harness.controller.acceptConfirmedEvent({ point: batch2[1], version: 2, trajectory: batch2 })
    harness.controller.acceptConfirmedEvent({ point: batch3[1], version: 3, trajectory: batch3 })

    expect(harness.controller.snapshot()).toMatchObject({
      activeBatchVersion: 1,
      pendingBatchVersion: 3,
      rafActive: true,
    })
    expect(harness.controller.acceptConfirmedEvent({ point: batch2[1], version: 2, trajectory: batch2 })).toBe("discarded_old_version")
  })

  test("same-version heartbeats and old trajectories do not restart or roll back visual playback", () => {
    const harness = createRafHarness({ lat: 1, lng: 1 })
    harness.controller.seedRenderedPoint({ lat: 1, lng: 1 }, 8)
    expect(harness.controller.acceptConfirmedEvent({ point: { lat: 1, lng: 1 }, version: 8 })).toBe("duplicate")
    expect(harness.controller.acceptConfirmedEvent({ point: trajectory[2], version: 7, trajectory })).toBe("discarded_old_version")
    expect(harness.frames.size).toBe(0)
    expect(harness.writes).toHaveLength(0)
  })

  test("stale cancels active and pending batches, then recovery snaps to the fresh last point", () => {
    const harness = createRafHarness()
    harness.controller.seedRenderedPoint({ lat: 0, lng: 0 }, 1)
    harness.controller.acceptConfirmedEvent({ point: trajectory[2], version: 2, trajectory })
    harness.controller.cancelForStale()
    expect(harness.controller.snapshot()).toMatchObject({
      activeBatchVersion: null,
      pendingBatchVersion: null,
      rafActive: false,
      needsRecoverySnap: true,
    })
    const fresh = [
      { lat: 5, lng: 5, offsetMs: 0 },
      { lat: 6, lng: 6, offsetMs: 400 },
    ]
    expect(harness.controller.acceptConfirmedEvent({ point: fresh[1], version: 3, trajectory: fresh })).toBe("recovery_snapped")
    expect(harness.marker.position).toEqual({ lat: 6, lng: 6 })
    expect(harness.frames.size).toBe(0)
  })

  test("HTTP fallback snaps to the latest point and completion prevents later movement", () => {
    const harness = createRafHarness({ lat: 0, lng: 0 })
    harness.controller.seedRenderedPoint({ lat: 0, lng: 0 }, 1)
    expect(harness.controller.acceptConfirmedEvent({ point: { lat: 9, lng: 9 }, version: 2, source: "http" })).toBe("accepted")
    expect(harness.marker.position).toEqual({ lat: 9, lng: 9 })
    harness.controller.cancelForCompletion()
    expect(harness.controller.acceptConfirmedEvent({ point: { lat: 10, lng: 10 }, version: 3, trajectory })).toBe("ignored_invalid")
    expect(harness.marker.position).toEqual({ lat: 9, lng: 9 })
  })
})
