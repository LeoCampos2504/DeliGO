"use client"

import { useEffect } from "react"

/**
 * IOSKeyboardFix — Global iOS virtual keyboard handler.
 *
 * Detects when the virtual keyboard opens/closes on iOS Safari & PWA,
 * and manages CSS classes + CSS custom properties so that the entire
 * app can react via CSS (no inline style hacks needed in components).
 *
 * What it does:
 * 1. Adds `ios-device` to <html> and <body> on iOS devices
 * 2. Adds `ios-keyboard-open` and `keyboard-open` when keyboard is open
 * 3. Sets CSS custom properties:
 *    --visual-viewport-height  (actual visible height)
 *    --visual-viewport-width   (actual visible width)
 *    --visual-viewport-offset-top
 *    --ios-keyboard-offset     (how much the keyboard takes up)
 * 4. Cleans up everything on unmount
 *
 * Components should use CSS classes driven by `ios-keyboard-open`,
 * NOT their own JS keyboard detection. This is the single source of truth.
 */

const EDITABLE_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [contenteditable="true"], [contenteditable=""]'

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

function isEditableTarget(target: EventTarget | Element | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || Boolean(target.closest(EDITABLE_SELECTOR))
}

export function IOSKeyboardFix() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return
    if (!isIOSDevice()) return

    const root = document.documentElement
    const body = document.body
    const vv = window.visualViewport
    const keyboardThreshold = 80

    let rafId = 0
    let hasEditableFocus = isEditableTarget(document.activeElement)

    const setKeyboardClasses = (isOpen: boolean) => {
      for (const el of [root, body]) {
        el.classList.toggle("ios-device", true)
        el.classList.toggle("ios-keyboard-open", isOpen)
        el.classList.toggle("keyboard-open", isOpen)
      }
    }

    const updateViewportState = () => {
      rafId = 0

      const viewportHeight = vv?.height ?? window.innerHeight
      const viewportWidth = vv?.width ?? window.innerWidth
      const offsetTop = vv?.offsetTop ?? 0
      const heightDiff = Math.max(0, window.innerHeight - viewportHeight)
      const keyboardOffset = Math.max(0, heightDiff - offsetTop)
      const keyboardOpenFromViewport =
        heightDiff > keyboardThreshold || keyboardOffset > keyboardThreshold
      const keyboardOpen = hasEditableFocus || keyboardOpenFromViewport

      root.style.setProperty("--visual-viewport-height", `${viewportHeight}px`)
      root.style.setProperty("--visual-viewport-width", `${viewportWidth}px`)
      root.style.setProperty("--visual-viewport-offset-top", `${offsetTop}px`)
      root.style.setProperty(
        "--ios-keyboard-offset",
        keyboardOpen ? `${keyboardOffset}px` : "0px"
      )

      setKeyboardClasses(keyboardOpen)
    }

    const scheduleUpdate = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(updateViewportState)
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (!isEditableTarget(event.target)) return
      hasEditableFocus = true
      scheduleUpdate()
    }

    const handleFocusOut = () => {
      hasEditableFocus = isEditableTarget(document.activeElement)
      scheduleUpdate()
    }

    const handleViewportChange = () => {
      hasEditableFocus = isEditableTarget(document.activeElement)
      scheduleUpdate()
    }

    // Initial state
    setKeyboardClasses(false)
    updateViewportState()

    // Event listeners
    document.addEventListener("focusin", handleFocusIn)
    document.addEventListener("focusout", handleFocusOut)
    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("orientationchange", handleViewportChange)
    window.addEventListener("pageshow", handleViewportChange)
    vv?.addEventListener("resize", handleViewportChange)
    vv?.addEventListener("scroll", handleViewportChange)

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)

      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("orientationchange", handleViewportChange)
      window.removeEventListener("pageshow", handleViewportChange)
      vv?.removeEventListener("resize", handleViewportChange)
      vv?.removeEventListener("scroll", handleViewportChange)

      for (const el of [root, body]) {
        el.classList.remove("ios-keyboard-open", "keyboard-open", "ios-device")
      }

      root.style.removeProperty("--visual-viewport-height")
      root.style.removeProperty("--visual-viewport-width")
      root.style.removeProperty("--visual-viewport-offset-top")
      root.style.removeProperty("--ios-keyboard-offset")
    }
  }, [])

  return null
}
