"use client"

import { useEffect } from "react"

/**
 * Prevents iOS Safari viewport scroll drift when the virtual keyboard opens.
 *
 * On iOS, when a text input is focused and the virtual keyboard appears,
 * `position: fixed` elements can drift or float because Safari adjusts the
 * visual viewport but not the layout viewport consistently.
 *
 * This component:
 * 1. Detects iOS via user agent
 * 2. Listens for focusin/focusout on editable elements
 * 3. Adds/removes a `keyboard-open` class on <body>
 * 4. CSS rules using `.keyboard-open` can then hide/reposition elements
 *
 * Returns null — no UI rendered.
 */
export function IOSInputScrollGuard() {
  useEffect(() => {
    // Only run on iOS-like devices
    if (typeof navigator === "undefined") return
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    if (!isIOS) return

    const editableSelector =
      'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [contenteditable="true"]'

    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      return Boolean(target.closest(editableSelector))
    }

    const handleFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) {
        document.body.classList.add("keyboard-open")
      }
    }

    const handleFocusOut = () => {
      // Delay to handle rapid focus switches between inputs
      setTimeout(() => {
        if (!isEditable(document.activeElement)) {
          document.body.classList.remove("keyboard-open")
        }
      }, 150)
    }

    // Also listen for visualViewport resize as a fallback signal
    const handleViewportResize = () => {
      if (!window.visualViewport) return
      const viewport = window.visualViewport
      // If viewport height is significantly less than window height, keyboard is likely open
      if (viewport.height < window.innerHeight - 100) {
        document.body.classList.add("keyboard-open")
      }
    }

    document.addEventListener("focusin", handleFocusIn)
    document.addEventListener("focusout", handleFocusOut)
    window.visualViewport?.addEventListener("resize", handleViewportResize)

    return () => {
      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
      window.visualViewport?.removeEventListener("resize", handleViewportResize)
      document.body.classList.remove("keyboard-open")
    }
  }, [])

  return null
}
