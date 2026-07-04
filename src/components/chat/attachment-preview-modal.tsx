"use client"

import { Paperclip } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PdfViewerModal } from "./pdf-viewer-modal"

// ============================================
// DeliGO - Visor interno de adjuntos (compartido: Terminal PyR + panel personal PyR)
// ============================================
// Componente presentacional compartido: abre imagenes en un Dialog interno y PDFs
// reutilizando el PdfViewerModal ya existente (mismo componente que usa el chat de
// cliente/administrador) - sin ventanas nuevas, sin target="_blank", sin window.open.
// Solo recibe una URL ya autorizada (el endpoint interno de adjunto correspondiente,
// personal o de Terminal segun quien lo use) - nunca decide autorizacion ni construye
// URLs de storage. No renderiza SVG, HTML ni ningun tipo fuera de "imagen"/"pdf".

export type AttachmentPreview =
  | {
      tipo: "imagen"
      src: string
      nombre: string
    }
  | {
      tipo: "pdf"
      src: string
      nombre: string
    }
  | null

interface AttachmentPreviewModalProps {
  preview: AttachmentPreview
  onClose: () => void
}

export function AttachmentPreviewModal({ preview, onClose }: AttachmentPreviewModalProps) {
  if (preview?.tipo === "pdf") {
    return (
      <PdfViewerModal
        open
        onClose={onClose}
        url={preview.src}
        fileName={preview.nombre}
        allowOpenExternal={false}
      />
    )
  }

  return (
    <Dialog open={preview?.tipo === "imagen"} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-4">
        <DialogHeader>
          <DialogTitle className="text-sm truncate">
            {preview?.tipo === "imagen" ? preview.nombre : "Comprobante"}
          </DialogTitle>
        </DialogHeader>
        {preview?.tipo === "imagen" && (
          <div className="flex items-center justify-center">
            <img
              src={preview.src}
              alt={preview.nombre}
              className="max-w-full max-h-[70vh] rounded-lg object-contain"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Fallback para tipos no permitidos (sin enlace, sin descarga automatica)
// ============================================
export function AttachmentUnavailableNotice() {
  return (
    <p className="text-[11px] italic flex items-center gap-1">
      <Paperclip className="h-3 w-3" />
      Adjunto no disponible para vista previa.
    </p>
  )
}
