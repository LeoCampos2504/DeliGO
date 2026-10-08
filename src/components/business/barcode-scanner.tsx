"use client"

// ============================================
// F9 — shared barcode scanner (Caja continuous / Inventario single-read)
// ============================================
// ONE camera component, two modes:
//   - "continuous" (Caja): the camera stays open; every accepted read calls
//     onCode and shows the returned feedback; the parent owns the cart.
//   - "single" (Inventario): the first accepted read calls onCode and the
//     parent closes the scanner (filling only the field it was opened from).
// Detection runs locally (native BarcodeDetector or the self-hosted
// WebAssembly ponyfill, see src/lib/barcode-detector-loader.ts); no image or
// video ever leaves the device. Every analyzed frame — with or without a
// decoded code — goes through the scan lock (src/lib/scan-lock.ts), which is
// what prevents a product held in front of the camera from adding units.
// Camera lifecycle: every start bumps a session counter; anything async that
// resolves for an older session stops its own stream immediately, so closing
// while the permission prompt is open, reopening, or backgrounding the app
// never leaves a camera track, timer or detection loop behind.

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { CameraOff, Flashlight, FlashlightOff, Keyboard, Loader2, ScanBarcode, Volume2, VolumeX, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { barcodeLookupKey, isPlausibleCameraRead } from "@/lib/barcode"
import { createScanLock } from "@/lib/scan-lock"
import { loadBarcodeDetector, type BarcodeDetectorLike } from "@/lib/barcode-detector-loader"
import { playScanFeedback, primeScanAudio, readScanSoundPreference, writeScanSoundPreference, type ScanFeedbackTone } from "@/lib/scan-feedback"

export interface ScanFeedback {
  tone: ScanFeedbackTone
  title: string
  detail?: string
}

export type ScanSource = "camera" | "manual"

type CameraState = "starting" | "running" | "denied" | "unavailable" | "error" | "suspended"

/** Pause between two analyzed frames (detection time is added on top). */
const SCAN_INTERVAL_MS = 90
/** Longest side of the frame handed to the detector. */
const MAX_ANALYSIS_WIDTH = 960

interface BarcodeScannerProps {
  mode: "single" | "continuous"
  title: string
  onClose: () => void
  /** Continuous: return the feedback to show. Single: the parent stores the value and closes. */
  onCode: (code: string, source: ScanSource) => ScanFeedback | void | Promise<ScanFeedback | void>
  /** Parent-driven pause (variant selector / ambiguity chooser open): nothing is accepted meanwhile. */
  paused?: boolean
  /** Continuous mode footer (cart counter, total, "Ver carrito"). */
  footer?: ReactNode
  /** Feedback produced outside onCode (e.g. after picking a variant); shown when its id changes. */
  announcement?: (ScanFeedback & { id: number }) | null
}

export function BarcodeScanner({ mode, title, onClose, onCode, paused = false, footer, announcement }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const sessionRef = useRef(0)
  const lockRef = useRef(createScanLock())
  const busyRef = useRef(false)
  const doneRef = useRef(false)
  const pausedRef = useRef(paused)
  const onCodeRef = useRef(onCode)
  const soundRef = useRef(true)
  const feedbackSeq = useRef(0)

  const [cameraState, setCameraState] = useState<CameraState>("starting")
  const [cameraMessage, setCameraMessage] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<(ScanFeedback & { id: number }) | null>(null)
  const [soundOn, setSoundOn] = useState(true)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualValue, setManualValue] = useState("")
  const [processing, setProcessing] = useState(false)
  const [finePointer, setFinePointer] = useState(false)

  const cameraStateRef = useRef<CameraState>("starting")
  useEffect(() => {
    cameraStateRef.current = cameraState
  }, [cameraState])
  useEffect(() => {
    onCodeRef.current = onCode
  }, [onCode])
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    const enabled = readScanSoundPreference()
    soundRef.current = enabled
    setSoundOn(enabled)
    // Desktop with a USB/Bluetooth "keyboard" reader: keep the manual field
    // open and focused. On touch phones it stays collapsed (no keyboard pop-up).
    const fine = typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches === true
    setFinePointer(fine)
    if (fine) setManualOpen(true)
  }, [])

  const stopCamera = useCallback(() => {
    sessionRef.current += 1
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
    }
    setTorchAvailable(false)
    setTorchOn(false)
  }, [])

  const showFeedback = useCallback((result: ScanFeedback) => {
    feedbackSeq.current += 1
    setFeedback({ ...result, id: feedbackSeq.current })
    playScanFeedback(result.tone, soundRef.current)
  }, [])

  const lastAnnouncementId = useRef<number | null>(announcement?.id ?? null)
  useEffect(() => {
    if (!announcement || announcement.id === lastAnnouncementId.current) return
    lastAnnouncementId.current = announcement.id
    showFeedback(announcement)
  }, [announcement, showFeedback])

  const handleCode = useCallback(
    async (raw: string, source: ScanSource) => {
      const code = raw.trim()
      if (!code || busyRef.current || doneRef.current) return
      busyRef.current = true
      setProcessing(true)
      try {
        if (mode === "single") doneRef.current = true
        const result = await onCodeRef.current(code, source)
        if (mode === "single") playScanFeedback("success", soundRef.current)
        else if (result) showFeedback(result)
      } catch {
        if (mode === "single") doneRef.current = false
        showFeedback({ tone: "error", title: "No se pudo procesar el código", detail: "Intentá nuevamente." })
      } finally {
        busyRef.current = false
        setProcessing(false)
      }
    },
    [mode, showFeedback]
  )

  const runLoop = useCallback(
    (session: number, detector: BarcodeDetectorLike) => {
      const tick = async () => {
        if (session !== sessionRef.current) return
        const video = videoRef.current
        const keys: string[] = []
        const rawByKey = new Map<string, string>()
        if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          // Full width, central band (where the on-screen guide is), downscaled.
          const vw = video.videoWidth
          const vh = video.videoHeight
          const sh = Math.min(vh, Math.round(vw * 0.8))
          const sy = Math.round((vh - sh) / 2)
          const scale = Math.min(1, MAX_ANALYSIS_WIDTH / vw)
          const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"))
          canvas.width = Math.round(vw * scale)
          canvas.height = Math.round(sh * scale)
          const ctx = canvas.getContext("2d", { willReadFrequently: true })
          if (ctx) {
            ctx.drawImage(video, 0, sy, vw, sh, 0, 0, canvas.width, canvas.height)
            try {
              const results = await detector.detect(canvas)
              for (const result of results) {
                const value = result.rawValue?.trim() ?? ""
                if (!isPlausibleCameraRead(value, result.format)) continue
                const key = barcodeLookupKey(value)
                if (key && !rawByKey.has(key)) {
                  rawByKey.set(key, value)
                  keys.push(key)
                }
              }
            } catch {
              // a failed frame counts as "nothing seen"
            }
          }
        }
        if (session !== sessionRef.current) return
        const acceptNew = !busyRef.current && !pausedRef.current && !doneRef.current
        const accepted = lockRef.current.observe(keys, performance.now(), { acceptNew })
        if (accepted) void handleCode(rawByKey.get(accepted) ?? accepted, "camera")
        timerRef.current = window.setTimeout(tick, SCAN_INTERVAL_MS)
      }
      void tick()
    },
    [handleCode]
  )

  const startCamera = useCallback(async () => {
    stopCamera()
    const session = sessionRef.current
    setCameraState("starting")
    setCameraMessage(null)
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable")
      setCameraMessage("Este navegador no permite usar la cámara aquí. Ingresá el código manualmente.")
      setManualOpen(true)
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
    } catch (error) {
      const name = (error as { name?: string })?.name
      if (name === "OverconstrainedError" || name === "NotFoundError") {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true })
        } catch {
          if (session !== sessionRef.current) return
          setCameraState("unavailable")
          setCameraMessage("No encontramos una cámara disponible. Ingresá el código manualmente.")
          setManualOpen(true)
          return
        }
      } else {
        if (session !== sessionRef.current) return
        const denied = name === "NotAllowedError" || name === "SecurityError"
        setCameraState(denied ? "denied" : "error")
        setCameraMessage(
          denied
            ? "Permiso de cámara denegado. Habilitalo en los ajustes del navegador o ingresá el código manualmente."
            : "No se pudo abrir la cámara. Ingresá el código manualmente o reintentá."
        )
        setManualOpen(true)
        return
      }
    }
    if (session !== sessionRef.current) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    streamRef.current = stream
    const video = videoRef.current
    if (video) {
      video.srcObject = stream
      video.muted = true
      video.setAttribute("playsinline", "true")
      await video.play().catch(() => undefined)
    }
    const track = stream.getVideoTracks()[0]
    const capabilities = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
    setTorchAvailable(capabilities.torch === true)

    let detector: BarcodeDetectorLike
    try {
      detector = (await loadBarcodeDetector()).detector
    } catch {
      if (session !== sessionRef.current) return
      stopCamera()
      setCameraState("error")
      setCameraMessage("No se pudo iniciar el lector de códigos. Ingresá el código manualmente o reintentá.")
      setManualOpen(true)
      return
    }
    if (session !== sessionRef.current) return
    setCameraState("running")
    runLoop(session, detector)
  }, [runLoop, stopCamera])

  // Open on mount, release everything on unmount.
  useEffect(() => {
    void startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  // Background / tab switch: release the camera; resume when visible again.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (streamRef.current) {
          stopCamera()
          setCameraState("suspended")
        }
      } else if (cameraStateRef.current === "suspended") {
        void startCamera()
      }
    }
    const onPageHide = () => stopCamera()
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [startCamera, stopCamera])

  // Escape closes (unless a chooser on top owns the keyboard); lock page scroll.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pausedRef.current) onClose()
    }
    document.addEventListener("keydown", onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorchOn(next)
    } catch {
      setTorchAvailable(false)
    }
  }

  function toggleSound() {
    primeScanAudio()
    const next = !soundRef.current
    soundRef.current = next
    setSoundOn(next)
    writeScanSoundPreference(next)
  }

  function submitManual(event: FormEvent) {
    event.preventDefault()
    const value = manualValue.trim()
    if (!value || busyRef.current) return
    // The camera must not re-add the same physical code if it is also in view.
    const key = barcodeLookupKey(value)
    if (key) lockRef.current.lock(key, performance.now())
    setManualValue("")
    void handleCode(value, "manual")
  }

  if (typeof document === "undefined") return null

  const toneClasses: Record<ScanFeedbackTone, string> = {
    success: "bg-emerald-600 text-white",
    warning: "bg-amber-500 text-black",
    error: "bg-red-600 text-white",
    info: "bg-slate-800 text-white",
  }

  const cameraBlocked = cameraState === "denied" || cameraState === "unavailable" || cameraState === "error"

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-deligo-barcode-scanner=""
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      // Opened from a modal Radix dialog (Inventario), the body has
      // pointer-events:none — the scanner re-enables them for itself.
      style={{ pointerEvents: "auto" }}
      onPointerDown={primeScanAudio}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] pb-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ScanBarcode className="h-4 w-4" /> {title}
        </p>
        <div className="flex items-center gap-1">
          {mode === "continuous" && (
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/15" onClick={toggleSound} aria-label={soundOn ? "Silenciar sonido" : "Activar sonido"}>
              {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          )}
          {torchAvailable && (
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/15" onClick={toggleTorch} aria-label={torchOn ? "Apagar linterna" : "Encender linterna"}>
              {torchOn ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/15" onClick={onClose} aria-label="Cerrar escáner">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className={cn("absolute inset-0 h-full w-full object-cover", cameraState !== "running" && "opacity-0")} playsInline muted autoPlay />
        {cameraState === "running" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "h-[38%] max-h-56 w-[86%] max-w-md rounded-2xl border-4 transition-colors",
                processing || paused ? "border-amber-400" : "border-white/85"
              )}
            />
          </div>
        )}
        {(cameraState === "starting" || cameraState === "suspended") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" /> Abriendo cámara…
          </div>
        )}
        {cameraBlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <CameraOff className="h-10 w-10 text-white/70" />
            <p className="text-sm text-white/85">{cameraMessage}</p>
            {cameraState !== "unavailable" && (
              <Button type="button" variant="secondary" className="rounded-xl" onClick={() => void startCamera()}>
                Reintentar cámara
              </Button>
            )}
          </div>
        )}
        {cameraState === "running" && (
          <p className="pointer-events-none absolute left-0 right-0 top-3 text-center text-xs text-white/85 drop-shadow">
            {mode === "continuous" ? "Acercá el código de barras al recuadro" : "Apuntá al código de barras del producto"}
          </p>
        )}
        {feedback && (
          <div key={feedback.id} className={cn("absolute left-3 right-3 bottom-3 rounded-2xl px-4 py-3 shadow-xl animate-in fade-in-0 zoom-in-95", toneClasses[feedback.tone])} role="status" aria-live="polite">
            <p className="text-sm font-bold">{feedback.title}</p>
            {feedback.detail && <p className="text-xs opacity-90 mt-0.5">{feedback.detail}</p>}
          </div>
        )}
      </div>

      <div className="space-y-2 bg-black px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
        {mode === "single" ? (
          // Single-read always lives next to an editable field: typing goes there.
          <p className="text-xs text-white/70">¿No se puede leer? Cerrá el escáner y escribí el código en el campo.</p>
        ) : manualOpen ? (
          <form onSubmit={submitManual} className="flex gap-2">
            <Input
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Código de barras"
              inputMode="text"
              autoComplete="off"
              autoFocus={finePointer || cameraBlocked}
              aria-label="Código de barras manual"
              className="rounded-xl bg-white text-black"
            />
            <Button type="submit" className="rounded-xl" disabled={!manualValue.trim() || processing}>
              {mode === "continuous" ? "Agregar" : "Usar"}
            </Button>
          </form>
        ) : (
          <button type="button" onClick={() => setManualOpen(true)} className="flex items-center gap-1.5 text-xs text-white/75 underline-offset-2 hover:underline">
            <Keyboard className="h-3.5 w-3.5" /> Ingresar código manualmente
          </button>
        )}
        {footer}
      </div>
    </div>,
    document.body
  )
}

