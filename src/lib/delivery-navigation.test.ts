import { describe, expect, test } from "bun:test"
import {
  buildGoogleMapsDirectionsUrl,
  buildOsrmRouteUrl,
  parseOsrmRouteResponse,
  shouldRecalculateRoute,
} from "./delivery-navigation"

describe("delivery navigation route helpers", () => {
  test("builds an official Google Maps URL from valid coordinates", () => {
    const url = buildGoogleMapsDirectionsUrl({ lat: -26.1856, lng: -58.1732, address: "ignored" })
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=-26.1856%2C-58.1732")
  })

  test("falls back to an encoded address and rejects missing destinations", () => {
    const url = buildGoogleMapsDirectionsUrl({ address: "Av. 25 de Mayo & Mitre <script>alert(1)</script>" })
    expect(url).toContain("https://www.google.com/maps/dir/?api=1&destination=")
    expect(url).toContain("%3Cscript%3Ealert%281%29%3C%2Fscript%3E")
    expect(buildGoogleMapsDirectionsUrl({ address: "   " })).toBeNull()
    expect(buildGoogleMapsDirectionsUrl({ lat: 999, lng: 1, address: null })).toBeNull()
  })

  test("builds OSRM requests from coordinates only", () => {
    const url = buildOsrmRouteUrl({ lat: -26.1, lng: -58.2 }, { lat: -26.2, lng: -58.3 })
    expect(url).toBe("https://router.project-osrm.org/route/v1/driving/-58.2,-26.1;-58.3,-26.2?overview=full&geometries=geojson&steps=true")
    expect(buildOsrmRouteUrl({ lat: -26.1, lng: -58.2 }, { lat: 999, lng: -58.3 })).toBeNull()
  })

  test("parses a route and does not invent one for an invalid provider response", () => {
    expect(parseOsrmRouteResponse({ code: "NoRoute", routes: [] })).toBeNull()
    expect(parseOsrmRouteResponse({
      code: "Ok",
      routes: [{
        distance: 1234,
        duration: 600,
        geometry: { type: "LineString", coordinates: [[-58.2, -26.1], [-58.3, -26.2]] },
        legs: [{ steps: [{ maneuver: { instruction: "Girá a la derecha" } }] }],
      }],
    })).toMatchObject({ distanceMeters: 1234, durationSeconds: 600, nextInstruction: "Girá a la derecha" })
  })

  test("guards route requests by movement and time window", () => {
    const origin = { lat: -26.1, lng: -58.2 }
    expect(shouldRecalculateRoute(null, origin, null, 0)).toBe(true)
    expect(shouldRecalculateRoute(origin, { lat: -26.1001, lng: -58.2001 }, 0, 10_000)).toBe(false)
    expect(shouldRecalculateRoute(origin, { lat: -26.1001, lng: -58.2001 }, 0, 30_000)).toBe(false)
    expect(shouldRecalculateRoute(origin, { lat: -26.1001, lng: -58.2001 }, 0, 120_000)).toBe(true)
    expect(shouldRecalculateRoute(origin, { lat: -26.102, lng: -58.2 }, 0, 30_000)).toBe(true)
  })
})
