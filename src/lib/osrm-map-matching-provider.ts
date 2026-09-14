import { haversineDistanceMeters } from "@/lib/tracking-movement"
import { mapFullRoadGeometryToTimedTrajectory, parseGeoJsonLineString } from "@/lib/map-matching-geometry"
import {
  isValidMatchingAccuracy,
  MATCHING_TIMEOUT_MS,
  type MapMatchingProvider,
  type MapMatchingProfile,
  type MapMatchingRequestContext,
  type MapMatchingResult,
  type MapMatchingSubtrace,
  type MapMatchingTracepoint,
  type MatchedMapMatchingResult,
  type RawMatchingPoint,
  type GeoJsonLineString,
} from "@/lib/map-matching-provider"

const DEFAULT_PROFILE: MapMatchingProfile = "driving"
export type MapMatchingFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface OsrmMapMatchingProviderOptions {
  baseUrl?: string
  enabled?: boolean
  fetchImpl?: MapMatchingFetch
  timeoutMs?: number
  env?: Record<string, string | undefined>
}

export interface OsrmMapMatchingConfig {
  enabled: boolean
  baseUrl: string | null
  profile: MapMatchingProfile
  timeoutMs: number
  reason?: string
}

function environmentName(env: Record<string, string | undefined>): string | undefined {
  return env.DELIGO_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME || env.APP_ENV
}

function isProductionHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === "deligo.ar" || host === "www.deligo.ar" || host.endsWith(".deligo.ar")
}

export function validateMapMatchingBaseUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      isProductionHost(url.hostname)
    ) return null
    return url.toString().replace(/\/+$/, "")
  } catch {
    return null
  }
}

export function resolveOsrmMapMatchingConfig(
  env: Record<string, string | undefined> = process.env,
): OsrmMapMatchingConfig {
  const provider = env.MAP_MATCHING_PROVIDER?.trim().toLowerCase()
  if (provider !== "osrm") {
    return { enabled: false, baseUrl: null, profile: DEFAULT_PROFILE, timeoutMs: MATCHING_TIMEOUT_MS, reason: "provider_disabled" }
  }
  if (environmentName(env) !== "TESTING") {
    return { enabled: false, baseUrl: null, profile: DEFAULT_PROFILE, timeoutMs: MATCHING_TIMEOUT_MS, reason: "testing_only_guard" }
  }
  const baseUrl = validateMapMatchingBaseUrl(env.MAP_MATCHING_BASE_URL)
  if (!baseUrl) {
    return { enabled: false, baseUrl: null, profile: DEFAULT_PROFILE, timeoutMs: MATCHING_TIMEOUT_MS, reason: "invalid_base_url" }
  }
  return { enabled: true, baseUrl, profile: DEFAULT_PROFILE, timeoutMs: MATCHING_TIMEOUT_MS }
}

export function buildOsrmMatchUrl(
  rawPoints: readonly RawMatchingPoint[],
  options: { baseUrl: string; profile?: MapMatchingProfile },
): string | null {
  const baseUrl = validateMapMatchingBaseUrl(options.baseUrl)
  if (!baseUrl || rawPoints.length === 0) return null
  if (rawPoints.some((point) =>
    !Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90 ||
    !Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180
  )) return null

  const coordinates = rawPoints.map((point) => String(point.lng) + "," + String(point.lat)).join(";")
  const url = new URL(baseUrl + "/match/v1/" + (options.profile ?? DEFAULT_PROFILE) + "/" + coordinates)
  url.searchParams.set("geometries", "geojson")
  url.searchParams.set("overview", "full")
  url.searchParams.set("steps", "false")
  url.searchParams.set("gaps", "split")
  url.searchParams.set("tidy", "false")
  if (rawPoints.every((point) => isValidMatchingAccuracy(point.accuracy))) {
    url.searchParams.set("radiuses", rawPoints.map((point) => String(point.accuracy)).join(";"))
  }
  return url.toString()
}

function invalidResult(reason: string): MapMatchingResult {
  return { status: "error", reason, provider: "osrm" }
}

function parseTracepoint(
  value: unknown,
  rawPoint: RawMatchingPoint,
): MapMatchingTracepoint | null | undefined {
  if (value === null) return null
  if (!value || typeof value !== "object") return undefined
  const candidate = value as {
    location?: unknown
    matchings_index?: unknown
    waypoint_index?: unknown
    alternatives_count?: unknown
  }
  if (
    !Array.isArray(candidate.location) ||
    candidate.location.length < 2 ||
    typeof candidate.location[0] !== "number" ||
    typeof candidate.location[1] !== "number" ||
    !Number.isFinite(candidate.location[0]) ||
    !Number.isFinite(candidate.location[1]) ||
    typeof candidate.matchings_index !== "number" ||
    !Number.isInteger(candidate.matchings_index) ||
    typeof candidate.waypoint_index !== "number" ||
    !Number.isInteger(candidate.waypoint_index) ||
    typeof candidate.alternatives_count !== "number" ||
    !Number.isInteger(candidate.alternatives_count) ||
    candidate.alternatives_count < 0
  ) return undefined
  const point = { lat: candidate.location[1], lng: candidate.location[0] }
  if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) return undefined
  return {
    ...point,
    matchingIndex: candidate.matchings_index,
    waypointIndex: candidate.waypoint_index,
    alternativesCount: candidate.alternatives_count,
    snapDistanceMeters: haversineDistanceMeters(rawPoint, point),
  }
}

