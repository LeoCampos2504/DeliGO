import type { TrackingTrajectoryWirePoint } from "@/lib/tracking-trajectory"

export interface TrackingPlaybackPoint {
  lat: number
  lng: number
}

export const T23_INTERPOLATION_MIN_DURATION_MS = 250
export const T23_INTERPOLATION_MAX_DURATION_MS = 1_200
export const T23_LARGE_GAP_SNAP_THRESHOLD_MS = 20_000

export const MIN_SEGMENT_DURATION_MS = 80
export const MAX_SEGMENT_DURATION_MS = 750
export const NORMAL_PLAYBACK_SPEED_FACTOR = 1
export const MAX_CATCHUP_PLAYBACK_SPEED_FACTOR = 2
export const CLIENT_BATCH_QUEUE_MAX = 2

export interface ConfirmedTrackingTrajectoryBatch {
  version: number | string | null
  points: TrackingTrajectoryWirePoint[]
}

export interface TrackingPlaybackMarkerWriter {
  setLatLng(position: [number, number]): void
  getLatLng?(): { lat: number; lng: number }
}

export interface TrackingPlaybackControllerOptions {
  marker: TrackingPlaybackMarkerWriter | (() => TrackingPlaybackMarkerWriter | null)
  now?: () => number
  requestFrame?: (callback: (timestamp: number) => void) => number
  cancelFrame?: (handle: number) => void
}

export interface TrackingPlaybackControllerSnapshot {
  renderedPoint: TrackingPlaybackPoint | null
  authoritativePoint: TrackingPlaybackPoint | null
  authoritativeVersion: number | string | null
  activeBatchVersion: number | string | null
  pendingBatchVersion: number | string | null
  activeSegmentIndex: number | null
  rafActive: boolean
  needsRecoverySnap: boolean
  completed: boolean
}

export type TrackingPlaybackEventSource = "realtime" | "http"

export interface TrackingPlaybackEvent {
  point: TrackingPlaybackPoint
  trajectory?: TrackingTrajectoryWirePoint[]
  version: number | string | null
  source?: TrackingPlaybackEventSource
}

export type TrackingPlaybackAcceptance =
  | "accepted"
  | "duplicate"
  | "discarded_old_version"
  | "ignored_invalid"
  | "recovery_snapped"

function defaultRequestFrame(callback: (timestamp: number) => void): number {
  return requestAnimationFrame(callback)
}

function defaultCancelFrame(handle: number): void {
  cancelAnimationFrame(handle)
}

function markerFromOption(
  marker: TrackingPlaybackMarkerWriter | (() => TrackingPlaybackMarkerWriter | null),
): TrackingPlaybackMarkerWriter | null {
  return typeof marker === "function" ? marker() : marker
}

function isFinitePoint(point: TrackingPlaybackPoint | null | undefined): point is TrackingPlaybackPoint {
  return Boolean(
    point &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 && point.lat <= 90 &&
    point.lng >= -180 && point.lng <= 180,
  )
}

function isFiniteTrajectoryPoint(point: TrackingTrajectoryWirePoint | null | undefined): point is TrackingTrajectoryWirePoint {
  return Boolean(
    point &&
    isFinitePoint(point) &&
    Number.isFinite(point.offsetMs) &&
    point.offsetMs >= 0,
  )
}

function samePoint(first: TrackingPlaybackPoint | null | undefined, second: TrackingPlaybackPoint | null | undefined): boolean {
  return Boolean(first && second && first.lat === second.lat && first.lng === second.lng)
}

function nearPoint(first: TrackingPlaybackPoint | null | undefined, second: TrackingPlaybackPoint | null | undefined): boolean {
  if (!first || !second) return false
  return Math.abs(first.lat - second.lat) <= 0.00001 && Math.abs(first.lng - second.lng) <= 0.00001
}

function trustedVersion(value: number | string | null): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null
}

function compareVersions(first: number | string | null, second: number | string | null): number | null {
  const firstTrusted = trustedVersion(first)
  const secondTrusted = trustedVersion(second)
  if (firstTrusted === null || secondTrusted === null) return null
  return firstTrusted === secondTrusted ? 0 : firstTrusted < secondTrusted ? -1 : 1
}

