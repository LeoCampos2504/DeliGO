"use client"

import React, { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Home,
  Building,
  MapPin,
  Plus,
  Check,
  Navigation,
  ChevronRight,
} from "lucide-react"
import { useCartStore, type DeliveryAddress } from "@/store/cart-store"
import { useNavStore } from "@/store/nav-store"
import { cn } from "@/lib/utils"

// ============================================
// Types
// ============================================
interface DireccionDB {
  id: string
  alias: string
  direccion: string
  referencia: string
  lat: number | null
  lng: number | null
}

interface AddressSelectorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** If true and no addresses exist, clicking "Agregar" goes to profile */
  onAddNew?: () => void
}

// ============================================
// Helper: icon based on alias
// ============================================
function getAliasIcon(alias: string) {
  const lower = alias.toLowerCase()
  if (lower.includes("casa") || lower.includes("home")) return Home
  if (lower.includes("trabajo") || lower.includes("office") || lower.includes("oficina")) return Building
  return MapPin
}

// ============================================
// Address Selector Sheet
// ============================================
export function AddressSelectorSheet({
  open,
  onOpenChange,
  onAddNew,
}: AddressSelectorSheetProps) {
  const deliveryAddress = useCartStore((s) => s.deliveryAddress)
  const setDeliveryAddress = useCartStore((s) => s.setDeliveryAddress)
  const setActiveTab = useNavStore((s) => s.setActiveTab)

  // Fetch saved addresses from DB
  const { data: direcciones = [] } = useQuery<DireccionDB[]>({
    queryKey: ["cliente-direcciones"],
    queryFn: async () => {
      const res = await fetch("/api/cliente/direcciones")
      if (!res.ok) return []
      const data = await res.json()
      return data.direcciones ?? []
    },
    enabled: open,
  })

  const handleSelect = (dir: DireccionDB) => {
    const address: DeliveryAddress = {
      lat: dir.lat ?? -26.1856,
      lng: dir.lng ?? -58.1732,
      direccion: dir.direccion,
      referencia: dir.referencia,
      alias: dir.alias,
      direccionId: dir.id,
    }
    setDeliveryAddress(address)
    onOpenChange(false)
  }

  const handleAddNew = () => {
    onOpenChange(false)
    if (onAddNew) {
      onAddNew()
    } else {
      setActiveTab("perfil")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 gap-0 max-h-[70vh]">
        <SheetTitle className="sr-only">Seleccionar dirección de entrega</SheetTitle>
        <SheetDescription className="sr-only">Elegí una dirección guardada o agregá una nueva</SheetDescription>

        <div className="p-5 pb-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg">¿Dónde te entregamos?</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Seleccioná una de tus direcciones guardadas
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[50vh] p-4 space-y-2">
          {direcciones.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold mb-1">No tenés direcciones guardadas</p>
              <p className="text-xs text-muted-foreground mb-4">
                Agregá una dirección con su ubicación en el mapa para recibir pedidos
              </p>
              <Button
                onClick={handleAddNew}
                className="gap-2 rounded-xl"
              >
                <Plus className="h-4 w-4" />
                Agregar dirección
              </Button>
            </div>
          ) : (
            <>
              {direcciones.map((dir) => {
                const Icon = getAliasIcon(dir.alias)
                const isSelected = deliveryAddress?.direccionId === dir.id
                const hasCoords = dir.lat !== null && dir.lng !== null

                return (
                  <button
                    key={dir.id}
                    onClick={() => handleSelect(dir)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left group",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/50 bg-card hover:border-primary/30 hover:bg-muted/30"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      isSelected ? "bg-primary/15" : "bg-muted"
                    )}>
                      <Icon className={cn(
                        "h-5 w-5",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "font-bold text-sm",
                          isSelected ? "text-primary" : "text-foreground"
                        )}>
                          {dir.alias}
                        </p>
                        {hasCoords && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                            <Navigation className="h-2.5 w-2.5" />
                            GPS
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {dir.direccion}
                      </p>
                      {dir.referencia && (
                        <p className="text-[10px] text-muted-foreground/70 truncate">
                          Ref: {dir.referencia}
                        </p>
                      )}
                    </div>

                    {isSelected ? (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                )
              })}

              {/* Add new button at bottom */}
              <button
                onClick={handleAddNew}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-dashed border-border/50 bg-transparent hover:border-primary/30 hover:bg-muted/20 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Agregar nueva dirección
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Ir a mi perfil para cargar una nueva
                  </p>
                </div>
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
