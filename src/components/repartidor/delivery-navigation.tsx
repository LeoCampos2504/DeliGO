"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { ArrowLeft, Bike, Loader2, LocateFixed, MapPin, Navigation, Route, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock"
import {
  buildGoogleMapsDirectionsUrl,
  buildOsrmRouteUrl,
  DeliveryRouteRequestError,
  fetchDeliveryRoute,
  formatRouteDistance,
  formatRouteEta,
  getDestinationCoordinate,
  shouldRecoverRouteOnForeground,
  shouldRecalculateRoute,
  trackingSampleToCoordinate,
  type DeliveryDestination,
  type DeliveryRoute,
} from "@/lib/delivery-navigation"
import type { TrackingLocationSample } from "@/lib/tracking-movement"
import {
  FOLLOW_DEFAULT_ZOOM,
  isRecenterButtonVisible,
  nextFollowModeOnMapInteraction,
  recenterFollowCamera,
  resolveDriverCourse,
  shouldRecenterFollowCamera,
  type BearingGateSample,
  type DriverCourseState,
  type FollowCameraMode,
} from "@/lib/delivery-navigation-ux"

interface DeliveryNavigationProps {
  pedidoId: string
  destination: DeliveryDestination
  destinationReference?: string | null
  currentPosition: TrackingLocationSample | null
  trackingEligible: boolean
  open: boolean
  onClose: () => void
}