function normalizeTrajectory(points: TrackingTrajectoryWirePoint[] | undefined): TrackingTrajectoryWirePoint[] {
  if (!Array.isArray(points)) return []
  const normalized: TrackingTrajectoryWirePoint[] = []
  let previousOffset = -1
  for (const point of points) {
    if (!isFiniteTrajectoryPoint(point) || point.offsetMs < previousOffset) continue
    if (normalized.length && samePoint(normalized[normalized.length - 1], point)) continue
    normalized.push({ lat: point.lat, lng: point.lng, offsetMs: point.offsetMs })
    previousOffset = point.offsetMs
  }
  return normalized
}

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
  return samePoint(first, second)
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

  return Math.min(
    T23_INTERPOLATION_MAX_DURATION_MS,
    Math.max(T23_INTERPOLATION_MIN_DURATION_MS, Math.round(arrivalGapMs / 4)),
  )
}

export function getTrackingTrajectorySegmentDurationMs(
  previousOffsetMs: number,
  nextOffsetMs: number,
  speedFactor = NORMAL_PLAYBACK_SPEED_FACTOR,
): number {
  const safeDelta = Number.isFinite(previousOffsetMs) && Number.isFinite(nextOffsetMs)
    ? Math.max(0, nextOffsetMs - previousOffsetMs)
    : 0
  const safeSpeedFactor = Number.isFinite(speedFactor) && speedFactor > 0
    ? Math.min(MAX_CATCHUP_PLAYBACK_SPEED_FACTOR, speedFactor)
    : NORMAL_PLAYBACK_SPEED_FACTOR
  return Math.min(
    MAX_SEGMENT_DURATION_MS,
    Math.max(MIN_SEGMENT_DURATION_MS, Math.round(safeDelta / safeSpeedFactor)),
  )
}

