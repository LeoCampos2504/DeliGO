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
  timingLogger?: (event: OsrmMapMatchingTimingEvent) => void
}

export type OsrmMapMatchingTimingStage =
  | "MATCH_REQUEST_START"
  | "HEADERS_RECEIVED"
  | "JSON_PARSED"
  | "MATCH_REQUEST_END"

export interface OsrmMapMatchingTimingEvent {
  event: OsrmMapMatchingTimingStage
  provider: "osrm"
  profile: MapMatchingProfile
  pointCount: number
  radiusesPresent: boolean
  timeoutMs: number
  providerTimeoutLayerCount: 1
  requestPathKind: "match"
  geometriesMode: string
  overviewMode: string
  gapsMode: string
  tidyMode: string
  serializedRequestLengthBytes: number
  fetchHeadersMs?: number
  jsonBodyParseMs?: number
  totalProviderMs?: number
  abortElapsedMs?: number
  resultCategory?: "matched" | "rejected" | "timeout" | "error"
  httpStatus?: number
  osrmCode?: string
  confidence?: number
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
  if (environmentName(env) !== "TESTING" || env.NODE_ENV === "production") {
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

interface OsrmRequestTiming {
  startedAt: number
  headersAt?: number
  jsonParsedAt?: number
  endedAt?: number
  abortElapsedMs?: number
  httpStatus?: number
}

type FetchJsonResult =
  | { kind: "ok"; payload: unknown; timing: OsrmRequestTiming }
  | { kind: "timeout"; timing: OsrmRequestTiming }
  | { kind: "error"; reason: string; timing: OsrmRequestTiming }

async function fetchJsonWithTimeout(
  fetchImpl: MapMatchingFetch,
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<FetchJsonResult> {
  const timing: OsrmRequestTiming = { startedAt: performance.now() }
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    timing.abortElapsedMs = performance.now() - timing.startedAt
    controller.abort()
  }, timeoutMs)
  const forwardAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener("abort", forwardAbort, { once: true })
  }
  try {
    const response = await fetchImpl(url, { signal: controller.signal })
    timing.headersAt = performance.now()
    timing.httpStatus = response.status
    if (!response.ok) return { kind: "error", reason: "http_" + response.status, timing }
    try {
      const payload = await response.json()
      timing.jsonParsedAt = performance.now()
      return { kind: "ok", payload, timing }
    } catch {
      return { kind: "error", reason: "invalid_json", timing }
    }
  } catch {
    if (timedOut) return { kind: "timeout", timing }
    return { kind: "error", reason: signal?.aborted ? "aborted" : "network_error", timing }
  } finally {
    timing.endedAt = performance.now()
    clearTimeout(timeoutId)
    signal?.removeEventListener("abort", forwardAbort)
  }
}

function roundTimingMs(value: number): number {
  return Math.round(value * 100) / 100
}

function createTimingEvent(
  event: OsrmMapMatchingTimingStage,
  rawPoints: readonly RawMatchingPoint[],
  requestUrl: string,
  profile: MapMatchingProfile,
  timeoutMs: number,
): OsrmMapMatchingTimingEvent {
  const url = new URL(requestUrl)
  return {
    event,
    provider: "osrm",
    profile,
    pointCount: rawPoints.length,
    radiusesPresent: url.searchParams.has("radiuses"),
    timeoutMs,
    providerTimeoutLayerCount: 1,
    requestPathKind: "match",
    geometriesMode: url.searchParams.get("geometries") ?? "",
    overviewMode: url.searchParams.get("overview") ?? "",
    gapsMode: url.searchParams.get("gaps") ?? "",
    tidyMode: url.searchParams.get("tidy") ?? "",
    serializedRequestLengthBytes: new TextEncoder().encode(requestUrl).byteLength,
  }
}

function resultTimingFields(result: MapMatchingResult): Pick<OsrmMapMatchingTimingEvent, "resultCategory" | "osrmCode" | "confidence"> {
  if (result.status === "matched") {
    return {
      resultCategory: "matched",
      osrmCode: "Ok",
      confidence: result.matchings[0]?.confidence,
    }
  }
  if (result.status === "timeout") return { resultCategory: "timeout" }
  if (result.status === "rejected") {
    return {
      resultCategory: "rejected",
      osrmCode: result.reason.startsWith("osrm_") ? result.reason.slice("osrm_".length) : undefined,
    }
  }
  return { resultCategory: "error" }
}

