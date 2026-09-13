import { haversineDistanceMeters } from "@/lib/tracking-movement"
import {
  INITIAL_CONFIDENCE_THRESHOLD,
  isValidRawMatchingPoint,
  MIN_RAW_POINTS_FOR_MATCH,
  snapDistanceLimitMeters,
  type MapMatchingResult,
  type MatchedMapMatchingResult,
  type RawMatchingPoint,
} from "@/lib/map-matching-provider"

export type MapMatchingDecision =
  | {
      decision: "ACCEPT_MATCH"
      matchedTrajectory: MatchedMapMatchingResult["matchedTrajectory"]
      confidence: number
    }
  | {
      decision: "REJECT_MATCH"
      reason: string
    }

function hasTwoMovementSegments(rawPoints: readonly RawMatchingPoint[]): boolean {
  let movementSegments = 0
  for (let index = 1; index < rawPoints.length; index += 1) {
    if (haversineDistanceMeters(rawPoints[index - 1], rawPoints[index]) > 0) movementSegments += 1
  }
  return movementSegments >= 2
}

export function isRawMatchingCandidate(rawPoints: readonly RawMatchingPoint[]): boolean {
  return rawPoints.length >= MIN_RAW_POINTS_FOR_MATCH &&
    rawPoints.every(isValidRawMatchingPoint) &&
    rawPoints.every((point, index) => index === 0 || point.offsetMs >= rawPoints[index - 1].offsetMs) &&
    hasTwoMovementSegments(rawPoints)
}

function isValidTrajectory(
  trajectory: MatchedMapMatchingResult["matchedTrajectory"],
  rawPoints: readonly RawMatchingPoint[],
): boolean {
  if (trajectory.length < 2 || trajectory.length > 48) return false
  if (trajectory[0].offsetMs !== rawPoints[0].offsetMs) return false
  if (trajectory.at(-1)?.offsetMs !== rawPoints.at(-1)?.offsetMs) return false
  return trajectory.every((point, index) => {
    if (
      !Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90 ||
      !Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180 ||
      !Number.isFinite(point.offsetMs) || point.offsetMs < 0
    ) return false
    return index === 0 || point.offsetMs >= trajectory[index - 1].offsetMs
  })
}

function reject(reason: string): MapMatchingDecision {
  return { decision: "REJECT_MATCH", reason }
}

export function evaluateMapMatching(
  rawPoints: readonly RawMatchingPoint[],
  result: MapMatchingResult,
): MapMatchingDecision {
  if (!isRawMatchingCandidate(rawPoints)) return reject("raw_points_not_eligible")
  if (result.status !== "matched") return reject("provider_" + result.status)
  if (result.rawPointCount !== rawPoints.length) return reject("raw_point_count_mismatch")
  if (result.matchings.length !== 1) return reject("multiple_or_missing_matchings")
  if (!Number.isFinite(result.matchings[0].confidence) ||
      result.matchings[0].confidence < INITIAL_CONFIDENCE_THRESHOLD) {
    return reject("low_confidence")
  }
  if (result.tracepoints.length !== rawPoints.length) return reject("tracepoint_count_mismatch")

  let previousWaypointIndex = -1
  for (const tracepoint of result.tracepoints) {
    if (!tracepoint) return reject("null_tracepoint")
    if (
      tracepoint.matchingIndex !== result.matchings[0].matchingIndex ||
      tracepoint.waypointIndex < previousWaypointIndex ||
      !Number.isInteger(tracepoint.alternativesCount) ||
      tracepoint.alternativesCount !== 0
    ) return reject("ambiguous_tracepoints")
    previousWaypointIndex = tracepoint.waypointIndex
  }

  if (result.snapDistancesMeters.length !== rawPoints.length) return reject("snap_distance_count_mismatch")
  for (let index = 0; index < rawPoints.length; index += 1) {
    const distance = result.snapDistancesMeters[index]
    if (!Number.isFinite(distance) || distance < 0 || distance > snapDistanceLimitMeters(rawPoints[index])) {
      return reject("snap_distance_exceeded")
    }
  }
  if (!isValidTrajectory(result.matchedTrajectory, rawPoints)) return reject("invalid_matched_trajectory")

  return {
    decision: "ACCEPT_MATCH",
    matchedTrajectory: result.matchedTrajectory,
    confidence: result.matchings[0].confidence,
  }
}

export function matchingEligibilityReason(rawPoints: readonly RawMatchingPoint[]): string {
  if (rawPoints.length < MIN_RAW_POINTS_FOR_MATCH) return "insufficient_raw_points"
  if (!rawPoints.every(isValidRawMatchingPoint)) return "invalid_raw_points"
  if (!hasTwoMovementSegments(rawPoints)) return "insufficient_movement_segments"
  return "eligible_candidate"
}
