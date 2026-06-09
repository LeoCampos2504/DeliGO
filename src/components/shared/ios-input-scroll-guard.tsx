"use client"

import { useEffect, useRef } from "react"

const EDITABLE_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [contenteditable="true"]'

function isIOSLike() {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isEditableElement(target: EventTarget | Element | null) {
  return target instanceof Element && Boolean(target.closest(EDITABLE_SELECTOR))
}

export function IOSInputScrollGuard() {
  const focusScrollYRef = useRef(0)
  const hadEditableFocusRef = useRef(false)

  useEffect(() => {
    if (!isIOSLike()) return

    const restoreScroll = () => {
      if (!hadEditableFocusRef.current) return
      if (isEditableElement(document.activeElement)) return

      hadEditableFocusRef.current = false
      document.body.classList.remove("keyboard-open")
      window.scrollTo(0, focusScrollYRef.current)
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (!isEditableElement(event.target)) return
      focusScrollYRef.current = window.scrollY
      hadEditableFocusRef.current = true
      document.body.classList.add("keyboard-open")
    }

    const handleFocusOut = () => {
      window.setTimeout(restoreScroll, 250)
      window.setTimeout(restoreScroll, 550)
    }

    const handleViewportResize = () => {
      if (isEditableElement(document.activeElement)) return
      window.setTimeout(restoreScroll, 120)
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