function createNavigationMarker(color: string, label: string) {
  return L.divIcon({
    className: "delivery-navigation-marker",
    html: `<span aria-label="${label}" style="display:flex;width:32px;height:32px;border-radius:50%;align-items:center;justify-content:center;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:15px">${label === "Destino" ? "📍" : "🛵"}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

// P2-T54-R1: the driver marker adds a nested direction wedge whose zero
// degrees points north (unrotated = up); only this inner child is rotated,
// never the Leaflet-positioned divIcon root (A1 §5, MARKER_ROTATION_FEASIBLE).
// Hidden (opacity 0) whenever the derived course is NEUTRAL.
function createCurrentPositionMarkerIcon() {
  return L.divIcon({
    className: "delivery-navigation-marker delivery-navigation-current-marker",
    html: `<span aria-label="Tu ubicación" style="position:relative;display:flex;width:32px;height:32px;border-radius:50%;align-items:center;justify-content:center;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:15px">
      <span class="delivery-navigation-direction-wedge" data-course="neutral" style="position:absolute;top:-8px;left:50%;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:9px solid #1d4ed8;transform:translateX(-50%) rotate(0deg);transform-origin:50% 24px;opacity:0;transition:opacity 150ms linear"></span>
      🛵
    </span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function updateDirectionIndicator(marker: L.Marker | null, course: DriverCourseState) {
  const element = marker?.getElement()
  const wedge = element?.querySelector<HTMLElement>(".delivery-navigation-direction-wedge")
  if (!wedge) return
  if (course.status === "NEUTRAL") {
    wedge.style.opacity = "0"
    wedge.dataset.course = "neutral"
    delete wedge.dataset.bearing
    return
  }
  wedge.style.opacity = "1"
  wedge.style.transform = `translateX(-50%) rotate(${course.bearingDegrees}deg)`
  wedge.dataset.course = course.status === "HELD" ? "held" : "valid"
  wedge.dataset.bearing = String(Math.round(course.bearingDegrees))
}

export function DeliveryNavigation({
  pedidoId,
  destination,
  destinationReference,
  currentPosition,
  trackingEligible,
  open,
  onClose,
}: DeliveryNavigationProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const destinationMarkerRef = useRef<L.Marker | null>(null)
  const currentMarkerRef = useRef<L.Marker | null>(null)
  const routeLineRef = useRef<L.Polyline | null>(null)
  const routeOriginRef = useRef<{ lat: number; lng: number } | null>(null)
  const lastRouteRequestAtRef = useRef<number | null>(null)
  const routeRef = useRef<DeliveryRoute | null>(null)
  const routeErrorRef = useRef<string | null>(null)
  const routeLoadingRef = useRef(false)
  const routeRequestControllerRef = useRef<AbortController | null>(null)
  const routeRequestGenerationRef = useRef(0)
  const foregroundRecoveryPendingRef = useRef(false)
  const foregroundRecoveryScheduledRef = useRef(false)
  // P2-T54-R1 follow camera: refs only, per A1 §4 ("simple FOLLOWING | MANUAL
  // state in refs, plus React state only for the visible recenter
  // affordance") — avoids per-GPS-sample React state churn.
  const followModeRef = useRef<FollowCameraMode>("FOLLOWING")
  const cameraOperationRef = useRef(false)
  const previousBearingSampleRef = useRef<BearingGateSample | null>(null)
  const courseRef = useRef<DriverCourseState>({ status: "NEUTRAL" })
  const currentCoordinateRef = useRef<{ lat: number; lng: number } | null>(null)
  const [route, setRoute] = useState<DeliveryRoute | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [foregroundRecoveryNonce, setForegroundRecoveryNonce] = useState(0)
  const [followMode, setFollowMode] = useState<FollowCameraMode>("FOLLOWING")

  const destinationCoordinate = getDestinationCoordinate(destination)
  const currentCoordinate = trackingSampleToCoordinate(currentPosition)
  const mapsUrl = buildGoogleMapsDirectionsUrl(destination)

  // Screen Wake Lock is strictly scoped to this visible, eligible navigation.
  // Unsupported browsers and rejected requests are intentionally best effort.
  useScreenWakeLock(open && trackingEligible)

  function updateRoute(nextRoute: DeliveryRoute | null) {
    routeRef.current = nextRoute
    setRoute(nextRoute)
  }

  function updateRouteError(nextError: string | null) {
    routeErrorRef.current = nextError
    setRouteError(nextError)
  }

  function updateRouteLoading(nextLoading: boolean) {
    routeLoadingRef.current = nextLoading
    setRouteLoading(nextLoading)
  }

  function cancelRouteRequest() {
    routeRequestGenerationRef.current += 1
    routeRequestControllerRef.current?.abort()
    routeRequestControllerRef.current = null
    updateRouteLoading(false)
  }

  // Marks a camera change as programmatic so the dragstart/zoomstart
  // listeners below don't misclassify follow/recenter/initial-fit moves as
  // user interaction (A1 §5/§16). Leaflet's non-animated setView/fitBounds
  // fire their move events synchronously, so a synchronous guard is enough.
  function withCameraOperation(run: () => void) {
    cameraOperationRef.current = true
    try {
      run()
    } finally {
      cameraOperationRef.current = false
    }
  }

  // Re-centers a non-animated camera so the driver marker lands at the
  // lower-middle safe-zone anchor instead of dead-center (A1 §4/§13).
  function panToFollowSafeZone(map: L.Map, latLng: [number, number], zoom: number) {
    const size = map.getSize()
    const targetPoint = L.point(size.x / 2, size.y * 0.65)
    const currentCenterPoint = map.latLngToContainerPoint(map.getCenter())
    const markerPoint = map.latLngToContainerPoint(latLng)
    const offset = targetPoint.subtract(markerPoint)
    const newCenterPoint = currentCenterPoint.subtract(offset)
    const newCenter = map.containerPointToLatLng(newCenterPoint)
    withCameraOperation(() => map.setView(newCenter, zoom, { animate: false }))
  }

  function startRouteRequest(origin: { lat: number; lng: number }, destinationPoint: { lat: number; lng: number }, force: boolean) {
    const now = Date.now()
    if (!force && !shouldRecalculateRoute(routeOriginRef.current, origin, lastRouteRequestAtRef.current, now)) return
    const url = buildOsrmRouteUrl(origin, destinationPoint)
    if (!url) return

    routeRequestControllerRef.current?.abort()
    const controller = new AbortController()
    const generation = routeRequestGenerationRef.current + 1
    routeRequestGenerationRef.current = generation
    routeRequestControllerRef.current = controller
    routeOriginRef.current = origin
    lastRouteRequestAtRef.current = now
    updateRouteLoading(true)
    updateRouteError(null)

    void fetchDeliveryRoute(url, { signal: controller.signal })
      .then((nextRoute) => {
        if (generation !== routeRequestGenerationRef.current) return
        updateRoute(nextRoute)
      })
      .catch((error: unknown) => {
        if (generation !== routeRequestGenerationRef.current) return
        if (error instanceof DeliveryRouteRequestError && error.status === "ABORTED") return
        updateRouteError("No se pudo calcular la ruta en este momento")
      })
      .finally(() => {
        if (generation !== routeRequestGenerationRef.current) return
        routeRequestControllerRef.current = null
        updateRouteLoading(false)
      })
  }

  useEffect(() => {
    if (!open || !trackingEligible || !destinationCoordinate || !currentCoordinate) return

    const requestId = window.setTimeout(() => {
      if (!open || !trackingEligible || !destinationCoordinate || !currentCoordinate) return
      const shouldRecover = foregroundRecoveryNonce > 0 && shouldRecoverRouteOnForeground(routeRef.current, routeErrorRef.current, routeLoadingRef.current)
      startRouteRequest(currentCoordinate, destinationCoordinate, shouldRecover)
    }, 0)
    return () => window.clearTimeout(requestId)
  }, [open, trackingEligible, currentCoordinate?.lat, currentCoordinate?.lng, destinationCoordinate?.lat, destinationCoordinate?.lng, pedidoId, foregroundRecoveryNonce])

  useEffect(() => {
    return () => cancelRouteRequest()
  }, [])

  useEffect(() => {
    let disposed = false

    function scheduleForegroundRecovery() {
      if (disposed || !open || document.visibilityState !== "visible" || !foregroundRecoveryPendingRef.current) return
      if (foregroundRecoveryScheduledRef.current) return
      foregroundRecoveryScheduledRef.current = true
      queueMicrotask(() => {
        foregroundRecoveryScheduledRef.current = false
        if (disposed || !open || document.visibilityState !== "visible") return
        foregroundRecoveryPendingRef.current = false
        // Foreground return recalculates map size but never infers movement
        // from a stale sample or moves the camera on its own (A1 §21).
        mapRef.current?.invalidateSize({ pan: false, debounceMoveend: true })
        if (shouldRecoverRouteOnForeground(routeRef.current, routeErrorRef.current, routeLoadingRef.current)) {
          setForegroundRecoveryNonce((value) => value + 1)
        }
      })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        foregroundRecoveryPendingRef.current = true
        return
      }
      scheduleForegroundRecovery()
    }

    function handleFocus() {
      scheduleForegroundRecovery()
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) foregroundRecoveryPendingRef.current = true
      scheduleForegroundRecovery()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)
    window.addEventListener("pageshow", handlePageShow)
    return () => {
      disposed = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("pageshow", handlePageShow)
    }
  }, [open])

  useEffect(() => {
    if (!open || !destinationCoordinate || !mapContainerRef.current || mapRef.current) return

    // First open + fresh GPS: FOLLOWING, center on driver, zoom 16, north-up.
    // First open without a fresh fix: keep the existing destination-first
    // view and wait for a fresh `currentPosition` prop (A1 §4/§12).
    const initialCenter = currentCoordinate ?? destinationCoordinate
    const initialZoom = currentCoordinate ? FOLLOW_DEFAULT_ZOOM : 15
    const map = L.map(mapContainerRef.current, { center: [initialCenter.lat, initialCenter.lng], zoom: initialZoom, zoomControl: false })
    L.control.zoom({ position: "topright" }).addTo(map)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    destinationMarkerRef.current = L.marker([destinationCoordinate.lat, destinationCoordinate.lng], {
      icon: createNavigationMarker("#dc2626", "Destino"),
    }).addTo(map)

    if (currentCoordinate) {
      currentMarkerRef.current = L.marker([currentCoordinate.lat, currentCoordinate.lng], {
        icon: createCurrentPositionMarkerIcon(),
      }).addTo(map)
      currentCoordinateRef.current = currentCoordinate
    }

    followModeRef.current = "FOLLOWING"
    setFollowMode("FOLLOWING")

    // dragstart/zoomstart are real user gestures; movestart also fires for
    // our own programmatic setView/fitBounds calls, so every such call is
    // wrapped in `withCameraOperation` and guarded here (A1 §5/§16).
    function handleUserMapInteraction() {
      const next = nextFollowModeOnMapInteraction(followModeRef.current, cameraOperationRef.current)
      followModeRef.current = next
      setFollowMode(next)
    }
    map.on("dragstart", handleUserMapInteraction)
    map.on("zoomstart", handleUserMapInteraction)

    // Recalculate map size on real layout changes only — never move the
    // camera just because of an invalidateSize (A1 §21).
    function handleViewportResize() {
      map.invalidateSize({ pan: false, debounceMoveend: true })
    }
    window.addEventListener("resize", handleViewportResize)
    window.addEventListener("orientationchange", handleViewportResize)

    mapRef.current = map
    window.setTimeout(() => map.invalidateSize(), 100)
    return () => {
      window.removeEventListener("resize", handleViewportResize)
      window.removeEventListener("orientationchange", handleViewportResize)
      map.remove()
      mapRef.current = null
      destinationMarkerRef.current = null
      currentMarkerRef.current = null
      routeLineRef.current = null
      currentCoordinateRef.current = null
      previousBearingSampleRef.current = null
      courseRef.current = { status: "NEUTRAL" }
    }
  }, [open, destinationCoordinate?.lat, destinationCoordinate?.lng])

  function retryRoute() {
    if (!open || !trackingEligible || !currentCoordinate || !destinationCoordinate) return
    startRouteRequest(currentCoordinate, destinationCoordinate, true)
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map || !currentCoordinate || !currentPosition) return

    currentCoordinateRef.current = currentCoordinate
    const latLng: [number, number] = [currentCoordinate.lat, currentCoordinate.lng]
    if (!currentMarkerRef.current) {
      currentMarkerRef.current = L.marker(latLng, { icon: createCurrentPositionMarkerIcon() }).addTo(map)
    } else {
      currentMarkerRef.current.setLatLng(latLng)
    }

    // Derived bearing: only ever from the existing GPS sample stream already
    // flowing through `currentPosition` — no new watcher (A1 §3/§9).
    const nowSample: BearingGateSample = {
      lat: currentPosition.lat,
      lng: currentPosition.lng,
      accuracy: currentPosition.accuracy,
      capturedAt: currentPosition.capturedAt,
    }
    const previousSample = previousBearingSampleRef.current
    const now = Date.now()
    const previousQualified = courseRef.current.status !== "NEUTRAL"
      ? { bearingDegrees: courseRef.current.bearingDegrees, qualifiedAt: courseRef.current.qualifiedAt }
      : null
    const nextCourse = resolveDriverCourse(
      previousQualified,
      previousSample ? { previous: previousSample, current: nowSample } : null,
      now,
    )
    courseRef.current = nextCourse
    previousBearingSampleRef.current = nowSample
    updateDirectionIndicator(currentMarkerRef.current, nextCourse)

    // Follow camera: a fresh sample only moves the camera while FOLLOWING,
    // and only once the marker leaves the lower-middle dead-zone — never on
    // every GPS tick (A1 §4/§13).
    if (followModeRef.current === "FOLLOWING") {
      const size = map.getSize()
      const markerPoint = map.latLngToContainerPoint(latLng)
      if (shouldRecenterFollowCamera({ x: markerPoint.x, y: markerPoint.y }, { width: size.x, height: size.y })) {
        panToFollowSafeZone(map, latLng, map.getZoom())
      }
    }
  }, [currentPosition?.lat, currentPosition?.lng, currentPosition?.accuracy, currentPosition?.capturedAt])

  function handleRecenter() {
    const map = mapRef.current
    const latest = currentCoordinateRef.current
    if (!map || !latest) return
    const target = recenterFollowCamera()
    followModeRef.current = target.mode
    setFollowMode(target.mode)
    panToFollowSafeZone(map, [latest.lat, latest.lng], target.zoom)
  }

  useEffect(() => {
    if (!mapRef.current || !route) return
    routeLineRef.current?.removeFrom(mapRef.current)
    routeLineRef.current = L.polyline(route.coordinates, {
      color: "#2563eb",
      weight: 6,
      opacity: 0.82,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(mapRef.current)
    // Route redraw != camera movement once a driver fix exists (A1 §18): an
    // OSRM refresh must never steal FOLLOWING/MANUAL camera state. The
    // initial fitBounds is only allowed before any fresh driver position.
    if (!currentCoordinateRef.current) {
      withCameraOperation(() => mapRef.current!.fitBounds(routeLineRef.current!.getBounds(), { padding: [48, 48], maxZoom: 17 }))
    }
  }, [route])

  if (!open) return null

  const eta = formatRouteEta(route?.durationSeconds ?? null)
  const hasDestinationCoordinates = destinationCoordinate !== null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background" data-testid="delivery-navigation">
      <header className="relative z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] shadow-sm backdrop-blur-md">
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={onClose} aria-label="Volver al pedido">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-bold"><Bike className="h-4 w-4 text-primary" /> Navegación del pedido</p>
          <p className="truncate text-xs text-muted-foreground">Pedido {pedidoId.slice(0, 8)}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={onClose} aria-label="Cerrar navegación">
          <X className="h-5 w-5" />
        </Button>
      </header>

      <main className="relative flex-1 overflow-hidden">
        {hasDestinationCoordinates ? (
          <div ref={mapContainerRef} className="absolute inset-0" aria-label="Mapa de navegación" />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted/40 p-6 text-center">
            <div className="max-w-xs space-y-3">
              <MapPin className="mx-auto h-10 w-10 text-amber-500" />
              <p className="font-semibold">Este pedido no tiene coordenadas de destino</p>
              <p className="text-sm text-muted-foreground">Mostramos la dirección textual y no dibujamos una ruta inventada.</p>
            </div>
          </div>
        )}

        {hasDestinationCoordinates && !currentCoordinate && (
          <div className="absolute left-1/2 top-4 z-[400] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border bg-background/95 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Esperando tu ubicación GPS…
          </div>
        )}

        {isRecenterButtonVisible(followMode, currentCoordinate !== null) && (
          <Button
            type="button"
            onClick={handleRecenter}
            aria-label="Volver a seguir mi ubicación"
            aria-pressed={followMode === "FOLLOWING"}
            className="absolute bottom-4 right-4 z-[400] h-12 w-12 rounded-full p-0 shadow-lg"
          >
            <LocateFixed className="h-5 w-5" />
          </Button>
        )}
      </main>

      <section className="relative z-10 space-y-3 border-t border-border bg-background px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4 shadow-[0_-4px_18px_rgba(0,0,0,.08)]">
        <div className="min-w-0">
          <p className="flex items-start gap-2 text-sm font-semibold"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /> <span>{destination.address || "Destino del pedido"}</span></p>
          {destinationReference && <p className="mt-1 pl-6 text-xs text-muted-foreground">{destinationReference}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted/60 px-2 py-2"><p className="text-[10px] text-muted-foreground">Distancia</p><p className="text-sm font-bold">{route ? formatRouteDistance(route.distanceMeters) : "—"}</p></div>
          <div className="rounded-xl bg-muted/60 px-2 py-2"><p className="text-[10px] text-muted-foreground">ETA</p><p className="text-sm font-bold">{eta || "—"}</p></div>
          <div className="rounded-xl bg-muted/60 px-2 py-2"><p className="text-[10px] text-muted-foreground">Tracking</p><p className={cn("text-sm font-bold", trackingEligible ? "text-emerald-600" : "text-amber-600")}>{trackingEligible ? "Activo" : "No disponible"}</p></div>
        </div>

        {route?.nextInstruction && <p className="flex items-start gap-2 rounded-xl bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-800 dark:text-blue-200"><Route className="mt-0.5 h-4 w-4 shrink-0" /> {route.nextInstruction}</p>}
        {routeLoading && currentCoordinate && hasDestinationCoordinates && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculando ruta…</p>}
        {routeError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="text-xs text-amber-700 dark:text-amber-400">{routeError}. Podés continuar con Google Maps.</p>
            <Button variant="outline" size="sm" className="shrink-0 rounded-lg" onClick={retryRoute} disabled={routeLoading}>Reintentar</Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {trackingEligible
            ? "Tu dispositivo puede pausar la ubicación en segundo plano."
            : "El seguimiento no está disponible para este pedido."}
        </p>

        <div className="flex gap-2">
          {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1"><Button variant="outline" className="h-11 w-full gap-2 rounded-xl"><Navigation className="h-4 w-4" /> Abrir en Google Maps</Button></a>}
          <Button variant="secondary" className="h-11 flex-1 gap-2 rounded-xl" onClick={onClose}>Volver al pedido</Button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground">La pantalla intentará permanecer activa cuando tu dispositivo lo permita.</p>
      </section>
    </div>
  )
}
