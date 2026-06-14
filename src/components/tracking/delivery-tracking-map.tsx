"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import L from "leaflet"
import { io, Socket } from "socket.io-client"
import "leaflet/dist/leaflet.css"
import { X, Bike, MapPin, Loader2, AlertCircle, Wifi, WifiOff } from "lucide-react"

// ============================================
// Fix default marker icon paths (Leaflet + bundler issue)
// ============================================
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// ============================================
// Types
// ============================================
interface DeliveryTrackingMapProps {
  pedidoId: string
  destinoLat: number
  destinoLng: number
  destinoDireccion?: string
  origenLat?: number
  origenLng?: number
  origenNombre?: string
  colorPrincipal?: string
  logoUrl?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface TrackingData {
  trackable: boolean
  trackingDisabled?: boolean
  repartidorLat: number
  repartidorLng: number
  repartidorLastUpdate: string
  destinoLat: number
  destinoLng: number
  destinoDireccion: string
  negocioLat: number | null
  negocioLng: number | null
  negocioNombre: string | null
  negocioLogoUrl: string | null
  negocioColorPrincipal: string | null
  estado: string
}

// ============================================
// Default center (Formosa, Argentina)
// ============================================
const DEFAULT_CENTER: [number, number] = [-26.1856, -58.1732]
const DEFAULT_ZOOM = 15
const POLL_INTERVAL = 8_000 // 8 seconds (fallback when no Socket.IO)
const SOCKET_POLL_HEARTBEAT = 20_000 // 20 seconds heartbeat even with Socket.IO

// ============================================
// Custom marker icons
// ============================================
function createRepartidorIcon(colorPrincipal?: string) {
  const color = colorPrincipal || "#10b981"
  return L.divIcon({
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div style="
          position: absolute;
          width: 44px; height: 44px;
          border-radius: 50%;
          background: ${color}33;
          animation: pulse-ring 2s ease-out infinite;
        "></div>
        <div style="
          width: 36px; height: 36px;
          border-radius: 50%;
          background: ${color};
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px ${color}66;
          border: 3px solid white;
          font-size: 18px;
          line-height: 1;
          z-index: 2;
        ">🛵</div>
        <style>
          @keyframes pulse-ring {
            0% { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(2); opacity: 0; }
          }
        </style>
      </div>
    `,
    className: "repartidor-marker",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

function createDestinoIcon() {
  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="#ef4444"/>
          <circle cx="14" cy="13" r="6" fill="white"/>
        </svg>
      </div>
    `,
    className: "destino-marker",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  })
}

function createOrigenIcon(colorPrincipal?: string | null, logoUrl?: string | null) {
  const color = colorPrincipal || "#3b82f6"

  if (logoUrl) {
    return L.divIcon({
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 0C8.058 0 0 8.058 0 18c0 13.5 18 28 18 28s18-14.5 18-28C36 8.058 27.942 0 18 0z" fill="${color}"/>
            <circle cx="18" cy="17" r="10" fill="white"/>
          </svg>
          <img
            src="${logoUrl}"
            alt="Logo"
            style="
              position: absolute;
              top: 7px;
              left: 50%;
              transform: translateX(-50%);
              width: 20px;
              height: 20px;
              border-radius: 50%;
              object-fit: cover;
            "
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <span style="
            position: absolute;
            top: 7px;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 20px;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            line-height: 1;
          ">🏪</span>
        </div>
      `,
      className: "origen-marker",
      iconSize: [36, 46],
      iconAnchor: [18, 46],
    })
  }

  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="${color}"/>
          <text x="14" y="17" text-anchor="middle" dominant-baseline="central" font-size="12" fill="white">🏪</text>
        </svg>
      </div>
    `,
    className: "origen-marker",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  })
}

// ============================================
// Time since last update in Spanish
// ============================================
function timeSinceUpdate(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 5) return "ahora mismo"
  if (diffSec < 60) return `hace ${diffSec} seg`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  return `hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`
}

// ============================================
// Main Component
// ============================================
export function DeliveryTrackingMap({
  pedidoId,
  destinoLat,
  destinoLng,
  destinoDireccion,
  origenLat,
  origenLng,
  origenNombre,
  colorPrincipal,
  logoUrl,
  open,
  onOpenChange,
}: DeliveryTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const repartidorMarkerRef = useRef<L.Marker | null>(null)
  const destinoMarkerRef = useRef<L.Marker | null>(null)
  const origenMarkerRef = useRef<L.Marker | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const userInteractedRef = useRef(false)

  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeSince, setTimeSince] = useState<string>("")
  const [isMapReady, setIsMapReady] = useState(false)
  const [isLiveSocket, setIsLiveSocket] = useState(false)
  const [isTrackingDisabled, setIsTrackingDisabled] = useState(false)