function timingDurations(timing: OsrmRequestTiming): Pick<OsrmMapMatchingTimingEvent, "fetchHeadersMs" | "jsonBodyParseMs" | "totalProviderMs" | "abortElapsedMs"> {
  const headersAt = timing.headersAt
  const jsonParsedAt = timing.jsonParsedAt
  const endedAt = timing.endedAt
  return {
    fetchHeadersMs: headersAt === undefined ? undefined : roundTimingMs(headersAt - timing.startedAt),
    jsonBodyParseMs: headersAt === undefined || jsonParsedAt === undefined ? undefined : roundTimingMs(jsonParsedAt - headersAt),
    totalProviderMs: endedAt === undefined ? undefined : roundTimingMs(endedAt - timing.startedAt),
    abortElapsedMs: timing.abortElapsedMs === undefined ? undefined : roundTimingMs(timing.abortElapsedMs),
  }
}

function formatTimingEvent(event: OsrmMapMatchingTimingEvent): string {
  return "[Tracking Matching Timing] " + JSON.stringify(event)
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
  const timingEnabled = env.DELIGO_ENVIRONMENT === "TESTING" && env.NODE_ENV !== "production"
  const timingLogger = options.timingLogger ?? ((event: OsrmMapMatchingTimingEvent) => console.info(formatTimingEvent(event)))

  return {
    name: "osrm",
    async matchTrajectory(rawPoints, context: MapMatchingRequestContext = {}): Promise<MapMatchingResult> {
      if (!config.enabled || !config.baseUrl) {
        return { status: "rejected", reason: "provider_disabled", provider: "osrm" }
      }
      if (env.NODE_ENV === "production" || environmentName(env) !== "TESTING") {
        return { status: "rejected", reason: "testing_only_guard", provider: "osrm" }
      }
      const url = buildOsrmMatchUrl(rawPoints, { baseUrl: config.baseUrl, profile: context.profile ?? config.profile })
      if (!url) return invalidResult("invalid_request_points")
      const timeoutMs = context.timeoutMs ?? options.timeoutMs ?? config.timeoutMs
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_000) {
        return invalidResult("invalid_timeout")
      }
      const requestProfile = context.profile ?? config.profile
      const startEvent = createTimingEvent("MATCH_REQUEST_START", rawPoints, url, requestProfile, timeoutMs)
      if (timingEnabled) timingLogger(startEvent)
      const fetched = await fetchJsonWithTimeout(fetchImpl, url, timeoutMs, context.signal)
      const baseEvent = createTimingEvent("MATCH_REQUEST_END", rawPoints, url, requestProfile, timeoutMs)
      const timing = timingDurations(fetched.timing)
      if (timingEnabled && fetched.timing.headersAt !== undefined) {
        timingLogger({ ...createTimingEvent("HEADERS_RECEIVED", rawPoints, url, requestProfile, timeoutMs), httpStatus: fetched.timing.httpStatus, ...timing })
      }
      if (timingEnabled && fetched.timing.jsonParsedAt !== undefined) {
        timingLogger({ ...createTimingEvent("JSON_PARSED", rawPoints, url, requestProfile, timeoutMs), httpStatus: fetched.timing.httpStatus, ...timing })
      }
      if (fetched.kind === "timeout") {
        const result: MapMatchingResult = { status: "timeout", provider: "osrm" }
        if (timingEnabled) timingLogger({ ...baseEvent, ...timing, ...resultTimingFields(result), httpStatus: fetched.timing.httpStatus })
        return result
      }
      if (fetched.kind === "error") {
        const result = invalidResult(fetched.reason)
        if (timingEnabled) timingLogger({ ...baseEvent, ...timing, ...resultTimingFields(result), httpStatus: fetched.timing.httpStatus })
        return result
      }
      try {
        const result = parseOsrmMatchResponse(fetched.payload, rawPoints)
        if (timingEnabled) timingLogger({ ...baseEvent, ...timing, ...resultTimingFields(result), httpStatus: fetched.timing.httpStatus })
        return result
      } catch {
        const result = invalidResult("response_processing_error")
        if (timingEnabled) timingLogger({ ...baseEvent, ...timing, ...resultTimingFields(result), httpStatus: fetched.timing.httpStatus })
        return result
      }
    },
  }
}
