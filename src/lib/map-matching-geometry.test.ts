import { describe, expect, test } from "bun:test"
import { boundMatchedTrajectory, mapFullRoadGeometryToTimedTrajectory, parseGeoJsonLineString } from "@/lib/map-matching-geometry"
import type { GeoJsonLineString, MapMatchingTracepoint, RawMatchingPoint } from "@/lib/map-matching-provider"

const raw: RawMatchingPoint[] = [
  { lat: 0, lng: 0, offsetMs: 0 },
  { lat: 0, lng: 0.01, offsetMs: 1_000 },
  { lat: 0.01, lng: 0.01, offsetMs: 2_000 },
]
const geometry: GeoJsonLineString = {
  type: "LineString",
  coordinates: [[0, 0], [0.005, 0], [0.01, 0], [0.01, 0.005], [0.01, 0.01]],
}
const tracepoints: MapMatchingTracepoint[] = raw.map((point, index) => ({ ...point, matchingIndex: 0, waypointIndex: index, alternativesCount: 0, snapDistanceMeters: 0 }))

describe("P2-T24 bounded matched geometry", () => {
  test("parses only valid GeoJSON LineStrings", () => {
    expect(parseGeoJsonLineString(geometry)).toEqual(geometry)
    expect(parseGeoJsonLineString({ type: "Point", coordinates: [0, 0] })).toBeNull()
    expect(parseGeoJsonLineString({ type: "LineString", coordinates: [[0, 0]] })).toBeNull()
    expect(parseGeoJsonLineString({ type: "LineString", coordinates: [[0, 0], [181, 0]] })).toBeNull()
  })

  test("maps full road geometry to monotonic timed points", () => {
    const result = mapFullRoadGeometryToTimedTrajectory(raw, tracepoints, geometry)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.points.length).toBeGreaterThanOrEqual(3)
    expect(result.points[0].offsetMs).toBe(0)
    expect(result.points.at(-1)?.offsetMs).toBe(2_000)
    expect(result.points.every((point, index) => index === 0 || point.offsetMs >= result.points[index - 1].offsetMs)).toBe(true)
  })

  test("preserves tracepoint anchors and a 90-degree turn", () => {
    const result = mapFullRoadGeometryToTimedTrajectory(raw, tracepoints, geometry)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.points.some((point) => point.anchorIndex === 1)).toBe(true)
    expect(result.points.some((point) => point.lat === 0.01 && point.lng === 0.01)).toBe(true)
  })

  test("rejects reverse-ordered anchors", () => {
    const reversed = [tracepoints[0], tracepoints[2], tracepoints[1]]
    expect(mapFullRoadGeometryToTimedTrajectory(raw, reversed, geometry).ok).toBe(false)
  })

  test("handles zero-distance geometry without NaN offsets", () => {
    const flat: GeoJsonLineString = { type: "LineString", coordinates: [[0, 0], [0, 0]] }
    const points = raw.map((point, index) => ({ ...point, lat: 0, lng: 0, offsetMs: index * 100 }))
    const anchors = points.map((point, index) => ({ ...point, matchingIndex: 0, waypointIndex: index, alternativesCount: 0, snapDistanceMeters: 0 }))
    const result = mapFullRoadGeometryToTimedTrajectory(points, anchors, flat)
    expect(result.ok).toBe(false)
  })

  test("bounds dense geometry deterministically and retains endpoints", () => {
    const dense = Array.from({ length: 100 }, (_, index) => ({ lat: 0, lng: index / 10_000, offsetMs: index * 100 }))
    const bounded = boundMatchedTrajectory(dense, 48)
    expect(bounded?.length).toBe(48)
    expect(bounded?.[0]).toEqual(dense[0])
    expect(bounded?.at(-1)).toEqual(dense.at(-1))
  })

  test("refuses a bound that cannot retain all important anchors", () => {
    const sharp = Array.from({ length: 8 }, (_, index) => ({
      lat: index % 2 === 0 ? 0 : 0.001,
      lng: index * 0.001,
      offsetMs: index,
      anchorIndex: index,
    }))
    expect(boundMatchedTrajectory(sharp, 4)).toBeNull()
  })

  test("deduplicates consecutive coordinates and keeps the latest offset", () => {
    const bounded = boundMatchedTrajectory([
      { lat: 0, lng: 0, offsetMs: 0 },
      { lat: 0, lng: 0, offsetMs: 50 },
      { lat: 0, lng: 0.001, offsetMs: 100 },
    ])
    expect(bounded?.length).toBe(2)
    expect(bounded?.[0].offsetMs).toBe(50)
  })
})
