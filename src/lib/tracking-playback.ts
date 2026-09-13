export interface TrackingPlaybackPoint {
  lat: number
  lng: number
}

// The producer publishes at roughly five-second intervals. Playback is
// intentionally much shorter so it catches up to confirmed data instead of
// creating a hidden client-side buffer or extrapolating a future position.
export const T23_INTERPOLATION_MIN_DURATION_MS = 250
export const T23_INTERPOLATION_MAX_DURATION_MS = 1_200
export const T23_LARGE_GAP_SNAP_THRESHOLD_MS = 20_000

export function clampPlaybackProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.min(1, Math.max(0, progress))
}

export function interpolateTrackingPoint(
  start: TrackingPlaybackPoint,
  target: TrackingPlaybackPoint,
  progress: number,
): TrackingPlaybackPoint {
  const clampedProgress = clampPlaybackProgress(progress)
  return {
    lat: start.lat + (target.lat - start.lat) * clampedProgress,
    lng: start.lng + (target.lng - start.lng) * clampedProgress,
  }
}

export function sameTrackingPlaybackCoordinate(
  first: TrackingPlaybackPoint | null | undefined,
  second: TrackingPlaybackPoint | null | undefined,
): boolean {
  return Boolean(
    first &&
    second &&
    first.lat === second.lat &&
    first.lng === second.lng,
  )
}

export function shouldSnapForTrackingGap(
  arrivalGapMs: number | null | undefined,
  thresholdMs = T23_LARGE_GAP_SNAP_THRESHOLD_MS,
): boolean {
  return arrivalGapMs !== null &&
    arrivalGapMs !== undefined &&
    Number.isFinite(arrivalGapMs) &&
    arrivalGapMs > thresholdMs
}

export function getTrackingPlaybackDurationMs(
  arrivalGapMs: number | null | undefined,
): number {
  if (arrivalGapMs === null || arrivalGapMs === undefined || !Number.isFinite(arrivalGapMs) || arrivalGapMs <= 0) {
    return T23_INTERPOLATION_MIN_DURATION_MS
  }

  // A quarter of the observed arrival gap gives a short catch-up animation;
  // the bounds keep cadence jitter from becoming a five-second visual queue.
  return Math.min(
    T23_INTERPOLATION_MAX_DURATION_MS,
    Math.max(T23_INTERPOLATION_MIN_DURATION_MS, Math.round(arrivalGapMs / 4)),
  )
}
