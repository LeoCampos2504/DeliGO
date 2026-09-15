import { haversineDistanceMeters, type TrackingLocationSample } from "@/lib/tracking-movement"

// R3A transport/buffer limits. The local point spacing is deliberately lower
// than the current network movement threshold: preserving geometry and
// deciding when to send are separate policies.
export const MIN_DISTANCE_BETWEEN_BUFFERED_POINTS_METERS = 5
export const TRAJECTORY_ACCURACY_WEIGHT = 0.5
export const TRAJECTORY_POINT_MAX_ACCURACY_METERS = 100
// Deliberately permissive for GPS callback gaps (a delayed 1 km callback is
// valid input to the producer); only clearly impossible coordinate jumps are
// rejected here, without map matching or road assumptions.
export const MAX_REASONABLE_TRAJECTORY_SPEED_MPS = 10_000_000
export const MAX_LOCAL_TRAJECTORY_POINTS = 12
// Governs a single INCOMING sample's own freshness (acceptTrackingTrajectoryPoint's
// "sample_too_old" rejection) — a GPS fix delivered this late is untrustworthy
// on its own terms, independent of any batching policy. Deliberately kept
// short and untouched by the P2-T23-H2 batch-age calibration below — this is
// about sensor-fix staleness, never about how long the BUFFER may accumulate.
export const MAX_LOCAL_TRAJECTORY_AGE_MS = 5_000
// P2-T23-H2: distinct from MAX_LOCAL_TRAJECTORY_AGE_MS above — this one
// governs how long an unflushed buffer may sit before use-repartidor-tracking.ts's
// safety valve gives up and resets it (considerSampleForDelivery's
// oldestPending check). Must stay >= MAX_MOVING_BATCH_AGE_MS or that safety
// reset would fire and wipe the buffer BEFORE the batch-age flush this task
// exists to enable ever gets a chance to occur — kept with the same margin
// as MAX_BATCH_DURATION_MS below.
export const MAX_STALE_TRAJECTORY_BUFFER_AGE_MS = 16_000
export const BATCH_ACCUMULATED_DISTANCE_FLUSH_THRESHOLD_METERS = 30
// P2-T23-H2 (calibrated against the real R5.14B raw callback replay, not a
// theoretical guess): the previous 3000ms was shorter than the GPS callback
// median itself (4411ms), which structurally guaranteed 1-point batches
// (P2_T23_H1_RAW_SMOOTHNESS_REALTIME_RECOVERY_AUDIT.md §3). Replaying the
// real accepted-callback sequence from that probe (median gap ≈14.8s between
// callbacks the movement filter actually accepts, not raw GPS callbacks)
// through this exact acceptTrackingTrajectoryPoint/shouldFlushTrackingTrajectory
// logic shows 3000-10000ms still yields a batch-point median of 1 (P2_T23_H2
// report §7/§14); 15000ms is the first value where the median rises to 2 and
// ~2/3 of batches reach 2+ wire points, without requiring any change to the
// movement filter itself (which stays exactly as conservative as before).
// Reaching a median of 3+ would require loosening acceptance too — deferred
// pending a dedicated stationary-safety calibration probe (H2A §10/§13).
export const MAX_MOVING_BATCH_AGE_MS = 15_000
export const MAX_BATCH_POINTS = 12
// P2-T23-H2: must stay >= MAX_MOVING_BATCH_AGE_MS, or buildTrackingTrajectoryBatch's
// own prefix-drop (line ~190) would silently truncate exactly the older point
// this wider batch window was raised to preserve. Kept with a small margin
// above the new age, not equal to it, so a batch flushing right at the age
// boundary never loses its oldest point to this independent transport cap.
export const MAX_BATCH_DURATION_MS = 16_000
export const MAX_BATCH_DISTANCE_METERS = 150
export const MAX_BATCH_PAYLOAD_BYTES = 8_192

export interface TrackingTrajectoryWirePoint {
  lat: number
  lng: number
  offsetMs: number
  /** Optional live-only GPS accuracy; never persisted or emitted realtime. */
  accuracy?: number
}

export type RealtimeTrackingTrajectoryPoint = Omit<TrackingTrajectoryWirePoint, "accuracy">

export interface TrackingTrajectoryBuffer {
  anchor: TrackingLocationSample | null
  points: TrackingLocationSample[]
  accumulatedDistanceMeters: number
}

export interface TrackingTrajectoryBatch {
  points: TrackingTrajectoryWirePoint[]
  sourceSamples: TrackingLocationSample[]
  lastSample: TrackingLocationSample
  distanceMeters: number
}

export type TrajectoryPointRejectionReason =
  | "invalid_coordinates"
  | "invalid_accuracy"
  | "invalid_captured_at"
  | "future_captured_at"
  | "sample_too_old"
  | "non_monotonic_timestamp"
  | "duplicate_point"
  | "stationary_jitter"
  | "impossible_jump"
  | "max_points"

