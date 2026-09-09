"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, Navigation, Check, X, Info } from "lucide-react"
import { AddressMapPicker } from "./address-map-picker"

// ============================================
// P2-T32 — Autoridad única de formulario/lógica de dirección de Cliente
// ============================================
// Única implementación de: campos, validación, geolocalización/mapa
// (vía AddressMapPicker), payload y submit (POST/PUT reales a
// /api/cliente/direcciones). Perfil (sección "Mis Direcciones") y el
// modal de checkout ("Agregar dirección" desde el carrito) instancian
// este MISMO componente — nunca dos formularios divergentes. El
// contenedor visual (sección de página vs. modal flotante) es decisión
// del consumidor; los campos/validaciones/API nunca varían entre ambos.
// Extraído de client-profile-panel.tsx (única implementación completa y
// estable existente al momento de esta extracción, la que el operador
// identificó como referencia funcional).

export interface DireccionRecord {
  id: string
  alias: string
  direccion: string
  referencia: string
  lat: number | null
  lng: number | null
}

export interface AddressFormInitialValues {
  alias: string
  direccion: string
  referencia: string
  lat: number | null
  lng: number | null
}

export interface AddressFormProps {
  mode: "create" | "edit"
  /** Requerido cuando mode === "edit" — id de la Direccion a actualizar. */
  addressId?: string
  initialValues?: AddressFormInitialValues
  onSuccess: (direccion: DireccionRecord) => void
  onCancel: () => void
  /** Color de marca del negocio, sólo relevante en el modal de checkout. Perfil no lo pasa. */
  colorPrincipal?: string
}

export function AddressForm({
  mode,
  addressId,
  initialValues,
  onSuccess,
  onCancel,
  colorPrincipal,
}: AddressFormProps) {
  const [alias, setAlias] = useState(initialValues?.alias ?? "")
  const [direccion, setDireccion] = useState(initialValues?.direccion ?? "")
  const [referencia, setReferencia] = useState(initialValues?.referencia ?? "")
  const [lat, setLat] = useState<number | null>(initialValues?.lat ?? null)
  const [lng, setLng] = useState<number | null>(initialValues?.lng ?? null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        alias: alias.trim(),
        direccion: direccion.trim(),
        referencia: referencia.trim(),
        lat,
        lng,
      }
      const res = await fetch("/api/cliente/direcciones", {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "edit" ? { id: addressId, ...payload } : payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al guardar la dirección" }))
        throw new Error(err.error || "Error al guardar la dirección")
      }
      const data = await res.json()
      return data.direccion as DireccionRecord
    },
    onSuccess: (direccion) => onSuccess(direccion),
  })

  const handleSubmit = () => {
    setValidationError(null)
    if (!alias.trim()) {
      setValidationError("El alias es obligatorio")
      return
    }
    // Either direccion text or coordinates must be present (coords take priority)
    if (!direccion.trim() && (lat === null || lng === null)) {
      setValidationError("Ingresá una dirección o seleccioná la ubicación en el mapa")
      return
    }
    if (mutation.isPending) return // double-submit guard
    mutation.mutate()
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Alias *</Label>
        <Input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          className="h-9 text-sm"
          placeholder="Ej: Casa, Trabajo..."
        />
        <p className="text-[10px] text-muted-foreground">Este nombre aparecerá al seleccionar la dirección</p>
      </div>

      {/* Map picker for coordinates */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Navigation className="h-3 w-3 text-primary" />
          Ubicación en el mapa
        </Label>
        <AddressMapPicker
          lat={lat}
          lng={lng}
          direccion={direccion}
          onCoordsChange={(newLat, newLng) => { setLat(newLat); setLng(newLng) }}
          onDireccionChange={setDireccion}
          colorPrincipal={colorPrincipal}
        />
        {lat !== null && lng !== null && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/30">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-mono text-muted-foreground">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
          </div>
        )}
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
          <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-700 dark:text-amber-300">
            Las coordenadas del mapa tienen prioridad sobre la dirección escrita para calcular distancias de delivery.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Dirección</Label>
        <Input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="h-9 text-sm"
          placeholder="Calle, número, barrio..."
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Referencia (opcional)</Label>
        <Input
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          className="h-9 text-sm"
          placeholder="Piso, depto, entre calles..."
        />
      </div>

      {(validationError || mutation.error) && (
        <p className="text-xs text-destructive">
          {validationError || (mutation.error as Error)?.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs flex-1"
          onClick={handleSubmit}
          disabled={mutation.isPending}
        >
          <Check className="h-3.5 w-3.5" />
          {mode === "edit"
            ? mutation.isPending ? "Guardando..." : "Guardar cambios"
            : mutation.isPending ? "Agregando..." : "Agregar dirección"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          <X className="h-3.5 w-3.5" />
          Cancelar
        </Button>
      </div>
    </div>
  )
}
