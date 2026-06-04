"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const DEFAULT_CENTER: [number, number] = [-26.1856, -58.1732] // Formosa

function createStoreIcon(colorPrincipal: string, logoUrl?: string | null) {
  if (logoUrl) {
    return L.divIcon({
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 0C8.058 0 0 8.058 0 18c0 13.5 18 28 18 28s18-14.5 18-28C36 8.058 27.942 0 18 0z" fill="${colorPrincipal}"/>
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
      className: "store-marker",
      iconSize: [36, 46],
      iconAnchor: [18, 46],
    })
  }

  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="${colorPrincipal}"/>
          <text x="14" y="17" text-anchor="middle" dominant-baseline="central" font-size="12" fill="white">🏪</text>
        </svg>
      </div>
    `,
    className: "store-marker",
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  })
}

export function LocationPickerInline({
  initialLat,
  initialLng,
  colorPrincipal,
  logoUrl,
  onConfirm,
  onCancel,
}: {
  initialLat?: number
  initialLng?: number
  colorPrincipal: string
  logoUrl?: string | null
  onConfirm: (lat: number, lng: number) => void
  onCancel: () => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [selectedPos, setSelectedPos] = useState<[number, number]>(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : DEFAULT_CENTER
  )

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const center = initialLat != null && initialLng != null
      ? [initialLat, initialLng] as [number, number]
      : DEFAULT_CENTER

    const map = L.map(mapRef.current, {
      center,
      zoom: 15,
      zoomControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Custom store icon (with logo if available)
    const storeIcon = createStoreIcon(colorPrincipal, logoUrl)
    const marker = L.marker(center, { icon: storeIcon, draggable: true }).addTo(map)

    // Click on map to move marker
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng)
      setSelectedPos([e.latlng.lat, e.latlng.lng])
    })

    // Drag marker
    marker.on("dragend", () => {
      const pos = marker.getLatLng()
      setSelectedPos([pos.lat, pos.lng])
    })

    setTimeout(() => map.invalidateSize(), 300)

    mapInstanceRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [colorPrincipal, initialLat, initialLng, logoUrl])

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-border/50" style={{ height: 250 }}>
        <div ref={mapRef} className="w-full h-full" />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Hacé clic en el mapa o arrastrá el marcador para setear la ubicación de tu local
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-xl flex-1 gap-1.5 font-semibold"
          style={{ backgroundColor: colorPrincipal }}
          onClick={() => onConfirm(selectedPos[0], selectedPos[1])}
        >
          <MapPin className="h-3.5 w-3.5" />
          Confirmar ubicación
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
