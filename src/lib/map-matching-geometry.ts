import { haversineDistanceMeters } from "@/lib/tracking-movement"
import type {
  GeoJsonLineString,
  MapMatchingTracepoint,
  MatchedTrajectoryPoint,
  RawMatchingPoint,
} from "@/lib/map-matching-provider"
import { MAX_MATCHED_VISUAL_POINTS_PER_BATCH } from "@/lib/map-matching-provider"

interface Projection {
  point: { lat: number; lng: number }
  segmentIndex: number
  fraction: number
  distanceMeters: number
}

function finiteCoordinate(point: { lat: number; lng: number } | null | undefined): boolean {
  return Boolean(
    point &&
    Number.isFinite(point.lat) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    Number.isFinite(point.lng) &&
    point.lng >= -180 &&
    point.lng <= 180,
  )
}

function sameCoordinate(
  first: { lat: number; lng: number } | undefined,
  second: { lat: number; lng: number } | undefined,
): boolean {
  return Boolean(first && second && first.lat === second.lat && first.lng === second.lng)
}

export function parseGeoJsonLineString(value: unknown): GeoJsonLineString | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as { type?: unknown; coordinates?: unknown }
  if (candidate.type !== "LineString" || !Array.isArray(candidate.coordinates)) return null
  const coordinates: Array<[number, number]> = []
  for (const raw of candidate.coordinates) {
    if (!Array.isArray(raw) || raw.length < 2) return null
    const [lng, lat] = raw
    if (!finiteCoordinate({ lat, lng })) return null
    coordinates.push([lng, lat])
  }
  return coordinates.length >= 2 ? { type: "LineString", coordinates } : null
}

function toPoint(coordinate: [number, number]): { lat: number; lng: number } {
  return { lat: coordinate[1], lng: coordinate[0] }
}

function projectOnSegment(
  target: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  segmentIndex: number,
): Projection {
  const cosLatitude = Math.cos((target.lat * Math.PI) / 180)
  const x = (lng: number) => lng * cosLatitude
  const y = (lat: number) => lat
  const dx = x(end.lng) - x(start.lng)
  const dy = y(end.lat) - y(start.lat)
  const denominator = dx * dx + dy * dy
  const rawFraction = denominator === 0
    ? 0
    : ((x(target.lng) - x(start.lng)) * dx + (y(target.lat) - y(start.lat)) * dy) / denominator
  const fraction = Math.max(0, Math.min(1, rawFraction))
  const point = {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lng: start.lng + (end.lng - start.lng) * fraction,
  }
  return {
    point,
    segmentIndex,
    fraction,
    distanceMeters: haversineDistanceMeters(target, point),
  }
}

function projectAnchors(
  geometry: GeoJsonLineString,
  tracepoints: MapMatchingTracepoint[],
): Projection[] | null {
  const geometryPoints = geometry.coordinates.map(toPoint)
  const projections: Projection[] = []
  let minimumSegment = 0
  let previousProjection: Projection | null = null

  for (const tracepoint of tracepoints) {
    let best: Projection | null = null
    for (let index = minimumSegment; index < geometryPoints.length - 1; index += 1) {
      const candidate = projectOnSegment(
        tracepoint,
        geometryPoints[index],
        geometryPoints[index + 1],
        index,
      )
      if (!best || candidate.distanceMeters < best.distanceMeters) best = candidate
    }
    if (!best) return null
    if (previousProjection && best.segmentIndex === previousProjection.segmentIndex && best.fraction < previousProjection.fraction) {
      return null
    }
    projections.push(best)
    minimumSegment = best.segmentIndex
    previousProjection = best
  }
  return projections
}

function deduplicateConsecutive(points: MatchedTrajectoryPoint[]): MatchedTrajectoryPoint[] {
  const result: MatchedTrajectoryPoint[] = []
  for (const point of points) {
    const previous = result.at(-1)
    if (previous && sameCoordinate(previous, point)) {
      if (point.anchorIndex !== undefined) previous.anchorIndex = point.anchorIndex
      previous.offsetMs = Math.max(previous.offsetMs, point.offsetMs)
      continue
    }
    result.push(point)
  }
  return result
}

function turnAngleDegrees(
  before: { lat: number; lng: number },
  current: { lat: number; lng: number },
  after: { lat: number; lng: number },
): number {
  const first = { x: current.lng - before.lng, y: current.lat - before.lat }
  const second = { x: after.lng - current.lng, y: after.lat - current.lat }
  const firstLength = Math.hypot(first.x, first.y)
  const secondLength = Math.hypot(second.x, second.y)
  if (firstLength === 0 || secondLength === 0) return 0
  const cosine = Math.max(-1, Math.min(1, (first.x * second.x + first.y * second.y) / (firstLength * secondLength)))
  return (Math.acos(cosine) * 180) / Math.PI
}

