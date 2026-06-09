"use client"

import { useEffect } from "react"

/**
 * Prevents iOS Safari/PWA viewport scroll drift when the virtual keyboard opens.
 *
 * On iOS PWA, when a text input is focused:
 * 1. The browser scrolls the page to bring the input above the keyboard
 * 2. When the keyboard closes, iOS does NOT scroll back — page stays shifted up
 * 3. `position: fixed` elements appear misplaced because the layout viewport is off
 *
 * This component:
 * 1. Saves the scroll position before the keyboard opens
 * 2. After keyboard closes, restores the scroll position
 * 3. Adds/removes `keyboard-open` class on <body> for CSS-based hiding
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

    // Save scroll position before keyboard animation
    let scrollBeforeKeyboard = 0
    let keyboardIsOpen = false

    const addClass = () => {
      if (!keyboardIsOpen) {
        keyboardIsOpen = true
        document.body.classList.add("keyboard-open")
      }
    }

    const removeClass = () => {
      if (keyboardIsOpen) {
        keyboardIsOpen = false
        document.body.classList.remove("keyboard-open")
      }
    }

    const handleFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) {
        // Save where we are before iOS scrolls us
        scrollBeforeKeyboard = window.scrollY
        addClass()
      }
    }

    const handleFocusOut = () => {
      setTimeout(() => {
        if (!isEditable(document.activeElement)) {
          removeClass()
          // Restore scroll position — iOS leaves the page shifted up
          // Use scrollTo to snap back to where we were before keyboard opened
          window.scrollTo(0, scrollBeforeKeyboard)
        }
      }, 100)
      // Second attempt with longer delay for slow keyboard animations
      setTimeout(() => {
        if (!isEditable(document.activeElement)) {
          removeClass()
          window.scrollTo(0, scrollBeforeKeyboard)
        }
      }, 400)
    }

    const handleViewportResize = () => {
      if (!window.visualViewport) return
      const vv = window.visualViewport
      const viewportIsFull = vv.height >= window.innerHeight - 50

      if (viewportIsFull && keyboardIsOpen && !isEditable(document.activeElement)) {
        removeClass()
        // Viewport is back to full — restore scroll
        window.scrollTo(0, scrollBeforeKeyboard)
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