export function createTrackingPlaybackController(options: TrackingPlaybackControllerOptions) {
  const now = options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()))
  const requestFrame = options.requestFrame ?? defaultRequestFrame
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame

  let renderedPoint: TrackingPlaybackPoint | null = null
  let authoritativePoint: TrackingPlaybackPoint | null = null
  let authoritativeVersion: number | string | null = null
  let activeBatch: ConfirmedTrackingTrajectoryBatch | null = null
  let pendingBatch: ConfirmedTrackingTrajectoryBatch | null = null
  let activeSegmentIndex: number | null = null
  let activeSegmentStartedAt = 0
  let activeSegmentStart: TrackingPlaybackPoint | null = null
  let activeSegmentDurationMs = MIN_SEGMENT_DURATION_MS
  let frameHandle: number | null = null
  let token = 0
  let needsRecoverySnap = false
  let completed = false

  const getMarker = () => markerFromOption(options.marker)

  const writePoint = (point: TrackingPlaybackPoint): void => {
    const marker = getMarker()
    if (!marker) return
    marker.setLatLng([point.lat, point.lng])
    renderedPoint = point
  }

  const stopFrame = (): void => {
    token += 1
    if (frameHandle !== null) {
      cancelFrame(frameHandle)
      frameHandle = null
    }
    activeSegmentIndex = null
    activeSegmentStart = null
  }

  const finishActiveBatch = (): void => {
    activeBatch = null
    activeSegmentIndex = null
    activeSegmentStart = null
    if (pendingBatch) {
      activeBatch = pendingBatch
      pendingBatch = null
      runNextSegment()
    }
  }

  const runNextSegment = (): void => {
    if (!activeBatch) return
    const points = activeBatch.points
    const nextIndex = activeSegmentIndex === null ? 0 : activeSegmentIndex + 1
    if (nextIndex >= points.length) {
      finishActiveBatch()
      return
    }

    const target = points[nextIndex]
    const start = renderedPoint ?? { lat: target.lat, lng: target.lng }
    if (nearPoint(start, target)) {
      writePoint(target)
      activeSegmentIndex = nextIndex
      runNextSegment()
      return
    }

    const previousOffset = nextIndex === 0 ? target.offsetMs : points[nextIndex - 1].offsetMs
    const speedFactor = pendingBatch ? MAX_CATCHUP_PLAYBACK_SPEED_FACTOR : NORMAL_PLAYBACK_SPEED_FACTOR
    activeSegmentIndex = nextIndex
    activeSegmentStart = start
    activeSegmentStartedAt = now()
    activeSegmentDurationMs = getTrackingTrajectorySegmentDurationMs(previousOffset, target.offsetMs, speedFactor)
    const currentToken = token
    const tick = (timestamp: number) => {
      if (currentToken !== token || !activeBatch || !activeSegmentStart) return
      const progress = clampPlaybackProgress((timestamp - activeSegmentStartedAt) / activeSegmentDurationMs)
      const nextPoint = interpolateTrackingPoint(activeSegmentStart, target, progress)
      writePoint(nextPoint)
      if (progress >= 1) {
        writePoint(target)
        frameHandle = null
        runNextSegment()
        return
      }
      frameHandle = requestFrame(tick)
    }
    frameHandle = requestFrame(tick)
  }

  const enqueueBatch = (batch: ConfirmedTrackingTrajectoryBatch): void => {
    if (!batch.points.length) return
    if (!activeBatch) {
      activeBatch = batch
      runNextSegment()
      return
    }
    if (!pendingBatch) {
      pendingBatch = batch
      return
    }
    const order = compareVersions(batch.version, pendingBatch.version)
    if (order === null || order > 0) pendingBatch = batch
  }

  const snapToLatest = (point: TrackingPlaybackPoint): void => {
    stopFrame()
    activeBatch = null
    pendingBatch = null
    writePoint(point)
  }

  return {
    seedRenderedPoint(point: TrackingPlaybackPoint, version: number | string | null = null): void {
      if (!isFinitePoint(point)) return
      renderedPoint = point
      authoritativePoint = point
      authoritativeVersion = version
    },

    reset(): void {
      stopFrame()
      renderedPoint = null
      authoritativePoint = null
      authoritativeVersion = null
      activeBatch = null
      pendingBatch = null
      needsRecoverySnap = false
      completed = false
    },

    cancelForStale(): void {
      stopFrame()
      activeBatch = null
      pendingBatch = null
      needsRecoverySnap = true
    },

    cancelForCompletion(): void {
      stopFrame()
      activeBatch = null
      pendingBatch = null
      completed = true
    },

    acceptConfirmedEvent(event: TrackingPlaybackEvent): TrackingPlaybackAcceptance {
      if (completed || !isFinitePoint(event.point)) return "ignored_invalid"
      const points = normalizeTrajectory(event.trajectory)
      const finalPoint = points.length
        ? { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng }
        : event.point
      const order = compareVersions(event.version, authoritativeVersion)

      if (needsRecoverySnap) {
        authoritativePoint = finalPoint
        if (trustedVersion(event.version) !== null) authoritativeVersion = event.version
        snapToLatest(finalPoint)
        needsRecoverySnap = false
        return "recovery_snapped"
      }
      if (order !== null && order < 0) return "discarded_old_version"
      if (order === 0) {
        authoritativePoint = finalPoint
        return "duplicate"
      }

      authoritativePoint = finalPoint
      if (trustedVersion(event.version) !== null) authoritativeVersion = event.version

      if (!points.length) {
        if (samePoint(renderedPoint, event.point)) return "duplicate"
        if (event.source === "http") {
          snapToLatest(event.point)
        } else {
          enqueueBatch({ version: event.version, points: [{ ...event.point, offsetMs: 0 }] })
        }
        return "accepted"
      }

      if (samePoint(renderedPoint, finalPoint) && !activeBatch && !pendingBatch) return "duplicate"
      if (!renderedPoint) {
        writePoint(points[0])
        activeBatch = { version: event.version, points }
        activeSegmentIndex = 0
        runNextSegment()
        return "accepted"
      }

      enqueueBatch({ version: event.version, points })
      return "accepted"
    },

    snapshot(): TrackingPlaybackControllerSnapshot {
      return {
        renderedPoint,
        authoritativePoint,
        authoritativeVersion,
        activeBatchVersion: activeBatch?.version ?? null,
        pendingBatchVersion: pendingBatch?.version ?? null,
        activeSegmentIndex,
        rafActive: frameHandle !== null,
        needsRecoverySnap,
        completed,
      }
    },
  }
}
