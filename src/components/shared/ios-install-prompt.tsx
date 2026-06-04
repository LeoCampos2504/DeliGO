"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Share } from "lucide-react"
import { Button } from "@/components/ui/button"

export function IosInstallPrompt() {
  const [dismissed, setDismissed] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Only show on iOS Safari (not standalone, not Chrome on iOS)
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone)

    if (isIos && isSafari && !isStandalone) {
      // Show after a small delay so it doesn't appear immediately on page load
      const timer = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  if (!show || dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
      >
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-2xl border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <img
                src="/icon-192x192.png"
                alt="DeliGO"
                className="w-8 h-8 rounded-lg"
              />
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Instalar DeliGO en tu iPhone
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1 leading-relaxed">
                Tocá el botón <Share className="w-3.5 h-3.5 inline mx-0.5 text-orange-500" /> Compartir
                y seleccioná <strong>&quot;Agregar a inicio&quot;</strong>
              </p>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="text-xs text-zinc-500"
            >
              No, gracias
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
