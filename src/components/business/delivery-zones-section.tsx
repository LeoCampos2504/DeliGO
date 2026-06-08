"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  MapPin,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface Punto {
  lat: number
  lng: number
}

interface Zona {
  id: string
  nombre: string
  precio: number
  puntos: Punto[]
  color: string
}

interface DeliveryZonesSectionProps {
  negocio: {
    id: string
    colorPrincipal: string
  }
}

const ZONE_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletRef = any

// ============================================
// Main Component
// ============================================
export function DeliveryZonesSection({ negocio }: DeliveryZonesSectionProps) {
  const queryClient = useQueryClient()
  const [deliveryMode, setDeliveryMode] = useState<string>("simple")
  const [precioSimple, setPrecioSimple] = useState<number>(0)
  const [zonas, setZonas] = useState<Zona[]>([])
  const [showMap, setShowMap] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Fetch config
  const { data: config, isLoading } = useQuery({
    queryKey: ["negocio-config", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/config?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando configuración")
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Initialize local state from config
  useEffect(() => {
    if (config && !initialized) {
      setDeliveryMode(config.deliveryMode || "simple")
      setPrecioSimple(config.precioDelivery || 0)
      const parsedZonas = Array.isArray(config.zonasDelivery) ? config.zonasDelivery : []
      setZonas(parsedZonas)
      setInitialized(true)
    }
  }, [config, initialized])

  // Save
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/negocio/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryMode,
          precioDelivery: deliveryMode === "simple" ? precioSimple : 0,
          zonasDelivery: zonas,
          zonaDeliveryActiva: deliveryMode === "expert" && zonas.length > 0,
        }),
      })
      if (!res.ok) throw new Error("Error guardando")
      const data = await res.json()
      // Immediately update cache with server response
      queryClient.setQueryData(["negocio-config", negocio.id], (old: Record<string, unknown> | undefined) =>
        old ? { ...old, ...data } : data
      )
      queryClient.invalidateQueries({ queryKey: ["negocio-config", negocio.id] })
      toast.success("Configuración de delivery guardada")
    } catch {
      toast.error("Error al guardar la configuración")
    } finally {
      setSaving(false)
    }
  }, [deliveryMode, precioSimple, zonas, queryClient, negocio.id])

  // Add zone
  const addZona = useCallback(() => {
    const colorIndex = zonas.length % ZONE_COLORS.length
    const newZona: Zona = {
      id: `zona-${Date.now()}`,
      nombre: `Zona ${zonas.length + 1}`,
      precio: 0,
      puntos: [],
      color: ZONE_COLORS[colorIndex],
    }
    setZonas((prev) => [...prev, newZona])
    setShowMap(true)
  }, [zonas.length])

  // Remove zone
  const removeZona = useCallback((id: string) => {
    setZonas((prev) => prev.filter((z) => z.id !== id))
  }, [])

  // Update zone
  const updateZona = useCallback((id: string, updates: Partial<Zona>) => {
    setZonas((prev) =>
      prev.map((z) => (z.id === id ? { ...z, ...updates } : z))
    )
  }, [])

  // Set zone points from map
  const setZonaPoints = useCallback((id: string, puntos: Punto[]) => {
    setZonas((prev) =>
      prev.map((z) => (z.id === id ? { ...z, puntos } : z))
    )
  }, [])

  if (isLoading) {
    return <DeliveryZonesSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
        <div>
          <p className="text-sm font-semibold">Modo de delivery</p>
          <p className="text-xs text-muted-foreground">
            {deliveryMode === "simple"
              ? "Mismo precio de delivery para todos"
              : "Diferentes precios según zona"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-semibold", deliveryMode === "simple" && "text-primary")}>
            Simple
          </span>
          <Switch
            checked={deliveryMode === "expert"}
            onCheckedChange={(v) => setDeliveryMode(v ? "expert" : "simple")}
          />
          <span className={cn("text-xs font-semibold", deliveryMode === "expert" && "text-primary")}>
            Experto
          </span>
        </div>
      </div>

      {/* Info banner */}
      {deliveryMode === "expert" && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Modo experto
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-500">
                Los clientes fuera de las zonas que definas no podrán realizar pedidos de delivery. Solo se entrega dentro de las zonas con sus respectivos precios.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Simple mode: just price */}
      {deliveryMode === "simple" && (
        <div>
          <Label className="text-sm font-semibold mb-1.5 block">Precio de delivery</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              value={precioSimple}
              onChange={(e) => setPrecioSimple(parseFloat(e.target.value) || 0)}
              className="rounded-xl pl-7"
              placeholder="0"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Todos los clientes pagan el mismo precio de delivery
          </p>
        </div>
      )}

      {/* Expert mode: zones list + map */}
      {deliveryMode === "expert" && (
        <>
          {/* Zones list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="h-4 w-4" style={{ color: negocio.colorPrincipal }} />
                Zonas de delivery
              </p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 border-dashed font-semibold"
                style={{ borderColor: `${negocio.colorPrincipal}40`, color: negocio.colorPrincipal }}
                onClick={addZona}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar zona
              </Button>
            </div>

            {zonas.length === 0 ? (
              <div className="text-center py-6 px-4">
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: `${negocio.colorPrincipal}12` }}
                >
                  <MapPin className="h-7 w-7" style={{ color: negocio.colorPrincipal }} />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Creá zonas en el mapa para definir diferentes precios de delivery según la ubicación del cliente.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {zonas.map((zona) => (
                  <ZonaCard
                    key={zona.id}
                    zona={zona}
                    onUpdate={(updates) => updateZona(zona.id, updates)}
                    onRemove={() => removeZona(zona.id)}
                    onOpenMap={() => setShowMap(true)}
                    colorPrincipal={negocio.colorPrincipal}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Map dialog */}
          <AnimatePresence>
            {showMap && (
              <ZoneMapDialog
                zonas={zonas}
                onSetZonaPoints={setZonaPoints}
                onClose={() => setShowMap(false)}
                colorPrincipal={negocio.colorPrincipal}
              />
            )}
          </AnimatePresence>
        </>
      )}

      {/* Save button */}
      <div className="pt-3 border-t border-border/30">
        <Button
          size="sm"
          className="rounded-xl w-full gap-2 font-semibold"
          style={{ backgroundColor: negocio.colorPrincipal }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {saving ? "Guardando..." : "Guardar zonas de delivery"}
        </Button>
      </div>
    </div>
  )
}

// ============================================
// Zone Card
// ============================================
function ZonaCard({
  zona,
  onUpdate,
  onRemove,
  onOpenMap,
  colorPrincipal,
}: {
  zona: Zona
  onUpdate: (updates: Partial<Zona>) => void
  onRemove: () => void
  onOpenMap: () => void
  colorPrincipal: string
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="p-3 rounded-xl border border-border/50 bg-background space-y-3">
      <div className="flex items-center gap-2.5">
        {/* Color dot */}
        <div
          className="w-4 h-4 rounded-full shrink-0 border border-white/50"
          style={{ backgroundColor: zona.color }}
        />
        {/* Name input */}
        <Input
          value={zona.nombre}
          onChange={(e) => onUpdate({ nombre: e.target.value })}
          className="rounded-xl h-8 text-sm flex-1"
          placeholder="Nombre de la zona"
        />
        {/* Price */}
        <div className="relative w-24 shrink-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">$</span>
          <Input
            type="number"
            min={0}
            value={zona.precio}
            onChange={(e) => onUpdate({ precio: parseFloat(e.target.value) || 0 })}
            className="rounded-xl h-8 text-sm pl-6"
            placeholder="0"
          />
        </div>
      </div>

      {/* Points info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {zona.puntos.length === 0
              ? "Sin puntos"
              : `${zona.puntos.length} puntos`}
          </Badge>
          {zona.puntos.length >= 3 && (
            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-0">
              Zona cerrada
            </Badge>
          )}
          {zona.puntos.length > 0 && zona.puntos.length < 3 && (
            <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-0">
              Faltan {3 - zona.puntos.length} puntos
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl h-7 text-xs gap-1"
            onClick={onOpenMap}
          >
            <MapPin className="h-3 w-3" />
            Mapa
          </Button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg text-red-500"
                onClick={onRemove}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-lg"
                onClick={() => setConfirmDelete(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-red-500"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Zone Map Dialog (Full screen overlay)
// ============================================
function ZoneMapDialog({
  zonas,
  onSetZonaPoints,
  onClose,
  colorPrincipal,
}: {
  zonas: Zona[]
  onSetZonaPoints: (id: string, puntos: Punto[]) => void
  onClose: () => void
  colorPrincipal: string
}) {
  const [activeZonaId, setActiveZonaId] = useState<string | null>(zonas.length > 0 ? zonas[zonas.length - 1].id : null)
  const [mapReady, setMapReady] = useState(false)
  const [closedZonaIds, setClosedZonaIds] = useState<Set<string>>(() => {
    // Zones that already have 3+ points are considered closed on init
    const closed = new Set<string>()
    zonas.forEach((z) => { if (z.puntos.length >= 3) closed.add(z.id) })
    return closed
  })
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<LeafletRef>(null)
  const LRef = useRef<LeafletRef>(null)
  const layerRefs = useRef<LeafletRef[]>([]) // all markers and polygons
  const zonasRef = useRef(zonas) // Keep latest zonas for the click handler
  const activeZonaIdRef = useRef(activeZonaId) // Keep latest activeZonaId for the click handler
  useEffect(() => { zonasRef.current = zonas }, [zonas])
  useEffect(() => { activeZonaIdRef.current = activeZonaId }, [activeZonaId])

  // Load leaflet dynamically and init map
  useEffect(() => {
    let cancelled = false

    async function initMap() {
      const L = (await import("leaflet")).default
      if (cancelled || !mapContainerRef.current) return

      LRef.current = L

      // Fix default icon paths
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const map = L.map(mapContainerRef.current, {
        center: [-34.6, -58.45],
        zoom: 13,
        zoomControl: true,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map

      // Draw existing zones
      zonas.forEach((zona) => {
        const isClosed = zona.puntos.length >= 3
        drawZona(map, L, zona, isClosed)
      })

      // Fit map to existing points
      const allPoints = zonas.flatMap((z) => z.puntos)
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints.map((p: Punto) => [p.lat, p.lng]))
        map.fitBounds(bounds, { padding: [50, 50] })
      }

      // Click handler - uses refs to always have latest state
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const currentActiveId = activeZonaIdRef.current
        if (!currentActiveId) return
        const currentZonas = zonasRef.current
        const zona = currentZonas.find((z) => z.id === currentActiveId)
        if (!zona) return

        const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng }
        const currentPoints = [...zona.puntos, newPoint]
        onSetZonaPoints(currentActiveId, currentPoints)

        // When adding points, the zone is no longer "closed" (polygon needs redraw)
        setClosedZonaIds((prev) => {
          const next = new Set(prev)
          next.delete(currentActiveId)
          return next
        })

        // Clear and redraw this zone (markers only, no polygon until closed)
        clearZonaLayers(map, zona.id)
        drawZona(map, L, { ...zona, puntos: currentPoints }, false)
      })

      setMapReady(true)
    }

    initMap()

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
    // We intentionally only run this once on mount
  }, [])

  // Draw a zone on the map
  function drawZona(map: LeafletRef, L: LeafletRef, zona: Zona, drawPolygon: boolean) {
    const { puntos, color, id } = zona

    // Draw markers for each point
    puntos.forEach((p: Punto, idx: number) => {
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: "custom-zone-marker",
          html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold">${idx + 1}</div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(map)
      ;(marker as Record<string, unknown>)._zonaId = id
      layerRefs.current.push(marker)
    })

    // Draw polyline connecting points (always, so user can see the path)
    if (puntos.length >= 2) {
      const polyline = L.polyline(
        puntos.map((p: Punto) => [p.lat, p.lng]),
        {
          color,
          weight: 2,
          dashArray: drawPolygon ? undefined : "6 4",
          opacity: 0.7,
        }
      ).addTo(map)
      ;(polyline as Record<string, unknown>)._zonaId = id
      layerRefs.current.push(polyline)
    }

    // Draw polygon ONLY when zone is explicitly closed
    if (drawPolygon && puntos.length >= 3) {
      const polygon = L.polygon(
        puntos.map((p: Punto) => [p.lat, p.lng]),
        {
          color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2,
        }
      ).addTo(map)
      ;(polygon as Record<string, unknown>)._zonaId = id
      layerRefs.current.push(polygon)
    }
  }

  // Clear layers for a specific zone
  function clearZonaLayers(map: LeafletRef, zonaId: string) {
    layerRefs.current = layerRefs.current.filter((layer: LeafletRef) => {
      if ((layer as Record<string, unknown>)._zonaId === zonaId) {
        map.removeLayer(layer)
        return false
      }
      return true
    })
  }

  // Clear zona points
  const handleClearZona = (zonaId: string) => {
    onSetZonaPoints(zonaId, [])
    setClosedZonaIds((prev) => {
      const next = new Set(prev)
      next.delete(zonaId)
      return next
    })
    const map = mapInstanceRef.current
    if (map) clearZonaLayers(map, zonaId)
  }

  // Close a zone (draw the polygon)
  const handleCloseZona = (zona: Zona) => {
    if (zona.puntos.length < 3) return
    const map = mapInstanceRef.current
    const L = LRef.current
    if (!map || !L) return
    setClosedZonaIds((prev) => {
      const next = new Set(prev)
      next.add(zona.id)
      return next
    })
    clearZonaLayers(map, zona.id)
    drawZona(map, L, zona, true)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div>
          <h3 className="font-semibold text-sm">Mapa de zonas de delivery</h3>
          <p className="text-xs text-muted-foreground">
            Hacé clic en el mapa para agregar puntos a la zona seleccionada
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={onClose}
        >
          <Check className="h-3.5 w-3.5" />
          Listo
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row h-[calc(100vh-56px)]">
        {/* Sidebar: zona selector */}
        <div className="sm:w-72 border-b sm:border-b-0 sm:border-r border-border bg-background overflow-y-auto shrink-0">
          <div className="p-3 space-y-2">
            {zonas.map((zona) => (
              <div
                key={zona.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveZonaId(zona.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveZonaId(zona.id) }}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-colors cursor-pointer",
                  activeZonaId === zona.id
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/30 hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: zona.color }}
                  />
                  <span className="text-sm font-semibold truncate">{zona.nombre}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    ${zona.precio} · {zona.puntos.length} pts
                    {zona.puntos.length >= 3 && " ✓"}
                  </span>
                </div>
                {activeZonaId === zona.id && (
                  <div className="flex gap-1.5 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-6 text-[10px] px-2 gap-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCloseZona(zona)
                      }}
                      disabled={zona.puntos.length < 3}
                    >
                      <Check className="h-2.5 w-2.5" />
                      Cerrar zona
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-6 text-[10px] px-2 gap-1 text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleClearZona(zona.id)
                      }}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                      Limpiar
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {zonas.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Agregá zonas desde la sección de configuración
              </p>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {!mapReady && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Active zone badge */}
          {activeZonaId && mapReady && (
            <div className="absolute top-3 left-3 z-[1000]">
              {(() => {
                const zona = zonas.find((z) => z.id === activeZonaId)
                if (!zona) return null
                return (
                  <div
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg"
                    style={{ backgroundColor: zona.color }}
                  >
                    Dibujando: {zona.nombre}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// Skeleton
// ============================================
function DeliveryZonesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 w-full bg-muted/50 rounded-xl animate-pulse" />
      <div className="h-10 w-full bg-muted/30 rounded-xl animate-pulse" />
      <div className="h-8 w-32 bg-muted/30 rounded-xl animate-pulse" />
    </div>
  )
}
