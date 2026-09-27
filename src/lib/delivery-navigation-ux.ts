// ============================================
// P2-T54-R1 — pure driver follow-navigation UX helpers
// ============================================
// No DOM, no Leaflet, no React, no timers, no `navigator.geolocation` — every
// function here is a pure, synchronous computation kept separate from
// src/components/repartidor/delivery-navigation.tsx so the bearing/follow
// math can be tested directly without mounting a Leaflet map (see
// src/lib/delivery-navigation-ux.test.ts). Mirrors the separation already
// established by src/lib/tracking-movement.ts for P2-T02.
//
// Derived-bearing gates and follow-camera model per P2-T54-A1
// (codex-reports/P2_T54_A1_DRIVER_NAVIGATION_TECHNICAL_AUDIT_DESIGN.md,
// sections 3-5, 9, 11-14, 17): heading comes only from existing fresh GPS
// samples already flowing through this component's `currentPosition` prop —
// never a new geolocation watcher, DeviceOrientation, or compass.

import { effectiveMovementThresholdMeters, haversineDistanceMeters, sanitizeAccuracy } from "@/lib/tracking-movement"
import { isValidDeliveryPoint } from "@/lib/delivery-navigation"

export interface BearingGateSample {
  lat: number
  lng: number
  accuracy: number
  capturedAt: number
}

export interface QualifiedBearing {
  bearingDegrees: number
  qualifiedAt: number
}

export type DriverCourseState =
  | { status: "VALID"; bearingDegrees: number; qualifiedAt: number }
  | { status: "HELD"; bearingDegrees: number; qualifiedAt: number }
  | { status: "NEUTRAL" }

export const BEARING_MAX_ACCURACY_METERS = 40
export const BEARING_MIN_TIME_DELTA_MS = 1_000
export const BEARING_MAX_TIME_DELTA_MS = 20_000
export const BEARING_MIN_IMPLIED_SPEED_MPS = 1.5
export const BEARING_MAX_SAMPLE_AGE_MS = 15_000
export const BEARING_HOLD_MAX_MS = 30_000
export const BEARING_DEAD_BAND_DEGREES = 5

export const FOLLOW_DEFAULT_ZOOM = 16
export const RECENTER_TARGET_PX = 48

/** Normalizes any bearing (including negative or >360 values) into [0, 360). */
export function normalizeBearingDegrees(degrees: number): number {
  const normalized = degrees % 360
  return normalized < 0 ? normalized + 360 : normalized
}

/**
 * Initial great-circle bearing from `from` to `to`, in degrees clockwise
 * from true north (0 = N, 90 = E, 180 = S, 270 = W). Standard forward-azimuth
 * formula — short segments only, matching this navigation surface's scale.
 */
export function initialBearingDegrees(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)
  const deltaLng = toRad(to.lng - from.lng)

  const y = Math.sin(deltaLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
  return normalizeBearingDegrees(toDeg(Math.atan2(y, x)))
}

/**
 * Shortest signed angular delta from `fromDegrees` to `toDegrees`, in
 * (-180, 180]. Positive = clockwise (e.g. 350 -> 10 is +20, not -340).
 */
export function shortestAngularDeltaDegrees(fromDegrees: number, toDegrees: number): number {
  return ((toDegrees - fromDegrees + 540) % 360) - 180
}

function isFiniteCoordinate(point: { lat: number; lng: number }): boolean {
  return isValidDeliveryPoint(point)
}

/**
 * R1 acceptance gates for a derived bearing between two real GPS samples
 * (A1 §3/§9): both accuracies <= 40 m; timestamps monotonic and 1-20 s
 * apart; displacement >= max(15 m, accuracy sum); implied speed >= 1.5 m/s;
 * `current` no older than 15 s relative to `now`. Any failed gate means the
 * pair must not update the driver's course.
 */
export function isValidBearingSamplePair(
  previous: BearingGateSample,
  current: BearingGateSample,
  now: number,
): boolean {
  if (!isFiniteCoordinate(previous) || !isFiniteCoordinate(current)) return false
  if (!Number.isFinite(now)) return false

  const previousAccuracy = sanitizeAccuracy(previous.accuracy)
  const currentAccuracy = sanitizeAccuracy(current.accuracy)
  if (previousAccuracy > BEARING_MAX_ACCURACY_METERS || currentAccuracy > BEARING_MAX_ACCURACY_METERS) return false

  if (!Number.isFinite(previous.capturedAt) || !Number.isFinite(current.capturedAt)) return false
  const deltaMs = current.capturedAt - previous.capturedAt
  if (deltaMs < BEARING_MIN_TIME_DELTA_MS || deltaMs > BEARING_MAX_TIME_DELTA_MS) return false

  const sampleAge = now - current.capturedAt
  if (sampleAge < 0 || sampleAge > BEARING_MAX_SAMPLE_AGE_MS) return false

  const distance = haversineDistanceMeters(previous, current)
  const minDistance = effectiveMovementThresholdMeters(currentAccuracy, previousAccuracy)
  if (distance < minDistance) return false

  const impliedSpeedMps = distance / (deltaMs / 1000)
  if (impliedSpeedMps < BEARING_MIN_IMPLIED_SPEED_MPS) return false

  return true
}

