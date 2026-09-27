import { describe, expect, test } from "bun:test"
import {
  BEARING_HOLD_MAX_MS,
  FOLLOW_DEFAULT_ZOOM,
  initialBearingDegrees,
  isPointInsideFollowSafeZone,
  isRecenterButtonVisible,
  isValidBearingSamplePair,
  nextFollowModeOnMapInteraction,
  normalizeBearingDegrees,
  recenterFollowCamera,
  resolveDriverCourse,
  shortestAngularDeltaDegrees,
  shouldRecenterFollowCamera,
  type BearingGateSample,
} from "./delivery-navigation-ux"

const BASE_LAT = -26.1856
const BASE_LNG = -58.1732

function sample(overrides: Partial<BearingGateSample>): BearingGateSample {
  return { lat: BASE_LAT, lng: BASE_LNG, accuracy: 10, capturedAt: 0, ...overrides }
}

// Roughly ~30m north/east/south/west of BASE at this latitude, enough to
// clear the 15m/accuracy-sum distance gate with a 10s time delta (>1.5 m/s).
const METERS_PER_DEGREE_LAT = 111_320
const METERS_PER_DEGREE_LNG = 111_320 * Math.cos((BASE_LAT * Math.PI) / 180)
const OFFSET_METERS = 30
const LAT_OFFSET = OFFSET_METERS / METERS_PER_DEGREE_LAT
const LNG_OFFSET = OFFSET_METERS / METERS_PER_DEGREE_LNG

describe("normalizeBearingDegrees", () => {
  test("wraps into [0, 360)", () => {
    expect(normalizeBearingDegrees(0)).toBe(0)
    expect(normalizeBearingDegrees(359)).toBe(359)
    expect(normalizeBearingDegrees(360)).toBe(0)
    expect(normalizeBearingDegrees(370)).toBe(10)
    expect(normalizeBearingDegrees(-10)).toBe(350)
    expect(normalizeBearingDegrees(-370)).toBe(350)
  })
})

describe("initialBearingDegrees", () => {
  test("cardinal directions from the base point", () => {
    const north = { lat: BASE_LAT + LAT_OFFSET, lng: BASE_LNG }
    const south = { lat: BASE_LAT - LAT_OFFSET, lng: BASE_LNG }
    const east = { lat: BASE_LAT, lng: BASE_LNG + LNG_OFFSET }
    const west = { lat: BASE_LAT, lng: BASE_LNG - LNG_OFFSET }
    const from = { lat: BASE_LAT, lng: BASE_LNG }

    expect(initialBearingDegrees(from, north)).toBeCloseTo(0, 0)
    expect(initialBearingDegrees(from, east)).toBeCloseTo(90, 0)
    expect(initialBearingDegrees(from, south)).toBeCloseTo(180, 0)
    expect(initialBearingDegrees(from, west)).toBeCloseTo(270, 0)
  })
})

describe("shortestAngularDeltaDegrees", () => {
  test("wraps 359 -> 1 as +2, not -358", () => {
    expect(shortestAngularDeltaDegrees(359, 1)).toBeCloseTo(2, 5)
  })

  test("wraps 350 -> 10 as +20 and 10 -> 350 as -20", () => {
    expect(shortestAngularDeltaDegrees(350, 10)).toBeCloseTo(20, 5)
    expect(shortestAngularDeltaDegrees(10, 350)).toBeCloseTo(-20, 5)
  })

  test("zero delta for identical bearings", () => {
    expect(shortestAngularDeltaDegrees(45, 45)).toBeCloseTo(0, 5)
  })
})

describe("isValidBearingSamplePair", () => {
  const previous = sample({ capturedAt: 0 })

  test("accepts a qualifying pair (fresh, accurate, fast enough, far enough)", () => {
    const current = sample({ lat: BASE_LAT + LAT_OFFSET, capturedAt: 10_000 })
    expect(isValidBearingSamplePair(previous, current, 12_000)).toBe(true)
  })

  test("rejects invalid coordinates", () => {
    const current = sample({ lat: 999, capturedAt: 10_000 })
    expect(isValidBearingSamplePair(previous, current, 12_000)).toBe(false)
  })

  test("rejects nonmonotonic/too-small time deltas", () => {
    const current = sample({ lat: BASE_LAT + LAT_OFFSET, capturedAt: 500 })
    expect(isValidBearingSamplePair(previous, current, 2_000)).toBe(false)
    const backwards = sample({ lat: BASE_LAT + LAT_OFFSET, capturedAt: -5_000 })
    expect(isValidBearingSamplePair(previous, backwards, 2_000)).toBe(false)
  })

  test("rejects a time delta above 20s", () => {
    const current = sample({ lat: BASE_LAT + LAT_OFFSET, capturedAt: 21_000 })
    expect(isValidBearingSamplePair(previous, current, 22_000)).toBe(false)
  })

  test("rejects accuracy worse than 40m on either sample", () => {
    const current = sample({ lat: BASE_LAT + LAT_OFFSET, accuracy: 41, capturedAt: 10_000 })
    expect(isValidBearingSamplePair(previous, current, 12_000)).toBe(false)
    const poorPrevious = sample({ accuracy: 45, capturedAt: 0 })
    expect(isValidBearingSamplePair(poorPrevious, current, 12_000)).toBe(false)
  })

  test("rejects displacement below max(15m, accuracy sum)", () => {
    const barelyMoved = sample({ lat: BASE_LAT + LAT_OFFSET / 20, capturedAt: 10_000 })
    expect(isValidBearingSamplePair(previous, barelyMoved, 12_000)).toBe(false)
  })

  test("rejects implied speed below 1.5 m/s (stationary/low-speed jitter)", () => {
    // ~16m in 20s => 0.8 m/s, below the 1.5 m/s gate, even though distance clears 15m.
    const slow = sample({ lat: BASE_LAT + (16 / METERS_PER_DEGREE_LAT), capturedAt: 20_000 })
    expect(isValidBearingSamplePair(previous, slow, 21_000)).toBe(false)
  })

  test("rejects a stale current sample (older than 15s relative to now)", () => {
    const current = sample({ lat: BASE_LAT + LAT_OFFSET, capturedAt: 10_000 })
    expect(isValidBearingSamplePair(previous, current, 26_000)).toBe(false)
  })
})

