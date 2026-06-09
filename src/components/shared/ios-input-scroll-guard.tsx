"use client"

import { useEffect } from "react"

/**
 * Prevents iOS Safari/PWA viewport scroll drift when the virtual keyboard opens.
 *
 * On iOS PWA, when a text input is focused:
 * 1. The browser scrolls the page to bring the input above the keyboard
 * 2. `position: fixed` elements can detach and scroll with the content
 * 3. The page content shifts upward unpredictably
 *
 * This component:
 * 1. Detects iOS via user agent
 * 2. Listens for visualViewport changes (most reliable keyboard detection on iOS)
 * 3. Adds/removes a `keyboard-open` class on <body>
 * 4. CSS rules using `.keyboard-open` can hide/reposition elements
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

    // Track the scroll position before keyboard opens so we can restore it
    let scrollBeforeKeyboard = 0

    const handleViewportResize = () => {
      if (!window.visualViewport) return
      if (isEditable(document.activeElement)) {
        document.body.classList.add("keyboard-open")
        return
      }

      const vv = window.visualViewport
      const keyboardOpen = vv.height < window.innerHeight - 50

      if (keyboardOpen) {
        document.body.classList.add("keyboard-open")
      } else {
        document.body.classList.remove("keyboard-open")
      }
    }

    const handleFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) {
        // Record scroll position before keyboard animation starts
        scrollBeforeKeyboard = window.scrollY
        document.body.classList.add("keyboard-open")
      }
    }

    const handleFocusOut = () => {
      setTimeout(() => {
        if (!isEditable(document.activeElement)) {
          document.body.classList.remove("keyboard-open")
          window.scrollTo(0, scrollBeforeKeyboard)
        }
      }, 150)
      setTimeout(() => {
        if (!isEditable(document.activeElement)) {
          window.scrollTo(0, scrollBeforeKeyboard)
        }
      }, 450)
    }

    // visualViewport is the most reliable way to detect keyboard on iOS
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportResize)
      window.visualViewport.addEventListener("scroll", handleViewportResize)
    }

    document.addEventListener("focusin", handleFocusIn)
    document.addEventListener("focusout", handleFocusOut)

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportResize)
        window.visualViewport.removeEventListener("scroll", handleViewportResize)
      }
      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
      document.body.classList.remove("keyboard-open")
    }
  }, [])

  return null
}