function importantIndices(points: MatchedTrajectoryPoint[]): Set<number> {
  const indices = new Set<number>([0, points.length - 1])
  points.forEach((point, index) => {
    if (point.anchorIndex !== undefined) indices.add(index)
    if (index > 0 && index < points.length - 1 &&
        turnAngleDegrees(points[index - 1], point, points[index + 1]) >= 20) {
      indices.add(index)
    }
  })
  return indices
}

export function boundMatchedTrajectory(
  input: MatchedTrajectoryPoint[],
  maximumPoints = MAX_MATCHED_VISUAL_POINTS_PER_BATCH,
): MatchedTrajectoryPoint[] | null {
  const points = deduplicateConsecutive(input)
  if (points.length < 2 || points.length <= maximumPoints) return points.length >= 2 ? points : null

  const important = importantIndices(points)
  if (important.size > maximumPoints) return null

  const selected = new Set<number>(important)
  for (let index = 0; index < maximumPoints; index += 1) {
    const candidate = Math.round((index * (points.length - 1)) / (maximumPoints - 1))
    selected.add(candidate)
    if (selected.size >= maximumPoints) break
  }
  if (selected.size < maximumPoints) {
    for (let index = 0; index < points.length && selected.size < maximumPoints; index += 1) {
      selected.add(index)
    }
  }
  return [...selected].sort((a, b) => a - b).map((index) => points[index])
}

export type TimedGeometryResult = {
  ok: true
  points: MatchedTrajectoryPoint[]
} | {
  ok: false
  reason: string
}

export function mapFullRoadGeometryToTimedTrajectory(
  rawPoints: readonly RawMatchingPoint[],
  tracepoints: readonly MapMatchingTracepoint[],
  geometry: GeoJsonLineString,
  maximumPoints = MAX_MATCHED_VISUAL_POINTS_PER_BATCH,
): TimedGeometryResult {
  if (rawPoints.length < 2 || tracepoints.length !== rawPoints.length) {
    return { ok: false, reason: "anchor_count_mismatch" }
  }
  if (geometry.coordinates.length < 2) return { ok: false, reason: "geometry_too_short" }
  if (tracepoints.some((tracepoint) => !finiteCoordinate(tracepoint))) {
    return { ok: false, reason: "invalid_tracepoint" }
  }

  const projections = projectAnchors(geometry, [...tracepoints])
  if (!projections) return { ok: false, reason: "anchor_projection_failed" }
  const geometryPoints = geometry.coordinates.map(toPoint)
  const output: MatchedTrajectoryPoint[] = []

  for (let anchorIndex = 0; anchorIndex < rawPoints.length - 1; anchorIndex += 1) {
    const startProjection = projections[anchorIndex]
    const endProjection = projections[anchorIndex + 1]
    if (endProjection.segmentIndex < startProjection.segmentIndex) {
      return { ok: false, reason: "anchor_geometry_order" }
    }
    const interval: Array<{ lat: number; lng: number }> = [startProjection.point]
    for (let index = startProjection.segmentIndex + 1; index <= endProjection.segmentIndex; index += 1) {
      interval.push(geometryPoints[index])
    }
    interval.push(endProjection.point)

    const cumulative = [0]
    for (let index = 1; index < interval.length; index += 1) {
      cumulative.push(cumulative[index - 1] + haversineDistanceMeters(interval[index - 1], interval[index]))
    }
    const totalDistance = cumulative.at(-1) ?? 0
    const startOffset = rawPoints[anchorIndex].offsetMs
    const endOffset = rawPoints[anchorIndex + 1].offsetMs

    for (let index = 0; index < interval.length; index += 1) {
      if (anchorIndex > 0 && index === 0) continue
      const ratio = totalDistance === 0 ? 0 : cumulative[index] / totalDistance
      const point = interval[index]
      output.push({
        lat: point.lat,
        lng: point.lng,
        offsetMs: index === 0
          ? startOffset
          : index === interval.length - 1
            ? endOffset
            : Math.round(startOffset + (endOffset - startOffset) * ratio),
        ...(index === 0 ? { anchorIndex } : index === interval.length - 1 ? { anchorIndex: anchorIndex + 1 } : {}),
      })
    }
  }

  const deduplicated = deduplicateConsecutive(output)
  const first = deduplicated[0]
  const last = deduplicated.at(-1)
  if (!first || !last || first.offsetMs !== rawPoints[0].offsetMs || last.offsetMs !== rawPoints.at(-1)?.offsetMs) {
    return { ok: false, reason: "anchor_time_not_preserved" }
  }
  for (let index = 1; index < deduplicated.length; index += 1) {
    if (deduplicated[index].offsetMs < deduplicated[index - 1].offsetMs) {
      return { ok: false, reason: "offset_not_monotonic" }
    }
  }
  const bounded = boundMatchedTrajectory(deduplicated, maximumPoints)
  return bounded ? { ok: true, points: bounded } : { ok: false, reason: "geometry_cannot_be_bounded" }
}
