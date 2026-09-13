export const MIN_RAW_POINTS_FOR_MATCH = 3
export const MAX_MATCHED_VISUAL_POINTS_PER_BATCH = 48
export const MAX_ACCEPTABLE_SNAP_DISTANCE_METERS = 30
export const MAX_SNAP_DISTANCE_WITHOUT_ACCURACY_METERS = 15
export const INITIAL_CONFIDENCE_THRESHOLD = 0.75
export const MAX_RAW_MATCHING_ACCURACY_METERS = 100
export const MAX_MATCHED_REALTIME_PAYLOAD_BYTES = 16_384
export const MATCHING_TIMEOUT_MS = 250

export type MapMatchingProfile = "driving"

export interface RawMatchingPoint {
  lat: number
  lng: number
  offsetMs: number
  accuracy?: number
}

export interface MatchingCoordinate {
  lat: number
  lng: number
}

export interface MatchedTrajectoryPoint extends MatchingCoordinate {
  offsetMs: number
  anchorIndex?: number
}

export interface GeoJsonLineString {
  type: "LineString"
  coordinates: Array<[number, number]>
}

export interface MapMatchingTracepoint extends MatchingCoordinate {
  matchingIndex: number
  waypointIndex: number
  alternativesCount: number
  snapDistanceMeters: number
}

export interface MapMatchingSubtrace {
  matchingIndex: number
  confidence: number
  geometry: GeoJsonLineString
}

export interface MatchedMapMatchingResult {
  status: "matched"
  provider: string
  rawPointCount: number
  tracepoints: Array<MapMatchingTracepoint | null>
  matchings: MapMatchingSubtrace[]
  matchedTrajectory: MatchedTrajectoryPoint[]
  snapDistancesMeters: number[]
}

export type MapMatchingResult =
  | MatchedMapMatchingResult
  | { status: "rejected"; reason: string; provider: string }
  | { status: "timeout"; provider: string }
  | { status: "error"; reason: string; provider: string }

export interface MapMatchingRequestContext {
  profile?: MapMatchingProfile
  signal?: AbortSignal
  timeoutMs?: number
}

export interface MapMatchingProvider {
  readonly name: string
  matchTrajectory(
    rawPoints: readonly RawMatchingPoint[],
    context?: MapMatchingRequestContext,
  ): Promise<MapMatchingResult>
}

export function isValidMatchingAccuracy(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_RAW_MATCHING_ACCURACY_METERS
}

export function isValidRawMatchingPoint(point: RawMatchingPoint | null | undefined): point is RawMatchingPoint {
  return Boolean(
    point &&
    Number.isFinite(point.lat) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    Number.isFinite(point.lng) &&
    point.lng >= -180 &&
    point.lng <= 180 &&
    Number.isFinite(point.offsetMs) &&
    point.offsetMs >= 0 &&
    (point.accuracy === undefined || isValidMatchingAccuracy(point.accuracy)),
  )
}

export function snapDistanceLimitMeters(point: RawMatchingPoint): number {
  return isValidMatchingAccuracy(point.accuracy)
    ? Math.min(MAX_ACCEPTABLE_SNAP_DISTANCE_METERS, Math.max(15, 2 * point.accuracy))
    : MAX_SNAP_DISTANCE_WITHOUT_ACCURACY_METERS
}

export function serializedUtf8Bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

export function isMatchedRealtimePayloadWithinLimit(value: unknown): boolean {
  return serializedUtf8Bytes(value) <= MAX_MATCHED_REALTIME_PAYLOAD_BYTES
}
