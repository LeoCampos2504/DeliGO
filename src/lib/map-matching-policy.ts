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

export type MapMatchingGuardStatus = "PASS" | "FAIL" | "NOT_EVALUATED"

export interface MapMatchingPolicyGuards {
  confidence: MapMatchingGuardStatus
  snapDistance: MapMatchingGuardStatus
  tracepoints: MapMatchingGuardStatus
  alternatives: MapMatchingGuardStatus
  singleSubtrace: MapMatchingGuardStatus
  geometry: MapMatchingGuardStatus
}

export interface MapMatchingPolicyEvaluation {
  decision: MapMatchingDecision
  guards: MapMatchingPolicyGuards
}

// A bounded batch may tolerate one isolated interior ambiguity. Anchors and
// any broader ambiguity remain conservative rejects.
export const MAX_ACCEPTED_INTERMEDIATE_AMBIGUOUS_TRACEPOINTS = 1
export const MAX_CONSECUTIVE_AMBIGUOUS_TRACEPOINTS = 1

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

function isValidGeometry(geometry: MatchedMapMatchingResult["matchings"][number]["geometry"]): boolean {
  return geometry.type === "LineString" && geometry.coordinates.length >= 2 && geometry.coordinates.every(([lng, lat]) =>
    Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lng) && lng >= -180 && lng <= 180,
  )
}

function isAcceptableAlternativesProfile(
  tracepoints: Array<NonNullable<MatchedMapMatchingResult["tracepoints"][number]>>,
): boolean {
  const ambiguousIndices = tracepoints.flatMap((tracepoint, index) =>
    tracepoint.alternativesCount > 0 ? [index] : [],
  )
  if (ambiguousIndices.length === 0) return true
  if (ambiguousIndices.some((index) => index === 0 || index === tracepoints.length - 1)) return false
  if (ambiguousIndices.length > MAX_ACCEPTED_INTERMEDIATE_AMBIGUOUS_TRACEPOINTS) return false

  let maxConsecutive = 0
  let consecutive = 0
  for (let index = 0; index < tracepoints.length; index += 1) {
    if (tracepoints[index].alternativesCount > 0) {
      consecutive += 1
      maxConsecutive = Math.max(maxConsecutive, consecutive)
    } else {
      consecutive = 0
    }
  }
  return maxConsecutive <= MAX_CONSECUTIVE_AMBIGUOUS_TRACEPOINTS
}

function reject(reason: string): MapMatchingDecision {
  return { decision: "REJECT_MATCH", reason }
}

export function evaluateMapMatchingWithDiagnostics(
  rawPoints: readonly RawMatchingPoint[],
  result: MapMatchingResult,
): MapMatchingPolicyEvaluation {
  const guards: MapMatchingPolicyGuards = {
    confidence: "NOT_EVALUATED",
    snapDistance: "NOT_EVALUATED",
    tracepoints: "NOT_EVALUATED",
    alternatives: "NOT_EVALUATED",
    singleSubtrace: "NOT_EVALUATED",
    geometry: "NOT_EVALUATED",
  }
  if (!isRawMatchingCandidate(rawPoints)) return { decision: reject("raw_points_not_eligible"), guards }
  if (result.status !== "matched") return { decision: reject("provider_" + result.status), guards }

  const singleSubtrace = result.matchings.length === 1
  guards.singleSubtrace = singleSubtrace ? "PASS" : "FAIL"
  if (result.rawPointCount !== rawPoints.length) return { decision: reject("raw_point_count_mismatch"), guards }
  if (!singleSubtrace) return { decision: reject("multiple_or_missing_matchings"), guards }

  const matching = result.matchings[0]
  if (!matching) return { decision: reject("multiple_or_missing_matchings"), guards }
  const confidencePass = Number.isFinite(matching.confidence) && matching.confidence >= INITIAL_CONFIDENCE_THRESHOLD
  guards.confidence = confidencePass ? "PASS" : "FAIL"
  if (!confidencePass) return { decision: reject("low_confidence"), guards }
  if (result.tracepoints.length !== rawPoints.length) return { decision: reject("tracepoint_count_mismatch"), guards }

  let previousWaypointIndex = -1
  const tracepointsPass = result.tracepoints.every((tracepoint) => {
    if (!tracepoint || !matching || tracepoint.matchingIndex !== matching.matchingIndex ||
        tracepoint.waypointIndex < previousWaypointIndex) return false
    previousWaypointIndex = tracepoint.waypointIndex
    return true
  })
  guards.tracepoints = tracepointsPass ? "PASS" : "FAIL"
  if (!tracepointsPass) {
    const reason = result.tracepoints.some((tracepoint) => tracepoint === null)
      ? "null_tracepoint"
      : "ambiguous_tracepoints"
    return { decision: reject(reason), guards }
  }

  const completeTracepoints = result.tracepoints as Array<NonNullable<MatchedMapMatchingResult["tracepoints"][number]>>
  const alternativesPass = completeTracepoints.every((tracepoint) =>
    Number.isInteger(tracepoint.alternativesCount) && tracepoint.alternativesCount >= 0,
  ) && isAcceptableAlternativesProfile(completeTracepoints)
  guards.alternatives = alternativesPass ? "PASS" : "FAIL"

  const snapDistancePass = result.snapDistancesMeters.length === rawPoints.length && rawPoints.every((point, index) => {
    const distance = result.snapDistancesMeters[index]
    return Number.isFinite(distance) && distance >= 0 && distance <= snapDistanceLimitMeters(point)
  })
  guards.snapDistance = snapDistancePass ? "PASS" : "FAIL"
  const geometryPass = Boolean(isValidGeometry(matching.geometry) && isValidTrajectory(result.matchedTrajectory, rawPoints))
  guards.geometry = geometryPass ? "PASS" : "FAIL"

  if (!alternativesPass) return { decision: reject("ambiguous_tracepoints"), guards }
  if (!snapDistancePass) {
    return {
      decision: reject(result.snapDistancesMeters.length === rawPoints.length ? "snap_distance_exceeded" : "snap_distance_count_mismatch"),
      guards,
    }
  }

  if (!geometryPass) return { decision: reject("invalid_matched_trajectory"), guards }

  return {
    decision: {
      decision: "ACCEPT_MATCH",
      matchedTrajectory: result.matchedTrajectory,
      confidence: matching.confidence,
    },
    guards,
  }
}

export function evaluateMapMatching(
  rawPoints: readonly RawMatchingPoint[],
  result: MapMatchingResult,
): MapMatchingDecision {
  return evaluateMapMatchingWithDiagnostics(rawPoints, result).decision
}

export function matchingEligibilityReason(rawPoints: readonly RawMatchingPoint[]): string {
  if (rawPoints.length < MIN_RAW_POINTS_FOR_MATCH) return "insufficient_raw_points"
  if (!rawPoints.every(isValidRawMatchingPoint)) return "invalid_raw_points"
  if (!hasTwoMovementSegments(rawPoints)) return "insufficient_movement_segments"
  return "eligible_candidate"
}