  // Validate coordinates
  const validDestinoLat = typeof destinoLat === 'number' && isFinite(destinoLat) ? destinoLat : DEFAULT_CENTER[0]
  const validDestinoLng = typeof destinoLng === 'number' && isFinite(destinoLng) ? destinoLng : DEFAULT_CENTER[1]
  const validOrigenLat = typeof origenLat === 'number' && isFinite(origenLat) ? origenLat : null
  const validOrigenLng = typeof origenLng === 'number' && isFinite(origenLng) ? origenLng : null

  // Fit bounds helper — shows all visible markers
  const fitBoundsToMarkers = useCallback(() => {
    if (!mapInstanceRef.current || userInteractedRef.current) return

    const positions: [number, number][] = []

    if (repartidorMarkerRef.current) {
      const ll = repartidorMarkerRef.current.getLatLng()
      positions.push([ll.lat, ll.lng])
    }
    if (destinoMarkerRef.current) {
      const ll = destinoMarkerRef.current.getLatLng()
      positions.push([ll.lat, ll.lng])
    }
    if (origenMarkerRef.current) {
      const ll = origenMarkerRef.current.getLatLng()
      positions.push([ll.lat, ll.lng])
    }

    if (positions.length >= 2) {
      const bounds = L.latLngBounds(positions)
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true })
    }
  }, [])

  // Fetch tracking data (HTTP fallback)
  const fetchTracking = useCallback(async () => {
    if (!open) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/tracking`)
      if (!res.ok) {
        throw new Error("Error al obtener ubicación")
      }
      const data = await res.json()
      if (!data.trackable) {
        setTrackingData(null)
        if (data.trackingDisabled) {
          setIsTrackingDisabled(true)
        }
        return
      }
      setIsTrackingDisabled(false)
      const lat = data.repartidorLat
      const lng = data.repartidorLng
      if (typeof lat !== 'number' || !isFinite(lat) || typeof lng !== 'number' || !isFinite(lng)) {
        setTrackingData(null)
        return
      }
      const apiNegocioLat = data.negocioLat
      const apiNegocioLng = data.negocioLng
      const validApiNegocioLat = typeof apiNegocioLat === 'number' && isFinite(apiNegocioLat) ? apiNegocioLat : null
      const validApiNegocioLng = typeof apiNegocioLng === 'number' && isFinite(apiNegocioLng) ? apiNegocioLng : null

      setTrackingData({
        trackable: true,
        repartidorLat: lat,
        repartidorLng: lng,
        repartidorLastUpdate: data.repartidorLastUpdate || new Date().toISOString(),
        destinoLat: data.destinoLat ?? validDestinoLat,
        destinoLng: data.destinoLng ?? validDestinoLng,
        destinoDireccion: data.destinoDireccion || destinoDireccion || "",
        negocioLat: validApiNegocioLat,
        negocioLng: validApiNegocioLng,
        negocioNombre: data.negocioNombre || origenNombre || null,
        negocioLogoUrl: data.negocioLogoUrl || logoUrl || null,
        negocioColorPrincipal: data.negocioColorPrincipal || colorPrincipal || null,
        estado: data.estado || "en_camino",
      })
    } catch {
      setError("No se pudo obtener la ubicación del repartidor")
    } finally {
      setIsLoading(false)
    }
  }, [open, pedidoId, validDestinoLat, validDestinoLng, destinoDireccion, origenNombre, logoUrl, colorPrincipal])

  // Connect to Socket.IO for real-time location updates
  useEffect(() => {
    if (!open) return

    const chatUrl =
      process.env.NEXT_PUBLIC_CHAT_SERVICE_URL ||
      "http://localhost:3003"

    const socket = io(chatUrl, {
      transports: ["websocket", "polling"],
      auth: {
        userId: `tracking-${pedidoId}`,
        userType: "tracker",
        userName: "Tracker",
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
    })

    socket.on("connect", () => {
      socket.emit("join-room", pedidoId)
      setIsLiveSocket(true)
    })

    socket.on("repartidor-location", (data: { pedidoId: string; lat: number; lng: number; timestamp: string }) => {
      if (data.pedidoId !== pedidoId) return
      const lat = data.lat
      const lng = data.lng
      if (typeof lat !== 'number' || !isFinite(lat) || typeof lng !== 'number' || !isFinite(lng)) return

      setTrackingData((prev) => {
        if (prev) {
          return { ...prev, repartidorLat: lat, repartidorLng: lng, repartidorLastUpdate: data.timestamp }
        }
        return prev
      })
    })

    socket.on("disconnect", () => {
      setIsLiveSocket(false)
    })

    socket.on("connect_error", () => {
      setIsLiveSocket(false)
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
      setIsLiveSocket(false)
    }
  }, [open, pedidoId])

  // Initial fetch when opened
  useEffect(() => {
    if (open) {
      userInteractedRef.current = false
      fetchTracking()
    } else {
      setTrackingData(null)
      setError(null)
      setIsMapReady(false)
    }
  }, [open])

  // Polling fallback (only when Socket.IO is not connected)
  useEffect(() => {
    if (!open) return
    if (isLiveSocket) return
    const interval = setInterval(fetchTracking, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [open, fetchTracking, isLiveSocket])

  // Slow polling even with Socket.IO as heartbeat
  useEffect(() => {
    if (!open || !isLiveSocket) return
    const interval = setInterval(fetchTracking, SOCKET_POLL_HEARTBEAT)
    return () => clearInterval(interval)
  }, [open, fetchTracking, isLiveSocket])

  // Update time since every second
  useEffect(() => {
    if (!trackingData?.repartidorLastUpdate) return
    const update = () => setTimeSince(timeSinceUpdate(trackingData.repartidorLastUpdate))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [trackingData?.repartidorLastUpdate])

  // Initialize map
  useEffect(() => {
    if (!open || !mapContainerRef.current || mapInstanceRef.current) return

    const mapCenter: [number, number] = [validDestinoLat, validDestinoLng]

    const map = L.map(mapContainerRef.current, {
      center: mapCenter,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
    })

    L.control.zoom({ position: "topright" }).addTo(map)

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Add destination marker
    const destIcon = createDestinoIcon()
    const destLatLng: [number, number] = [validDestinoLat, validDestinoLng]
    const destinoMarker = L.marker(destLatLng, { icon: destIcon })
      .addTo(map)
      .bindPopup(
        `<div style="font-size: 13px; font-weight: 600; padding: 2px 4px;">
          📍 ${destinoDireccion || "Tu domicilio"}
        </div>`
      )

    // Add origin marker if valid
    const origenLatToUse = validOrigenLat ?? (trackingData?.negocioLat ?? null)
    const origenLngToUse = validOrigenLng ?? (trackingData?.negocioLng ?? null)
    const origenNameToUse = origenNombre ?? (trackingData?.negocioNombre ?? null)
    const origenLogoUrl = logoUrl ?? (trackingData?.negocioLogoUrl ?? null)
    const origenColor = colorPrincipal ?? (trackingData?.negocioColorPrincipal ?? null)

    if (
      origenLatToUse !== null && isFinite(origenLatToUse) &&
      origenLngToUse !== null && isFinite(origenLngToUse)
    ) {
      const origenPos: [number, number] = [origenLatToUse, origenLngToUse]
      const origenIcon = createOrigenIcon(origenColor, origenLogoUrl)
      const origenMarker = L.marker(origenPos, { icon: origenIcon, zIndexOffset: 500 })
        .addTo(map)
        .bindPopup(
          `<div style="font-size: 13px; font-weight: 600; padding: 2px 4px;">
            🏪 ${origenNameToUse || "Origen"}
          </div>`
        )
      origenMarkerRef.current = origenMarker
    }

    // Add repartidor marker if we already have tracking data
    if (
      trackingData &&
      typeof trackingData.repartidorLat === 'number' && isFinite(trackingData.repartidorLat) &&
      typeof trackingData.repartidorLng === 'number' && isFinite(trackingData.repartidorLng)
    ) {
      const repartidorPos: [number, number] = [trackingData.repartidorLat, trackingData.repartidorLng]
      const repartidorColor = trackingData.negocioColorPrincipal || colorPrincipal
      const repartidorIcon = createRepartidorIcon(repartidorColor)
      const repartidorMarker = L.marker(repartidorPos, { icon: repartidorIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(
          `<div style="font-size: 13px; font-weight: 600; padding: 2px 4px;">
            🛵 Tu repartidor
          </div>`
        )
      repartidorMarkerRef.current = repartidorMarker
    }

    // Fit bounds to show all markers
    const boundsPositions: [number, number][] = [destLatLng]
    if (origenMarkerRef.current) {
      const oLL = origenMarkerRef.current.getLatLng()
      boundsPositions.push([oLL.lat, oLL.lng])
    }
    if (repartidorMarkerRef.current) {
      const rLL = repartidorMarkerRef.current.getLatLng()
      boundsPositions.push([rLL.lat, rLL.lng])
    }
    if (boundsPositions.length >= 2) {
      const bounds = L.latLngBounds(boundsPositions)
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 })
    }

    setTimeout(() => map.invalidateSize(), 300)

    // Listen for user map interactions so we don't auto-fit bounds after they pan/zoom
    map.on("dragstart", () => { userInteractedRef.current = true })
    map.on("zoomstart", () => { userInteractedRef.current = true })

    mapInstanceRef.current = map
    destinoMarkerRef.current = destinoMarker
    setIsMapReady(true)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      repartidorMarkerRef.current = null
      destinoMarkerRef.current = null
      origenMarkerRef.current = null
      setIsMapReady(false)
    }
  }, [open]) // Only depend on open

  // Update origin marker when tracking data arrives
  useEffect(() => {
    if (!trackingData || !mapInstanceRef.current) return

    const negocioLat = trackingData.negocioLat
    const negocioLng = trackingData.negocioLng

    if (negocioLat === null || negocioLng === null || !isFinite(negocioLat) || !isFinite(negocioLng)) return

    const negocioPos: [number, number] = [negocioLat, negocioLng]
    const negocioColor = trackingData.negocioColorPrincipal || colorPrincipal
    const negocioLogo = trackingData.negocioLogoUrl || logoUrl

    if (origenMarkerRef.current) {
      const currentPos = origenMarkerRef.current.getLatLng()
      if (currentPos.lat !== negocioPos[0] || currentPos.lng !== negocioPos[1]) {
        origenMarkerRef.current.setLatLng(negocioPos)
      }
      origenMarkerRef.current.setIcon(createOrigenIcon(negocioColor, negocioLogo))
      origenMarkerRef.current.setPopupContent(
        `<div style="font-size: 13px; font-weight: 600; padding: 2px 4px;">
          🏪 ${trackingData.negocioNombre || origenNombre || "Origen"}
        </div>`
      )
    } else {
      const origenIcon = createOrigenIcon(negocioColor, negocioLogo)
      const origenMarker = L.marker(negocioPos, { icon: origenIcon, zIndexOffset: 500 })
        .addTo(mapInstanceRef.current)
        .bindPopup(
          `<div style="font-size: 13px; font-weight: 600; padding: 2px 4px;">
            🏪 ${trackingData.negocioNombre || origenNombre || "Origen"}
          </div>`
        )
      origenMarkerRef.current = origenMarker
    }

    fitBoundsToMarkers()
  }, [trackingData?.negocioLat, trackingData?.negocioLng, trackingData?.negocioLogoUrl, trackingData?.negocioColorPrincipal, trackingData?.negocioNombre, colorPrincipal, logoUrl, origenNombre, fitBoundsToMarkers])

  // Update repartidor marker when tracking data changes
  useEffect(() => {
    if (!trackingData || !mapInstanceRef.current) return

    const lat = trackingData.repartidorLat
    const lng = trackingData.repartidorLng
    if (typeof lat !== 'number' || !isFinite(lat) || typeof lng !== 'number' || !isFinite(lng)) return

    const newPos: [number, number] = [lat, lng]
    const repartidorColor = trackingData.negocioColorPrincipal || colorPrincipal

    if (repartidorMarkerRef.current) {
      const currentPos = repartidorMarkerRef.current.getLatLng()
      if (currentPos.lat !== newPos[0] || currentPos.lng !== newPos[1]) {
        repartidorMarkerRef.current.setLatLng(newPos)
      }
      // Update icon color in case it changed
      repartidorMarkerRef.current.setIcon(createRepartidorIcon(repartidorColor))
    } else {
      const repartidorIcon = createRepartidorIcon(repartidorColor)
      const repartidorMarker = L.marker(newPos, { icon: repartidorIcon, zIndexOffset: 1000 })
        .addTo(mapInstanceRef.current)
        .bindPopup(
          `<div style="font-size: 13px; font-weight: 600; padding: 2px 4px;">
            🛵 Tu repartidor
          </div>`
        )
      repartidorMarkerRef.current = repartidorMarker
    }

    fitBoundsToMarkers()
  }, [trackingData, validDestinoLat, validDestinoLng, colorPrincipal, fitBoundsToMarkers])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Header bar */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-border shadow-sm">
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              En vivo
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Bike className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Rastreando envío</span>
          </div>
        </div>

        <button
          onClick={() => onOpenChange(false)}
          className="w-9 h-9 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
          aria-label="Cerrar mapa"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Map container */}
      <div className="flex-1 relative">
        <div
          ref={mapContainerRef}
          className="absolute inset-0"
          style={{ zIndex: 0 }}
        />

        {/* Map loading overlay */}
        {!isMapReady && !error && (
          <div className="absolute inset-0 bg-muted/50 flex items-center justify-center z-[500]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                {isLoading ? "Obteniendo ubicación..." : "Cargando mapa..."}
              </span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-[500]">
            <div className="flex flex-col items-center gap-3 p-6 text-center max-w-xs">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
              <p className="text-sm font-medium text-foreground">{error}</p>
              <p className="text-xs text-muted-foreground">
                El repartidor aún podría no haber compartido su ubicación. Intentá de nuevo en unos segundos.
              </p>
              <button
                onClick={fetchTracking}
                disabled={isLoading}
                className="mt-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? "Reintentando..." : "Reintentar"}
              </button>
            </div>
          </div>
        )}

        {/* Tracking disabled overlay */}
        {isTrackingDisabled && (
          <div className="absolute inset-0 bg-background/90 flex items-center justify-center z-[500]">
            <div className="flex flex-col items-center gap-3 p-6 text-center max-w-xs">
              <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center">
                <WifiOff className="h-7 w-7 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">Seguimiento desactivado</p>
              <p className="text-xs text-muted-foreground">
                El local desactivó el seguimiento en tiempo real. Tu pedido sigue en camino.
              </p>
            </div>
          </div>
        )}

        {/* Waiting for repartidor overlay */}
        {isMapReady && !trackingData && !error && !isTrackingDisabled && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm shadow-lg border border-border">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs font-medium text-foreground">
              Esperando ubicación del repartidor...
            </span>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="relative z-10 bg-white dark:bg-zinc-900 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Last update */}
          <div className="flex items-center gap-2">
            {trackingData?.repartidorLastUpdate ? (
              <>
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Última actualización: <span className="font-medium text-foreground">{timeSince}</span>
                  </p>
                  {destinoDireccion && (
                    <p className="text-[11px] text-muted-foreground truncate max-w-[200px] sm:max-w-xs">
                      📍 {destinoDireccion}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Esperando ubicación del repartidor...
                </p>
              </div>
            )}
          </div>

          {/* Connection indicator */}
          {trackingData?.repartidorLastUpdate && (
            <div className="flex items-center gap-1.5 shrink-0">
              {isLiveSocket ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    Tiempo real
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Actualizando...
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
