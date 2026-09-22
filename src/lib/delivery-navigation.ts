import { haversineDistanceMeters, type TrackingLocationSample } from "@/lib/tracking-movement"

export interface DeliveryCoordinate {
  lat: number
  lng: number
}

export interface DeliveryDestination {
  lat?: number | null
  lng?: number | null
  address?: string | null
}

export interface DeliveryRoute {
  coordinates: Array<[number, number]>
  distanceMeters: number
  durationSeconds: number | null
  nextInstruction: string | null
}

const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1/driving"
export const ROUTE_RECALC_MIN_INTERVAL_MS = 30_000
export const ROUTE_RECALC_MIN_MOVEMENT_METERS = 100
export const ROUTE_RECALC_MAX_INTERVAL_MS = 120_000
export const ROUTE_FETCH_TIMEOUT_MS = 10_000

export type DeliveryRouteRequestStatus = "SUCCESS" | "ERROR" | "ABORTED" | "TIMEOUT"

export class DeliveryRouteRequestError extends Error {
  constructor(public readonly status: Exclude<DeliveryRouteRequestStatus, "SUCCESS">) {
    super(`delivery_route_${status.toLowerCase()}`)
    this.name = "DeliveryRouteRequestError"
  }
}

export function shouldRecoverRouteOnForeground(
  route: DeliveryRoute | null,
  routeError: string | null,
  routeLoading: boolean,
): boolean {
  return route === null || routeError !== null || routeLoading
}

/**
 * Fetches and validates one route with an explicit terminal outcome. The
 * caller owns the external signal; this helper adds a timeout signal without
 * relying on AbortSignal.any(), which is not uniformly available on WebKit.
 */
export async function fetchDeliveryRoute(
  url: string,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<DeliveryRoute> {
  const controller = new AbortController()
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? ROUTE_FETCH_TIMEOUT_MS
  let timedOut = false
  const forwardAbort = () => controller.abort()
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener("abort", forwardAbort, { once: true })
  }

  try {
    const response = await fetchImpl(url, { signal: controller.signal })
    if (!response.ok) throw new DeliveryRouteRequestError("ERROR")
    const route = parseOsrmRouteResponse(await response.json())
    if (!route) throw new DeliveryRouteRequestError("ERROR")
    return route
  } catch (error) {
    if (error instanceof DeliveryRouteRequestError) throw error
    if (timedOut) throw new DeliveryRouteRequestError("TIMEOUT")
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new DeliveryRouteRequestError("ABORTED")
    }
    throw new DeliveryRouteRequestError("ERROR")
  } finally {
    clearTimeout(timeoutId)
    options.signal?.removeEventListener("abort", forwardAbort)
  }
}

export function isValidDeliveryCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180
}

export function isValidDeliveryPoint(point: Partial<DeliveryCoordinate> | null | undefined): point is DeliveryCoordinate {
  if (!point) return false
  return isValidDeliveryCoordinate(point.lat) && point.lat >= -90 && point.lat <= 90 &&
    isValidDeliveryCoordinate(point.lng)
}

export function getDestinationCoordinate(destination: DeliveryDestination): DeliveryCoordinate | null {
  if (!isValidDeliveryCoordinate(destination.lat) || destination.lat < -90 || destination.lat > 90) return null
  if (!isValidDeliveryCoordinate(destination.lng)) return null
  return { lat: destination.lat, lng: destination.lng }
}

/** Official Google Maps directions URL. It needs no Maps API key. */
export function buildGoogleMapsDirectionsUrl(destination: DeliveryDestination): string | null {
  const coordinate = getDestinationCoordinate(destination)
  const target = coordinate
    ? `${coordinate.lat},${coordinate.lng}`
    : typeof destination.address === "string" && destination.address.trim().length > 0
      ? destination.address.trim()
      : null
  if (!target) return null

  const url = new URL("https://www.google.com/maps/dir/")
  url.searchParams.set("api", "1")
  url.searchParams.set("destination", target)
  return url.toString()
}

/**
 * Builds a public OSRM request. Coordinates are encoded as numbers only and
 * no user-provided address is sent to the router.
 */
export function buildOsrmRouteUrl(origin: DeliveryCoordinate, destination: DeliveryCoordinate): string | null {
  if (!isValidDeliveryPoint(origin) || !isValidDeliveryPoint(destination)) return null
  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
  const url = new URL(`${OSRM_BASE_URL}/${coordinates}`)
  url.searchParams.set("overview", "full")
  url.searchParams.set("geometries", "geojson")
  url.searchParams.set("steps", "true")
  return url.toString()
}

export function shouldRecalculateRoute(
  previousOrigin: DeliveryCoordinate | null,
  nextOrigin: DeliveryCoordinate,
  lastRequestAt: number | null,
  now: number,
  minIntervalMs: number = ROUTE_RECALC_MIN_INTERVAL_MS,
  minMovementMeters: number = ROUTE_RECALC_MIN_MOVEMENT_METERS,
  maxIntervalMs: number = ROUTE_RECALC_MAX_INTERVAL_MS,
): boolean {
  if (!isValidDeliveryPoint(nextOrigin)) return false
  if (previousOrigin === null || lastRequestAt === null) return true
  if (!Number.isFinite(now) || now < lastRequestAt) return false
  const elapsed = now - lastRequestAt
  return elapsed >= minIntervalMs &&
    (haversineDistanceMeters(previousOrigin, nextOrigin) >= minMovementMeters || elapsed >= maxIntervalMs)
}

export function parseOsrmRouteResponse(payload: unknown): DeliveryRoute | null {
  if (!payload || typeof payload !== "object") return null
  const data = payload as {
    code?: unknown
    routes?: Array<{
      distance?: unknown
      duration?: unknown
      geometry?: { type?: unknown; coordinates?: unknown }
      legs?: Array<{ steps?: Array<{ maneuver?: { instruction?: unknown; type?: unknown }; name?: unknown }> }>
    }>
  }
  const route = data.code === "Ok" ? data.routes?.[0] : undefined
  const geometry = route?.geometry
  if (!route || geometry?.type !== "LineString" || !Array.isArray(geometry.coordinates)) return null

  const coordinates = geometry.coordinates.flatMap((point): Array<[number, number]> => {
    if (!Array.isArray(point) || point.length < 2) return []
    const [lng, lat] = point
    return isValidDeliveryPoint({ lat, lng }) ? [[lat, lng]] : []
  })
  if (coordinates.length < 2 || typeof route.distance !== "number" || !Number.isFinite(route.distance)) return null

  const firstStep = route.legs?.[0]?.steps?.find((step) => {
    const instruction = step.maneuver?.instruction
    return typeof instruction === "string" && instruction.trim().length > 0
  })
  const instruction = firstStep?.maneuver?.instruction
  const namedInstruction = typeof instruction === "string" ? instruction.trim() : null

  return {
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: typeof route.duration === "number" && Number.isFinite(route.duration) ? route.duration : null,
    nextInstruction: namedInstruction,
  }
}

export function formatRouteDistance(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return "Distancia no disponible"
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`
  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10_000 ? 1 : 0)} km`
}

export function formatRouteEta(durationSeconds: number | null): string | null {
  if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds < 0) return null
  const minutes = Math.max(1, Math.round(durationSeconds / 60))
  return `${minutes} min`
}

export function trackingSampleToCoordinate(sample: TrackingLocationSample | null): DeliveryCoordinate | null {
  return sample && isValidDeliveryPoint(sample) ? { lat: sample.lat, lng: sample.lng } : null
}
