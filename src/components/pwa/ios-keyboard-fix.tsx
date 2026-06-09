"use client"

import { useEffect } from "react"

const EDITABLE_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [contenteditable="true"], [contenteditable=""]'

function isIOSDevice() {
  if (typeof navigator === "undefined") return false

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

function isEditableTarget(target: EventTarget | Element | null) {
  if (!(target instanceof HTMLElement)) return false

  return target.isContentEditable || Boolean(target.closest(EDITABLE_SELECTOR))
}

function setClass(element: Element, className: string, enabled: boolean) {
  element.classList.toggle(className, enabled)
}

export function IOSKeyboardFix() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return
    if (!isIOSDevice()) return

    const root = document.documentElement
    const body = document.body
    const visualViewport = window.visualViewport
    const keyboardThreshold = 80

    let rafId = 0
    let hasEditableFocus = isEditableTarget(document.activeElement)

    const setKeyboardClasses = (isOpen: boolean) => {
      for (const element of [root, body]) {
        setClass(element, "ios-device", true)
        setClass(element, "ios-keyboard-open", isOpen)
        setClass(element, "keyboard-open", isOpen)
      }
    }

    const updateViewportState = () => {
      rafId = 0

      const viewportHeight = visualViewport?.height ?? window.innerHeight
      const viewportWidth = visualViewport?.width ?? window.innerWidth
      const offsetTop = visualViewport?.offsetTop ?? 0
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

    const scheduleViewportUpdate = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(updateViewportState)
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (!isEditableTarget(event.target)) return
      hasEditableFocus = true
      scheduleViewportUpdate()
    }

    const handleFocusOut = () => {
      hasEditableFocus = isEditableTarget(document.activeElement)
      scheduleViewportUpdate()
    }

    const handleViewportChange = () => {
      hasEditableFocus = isEditableTarget(document.activeElement)
      scheduleViewportUpdate()
    }

    setKeyboardClasses(false)
    updateViewportState()

    document.addEventListener("focusin", handleFocusIn)
    document.addEventListener("focusout", handleFocusOut)
    window.addEventListener("resize", handleViewportChange)
    window.addEventListener("orientationchange", handleViewportChange)
    window.addEventListener("pageshow", handleViewportChange)
    visualViewport?.addEventListener("resize", handleViewportChange)
    visualViewport?.addEventListener("scroll", handleViewportChange)

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }

      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("orientationchange", handleViewportChange)
      window.removeEventListener("pageshow", handleViewportChange)
      visualViewport?.removeEventListener("resize", handleViewportChange)
      visualViewport?.removeEventListener("scroll", handleViewportChange)

      for (const element of [root, body]) {
        element.classList.remove("ios-keyboard-open", "keyboard-open", "ios-device")
      }

      root.style.removeProperty("--visual-viewport-height")
      root.style.removeProperty("--visual-viewport-width")
      root.style.removeProperty("--visual-viewport-offset-top")
      root.style.removeProperty("--ios-keyboard-offset")
    }
  }, [])

  return null
}
