import { describe, expect, test } from "bun:test"
import {
  buildOsrmMatchUrl,
  createOsrmMapMatchingProvider,
  parseOsrmMatchResponse,
  resolveOsrmMapMatchingConfig,
  validateMapMatchingBaseUrl,
} from "@/lib/osrm-map-matching-provider"
import { evaluateMapMatching } from "@/lib/map-matching-policy"
import type { RawMatchingPoint } from "@/lib/map-matching-provider"

const raw: RawMatchingPoint[] = [
  { lat: 52.517037, lng: 13.38886, offsetMs: 0, accuracy: 5 },
  { lat: 52.5172, lng: 13.3892, offsetMs: 1_000, accuracy: 5 },
  { lat: 52.5174, lng: 13.3895, offsetMs: 2_000, accuracy: 5 },
]
const payload = {
  code: "Ok",
  tracepoints: raw.map((point, index) => ({ location: [point.lng, point.lat], matchings_index: 0, waypoint_index: index, alternatives_count: 0 })),
  matchings: [{ confidence: 0.9, geometry: { type: "LineString", coordinates: raw.map((point) => [point.lng, point.lat]) } }],
}

function response(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

function rejection(result: ReturnType<typeof evaluateMapMatching>): string {
  if (result.decision !== "REJECT_MATCH") throw new Error("expected rejection")
  return result.reason
}

describe("P2-T24 OSRM adapter", () => {
  test("validates Testing-only base URLs", () => {
    expect(validateMapMatchingBaseUrl("https://router.project-osrm.org/")).toBe("https://router.project-osrm.org")
    expect(validateMapMatchingBaseUrl("https://user:pass@example.com")).toBeNull()
    expect(validateMapMatchingBaseUrl("https://deligo.ar/match")).toBeNull()
    expect(validateMapMatchingBaseUrl("https://example.com/?pii=1")).toBeNull()
  })

  test("is disabled unless explicitly configured for exact Testing", () => {
    expect(resolveOsrmMapMatchingConfig({ MAP_MATCHING_PROVIDER: "osrm", MAP_MATCHING_BASE_URL: "https://example.com" }).enabled).toBe(false)
    expect(resolveOsrmMapMatchingConfig({ MAP_MATCHING_PROVIDER: "osrm", DELIGO_ENVIRONMENT: "TESTING", NODE_ENV: "production", MAP_MATCHING_BASE_URL: "https://example.com" }).reason).toBe("testing_only_guard")
    expect(resolveOsrmMapMatchingConfig({ MAP_MATCHING_PROVIDER: "osrm", DELIGO_ENVIRONMENT: "TESTING", NODE_ENV: "test", MAP_MATCHING_BASE_URL: "https://example.com" }).enabled).toBe(true)
  })

  test("builds Match URL with driving, full GeoJSON, split gaps, and radiuses", () => {
    const url = buildOsrmMatchUrl(raw, { baseUrl: "https://router.project-osrm.org/" })
    expect(url).not.toBeNull()
    const parsed = new URL(url ?? "")
    expect(parsed.pathname).toContain("/match/v1/driving/")
    expect(parsed.searchParams.get("geometries")).toBe("geojson")
    expect(parsed.searchParams.get("overview")).toBe("full")
    expect(parsed.searchParams.get("gaps")).toBe("split")
    expect(parsed.searchParams.get("radiuses")).toBe("5;5;5")
    expect(parsed.searchParams.has("timestamps")).toBe(false)
  })

  test("omits radiuses when any accuracy is unavailable and rejects bad points", () => {
    const url = buildOsrmMatchUrl(raw.map(({ accuracy: _accuracy, ...point }) => point), { baseUrl: "https://example.com" })
    expect(new URL(url ?? "").searchParams.has("radiuses")).toBe(false)
    expect(buildOsrmMatchUrl([{ ...raw[0], lat: 91 }], { baseUrl: "https://example.com" })).toBeNull()
  })

  test("parses a valid OSRM Match response and creates timed geometry", () => {
    const result = parseOsrmMatchResponse(payload, raw)
    expect(result.status).toBe("matched")
    if (result.status !== "matched") return
    expect(result.matchedTrajectory.length).toBeGreaterThanOrEqual(3)
    expect(result.snapDistancesMeters).toEqual([0, 0, 0])
  })

  test("maps OSRM NoMatch to a controlled rejection", () => {
    const result = parseOsrmMatchResponse({ code: "NoMatch", tracepoints: [], matchings: [] }, raw)
    expect(result).toEqual({ status: "rejected", reason: "osrm_NoMatch", provider: "osrm" })
  })

  test("preserves null tracepoints for policy rejection", () => {
    const result = parseOsrmMatchResponse({ ...payload, tracepoints: [payload.tracepoints[0], null, payload.tracepoints[2]] }, raw)
    expect(result.status).toBe("matched")
    expect(rejection(evaluateMapMatching(raw, result))).toBe("null_tracepoint")
  })

  test("rejects malformed response shapes without throwing", () => {
    expect(parseOsrmMatchResponse(null, raw).status).toBe("error")
    expect(parseOsrmMatchResponse({ code: "Ok", tracepoints: [], matchings: [] }, raw).status).toBe("error")
    expect(parseOsrmMatchResponse({ code: "Ok", tracepoints: payload.tracepoints, matchings: [{ confidence: 0.9, geometry: { type: "Point", coordinates: [1, 2] } }] }, raw).status).toBe("error")
  })

  test("performs one real adapter request with no PII or timestamps", async () => {
    let requestedUrl = ""
    const provider = createOsrmMapMatchingProvider({
      baseUrl: "https://example.com",
      enabled: true,
      env: { DELIGO_ENVIRONMENT: "TESTING", NODE_ENV: "test" },
      fetchImpl: async (input) => { requestedUrl = String(input); return response(payload) },
    })
    const result = await provider.matchTrajectory(raw)
    expect(result.status).toBe("matched")
    expect(requestedUrl).not.toContain("TEST_T24")
    expect(requestedUrl).not.toContain("timestamp")
  })

  test("returns controlled HTTP and network errors", async () => {
    const httpProvider = createOsrmMapMatchingProvider({ baseUrl: "https://example.com", enabled: true, env: { DELIGO_ENVIRONMENT: "TESTING", NODE_ENV: "test" }, fetchImpl: async () => response({}, false, 503) })
    expect((await httpProvider.matchTrajectory(raw))).toEqual({ status: "error", reason: "http_503", provider: "osrm" })
    const networkProvider = createOsrmMapMatchingProvider({ baseUrl: "https://example.com", enabled: true, env: { DELIGO_ENVIRONMENT: "TESTING", NODE_ENV: "test" }, fetchImpl: async () => { throw new Error("offline") } })
    expect((await networkProvider.matchTrajectory(raw))).toEqual({ status: "error", reason: "network_error", provider: "osrm" })
  })

  test("returns timeout within the bounded request contract", async () => {
    const provider = createOsrmMapMatchingProvider({ baseUrl: "https://example.com", enabled: true, timeoutMs: 10, env: { DELIGO_ENVIRONMENT: "TESTING", NODE_ENV: "test" }, fetchImpl: (_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))) })
    expect((await provider.matchTrajectory(raw))).toEqual({ status: "timeout", provider: "osrm" })
  })

  test("never runs in production or outside exact Testing", async () => {
    let called = false
    const provider = createOsrmMapMatchingProvider({ baseUrl: "https://example.com", enabled: true, env: { DELIGO_ENVIRONMENT: "PRODUCTION", NODE_ENV: "production" }, fetchImpl: async () => { called = true; return response(payload) } })
    expect((await provider.matchTrajectory(raw))).toEqual({ status: "rejected", reason: "testing_only_guard", provider: "osrm" })
    expect(called).toBe(false)
  })
})
