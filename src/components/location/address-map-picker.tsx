"use client"

import { useState, useEffect, useRef } from "react"
import L from "leaflet"
import { Loader2, Crosshair } from "lucide-react"

// ============================================
// P2-T32 — Autoridad compartida de mapa/GPS para direcciones de Cliente
// ============================================
// Extraído de client-profile-panel.tsx (única implementación completa y
// estable existente al momento de esta extracción) para que Perfil y el
// modal de checkout compartan EXACTAMENTE la misma lógica de mapa,
// geolocalización y reverse-geocoding — nunca dos implementaciones
// divergentes. Patrón: marcador arrastrable + click en el mapa para
// reposicionar (distinto del patrón "pin fijo al centro" de
// location-map-picker.tsx, que queda sin usar por los flujos de Cliente
// tras esta tarea pero se preserva sin tocar por tener un test estático
// de contrato iOS que referencia su archivo).

delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

export interface AddressMapPickerProps {
  lat: number | null
  lng: number | null
  direccion: string
  onCoordsChange: (lat: number, lng: number) => void
  onDireccionChange: (dir: string) => void
  /** Color de marca del negocio en checkout; Perfil no lo pasa y preserva el naranja histórico. */
  colorPrincipal?: string
}

export function AddressMapPicker({
  lat,
  lng,
  direccion,
  onCoordsChange,
  onDireccionChange,
  colorPrincipal = "#FB8C00",
}: AddressMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [gpsUsed, setGpsUsed] = useState(false)
  const gpsAutoRequestedRef = useRef(false)
  const coordsRef = useRef<[number, number]>(
    lat !== null && lng !== null ? [lat, lng] : [-26.1856, -58.1732]
  )

  // Reverse geocoding function — defined before useEffect so it can be used inside
  const reverseGeocode = async (latlng: [number, number]) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng[0]}&lon=${latlng[1]}&format=json&accept-language=es`,
        { headers: { "User-Agent": "DeliGO-App/1.0" } }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.display_name) {
          const parts = data.display_name.split(",")
          const simplified = parts.slice(0, Math.min(3, parts.length)).join(",").trim()
          onDireccionChange(simplified)
        }
      }
    } catch {
      // silently fail
    }
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const initialCoords: [number, number] =
      lat !== null && lng !== null ? [lat, lng] : [-26.1856, -58.1732]

    const map = L.map(mapContainerRef.current, {
      center: initialCoords,
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const customIcon = L.divIcon({
      html: `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="${colorPrincipal}"/>
          <circle cx="14" cy="13" r="6" fill="white"/>
        </svg>
      </div>`,
      className: "custom-map-marker",
      iconSize: [28, 36],
      iconAnchor: [14, 36],
    })

    const marker = L.marker(initialCoords, {
      icon: customIcon,
      draggable: true,
    }).addTo(map)

    marker.on("dragend", () => {
      const pos = marker.getLatLng()
      const newCoords: [number, number] = [
        Math.round(pos.lat * 1000000) / 1000000,
        Math.round(pos.lng * 1000000) / 1000000,
      ]
      coordsRef.current = newCoords
      onCoordsChange(newCoords[0], newCoords[1])
      reverseGeocode(newCoords)
    })

    map.on("click", (e: L.LeafletMouseEvent) => {
      const newCoords: [number, number] = [
        Math.round(e.latlng.lat * 1000000) / 1000000,
        Math.round(e.latlng.lng * 1000000) / 1000000,
      ]
      marker.setLatLng(newCoords)
      coordsRef.current = newCoords
      onCoordsChange(newCoords[0], newCoords[1])
      reverseGeocode(newCoords)
    })

    setTimeout(() => map.invalidateSize(), 200)
    mapInstanceRef.current = map
    markerRef.current = marker
    setTimeout(() => setIsMapReady(true), 0)

    // Auto-request GPS if no initial coordinates set
    if (lat === null && lng === null && !gpsAutoRequestedRef.current) {
      gpsAutoRequestedRef.current = true
      setTimeout(() => {
        if (navigator.geolocation && mapInstanceRef.current) {
          setIsLocating(true)
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const newCoords: [number, number] = [
                Math.round(position.coords.latitude * 1000000) / 1000000,
                Math.round(position.coords.longitude * 1000000) / 1000000,
              ]
              coordsRef.current = newCoords
              onCoordsChange(newCoords[0], newCoords[1])
              if (mapInstanceRef.current && markerRef.current) {
                mapInstanceRef.current.setView(newCoords, 16)
                markerRef.current.setLatLng(newCoords)
              }
              reverseGeocode(newCoords)
              setGpsUsed(true)
              setIsLocating(false)
            },
            () => {
              // Auto-request failed — user will see the manual CTA button
              setIsLocating(false)
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
          )
        }
      }, 800)
    }

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  // Update marker position when lat/lng props change (e.g., editing an address)
  useEffect(() => {
    if (lat !== null && lng !== null && mapInstanceRef.current && markerRef.current) {
      const newCoords: [number, number] = [lat, lng]
      markerRef.current.setLatLng(newCoords)
      mapInstanceRef.current.setView(newCoords, 15)
      coordsRef.current = newCoords
    }
  }, [lat, lng])

  const handleGetLocation = () => {
    if (!navigator.geolocation) return
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords: [number, number] = [
          Math.round(position.coords.latitude * 1000000) / 1000000,
          Math.round(position.coords.longitude * 1000000) / 1000000,
        ]
        coordsRef.current = newCoords
        onCoordsChange(newCoords[0], newCoords[1])
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView(newCoords, 16)
          markerRef.current.setLatLng(newCoords)
        }
        reverseGeocode(newCoords)
        setGpsUsed(true)
        setIsLocating(false)
      },
      () => { setIsLocating(false) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative isolate rounded-xl overflow-hidden border border-border/50">
        <div
          ref={mapContainerRef}
          className="w-full h-[200px] bg-muted/30"
          style={{ zIndex: 0 }}
        />
        {/* GPS button overlay */}
        <button
          onClick={handleGetLocation}
          disabled={isLocating}
          className="absolute top-2 right-2 z-[1000] w-9 h-9 rounded-lg bg-background border border-border shadow-md flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
          title="Mi ubicación"
        >
          {isLocating ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Crosshair className="h-4 w-4 text-primary" />
          )}
        </button>
        {!isMapReady && (
          <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      {/* GPS CTA — Prominent button when no initial coordinates */}
      {lat === null && lng === null && !gpsUsed && (
        <button
          onClick={handleGetLocation}
          disabled={isLocating}
          className="w-full flex items-center justify-center gap-2.5 h-11 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98]"
          style={{
            backgroundColor: colorPrincipal,
            boxShadow: `0 4px 14px ${colorPrincipal}4D`,
          }}
        >
          {isLocating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Obteniendo ubicación...
            </>
          ) : (
            <>
              <Crosshair className="h-4 w-4" />
              Usar mi ubicación actual
            </>
          )}
        </button>
      )}
      {gpsUsed && (
        <p className="text-[10px] text-muted-foreground text-center">
          Arrastrá el marcador para ajustar la posición si es necesario.
        </p>
      )}
    </div>
  )
}
