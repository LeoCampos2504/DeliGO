"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Download, Smartphone, ChevronRight, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/shared/logo"

// ============================================
// Types
// ============================================
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type InstallState = "loading" | "promptable" | "installed" | "unsupported"

// ============================================
// Hook: usePWAInstall
// ============================================
export function usePWAInstall() {
  const [installState, setInstallState] = useState<InstallState>("loading")
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)

  // Detect if running as installed PWA
  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://")
      setIsStandalone(standalone)
    }

    checkStandalone()

    // Listen for display mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)")
    const handler = () => checkStandalone()
    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  // Capture beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setInstallState("promptable")
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  // Check if already installed
  useEffect(() => {
    const handler = () => {
      setInstallState("installed")
      deferredPromptRef.current = null
    }

    window.addEventListener("appinstalled", handler)
    return () => window.removeEventListener("appinstalled", handler)
  }, [])

  // On iOS Safari, beforeinstallprompt doesn't fire — we detect iOS + !standalone
  useEffect(() => {
    if (installState !== "loading") return

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

    if (isIOS && isSafari && !isStandalone) {
      // iOS Safari — can show manual instructions (deferred to avoid sync setState in effect)
      const timer = setTimeout(() => setInstallState("promptable"), 0)
      return () => clearTimeout(timer)
    } else if (!isStandalone && !deferredPromptRef.current) {
      // Not standalone and no prompt available yet — give it a moment
      const timer = setTimeout(() => {
        // If we still haven't gotten a prompt event, mark as unsupported
        // but still allow the banner to show with manual instructions
        if (!deferredPromptRef.current) {
          setInstallState("unsupported")
        }
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [installState, isStandalone])

  const triggerInstall = useCallback(async () => {
    if (deferredPromptRef.current) {
      try {
        await deferredPromptRef.current.prompt()
        const result = await deferredPromptRef.current.userChoice
        if (result.outcome === "accepted") {
          setInstallState("installed")
        }
        deferredPromptRef.current = null
      } catch {
        // Prompt was already shown or not available
      }
    }
  }, [])

  return {
    installState,
    isStandalone,
    canInstall: installState === "promptable",
    isInstalled: isStandalone || installState === "installed",
    triggerInstall,
  }
}

// ============================================
// Storage helpers for dismiss state
// ============================================
const DISMISS_KEY = "deligo-install-dismissed"
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

function wasDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    return Date.now() - parseInt(ts, 10) < DISMISS_DURATION
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // ignore
  }
}

// ============================================
// InstallBanner Component
// ============================================
interface InstallBannerProps {
  canInstall: boolean
  isInstalled: boolean
  triggerInstall: () => Promise<void>
  onDismiss: () => void
}

export function InstallBanner({
  canInstall,
  isInstalled,
  triggerInstall,
  onDismiss,
}: InstallBannerProps) {
  const [show, setShow] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  // Show banner after a short delay so it doesn't feel jarring
  useEffect(() => {
    if (isInstalled) return
    if (wasDismissed()) {
      onDismiss()
      return
    }

    const timer = setTimeout(() => setShow(true), 800)
    return () => clearTimeout(timer)
  }, [isInstalled, onDismiss])

  const handleInstall = async () => {
    setIsInstalling(true)
    try {
      await triggerInstall()
    } finally {
      setIsInstalling(false)
    }
  }

  const handleDismiss = () => {
    markDismissed()
    setShow(false)
    onDismiss()
  }

  if (isInstalled || !show) return null

  // Detect iOS for manual instructions
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleDismiss()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full max-w-sm mx-4 mb-4 sm:mb-0 overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-border/50"
          >
            {/* Header gradient */}
            <div className="relative bg-gradient-to-br from-primary via-orange-500 to-amber-500 px-6 pt-6 pb-8 text-white overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10" />
              <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5" />

              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4 text-white" />
              </button>

              <div className="relative flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <Download className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold">Instalá DeliGO</h2>
                  <p className="text-white/80 text-sm">Es gratis y en segundos</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {/* Benefits */}
              <div className="space-y-3 mb-5">
                {[
                  { icon: "⚡", text: "Más rápida, como una app nativa" },
                  { icon: "📱", text: "Accedé directo desde tu inicio" },
                  { icon: "🔔", text: "Recibí notificaciones de tus pedidos" },
                  { icon: "📴", text: "Funciona mejor incluso sin señal" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <span className="text-lg shrink-0">{item.icon}</span>
                    <span className="text-sm text-foreground/80">{item.text}</span>
                  </div>
                ))}
              </div>

              {/* Install button or iOS instructions */}
              {canInstall ? (
                <Button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base gap-2 shadow-lg shadow-primary/25"
                >
                  {isInstalling ? (
                    <>
                      <span className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                      Instalando...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      Instalar ahora
                    </>
                  )}
                </Button>
              ) : isIOS ? (
                /* iOS Safari manual instructions */
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-xl p-4 space-y-2.5">
                    <p className="text-sm font-semibold text-foreground">Seguí estos pasos:</p>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">1</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Tocá el botón <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-muted border border-border"><ShareIcon /></span> compartir de Safari
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-primary">2</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Elegí <strong className="text-foreground">"Agregar a inicio"</strong>
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleDismiss}
                    variant="outline"
                    className="w-full rounded-2xl font-semibold"
                  >
                    Entendido
                  </Button>
                </div>
              ) : (
                /* Non-supported browser */
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-sm text-muted-foreground">
                      Abrí esta página en <strong className="text-foreground">Chrome</strong> o <strong className="text-foreground">Safari</strong> para instalar la app.
                    </p>
                  </div>
                  <Button
                    onClick={handleDismiss}
                    variant="outline"
                    className="w-full rounded-2xl font-semibold"
                  >
                    Entendido
                  </Button>
                </div>
              )}

              {/* Skip link */}
              <button
                onClick={handleDismiss}
                className="w-full mt-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                Continuar en el navegador
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================
// iOS Share icon SVG
// ============================================
function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

// ============================================
// Install header button (shown when banner dismissed)
// ============================================
interface InstallHeaderButtonProps {
  canInstall: boolean
  isInstalled: boolean
  triggerInstall: () => Promise<void>
}

export function InstallHeaderButton({
  canInstall,
  isInstalled,
  triggerInstall,
}: InstallHeaderButtonProps) {
  const [isInstalling, setIsInstalling] = useState(false)

  if (isInstalled) return null

  const handleInstall = async () => {
    setIsInstalling(true)
    try {
      await triggerInstall()
    } finally {
      setIsInstalling(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleInstall}
      disabled={isInstalling || !canInstall}
      className="gap-1.5 rounded-full border-primary/30 text-primary hover:bg-primary/5 font-semibold text-xs h-8 px-3"
    >
      <Download className="h-3.5 w-3.5" />
      {isInstalling ? "..." : "Instalar"}
    </Button>
  )
}