/**
 * Resolves the driver's course for this render pass: a freshly qualified
 * bearing, a held previous bearing (<= 30 s old), or neutral. `previousQualified`
 * is the last VALID/HELD course this component computed; `candidatePair` is
 * the two most recent raw samples (or null if there is no prior sample yet).
 * Applies the 5-degree dead-band so tiny angular noise does not visibly
 * jitter the marker (A1 §3/§9).
 */
export function resolveDriverCourse(
  previousQualified: QualifiedBearing | null,
  candidatePair: { previous: BearingGateSample; current: BearingGateSample } | null,
  now: number,
): DriverCourseState {
  if (candidatePair && isValidBearingSamplePair(candidatePair.previous, candidatePair.current, now)) {
    const rawBearing = initialBearingDegrees(candidatePair.previous, candidatePair.current)
    if (previousQualified) {
      const delta = Math.abs(shortestAngularDeltaDegrees(previousQualified.bearingDegrees, rawBearing))
      if (delta < BEARING_DEAD_BAND_DEGREES) {
        return { status: "VALID", bearingDegrees: previousQualified.bearingDegrees, qualifiedAt: now }
      }
    }
    return { status: "VALID", bearingDegrees: rawBearing, qualifiedAt: now }
  }

  if (previousQualified && Number.isFinite(now) && now - previousQualified.qualifiedAt <= BEARING_HOLD_MAX_MS) {
    return { status: "HELD", bearingDegrees: previousQualified.bearingDegrees, qualifiedAt: previousQualified.qualifiedAt }
  }

  return { status: "NEUTRAL" }
}

// ============================================
// Follow camera: FOLLOWING / MANUAL state, dead-zone, recenter
// ============================================

export type FollowCameraMode = "FOLLOWING" | "MANUAL"

export interface ViewportSize {
  width: number
  height: number
}

export interface ContainerPoint {
  x: number
  y: number
}

// Keeps the driver roughly in the lower-middle third of the viewport so the
// route ahead stays visible (A1 §4/§13: FOLLOW_CENTER_STRATEGY).
export const FOLLOW_SAFE_ZONE_HORIZONTAL_MARGIN_RATIO = 0.28
export const FOLLOW_SAFE_ZONE_TOP_RATIO = 0.45
export const FOLLOW_SAFE_ZONE_BOTTOM_RATIO = 0.78

/** True when `point` (driver marker, in container pixels) is inside the follow safe zone. */
export function isPointInsideFollowSafeZone(point: ContainerPoint, viewport: ViewportSize): boolean {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) {
    return true
  }
  const left = viewport.width * FOLLOW_SAFE_ZONE_HORIZONTAL_MARGIN_RATIO
  const right = viewport.width * (1 - FOLLOW_SAFE_ZONE_HORIZONTAL_MARGIN_RATIO)
  const top = viewport.height * FOLLOW_SAFE_ZONE_TOP_RATIO
  const bottom = viewport.height * FOLLOW_SAFE_ZONE_BOTTOM_RATIO
  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom
}

/** Dead-zone predicate: only recenter the camera once the driver leaves the safe zone. */
export function shouldRecenterFollowCamera(point: ContainerPoint, viewport: ViewportSize): boolean {
  return !isPointInsideFollowSafeZone(point, viewport)
}

/**
 * A user-initiated map interaction (drag/zoom) always transitions FOLLOWING
 * to MANUAL; a programmatic camera operation (guarded by the caller via
 * `cameraOperationRef`) leaves the current mode unchanged, since Leaflet
 * fires the same events for follow/recenter/initial-fit calls (A1 §5/§16).
 */
export function nextFollowModeOnMapInteraction(
  currentMode: FollowCameraMode,
  isProgrammaticOperation: boolean,
): FollowCameraMode {
  return isProgrammaticOperation ? currentMode : "MANUAL"
}

export interface FollowCameraTarget {
  mode: FollowCameraMode
  zoom: number
}

/** Recenter always resumes FOLLOWING and resets zoom to the default (A1 §5/§17). */
export function recenterFollowCamera(): FollowCameraTarget {
  return { mode: "FOLLOWING", zoom: FOLLOW_DEFAULT_ZOOM }
}

/** RECENTER is only shown in MANUAL mode with a usable fresh location (A1 §17). */
export function isRecenterButtonVisible(mode: FollowCameraMode, hasFreshLocation: boolean): boolean {
  return mode === "MANUAL" && hasFreshLocation
}
