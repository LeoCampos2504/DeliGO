import { describe, expect, test } from "bun:test"
import {
  acceptTrackingTrajectoryPoint,
  buildTrackingTrajectoryBatch,
  createTrackingTrajectoryBuffer,
  MAX_BATCH_POINTS,
  MAX_MOVING_BATCH_AGE_MS,
  shouldFlushTrackingTrajectory,
  validateTrackingTrajectoryPayload,
} from "@/lib/tracking-trajectory"
import type { TrackingLocationSample } from "@/lib/tracking-movement"

function sample(lat: number, lng: number, capturedAt: number, accuracy = 5): TrackingLocationSample {
  return { lat, lng, capturedAt, accuracy }
}

describe("bounded trajectory producer", () => {
  test("preserves useful A/B/C geometry while separating point acceptance from network distance", () => {
    const buffer = createTrackingTrajectoryBuffer(sample(-34.6, -58.4, 1_000))
    expect(acceptTrackingTrajectoryPoint(buffer, sample(-34.5999, -58.4, 2_000), 2_000).accepted).toBe(true)
    expect(acceptTrackingTrajectoryPoint(buffer, sample(-34.5999, -58.3999, 3_000), 3_000).accepted).toBe(true)
    expect(buffer.points).toHaveLength(2)
    expect(buffer.accumulatedDistanceMeters).toBeGreaterThan(15)
    expect(buildTrackingTrajectoryBatch(buffer)?.points.map(({ lat, lng }) => ({ lat, lng }))).toEqual([
      { lat: -34.6, lng: -58.4 },
      { lat: -34.5999, lng: -58.4 },
      { lat: -34.5999, lng: -58.3999 },
    ])
  })

  test("rejects exact duplicates, stationary jitter, bad accuracy, NaN, invalid time, and non-monotonic time", () => {
    const buffer = createTrackingTrajectoryBuffer(sample(-34.6, -58.4, 1_000))
    expect(acceptTrackingTrajectoryPoint(buffer, sample(-34.6, -58.4, 2_000), 2_000).reason).toBe("duplicate_point")
    expect(acceptTrackingTrajectoryPoint(buffer, sample(-34.59999, -58.4, 3_000), 3_000).reason).toBe("stationary_jitter")
    expect(acceptTrackingTrajectoryPoint(buffer, sample(-34.5999, -58.4, 4_000, Number.NaN), 4_000).reason).toBe("invalid_accuracy")
    expect(acceptTrackingTrajectoryPoint(buffer, sample(Number.NaN, -58.4, 5_000), 5_000).reason).toBe("invalid_coordinates")
    expect(acceptTrackingTrajectoryPoint(buffer, sample(-34.5999, -58.4, Number.NaN), 5_000).reason).toBe("invalid_captured_at")
    expect(acceptTrackingTrajectoryPoint(buffer, sample(-34.5999, -58.4, 900), 5_000).reason).toBe("non_monotonic_timestamp")
  })

  test("keeps impossible jumps out and remains bounded", () => {
    const buffer = createTrackingTrajectoryBuffer(sample(-34.6, -58.4, 1_000))
    expect(acceptTrackingTrajectoryPoint(buffer, sample(-34.5, -58.4, 1_001), 1_001).reason).toBe("impossible_jump")
    for (let i = 1; i < MAX_BATCH_POINTS; i += 1) {
      expect(acceptTrackingTrajectoryPoint(buffer, sample(-34.6 + i * 0.0001, -58.4, 1_000 + i * 1_000), 1_000 + i * 1_000).accepted).toBe(true)
    }
    expect(buffer.points.length + 1).toBe(MAX_BATCH_POINTS)
    expect(acceptTrackingTrajectoryPoint(buffer, sample(-34.5988, -58.4, 20_000), 20_000).reason).toBe("max_points")
  })

  test("flushes by accumulated distance or moving age, never from an empty/stationary buffer", () => {
    const distanceBuffer = createTrackingTrajectoryBuffer(sample(-34.6, -58.4, 1_000))
    acceptTrackingTrajectoryPoint(distanceBuffer, sample(-34.5996, -58.4, 2_000), 2_000)
    expect(shouldFlushTrackingTrajectory(distanceBuffer, 2_000)).toBe(true)

    const ageBuffer = createTrackingTrajectoryBuffer(sample(-34.6, -58.4, 1_000))
    acceptTrackingTrajectoryPoint(ageBuffer, sample(-34.5999, -58.4, 2_000), 2_000)
    expect(shouldFlushTrackingTrajectory(ageBuffer, 2_000 + MAX_MOVING_BATCH_AGE_MS)).toBe(true)
    expect(shouldFlushTrackingTrajectory(createTrackingTrajectoryBuffer(sample(-34.6, -58.4, 1_000)), 99_000)).toBe(false)
  })

  test("validates wire ordering, last-point coherence, and bounded distance", () => {
    const valid = [
      { lat: -34.6, lng: -58.4, offsetMs: 0 },
      { lat: -34.5999, lng: -58.4, offsetMs: 1_000 },
    ]
    expect(validateTrackingTrajectoryPayload(valid, -34.5999, -58.4).ok).toBe(true)
    expect(validateTrackingTrajectoryPayload([{ ...valid[0], offsetMs: -1 }], -34.6, -58.4).ok).toBe(false)
    expect(validateTrackingTrajectoryPayload(valid, -34.6, -58.4).ok).toBe(false)
    expect(validateTrackingTrajectoryPayload([{ lat: -34.6, lng: -58.4, offsetMs: 0 }, { lat: -34.6, lng: -58.4, offsetMs: 1 }], -34.6, -58.4).ok).toBe(false)
  })
})
