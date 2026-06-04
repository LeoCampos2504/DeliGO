"use client"

import React, { useCallback, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { MapPin } from "lucide-react"
import { LocationMapPicker } from "./location-map-picker"
import { useCartStore, type DeliveryAddress } from "@/store/cart-store"

// ============================================
// Types
// ============================================
interface LocationPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  required?: boolean
  colorPrincipal?: string
}

// ============================================
// Location Picker Modal
// ============================================
export function LocationPickerModal({
  open,
  onOpenChange,
  required = false,
  colorPrincipal = "#FB8C00",
}: LocationPickerModalProps) {
  const deliveryAddress = useCartStore((s) => s.deliveryAddress)
  const setDeliveryAddress = useCartStore((s) => s.setDeliveryAddress)
  const addSavedAddress = useCartStore((s) => s.addSavedAddress)

  // Use ref to avoid re-creating callback when store setters change
  const setDeliveryAddressRef = useRef(setDeliveryAddress)
  useEffect(() => { setDeliveryAddressRef.current = setDeliveryAddress }, [setDeliveryAddress])

  // Memoized callback — stable reference to prevent infinite re-render loop
  // in LocationMapPicker's useEffect that depends on onAddressSelect
  const handleAddressSelect = useCallback((address: DeliveryAddress) => {
    setDeliveryAddressRef.current(address)
  }, [])

  const handleConfirm = useCallback(() => {
    if (deliveryAddress) {
      addSavedAddress(deliveryAddress)
    }
    onOpenChange(false)
  }, [deliveryAddress, addSavedAddress, onOpenChange])

  // Prevent closing if required and no address
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen && required && !deliveryAddress) {
      return // Can't close if required and no address
    }
    onOpenChange(newOpen)
  }, [required, deliveryAddress, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl">
        <DialogTitle className="sr-only">Seleccionar ubicación de entrega</DialogTitle>
        <DialogDescription className="sr-only">Elegí la dirección de entrega para tu pedido usando el mapa o tu GPS</DialogDescription>
        <div className="p-5 pb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${colorPrincipal}15` }}
            >
              <MapPin className="h-5 w-5" style={{ color: colorPrincipal }} />
            </div>
            <div>
              <h2 className="font-extrabold text-lg">¿Dónde te entregamos?</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {required
                  ? "Seleccioná tu ubicación para continuar"
                  : "Elegí la dirección de entrega para tu pedido"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <LocationMapPicker
            onAddressSelect={handleAddressSelect}
            initialAddress={deliveryAddress}
            colorPrincipal={colorPrincipal}
          />

          {/* Confirm button is inside the map picker, but we add an extra one for the modal */}
          {deliveryAddress && (
            <button
              onClick={handleConfirm}
              className="w-full mt-3 text-center text-sm font-semibold text-primary hover:underline"
            >
              Usar esta ubicación y cerrar
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
