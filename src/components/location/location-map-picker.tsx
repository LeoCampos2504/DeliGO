"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import L from "leaflet"
import {
  MapPin,
  Navigation,
  Loader2,
  AlertCircle,
  Crosshair,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { DeliveryAddress } from "@/store/cart-store"

// ============================================
// Types
// ============================================
interface LocationMapPickerProps {
  onAddressSelect: (address: DeliveryAddress) => void
  initialAddress?: DeliveryAddress | null
  colorPrincipal?: string
}

// ============================================
// Default center (Formosa, Argentina)
// ============================================
const DEFAULT_CENTER: [number, number] = [-26.1856, -58.1732]
const DEFAULT_ZOOM = 15
const GPS_ZOOM = 16

// Fix default marker icon paths — Leaflet's default icon URLs break with bundlers
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// ============================================
// Main Component
//
// Uses the "center pin" pattern: the pin is fixed
// in the center of the map, and the user drags
// the MAP underneath to position the pin. This
// avoids the auto-zoom problem when moving the pin.
// ============================================
export function LocationMapPicker({
  onAddressSelect,
  initialAddress,
  colorPrincipal = "#FB8C00",
}: LocationMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const pinOverlayRef = useRef<HTMLDivElement>(null)

  const [isMapReady, setIsMapReady] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [coords, setCoords] = useState<[number, number]>(
    initialAddress ? [initialAddress.lat, initialAddress.lng] : DEFAULT_CENTER
  )
  const [direccion, setDireccion] = useState(initialAddress?.direccion ?? "")
  const [referencia, setReferencia] = useState(initialAddress?.referencia ?? "")
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false)
  const [hasUserInteracted, setHasUserInteracted] = useState(!!initialAddress)
  // Track if GPS was used successfully — controls the big CTA visibility
  const [gpsUsed, setGpsUsed] = useState(false)
  // Track if GPS auto-request was already attempted
  const gpsAutoRequestedRef = useRef(false)

  // Debounce timer for reverse geocoding on map move
  const reverseGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reverse geocoding with Nominatim
  const reverseGeocode = useCallback(async (latlng: [number, number]) => {
    setIsReverseGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng[0]}&lon=${latlng[1]}&format=json&accept-language=es`,
        {
          headers: {
            "User-Agent": "DeliGO-App/1.0",
          },
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.display_name) {
          const parts = data.display_name.split(",")
          const simplified = parts.slice(0, Math.min(3, parts.length)).join(",").trim()
          setDireccion(simplified)
        }
      }
    } catch {
      // Silently fail - user can type address manually
    } finally {
      setIsReverseGeocoding(false)
    }
  }, [])

  // Initialize map — runs once after mount
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return

    const initialCenter = initialAddress
      ? [initialAddress.lat, initialAddress.lng] as [number, number]
      : DEFAULT_CENTER

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // When the map stops moving (after pan/zoom), read the center
    // and update coordinates + reverse geocode
    map.on("moveend", () => {
      const center = map.getCenter()
      const newCoords: [number, number] = [
        Math.round(center.lat * 1000000) / 1000000,
        Math.round(center.lng * 1000000) / 1000000,
      ]
      setCoords(newCoords)
      setHasUserInteracted(true)

      // Debounce reverse geocoding to avoid hammering Nominatim
      if (reverseGeocodeTimerRef.current) {
        clearTimeout(reverseGeocodeTimerRef.current)
      }
      reverseGeocodeTimerRef.current = setTimeout(() => {
        reverseGeocode(newCoords)
      }, 500)
    })

    // Force map to recalculate size
    setTimeout(() => map.invalidateSize(), 200)

    mapInstanceRef.current = map
    setIsMapReady(true)

    // If initial address exists, reverse geocode it
    if (initialAddress) {
      reverseGeocode(initialCenter)
    }

    // Auto-request GPS on first mount (after a short delay).
    // Most browsers allow geolocation prompts on page load,
    // and this ensures the user sees the permission dialog immediately.
    if (!initialAddress && !gpsAutoRequestedRef.current) {
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
              setCoords(newCoords)
              setHasUserInteracted(true)
              setGpsUsed(true)
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setView(newCoords, GPS_ZOOM, { animate: true })
              }
              reverseGeocode(newCoords)
              setIsLocating(false)
            },
            () => {
              // Auto-request failed — user will see the manual CTA button
              setIsLocating(false)
            },
            {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 60000,
            }
          )
        }
      }, 800) // Small delay to let the map render first
    }

    return () => {
      if (reverseGeocodeTimerRef.current) {
        clearTimeout(reverseGeocodeTimerRef.current)
      }
      map.remove()
      mapInstanceRef.current = null
    }
  // Only run once on mount
  }, [])

  // GPS location — triggered by user tap (required by browsers for permission prompt)
  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Tu navegador no soporta geolocalización")
      return
    }

    setIsLocating(true)
    setGpsError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords: [number, number] = [
          Math.round(position.coords.latitude * 1000000) / 1000000,
          Math.round(position.coords.longitude * 1000000) / 1000000,
        ]
        setCoords(newCoords)
        setHasUserInteracted(true)
        setGpsUsed(true)

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(newCoords, GPS_ZOOM, { animate: true })
        }

        reverseGeocode(newCoords)
        setIsLocating(false)
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Permiso de ubicación denegado. Habilitalo en la configuración del navegador.",
          2: "No se pudo obtener tu ubicación. Verificá que el GPS esté activado.",
          3: "Tiempo de espera agotado al obtener tu ubicación.",
        }
        setGpsError(messages[error.code] || "Error al obtener ubicación")
        setIsLocating(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    )
  }, [reverseGeocode])

  // Use refs to track latest values without triggering callback recreation
  const coordsRef = useRef(coords)
  useEffect(() => { coordsRef.current = coords }, [coords])
  const direccionRef = useRef(direccion)
  useEffect(() => { direccionRef.current = direccion }, [direccion])
  const referenciaRef = useRef(referencia)
  useEffect(() => { referenciaRef.current = referencia }, [referencia])
  const onAddressSelectRef = useRef(onAddressSelect)
  useEffect(() => { onAddressSelectRef.current = onAddressSelect }, [onAddressSelect])

  // Notify parent of address changes — stable callback (no deps that change on every render)
  const emitAddress = useCallback(() => {
    onAddressSelectRef.current({
      lat: coordsRef.current[0],
      lng: coordsRef.current[1],
      direccion: direccionRef.current,
      referencia: referenciaRef.current,
    })
  }, [])

  // Auto-emit only when coords change (user moved map or GPS)
  const prevCoordsRef = useRef(coords)
  useEffect(() => {
    if (hasUserInteracted) {
      const coordsChanged =
        prevCoordsRef.current[0] !== coords[0] ||
        prevCoordsRef.current[1] !== coords[1]
      if (coordsChanged) {
        emitAddress()
        prevCoordsRef.current = coords
      }
    }
  }, [hasUserInteracted, coords, emitAddress])

  return (
    <div className="space-y-3">
      {/* ===== MAP ===== */}
      <div className="relative rounded-2xl overflow-hidden border border-border/50">
        <div
          ref={mapContainerRef}
          className="w-full h-[280px] sm:h-[320px] md:h-[360px] bg-muted/30"
          style={{ zIndex: 0 }}
        />

        {/* Center pin overlay — fixed in the middle of the map */}
        <div
          ref={pinOverlayRef}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 500 }}
        >
          <div className="relative -translate-y-1/2" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
            <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0C7.164 0 0 7.164 0 16c0 12 16 26 16 26s16-14 16-26C32 7.164 24.836 0 16 0z" fill={colorPrincipal}/>
              <circle cx="16" cy="15" r="7" fill="white"/>
            </svg>
          </div>
        </div>

        {/* GPS button overlay */}
        <button
          onClick={handleGetLocation}
          disabled={isLocating}
          className={cn(
            "absolute top-3 right-3 z-[1000] w-10 h-10 rounded-xl bg-background border border-border shadow-lg flex items-center justify-center transition-all hover:bg-muted active:scale-95",
            isLocating && "opacity-70 cursor-wait"
          )}
          title="Mi ubicación"
        >
          {isLocating ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin text-primary" />
          ) : (
            <Crosshair className="h-4.5 w-4.5 text-primary" />
          )}
        </button>

        {/* Map loading overlay */}
        {!isMapReady && (
          <div className="absolute inset-0 bg-muted/50 flex items-center justify-center z-[600]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* ===== GPS PROMPT — Prominent CTA when no initial address ===== */}
      {!initialAddress && !gpsUsed && !gpsError && (
        <button
          onClick={handleGetLocation}
          disabled={isLocating}
          className="w-full flex items-center justify-center gap-2.5 h-12 rounded-2xl font-bold text-white text-sm transition-all active:scale-[0.98]"
          style={{
            backgroundColor: colorPrincipal,
            boxShadow: `0 4px 14px ${colorPrincipal}30`,
          }}
        >
          {isLocating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Obteniendo ubicación...
            </>
          ) : (
            <>
              <Crosshair className="h-5 w-5" />
              Usar mi ubicación actual
            </>
          )}
        </button>
      )}

      {/* GPS Error */}
      {gpsError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-red-700 dark:text-red-300">{gpsError}</p>
            {gpsError.includes("denegado") && (
              <p className="text-[11px] text-red-600/70 dark:text-red-400/70 mt-1">
                Podés mover el mapa manualmente para ubicar tu dirección.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ===== HINT ===== */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {gpsUsed
            ? "Arrastrá el mapa para ajustar la posición del pin si es necesario."
            : "Tocá \"Usar mi ubicación\" para centrar el mapa, o arrastrá el mapa manualmente."}
        </p>
      </div>

      {/* ===== COORDINATES DISPLAY ===== */}
      {hasUserInteracted && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/30">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-mono text-muted-foreground">
            {coords[0].toFixed(6)}, {coords[1].toFixed(6)}
          </span>
          {isReverseGeocoding && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
          )}
        </div>
      )}

      {/* ===== ADDRESS INPUT ===== */}
      <div className="space-y-2">
        <label className="text-sm font-semibold flex items-center gap-1.5">
          <Navigation className="h-3.5 w-3.5 text-primary" />
          Dirección
        </label>
        <Input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Ej: Manzana 15, Lote 23, Barrio Norte"
          className="text-sm rounded-xl"
        />
        <p className="text-[10px] text-muted-foreground">
          Si no conocés el nombre de la calle, indicá manzana y lote
        </p>
      </div>

      {/* ===== REFERENCE INPUT ===== */}
      <div className="space-y-2">
        <label className="text-sm font-semibold flex items-center gap-1.5">
          Referencia
        </label>
        <Input
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          placeholder="Ej: Casa naranja con reja negra, frente al kiosco"
          className="text-sm rounded-xl"
        />
      </div>

      {/* ===== SAVE BUTTON ===== */}
      <Button
        onClick={emitAddress}
        disabled={!hasUserInteracted || !direccion.trim()}
        className="w-full h-12 rounded-2xl font-bold text-white text-sm"
        style={{
          backgroundColor: colorPrincipal,
          boxShadow: `0 4px 14px ${colorPrincipal}30`,
        }}
      >
        <MapPin className="h-4 w-4 mr-2" />
        Confirmar ubicación
      </Button>
    </div>
  )
}
