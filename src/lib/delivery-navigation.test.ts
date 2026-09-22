import { describe, expect, test } from "bun:test"
import {
  buildGoogleMapsDirectionsUrl,
  buildOsrmRouteUrl,
  DeliveryRouteRequestError,
  fetchDeliveryRoute,
  parseOsrmRouteResponse,
  shouldRecoverRouteOnForeground,
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

  test("recovers route state when foreground returns without a usable route", () => {
    const route = { coordinates: [[-26.1, -58.2], [-26.2, -58.3]] as Array<[number, number]>, distanceMeters: 1234, durationSeconds: 600, nextInstruction: null }
    expect(shouldRecoverRouteOnForeground(route, null, false)).toBe(false)
    expect(shouldRecoverRouteOnForeground(null, null, false)).toBe(true)
    expect(shouldRecoverRouteOnForeground(route, "No se pudo calcular", false)).toBe(true)
    expect(shouldRecoverRouteOnForeground(route, null, true)).toBe(true)
  })

  test("returns SUCCESS data for a valid route response", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({
      code: "Ok",
      routes: [{ distance: 1234, duration: 600, geometry: { type: "LineString", coordinates: [[-58.2, -26.1], [-58.3, -26.2]] } }],
    }), { status: 200 })) as unknown as typeof fetch

    await expect(fetchDeliveryRoute("https://example.test/route", { fetchImpl })).resolves.toMatchObject({
      distanceMeters: 1234,
      durationSeconds: 600,
    })
  })

  test("returns ERROR for provider and payload failures", async () => {
    const providerFailure = (async () => new Response("", { status: 503 })) as unknown as typeof fetch
    await expect(fetchDeliveryRoute("https://example.test/route", { fetchImpl: providerFailure })).rejects.toMatchObject({
      status: "ERROR",
    })
    expect(() => { throw new DeliveryRouteRequestError("ERROR") }).toThrow("delivery_route_error")
  })

  test("returns ABORTED when the current request is cancelled", async () => {
    const externalController = new AbortController()
    const fetchImpl = ((_, init) => new Promise<Response>((_resolve, reject) => {
      const abort = () => reject(new DOMException("aborted", "AbortError"))
      if (init?.signal?.aborted) abort()
      else init?.signal?.addEventListener("abort", abort, { once: true })
    })) as typeof fetch
    const request = fetchDeliveryRoute("https://example.test/route", { signal: externalController.signal, fetchImpl })
    externalController.abort()
    await expect(request).rejects.toMatchObject({ status: "ABORTED" })
  })

  test("returns TIMEOUT and settles loading work within the configured deadline", async () => {
    const fetchImpl = ((_, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")), { once: true })
    })) as typeof fetch
    await expect(fetchDeliveryRoute("https://example.test/route", { fetchImpl, timeoutMs: 1 })).rejects.toMatchObject({
      status: "TIMEOUT",
    })
  })
})
