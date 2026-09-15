import { describe, expect, test } from "bun:test"
import {
  acceptTrackingTrajectoryPoint,
  buildTrackingTrajectoryBatch,
  createTrackingTrajectoryBuffer,
  MAX_BATCH_DURATION_MS,
  MAX_BATCH_POINTS,
  MAX_MOVING_BATCH_AGE_MS,
  MAX_STALE_TRAJECTORY_BUFFER_AGE_MS,
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

  test("preserves optional accuracy for server matching while rejecting invalid accuracy", () => {
    const valid = [
      { lat: -34.6, lng: -58.4, offsetMs: 0, accuracy: 5 },
      { lat: -34.5999, lng: -58.4, offsetMs: 1_000, accuracy: 6 },
    ]
    const result = validateTrackingTrajectoryPayload(valid, -34.5999, -58.4)
    expect(result).toEqual({ ok: true, points: valid })
    expect(validateTrackingTrajectoryPayload([{ ...valid[0], accuracy: Number.NaN }], -34.6, -58.4).ok).toBe(false)
    expect(validateTrackingTrajectoryPayload([{ ...valid[0], accuracy: 101 }], -34.6, -58.4).ok).toBe(false)
  })
})

// ============================================
// P2-T23-H2 — calibrated MAX_MOVING_BATCH_AGE_MS, validated against the real
// R5.14B accepted-callback interval distribution (median ≈14.8s, real
// samples ranged 4.0s-17.3s, see P2_T23_H2 report §4/§7). These are NEW
// regression coverage for the calibration itself — the tests above already
// cover accept/reject/geometry mechanics unchanged by this task.
// ============================================
describe("P2-T23-H2 — calibrated batch age under realistic irregular cadence", () => {
  test("a realistic irregular accepted-point cadence (mirroring the real R5.14B gaps: 14.8s, 15.2s, each step ≈22m — the real magnitude of an accepted jump per P2_T23_H2 report §4) now produces a 2-point batch before the age-based flush, instead of two separate 1-point batches", () => {
    const buffer = createTrackingTrajectoryBuffer(sample(-34.6, -58.4, 0))
    // Real gaps from the R5.14B replay (seq 47->49, 49->52): 14777ms, 15203ms —
    // both individually under the new 15000ms age window's cumulative check
    // relative to the OLDEST buffered point, so both land in the same batch.
    // ~0.0002° steps ≈ 22.2m — the real order of magnitude an ACCEPTED jump
    // has in this dataset (anything smaller is jitter, rejected already).
    const r1 = acceptTrackingTrajectoryPoint(buffer, sample(-34.5998, -58.4, 14_777), 14_777)
    expect(r1.accepted).toBe(true)
    expect(shouldFlushTrackingTrajectory(buffer, 14_777)).toBe(false) // age not yet due, distance not yet due
    const r2 = acceptTrackingTrajectoryPoint(buffer, sample(-34.5996, -58.4, 14_777 + 15_203), 14_777 + 15_203)
    expect(r2.accepted).toBe(true)
    expect(buffer.points).toHaveLength(2) // BOTH real-magnitude accepted points survived into the same buffer
  })

  test("MAX_BATCH_DURATION_MS stays >= MAX_MOVING_BATCH_AGE_MS — a batch flushing right at the age boundary must never have its oldest point silently dropped by the wire-transport prefix cut", () => {
    expect(MAX_BATCH_DURATION_MS).toBeGreaterThanOrEqual(MAX_MOVING_BATCH_AGE_MS)
  })

  test("MAX_STALE_TRAJECTORY_BUFFER_AGE_MS stays >= MAX_MOVING_BATCH_AGE_MS — the safety-valve reset in use-repartidor-tracking.ts must never fire before the calibrated batch-age flush gets its chance", () => {
    expect(MAX_STALE_TRAJECTORY_BUFFER_AGE_MS).toBeGreaterThanOrEqual(MAX_MOVING_BATCH_AGE_MS)
  })

  test("a genuinely irregular sensor cadence (short gap then long gap, mirroring real GPS jitter) is still evaluated purely against the oldest buffered point's own age, never an average", () => {
    const buffer = createTrackingTrajectoryBuffer(sample(-34.6, -58.4, 0))
    acceptTrackingTrajectoryPoint(buffer, sample(-34.5999, -58.4, 4_031), 4_031) // short gap (real min observed)
    // Still well under the age window measured from the oldest BUFFERED point (4_031ms, not 0).
    expect(shouldFlushTrackingTrajectory(buffer, 4_031 + 5_000)).toBe(false)
    // Now well past the age window measured from that SAME oldest buffered point.
    expect(shouldFlushTrackingTrajectory(buffer, 4_031 + MAX_MOVING_BATCH_AGE_MS + 1)).toBe(true)
  })
})
