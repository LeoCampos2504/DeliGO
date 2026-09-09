"use client"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { MapPin } from "lucide-react"
import { AddressForm, type DireccionRecord } from "./address-form"

// ============================================
// P2-T32 — Modal de checkout para agregar dirección (Problema B)
// ============================================
// Preserva la UX de modal flotante ya existente (nunca redirige a
// Perfil), pero por dentro usa la MISMA autoridad de formulario que
// Perfil (AddressForm) — nunca un formulario reducido/divergente.
// Reemplaza el uso de LocationPickerModal en el flujo de checkout
// (src/app/n/[slug]/page.tsx); LocationPickerModal/LocationMapPicker
// quedan sin tocar (preservados por un test estático de contrato iOS
// que referencia su archivo por path — fuera de alcance de esta tarea).
// ============================================

interface ClientAddressModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama sólo cuando la dirección se creó exitosamente en el backend. */
  onCreated: (direccion: DireccionRecord) => void
  colorPrincipal?: string
}

export function ClientAddressModal({
  open,
  onOpenChange,
  onCreated,
  colorPrincipal = "#FB8C00",
}: ClientAddressModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
          <MapPin className="h-5 w-5" style={{ color: colorPrincipal }} />
          Agregar dirección
        </DialogTitle>
        <DialogDescription className="sr-only">
          Agregá una dirección de entrega con su ubicación en el mapa para continuar tu pedido
        </DialogDescription>
        <AddressForm
          mode="create"
          colorPrincipal={colorPrincipal}
          onSuccess={(direccion) => {
            onCreated(direccion)
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
