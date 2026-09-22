"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { ArrowLeft, Bike, Loader2, MapPin, Navigation, Route, X } from "lucide-react"
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
  const [route, setRoute] = useState<DeliveryRoute | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [foregroundRecoveryNonce, setForegroundRecoveryNonce] = useState(0)

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

    const map = L.map(mapContainerRef.current, { center: [destinationCoordinate.lat, destinationCoordinate.lng], zoom: 15, zoomControl: false })
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
        icon: createNavigationMarker("#2563eb", "Tu ubicación"),
      }).addTo(map)
    }

    mapRef.current = map
    window.setTimeout(() => map.invalidateSize(), 100)
    return () => {
      map.remove()
      mapRef.current = null
      destinationMarkerRef.current = null
      currentMarkerRef.current = null
      routeLineRef.current = null
    }
  }, [open, destinationCoordinate?.lat, destinationCoordinate?.lng])

  function retryRoute() {
    if (!open || !trackingEligible || !currentCoordinate || !destinationCoordinate) return
    startRouteRequest(currentCoordinate, destinationCoordinate, true)
  }

  useEffect(() => {
    if (!mapRef.current || !currentCoordinate) return
    if (!currentMarkerRef.current) {
      currentMarkerRef.current = L.marker([currentCoordinate.lat, currentCoordinate.lng], {
        icon: createNavigationMarker("#2563eb", "Tu ubicación"),
      }).addTo(mapRef.current)
    } else {
      currentMarkerRef.current.setLatLng([currentCoordinate.lat, currentCoordinate.lng])
    }
  }, [currentCoordinate?.lat, currentCoordinate?.lng])

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
    mapRef.current.fitBounds(routeLineRef.current.getBounds(), { padding: [48, 48], maxZoom: 17 })
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