export interface TrajectoryPointAcceptanceResult {
  accepted: boolean
  reason?: TrajectoryPointRejectionReason
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isValidSample(sample: TrackingLocationSample): boolean {
  return (
    isFiniteNumber(sample.lat) &&
    sample.lat >= -90 &&
    sample.lat <= 90 &&
    isFiniteNumber(sample.lng) &&
    sample.lng >= -180 &&
    sample.lng <= 180
  )
}

function effectiveTrajectoryPointThresholdMeters(
  previous: TrackingLocationSample,
  next: TrackingLocationSample,
): number {
  return Math.max(
    MIN_DISTANCE_BETWEEN_BUFFERED_POINTS_METERS,
    TRAJECTORY_ACCURACY_WEIGHT * (previous.accuracy + next.accuracy),
  )
}

function lastBufferedSample(buffer: TrackingTrajectoryBuffer): TrackingLocationSample | null {
  return buffer.points.at(-1) ?? buffer.anchor
}

function batchSourceSamples(buffer: TrackingTrajectoryBuffer): TrackingLocationSample[] {
  return buffer.anchor ? [buffer.anchor, ...buffer.points] : [...buffer.points]
}

function recalculateAccumulatedDistance(buffer: TrackingTrajectoryBuffer): void {
  let previous = buffer.anchor
  let distance = 0
  for (const point of buffer.points) {
    if (previous) distance += haversineDistanceMeters(previous, point)
    previous = point
  }
  buffer.accumulatedDistanceMeters = distance
}

export function createTrackingTrajectoryBuffer(
  anchor: TrackingLocationSample | null = null,
): TrackingTrajectoryBuffer {
  return { anchor, points: [], accumulatedDistanceMeters: 0 }
}

export function resetTrackingTrajectoryBuffer(
  buffer: TrackingTrajectoryBuffer,
  anchor: TrackingLocationSample,
): void {
  buffer.anchor = anchor
  buffer.points = []
  buffer.accumulatedDistanceMeters = 0
}

export function acceptTrackingTrajectoryPoint(
  buffer: TrackingTrajectoryBuffer,
  sample: TrackingLocationSample,
  now: number,
): TrajectoryPointAcceptanceResult {
  if (!isValidSample(sample)) return { accepted: false, reason: "invalid_coordinates" }
  if (!isFiniteNumber(sample.accuracy) || sample.accuracy < 0 || sample.accuracy > TRAJECTORY_POINT_MAX_ACCURACY_METERS) {
    return { accepted: false, reason: "invalid_accuracy" }
  }
  if (!isFiniteNumber(sample.capturedAt) || !isFiniteNumber(now)) {
    return { accepted: false, reason: "invalid_captured_at" }
  }
  if (buffer.points.length >= MAX_LOCAL_TRAJECTORY_POINTS || batchSourceSamples(buffer).length >= MAX_BATCH_POINTS) {
    return { accepted: false, reason: "max_points" }
  }
  if (sample.capturedAt > now) return { accepted: false, reason: "future_captured_at" }
  if (now - sample.capturedAt > MAX_LOCAL_TRAJECTORY_AGE_MS) {
    return { accepted: false, reason: "sample_too_old" }
  }

  const previous = lastBufferedSample(buffer)
  if (!previous) {
    buffer.anchor = sample
    return { accepted: true }
  }
  if (sample.capturedAt <= previous.capturedAt) {
    return { accepted: false, reason: "non_monotonic_timestamp" }
  }

  const distance = haversineDistanceMeters(previous, sample)
  if (distance === 0) return { accepted: false, reason: "duplicate_point" }
  if (distance <= effectiveTrajectoryPointThresholdMeters(previous, sample)) {
    return { accepted: false, reason: "stationary_jitter" }
  }

  const elapsedMs = sample.capturedAt - previous.capturedAt
  const speedMps = distance / (elapsedMs / 1_000)
  if (!Number.isFinite(speedMps) || speedMps > MAX_REASONABLE_TRAJECTORY_SPEED_MPS) {
    return { accepted: false, reason: "impossible_jump" }
  }

  buffer.points.push(sample)
  buffer.accumulatedDistanceMeters += distance
  return { accepted: true }
}

export function shouldFlushTrackingTrajectory(
  buffer: TrackingTrajectoryBuffer,
  now: number,
): boolean {
  if (buffer.points.length === 0) return false
  const oldestMovingPoint = buffer.points[0]
  return (
    batchSourceSamples(buffer).length >= MAX_BATCH_POINTS ||
    buffer.accumulatedDistanceMeters >= BATCH_ACCUMULATED_DISTANCE_FLUSH_THRESHOLD_METERS ||
    now - oldestMovingPoint.capturedAt >= MAX_MOVING_BATCH_AGE_MS
  )
}

export function buildTrackingTrajectoryBatch(
  buffer: TrackingTrajectoryBuffer,
): TrackingTrajectoryBatch | null {
  if (buffer.points.length === 0) return null

  const allSamples = batchSourceSamples(buffer)
  const lastCapturedAt = allSamples[allSamples.length - 1].capturedAt
  // A delayed callback may arrive after the prior confirmed anchor is older
  // than the visual timing window. Drop only that stale prefix; the latest
  // accepted movement still forms a valid one-point batch rather than being
  // silently lost or transported with an out-of-window offset.
  const sourceSamples = allSamples.filter(
    (sample) => lastCapturedAt - sample.capturedAt <= MAX_BATCH_DURATION_MS,
  )
  const firstCapturedAt = sourceSamples[0].capturedAt
  const points = sourceSamples.map((sample) => ({
    lat: sample.lat,
    lng: sample.lng,
    offsetMs: sample.capturedAt - firstCapturedAt,
    ...(isFiniteNumber(sample.accuracy) ? { accuracy: sample.accuracy } : {}),
  }))
  const lastSample = sourceSamples[sourceSamples.length - 1]
  let distanceMeters = 0
  for (let index = 1; index < sourceSamples.length; index += 1) {
    distanceMeters += haversineDistanceMeters(sourceSamples[index - 1], sourceSamples[index])
  }
  return {
    points,
    sourceSamples,
    lastSample,
    distanceMeters,
  }
}

export function acknowledgeTrackingTrajectoryBatch(
  buffer: TrackingTrajectoryBuffer,
  batch: TrackingTrajectoryBatch,
): void {
  buffer.anchor = batch.lastSample
  buffer.points = buffer.points.filter((sample) => sample.capturedAt > batch.lastSample.capturedAt)
  recalculateAccumulatedDistance(buffer)
}

export function validateTrackingTrajectoryPayload(
  trajectory: unknown,
  topLevelLat: unknown,
  topLevelLng: unknown,
): { ok: true; points: TrackingTrajectoryWirePoint[] } | { ok: false; reason: string } {
  if (!Array.isArray(trajectory)) return { ok: false, reason: "trajectory_not_array" }
  if (trajectory.length < 1 || trajectory.length > MAX_BATCH_POINTS) {
    return { ok: false, reason: "trajectory_point_count" }
  }
  if (!isFiniteNumber(topLevelLat) || !isFiniteNumber(topLevelLng)) {
    return { ok: false, reason: "invalid_top_level_coordinates" }
  }

  let previousOffset = -1
  let previousPoint: TrackingTrajectoryWirePoint | null = null
  let distanceMeters = 0
  const points: TrackingTrajectoryWirePoint[] = []
  for (const candidate of trajectory) {
    if (!candidate || typeof candidate !== "object") return { ok: false, reason: "trajectory_point_shape" }
    const point = candidate as Partial<TrackingTrajectoryWirePoint>
    if (
      !isFiniteNumber(point.lat) ||
      point.lat < -90 ||
      point.lat > 90 ||
      !isFiniteNumber(point.lng) ||
      point.lng < -180 ||
      point.lng > 180 ||
      !isFiniteNumber(point.offsetMs)
    ) {
      return { ok: false, reason: "trajectory_point_coordinates" }
    }
    if (point.accuracy !== undefined &&
      (!isFiniteNumber(point.accuracy) || point.accuracy < 0 || point.accuracy > TRAJECTORY_POINT_MAX_ACCURACY_METERS)) {
      return { ok: false, reason: "trajectory_point_accuracy" }
    }
    if (point.offsetMs < 0 || point.offsetMs > MAX_BATCH_DURATION_MS || point.offsetMs < previousOffset) {
      return { ok: false, reason: "trajectory_offsets" }
    }
    const normalized = {
      lat: point.lat,
      lng: point.lng,
      offsetMs: point.offsetMs,
      ...(point.accuracy !== undefined ? { accuracy: point.accuracy } : {}),
    }
    if (previousPoint) {
      if (previousPoint.lat === normalized.lat && previousPoint.lng === normalized.lng) {
        return { ok: false, reason: "trajectory_duplicate_point" }
      }
      distanceMeters += haversineDistanceMeters(previousPoint, normalized)
    }
    previousPoint = normalized
    previousOffset = normalized.offsetMs
    points.push(normalized)
  }

  const lastPoint = points.at(-1)
  if (!lastPoint || lastPoint.lat !== topLevelLat || lastPoint.lng !== topLevelLng) {
    return { ok: false, reason: "trajectory_last_point_mismatch" }
  }
  if (distanceMeters > MAX_BATCH_DISTANCE_METERS) {
    return { ok: false, reason: "trajectory_distance" }
  }
  return { ok: true, points }
}
