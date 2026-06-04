"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, X, Share, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useInstallPrompt } from "@/hooks/use-install-prompt"

export function InstallPrompt() {
  const { isInstallable, isInstalled, promptInstall, shouldShowManualPrompt, platform } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)

  // Don't show if already installed or dismissed
  if (isInstalled || dismissed) return null

  // Show native install prompt (beforeinstallprompt was captured)
  if (isInstallable) {
    return (
      <InstallBanner
        onInstall={handleNativeInstall}
        onDismiss={() => setDismissed(true)}
        installing={installing}
        variant="native"
      />
    )
  }

  // Show manual install instructions for platforms without native prompt
  if (shouldShowManualPrompt) {
    if (platform === "android") {
      return (
        <InstallBanner
          onDismiss={() => setDismissed(true)}
          variant="android-manual"
        />
      )
    }
    if (platform === "ios") {
      return (
        <InstallBanner
          onDismiss={() => setDismissed(true)}
          variant="ios-manual"
        />
      )
    }
  }

  // Nothing to show
  return null

  async function handleNativeInstall() {
    setInstalling(true)
    await promptInstall()
    setInstalling(false)
  }
}

// ============================================
// Unified Install Banner — same look for all variants
// ============================================
function InstallBanner({
  onInstall,
  onDismiss,
  installing = false,
  variant,
}: {
  onInstall?: () => void
  onDismiss: () => void
  installing?: boolean
  variant: "native" | "android-manual" | "ios-manual"
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  // Choose content based on variant
  const content = getBannerContent(variant)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
      >
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 shadow-2xl shadow-orange-500/25">
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex items-center gap-3">
            {/* App icon */}
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <img
                src="/icon-192x192.png"
                alt="DeliGO"
                className="w-8 h-8 rounded-lg"
              />
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-sm">{content.title}</h3>
              <p className="text-white/80 text-xs mt-0.5 leading-relaxed">
                {content.description}
              </p>
            </div>

            {/* Action button */}
            {variant === "native" ? (
              <Button
                onClick={onInstall}
                disabled={installing}
                size="sm"
                className="bg-white text-orange-600 hover:bg-white/90 font-semibold gap-1.5 flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                {installing ? "Instalando..." : "Instalar"}
              </Button>
            ) : (
              <Button
                onClick={onDismiss}
                size="sm"
                className="bg-white text-orange-600 hover:bg-white/90 font-semibold gap-1.5 flex-shrink-0"
              >
                {content.buttonIcon}
                {content.buttonText}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ============================================
// Banner content by variant
// ============================================
function getBannerContent(variant: "native" | "android-manual" | "ios-manual") {
  switch (variant) {
    case "native":
      return {
        title: "Instalar DeliGO",
        description: "Accedé más rápido y recibí notificaciones",
        buttonText: "Instalar",
        buttonIcon: <Download className="w-4 h-4" />,
      }

    case "android-manual": {
      // Detect specific browser for tailored instructions
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
      const isFirefox = /firefox/i.test(ua)
      const isSamsungBrowser = /samsungbrowser/i.test(ua)
      const isOpera = /opr\//i.test(ua)

      let instructions = 'Tocá ⋮ del navegador y seleccioná "Instalar app"'
      if (isFirefox) {
        instructions = 'Tocá ⋮ y seleccioná "Instalar" o "Agregar a inicio"'
      } else if (isSamsungBrowser) {
        instructions = 'Tocá ☰ y seleccioná "Añadir a pantalla de inicio"'
      } else if (isOpera) {
        instructions = 'Tocá ⋮ y seleccioná "Agregar a pantalla de inicio"'
      }

      return {
        title: "Instalar DeliGO",
        description: instructions,
        buttonText: "Entendido",
        buttonIcon: <MoreVertical className="w-4 h-4" />,
      }
    }

    case "ios-manual":
      return {
        title: "Instalar DeliGO",
        description: 'Tocá el botón Compartir ↗ y seleccioná "Agregar a inicio"',
        buttonText: "Entendido",
        buttonIcon: <Share className="w-4 h-4" />,
      }
  }
}