function parseMatching(value: unknown, matchingIndex: number): MapMatchingSubtrace | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as { confidence?: unknown; geometry?: unknown }
  if (typeof candidate.confidence !== "number" || !Number.isFinite(candidate.confidence)) return null
  const geometry = parseGeoJsonLineString(candidate.geometry)
  if (!geometry) return null
  return { matchingIndex, confidence: candidate.confidence, geometry }
}

export function parseOsrmMatchResponse(
  payload: unknown,
  rawPoints: readonly RawMatchingPoint[],
): MapMatchingResult {
  if (!payload || typeof payload !== "object") return invalidResult("invalid_json_shape")
  const candidate = payload as { code?: unknown; tracepoints?: unknown; matchings?: unknown }
  if (candidate.code !== "Ok") {
    return {
      status: "rejected",
      reason: typeof candidate.code === "string" ? "osrm_" + candidate.code : "missing_osrm_code",
      provider: "osrm",
    }
  }
  if (!Array.isArray(candidate.tracepoints) || !Array.isArray(candidate.matchings)) {
    return invalidResult("missing_match_response_fields")
  }
  const matchings: MapMatchingSubtrace[] = []
  for (let index = 0; index < candidate.matchings.length; index += 1) {
    const matching = parseMatching(candidate.matchings[index], index)
    if (!matching) return invalidResult("invalid_matching")
    matchings.push(matching)
  }
  if (matchings.length === 0 || candidate.tracepoints.length !== rawPoints.length) {
    return invalidResult("matching_tracepoint_count")
  }

  const tracepoints: Array<MapMatchingTracepoint | null> = []
  for (let index = 0; index < candidate.tracepoints.length; index += 1) {
    const tracepoint = parseTracepoint(candidate.tracepoints[index], rawPoints[index])
    if (tracepoint === undefined) return invalidResult("invalid_tracepoint")
    tracepoints.push(tracepoint)
  }

  let matchedTrajectory: MatchedMapMatchingResult["matchedTrajectory"] = []
  const snapDistancesMeters = tracepoints.map((tracepoint) => tracepoint?.snapDistanceMeters ?? Number.POSITIVE_INFINITY)
  if (matchings.length === 1 && tracepoints.every((tracepoint): tracepoint is MapMatchingTracepoint => tracepoint !== null)) {
    const geometryResult = mapFullRoadGeometryToTimedTrajectory(
      rawPoints,
      tracepoints,
      matchings[0].geometry,
    )
    if (geometryResult.ok) matchedTrajectory = geometryResult.points
  }

  return {
    status: "matched",
    provider: "osrm",
    rawPointCount: rawPoints.length,
    tracepoints,
    matchings,
    matchedTrajectory,
    snapDistancesMeters,
  }
}

async function fetchJsonWithTimeout(
  fetchImpl: MapMatchingFetch,
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ kind: "ok"; payload: unknown } | { kind: "timeout" } | { kind: "error"; reason: string }> {
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const forwardAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener("abort", forwardAbort, { once: true })
  }
  try {
    const response = await fetchImpl(url, { signal: controller.signal })
    if (!response.ok) return { kind: "error", reason: "http_" + response.status }
    try {
      return { kind: "ok", payload: await response.json() }
    } catch {
      return { kind: "error", reason: "invalid_json" }
    }
  } catch {
    if (timedOut) return { kind: "timeout" }
    return { kind: "error", reason: signal?.aborted ? "aborted" : "network_error" }
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener("abort", forwardAbort)
  }
}

export function createOsrmMapMatchingProvider(
  options: OsrmMapMatchingProviderOptions = {},
): MapMatchingProvider {
  const env = options.env ?? process.env
  const config = options.baseUrl
    ? {
        enabled: options.enabled === true,
        baseUrl: validateMapMatchingBaseUrl(options.baseUrl),
        profile: DEFAULT_PROFILE,
        timeoutMs: options.timeoutMs ?? MATCHING_TIMEOUT_MS,
      }
    : resolveOsrmMapMatchingConfig(env)
  const fetchImpl = options.fetchImpl ?? fetch

  return {
    name: "osrm",
    async matchTrajectory(rawPoints, context: MapMatchingRequestContext = {}): Promise<MapMatchingResult> {
      if (!config.enabled || !config.baseUrl) {
        return { status: "rejected", reason: "provider_disabled", provider: "osrm" }
      }
      if (environmentName(env) !== "TESTING") {
        return { status: "rejected", reason: "testing_only_guard", provider: "osrm" }
      }
      const url = buildOsrmMatchUrl(rawPoints, { baseUrl: config.baseUrl, profile: context.profile ?? config.profile })
      if (!url) return invalidResult("invalid_request_points")
      const timeoutMs = context.timeoutMs ?? options.timeoutMs ?? config.timeoutMs
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_000) {
        return invalidResult("invalid_timeout")
      }
      const fetched = await fetchJsonWithTimeout(fetchImpl, url, timeoutMs, context.signal)
      if (fetched.kind === "timeout") return { status: "timeout", provider: "osrm" }
      if (fetched.kind === "error") return invalidResult(fetched.reason)
      try {
        return parseOsrmMatchResponse(fetched.payload, rawPoints)
      } catch {
        return invalidResult("response_processing_error")
      }
    },
  }
}
