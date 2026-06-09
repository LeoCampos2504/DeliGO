"use client"

import { useEffect } from "react"

/**
 * Prevents iOS Safari/PWA viewport scroll drift when the virtual keyboard opens.
 *
 * Adds/removes `keyboard-open` class on <body> for CSS-based hiding of elements
 * with the `.keyboard-hide-when-editing` class.
 *
 * The BottomNav handles its own show/hide via direct DOM manipulation,
 * so this component only manages the body class for OTHER floating elements.
 *
 * Returns null — no UI rendered.
 */
export function IOSInputScrollGuard() {
  useEffect(() => {
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

    const addClass = () => document.body.classList.add("keyboard-open")
    const removeClass = () => document.body.classList.remove("keyboard-open")

    const handleFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) addClass()
    }

    const handleFocusOut = () => {
      setTimeout(() => {
        if (!isEditable(document.activeElement)) removeClass()
      }, 200)
      // Safety: force remove after longer delay
      setTimeout(() => {
        if (!isEditable(document.activeElement)) removeClass()
      }, 600)
    }

    const handleViewportResize = () => {
      if (!window.visualViewport) return
      if (isEditable(document.activeElement)) {
        addClass()
        return
      }
      const vv = window.visualViewport
      if (vv.height >= window.innerHeight - 50) {
        removeClass()
      }
    }

    document.addEventListener("focusin", handleFocusIn)
    document.addEventListener("focusout", handleFocusOut)
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportResize)
    }

    return () => {
      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportResize)
      }
      removeClass()
    }
  }, [])

  return null
}