describe("resolveDriverCourse", () => {
  const previous = sample({ capturedAt: 0 })
  const current = sample({ lat: BASE_LAT + LAT_OFFSET, capturedAt: 10_000 })

  test("returns VALID with a fresh qualifying pair and no prior course", () => {
    const result = resolveDriverCourse(null, { previous, current }, 12_000)
    expect(result.status).toBe("VALID")
    if (result.status === "VALID") expect(result.bearingDegrees).toBeCloseTo(0, 0)
  })

  test("applies the 5-degree dead-band: tiny change holds the previous bearing", () => {
    const priorCourse = { bearingDegrees: 2, qualifiedAt: 5_000 }
    const result = resolveDriverCourse(priorCourse, { previous, current }, 12_000)
    expect(result.status).toBe("VALID")
    if (result.status === "VALID") expect(result.bearingDegrees).toBe(2)
  })

  test("updates when the change exceeds the dead-band", () => {
    const priorCourse = { bearingDegrees: 90, qualifiedAt: 5_000 }
    const result = resolveDriverCourse(priorCourse, { previous, current }, 12_000)
    expect(result.status).toBe("VALID")
    if (result.status === "VALID") expect(result.bearingDegrees).toBeCloseTo(0, 0)
  })

  test("holds the last qualified course for up to 30s when the new pair fails its gates", () => {
    const priorCourse = { bearingDegrees: 45, qualifiedAt: 1_000 }
    const result = resolveDriverCourse(priorCourse, null, 1_000 + BEARING_HOLD_MAX_MS)
    expect(result).toEqual({ status: "HELD", bearingDegrees: 45, qualifiedAt: 1_000 })
  })

  test("falls back to NEUTRAL after the 30s hold expires", () => {
    const priorCourse = { bearingDegrees: 45, qualifiedAt: 1_000 }
    const result = resolveDriverCourse(priorCourse, null, 1_000 + BEARING_HOLD_MAX_MS + 1)
    expect(result).toEqual({ status: "NEUTRAL" })
  })

  test("is NEUTRAL with no candidate pair and no prior course", () => {
    expect(resolveDriverCourse(null, null, 0)).toEqual({ status: "NEUTRAL" })
  })
})

describe("follow camera dead-zone and safe zone", () => {
  const viewport = { width: 400, height: 800 }

  test("center of the lower-middle zone is inside the safe zone", () => {
    expect(isPointInsideFollowSafeZone({ x: 200, y: 600 }, viewport)).toBe(true)
    expect(shouldRecenterFollowCamera({ x: 200, y: 600 }, viewport)).toBe(false)
  })

  test("marker near the top of the viewport is outside the safe zone", () => {
    expect(isPointInsideFollowSafeZone({ x: 200, y: 50 }, viewport)).toBe(false)
    expect(shouldRecenterFollowCamera({ x: 200, y: 50 }, viewport)).toBe(true)
  })

  test("marker near the left/right edges is outside the safe zone", () => {
    expect(isPointInsideFollowSafeZone({ x: 5, y: 600 }, viewport)).toBe(false)
    expect(isPointInsideFollowSafeZone({ x: 395, y: 600 }, viewport)).toBe(false)
  })

  test("an unmeasured (zero-size) viewport never forces a recenter", () => {
    expect(shouldRecenterFollowCamera({ x: 0, y: 0 }, { width: 0, height: 0 })).toBe(false)
  })
})

describe("FOLLOWING / MANUAL transitions", () => {
  test("user interaction (not guarded) transitions FOLLOWING to MANUAL", () => {
    expect(nextFollowModeOnMapInteraction("FOLLOWING", false)).toBe("MANUAL")
  })

  test("a guarded programmatic operation leaves FOLLOWING unchanged", () => {
    expect(nextFollowModeOnMapInteraction("FOLLOWING", true)).toBe("FOLLOWING")
  })

  test("a guarded programmatic operation leaves MANUAL unchanged", () => {
    expect(nextFollowModeOnMapInteraction("MANUAL", true)).toBe("MANUAL")
  })
})

describe("recenter", () => {
  test("recenter always resumes FOLLOWING and resets zoom to 16", () => {
    expect(recenterFollowCamera()).toEqual({ mode: "FOLLOWING", zoom: FOLLOW_DEFAULT_ZOOM })
  })

  test("recenter button is visible only in MANUAL with a fresh location", () => {
    expect(isRecenterButtonVisible("MANUAL", true)).toBe(true)
    expect(isRecenterButtonVisible("MANUAL", false)).toBe(false)
    expect(isRecenterButtonVisible("FOLLOWING", true)).toBe(false)
  })
})
