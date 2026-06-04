"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import { Html5Qrcode } from "html5-qrcode"
import {
  QrCode,
  Camera,
  X,
  ArrowRight,
  UserCheck,
  Armchair,
  Loader2,
  Keyboard,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface NegocioInfo {
  id: string
  nombre: string
  colorPrincipal: string
  logoUrl: string | null
  slug: string
}

interface MozoInfo {
  id: string
  nombre: string
  codigo: string
}

// ============================================
// Main Page (with Suspense wrapper for useSearchParams)
// ============================================
export default function MozoScannerPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MozoScannerContent params={params} />
    </Suspense>
  )
}

function MozoScannerContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  const mozoCodigo = searchParams.get("mozo")

  // Fetch negocio info
  const { data: negocio, isLoading: negocioLoading, error: negocioError } = useQuery<NegocioInfo>({
    queryKey: ["negocio-scan", slug],
    queryFn: async () => {
      const res = await fetch(`/api/negocios/${slug}`)
      if (!res.ok) throw new Error("Negocio no encontrado")
      const data = await res.json()
      return {
        id: data.id,
        nombre: data.nombre,
        colorPrincipal: data.colorPrincipal || "#6366f1",
        logoUrl: data.logoUrl,
        slug: data.slug,
      }
    },
    enabled: !!slug,
  })

  // Fetch mozo info
  const { data: mozo, isLoading: mozoLoading } = useQuery<MozoInfo>({
    queryKey: ["mozo-scan", mozoCodigo, negocio?.id],
    queryFn: async () => {
      if (!mozoCodigo || !negocio?.id) return null
      const res = await fetch(`/api/empleados/by-codigo?codigo=${mozoCodigo}&negocioId=${negocio.id}`)
      if (!res.ok) return null
      return res.json() as Promise<MozoInfo>
    },
    enabled: !!mozoCodigo && !!negocio?.id,
  })

  // Scanner state
  const [scanning, setScanning] = useState(false)
  const [manualMesa, setManualMesa] = useState("")
  const [scanSuccess, setScanSuccess] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const SCANNER_ELEMENT_ID = "mozo-qr-reader"

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current.clear()
        scannerRef.current = null
      }
    }
  }, [])

  // Start scanning
  const startScan = useCallback(async () => {
    setScanning(true)
    setScanSuccess(false)

    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID)
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Success — extract mesa number from QR
          try {
            const url = new URL(decodedText)
            const mesaNum = url.searchParams.get("mesa")
            if (mesaNum) {
              // Stop scanner and redirect
              scanner.stop().catch(() => {})
              setScanSuccess(true)
              // Haptic-like feedback
              if (navigator.vibrate) navigator.vibrate(100)
              toast.success(`Mesa ${mesaNum} detectada!`)
              setTimeout(() => {
                router.push(`/n/${slug}?mesa=${mesaNum}&mozo=${mozoCodigo}`)
              }, 800)
            } else {
              toast.error("El QR no contiene un número de mesa válido")
            }
          } catch {
            // Not a URL — maybe it's just a number?
            const parsed = parseInt(decodedText, 10)
            if (!isNaN(parsed) && parsed > 0) {
              scanner.stop().catch(() => {})
              setScanSuccess(true)
              if (navigator.vibrate) navigator.vibrate(100)
              toast.success(`Mesa ${parsed} detectada!`)
              setTimeout(() => {
                router.push(`/n/${slug}?mesa=${parsed}&mozo=${mozoCodigo}`)
              }, 800)
            } else {
              toast.error("QR no reconocido. Escaneá el código de la mesa.")
            }
          }
        },
        () => {} // Ignore scan failures (called frequently)
      )
    } catch (err) {
      console.error("Error starting scanner:", err)
      toast.error("No se pudo acceder a la cámara. Verificá los permisos.")
      setScanning(false)
    }
  }, [slug, mozoCodigo, router])

  // Stop scanning
  const stopScan = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch {
        // ignore
      }
      scannerRef.current.clear()
      scannerRef.current = null
    }
    setScanning(false)
  }, [])

  // Manual mesa entry
  const handleManualSubmit = () => {
    const num = parseInt(manualMesa, 10)
    if (isNaN(num) || num < 1) {
      toast.error("Ingresá un número de mesa válido")
      return
    }
    if (navigator.vibrate) navigator.vibrate(50)
    router.push(`/n/${slug}?mesa=${num}&mozo=${mozoCodigo}`)
  }

  // Loading state
  if (negocioLoading || mozoLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  // Error state
  if (negocioError || !negocio) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <h2 className="font-bold text-lg text-center">No encontramos este local</h2>
        <p className="text-sm text-muted-foreground text-center">
          Puede que el link sea incorrecto o el negocio no esté disponible.
        </p>
      </div>
    )
  }

  // No mozo code
  if (!mozoCodigo) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
        <AlertCircle className="h-10 w-10 text-amber-400" />
        <h2 className="font-bold text-lg text-center">Link incompleto</h2>
        <p className="text-sm text-muted-foreground text-center">
          Falta el código de mozo en el link. Contactá al administrador del local.
        </p>
      </div>
    )
  }

  const color = negocio.colorPrincipal

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ===== HEADER ===== */}
      <div
        className="relative px-4 pt-12 pb-6 text-white"
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}dd)`,
        }}
      >
        {/* Logo + negocio info */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl border-2 border-white/30 shadow-lg overflow-hidden shrink-0 flex items-center justify-center"
            style={{ backgroundColor: negocio.logoUrl ? undefined : `${color}40` }}
          >
            {negocio.logoUrl ? (
              <img
                src={negocio.logoUrl}
                alt={`Logo de ${negocio.nombre}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xl font-extrabold text-white">
                {negocio.nombre.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-extrabold text-lg truncate">{negocio.nombre}</h1>
            {mozo ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <UserCheck className="h-3.5 w-3.5 text-white/80" />
                <span className="text-sm text-white/90 font-semibold">{mozo.nombre}</span>
                <span className="text-xs text-white/60 font-mono">({mozo.codigo})</span>
              </div>
            ) : (
              <span className="text-sm text-white/60">Código: {mozoCodigo}</span>
            )}
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
        {/* Success state */}
        {scanSuccess ? (
          <motionSuccess color={color} />
        ) : !scanning ? (
          <>
            {/* Scan button */}
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl cursor-pointer transition-transform active:scale-95 hover:scale-[1.02]"
                style={{
                  background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                  boxShadow: `0 12px 40px ${color}40`,
                }}
                onClick={startScan}
              >
                <Camera className="h-12 w-12 text-white" />
              </div>
              <div className="text-center">
                <h2 className="font-bold text-xl mb-1">Escanear QR de mesa</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Escaneá el código QR de la mesa para tomar el pedido
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 w-full max-w-xs">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground font-semibold">o ingresá manualmente</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Manual entry */}
            <div className="w-full max-w-xs space-y-3">
              <div className="relative">
                <Armchair className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={1}
                  placeholder="Número de mesa"
                  value={manualMesa}
                  onChange={(e) => setManualMesa(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                  className="pl-10 h-12 rounded-xl text-center text-lg font-bold"
                  style={{ borderColor: manualMesa ? `${color}50` : undefined }}
                />
              </div>
              <Button
                className="w-full h-12 rounded-xl font-bold gap-2 text-base"
                style={{ backgroundColor: color }}
                onClick={handleManualSubmit}
                disabled={!manualMesa.trim()}
              >
                <Keyboard className="h-4 w-4" />
                Ir a la mesa
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : null}

        {/* ===== SCANNER VIEW ===== */}
        {scanning && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Scanner header */}
            <div
              className="flex items-center justify-between px-4 py-3 text-white"
              style={{ backgroundColor: color }}
            >
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                <span className="font-bold text-sm">Escaneá el QR de la mesa</span>
              </div>
              <button
                onClick={stopScan}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scanner body */}
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <div
                id={SCANNER_ELEMENT_ID}
                className="w-full max-w-md"
              />

              {/* Scanning overlay instructions */}
              <div className="absolute bottom-8 left-0 right-0 text-center px-6">
                <p className="text-white/80 text-sm font-medium">
                  Apuntá la cámara al código QR de la mesa
                </p>
              </div>
            </div>

            {/* Manual fallback in scanner */}
            <div className="p-4 bg-black/80 border-t border-white/10">
              <div className="flex gap-2 max-w-md mx-auto">
                <Input
                  type="number"
                  min={1}
                  placeholder="Nro. de mesa"
                  value={manualMesa}
                  onChange={(e) => setManualMesa(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      stopScan()
                      handleManualSubmit()
                    }
                  }}
                  className="flex-1 h-10 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40 text-center font-bold"
                />
                <Button
                  className="h-10 rounded-xl font-bold gap-1.5 px-4"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    stopScan()
                    handleManualSubmit()
                  }}
                  disabled={!manualMesa.trim()}
                >
                  Ir
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Simple success animation component
function motionSuccess({ color }: { color: string }) {
  return (
    <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-500">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <CheckCircle2 className="h-10 w-10" style={{ color }} />
      </div>
      <h2 className="font-bold text-lg">Mesa detectada!</h2>
      <p className="text-sm text-muted-foreground">Redirigiendo al menú...</p>
    </div>
  )
}