/** True while any BarcodeScanner is mounted (it lives in its own portal). */
export function isBarcodeScannerOpen(): boolean {
  return typeof document !== "undefined" && document.querySelector("[data-deligo-barcode-scanner]") !== null
}

/**
 * For a Radix Dialog that hosts a BarcodeField: the scanner is portaled
 * outside the dialog, so taps on it would count as "outside" and close the
 * form (losing what was typed). Pass this to onInteractOutside/onEscapeKeyDown.
 */
export function keepDialogOpenWhileScanning(event: Event): void {
  if (isBarcodeScannerOpen()) event.preventDefault()
}

/**
 * Inventario's barcode input: the existing editable field plus a camera
 * button that opens the shared scanner in single-read mode and fills ONLY
 * this field. Never looks anything up outside the business.
 */
export function BarcodeField({
  id,
  value,
  onChange,
  placeholder,
  warning,
  inputClassName,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  warning?: string | null
  inputClassName?: string
}) {
  const [scanning, setScanning] = useState(false)
  const handleScanned = useCallback(
    (code: string) => {
      onChange(code)
      setScanning(false)
    },
    [onChange]
  )
  const close = useCallback(() => setScanning(false), [])
  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" className={inputClassName} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 rounded-lg"
          aria-label="Escanear código de barras"
          onClick={() => {
            primeScanAudio()
            setScanning(true)
          }}
        >
          <ScanBarcode className="h-4 w-4" />
        </Button>
      </div>
      {warning && <p className="text-[11px] font-medium text-amber-600">{warning}</p>}
      {scanning && <BarcodeScanner mode="single" title="Escanear código de barras" onClose={close} onCode={handleScanned} />}
    </div>
  )
}
