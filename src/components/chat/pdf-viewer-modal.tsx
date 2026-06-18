"use client"

import { useState, useCallback } from "react"
import {
  X,
  ZoomIn,
  ZoomOut,
  Loader2,
  FileText,
  RefreshCw,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// ============================================
// Props
// ============================================
interface PdfViewerModalProps {
  open: boolean
  onClose: () => void
  url: string
  fileName?: string
}

// ============================================
// Route Cloudinary PDFs through our server-side proxy
// to avoid CORS and 401 auth issues in the browser.
// The proxy fetches from Cloudinary server-side (no browser
// restrictions) and serves the PDF from our own domain.
// ============================================
function getProxiedUrl(url: string): string {
  if (!url) return ""
  if (url.includes("res.cloudinary.com")) {
    return `/api/pdf-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}

// ============================================
// PdfViewerModal Component
// Uses an iframe to display the PDF natively.
// ============================================
export function PdfViewerModal({
  open,
  onClose,
  url,
  fileName,
}: PdfViewerModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)

  const iframeSrc = getProxiedUrl(url)

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false)
    setHasError(false)
  }, [])

  const handleIframeError = useCallback(() => {
    setIsLoading(false)
    setHasError(true)
  }, [])

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 25, 200))
  }, [])

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 25, 50))
  }, [])

  const handleRetry = useCallback(() => {
    setIsLoading(true)
    setHasError(false)
  }, [])

  const handleOpenExternal = useCallback(() => {
    if (url) window.open(url, "_blank")
  }, [url])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        {/* Left: file info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-sm text-white truncate">
            {fileName || "Documento PDF"}
          </span>
        </div>

        {/* Center: zoom */}
        <div className="flex items-center gap-1 shrink-0 mx-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-700"
            onClick={zoomOut}
            disabled={zoomLevel <= 50}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-zinc-400 tabular-nums min-w-[40px] text-center">
            {zoomLevel}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-700"
            onClick={zoomIn}
            disabled={zoomLevel >= 200}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Right: actions + close */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-700"
            onClick={handleOpenExternal}
            title="Abrir en nueva pestaña"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-zinc-700 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-700"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF content area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Loading indicator */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-400">Cargando PDF...</p>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400 z-20 bg-black/80">
            <FileText className="h-12 w-12 text-zinc-600" />
            <p className="text-sm">No se pudo cargar el PDF</p>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-zinc-300 border-zinc-600 hover:bg-zinc-800"
                onClick={handleRetry}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Reintentar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-zinc-300 border-zinc-600 hover:bg-zinc-800"
                onClick={handleOpenExternal}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir externo
              </Button>
            </div>
          </div>
        )}

        {/* iframe — loads from our proxy (same-origin), browser's built-in PDF viewer renders it */}
        <iframe
          key={iframeSrc}
          src={iframeSrc}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          className="w-full h-full border-0"
          style={{
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: "top left",
            width: `${10000 / zoomLevel}%`,
            height: `${10000 / zoomLevel}%`,
          }}
          title={fileName || "Visor PDF"}
        />
      </div>
    </div>
  )
}
