"use client"

import { useEffect } from "react"
import { decideScrollRestore, resolveCycleStart } from "@/lib/ios-scroll-restore-decision"

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
 * 4. IOS-24-POSITION-FIX: restores the real `document scroll` position that
 *    iOS itself displaces to bring a focused input into view. Real-device
 *    diagnostics (IOS-24-RUNTIME-DIAGNOSTIC) confirmed visualViewport.height/
 *    offsetTop already self-correct when the keyboard closes, but
 *    `window.scrollY` does not — it stays at the position iOS scrolled to.
 *    See src/lib/ios-scroll-restore-decision.ts for the pure decision logic
 *    (unit tested) — this effect is only the impure DOM/event shell around it.
 * 5. Cleans up everything on unmount
 *
 * Components should use CSS classes driven by `ios-keyboard-open`,
 * NOT their own JS keyboard detection. This is the single source of truth.
 */

// IOS-STANDALONE-REAL-DEVICE-FIX-R3 §18: read-only diagnostic snapshot of
// the last restore decision, for the TEMPORARY iosDebug panel only — never
// read by any application code, never changes control flow or timing of
// the restore logic itself (see the single write site below, right after
// decideScrollRestore already runs). Declared here (the writer) rather
// than imported from the diagnostic library, so this file's only import
// stays ios-scroll-restore-decision — the diagnostic panel defines its own
// matching shape defensively when it reads window.__iosScrollRestoreDebug.
declare global {
  interface Window {
    __iosScrollRestoreDebug?: {
      preFocusScrollY: number | null
      currentScrollYAtDecision: number
      shouldRestore: boolean
      restoreReason: string | null
      restoreTargetScrollY: number | null
      decidedAt: number
    }
  }
}

const EDITABLE_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [contenteditable="true"], [contenteditable=""]'

// IOS-24-POSITION-FIX tuning constants — documented, not magic numbers.
const RESTORE_TOLERANCE_PX = 2 // ignore differences this small — nothing to fix
const TOUCH_MOVE_THRESHOLD_PX = 10 // below this, a touchstart+touchmove is just tapping the input, not scrolling
const STABLE_FRAMES_REQUIRED = 6 // consecutive rAF frames with no material viewport change before we call it "settled"
const STABLE_TOLERANCE_PX = 1
const STABLE_MAX_FRAMES = 180 // ~3s at 60fps hard safety cap — never loops forever
const RESTORE_MAX_RETRIES = 1 // at most one bounded follow-up scrollTo if WebKit re-adjusts a frame later

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
    let lastKeyboardOpen = false

    // IOS-24-POSITION-FIX cycle state — a "keyboard cycle" runs from the
    // first editable focus until the keyboard is confirmed closed and the
    // viewport has settled (or the user scrolled intentionally, in which
    // case we never restore).
    let keyboardCycleActive = false
    let preFocusScrollY: number | null = null
    let userScrolledDuringCycle = false
    let touchStartY: number | null = null
    let stabilizeRafId = 0

    const setKeyboardClasses = (isOpen: boolean) => {
      for (const el of [root, body]) {
        el.classList.toggle("ios-device", true)
        el.classList.toggle("ios-keyboard-open", isOpen)
        el.classList.toggle("keyboard-open", isOpen)
      }
    }

    const resetCycle = () => {
      keyboardCycleActive = false
      preFocusScrollY = null
      userScrolledDuringCycle = false
      touchStartY = null
    }

    const performRestore = (target: number) => {
      const attempt = (retriesLeft: number) => {
        if (Math.abs(window.scrollY - target) <= RESTORE_TOLERANCE_PX) return
        window.scrollTo({ top: target, left: window.scrollX, behavior: "auto" })
        if (retriesLeft > 0) {
          window.requestAnimationFrame(() => attempt(retriesLeft - 1))
        }
      }
      attempt(RESTORE_MAX_RETRIES)
    }

    // Waits for visualViewport.height/offsetTop and window.innerHeight to
    // stop changing (STABLE_FRAMES_REQUIRED consecutive frames within
    // STABLE_TOLERANCE_PX) before deciding whether to restore scroll —
    // restoring immediately on focusout would race the native keyboard
    // close animation (confirmed on real device: ~46ms gap between
    // focusout and the visualViewport settling).
    const waitForViewportStableThenMaybeRestore = () => {
      if (stabilizeRafId) window.cancelAnimationFrame(stabilizeRafId)

      const capturedPreFocusScrollY = preFocusScrollY
      const capturedUserScrolled = userScrolledDuringCycle

      let consecutive = 0
      let last: { h: number; o: number; ih: number } | null = null
      let framesChecked = 0

      const tick = () => {
        framesChecked += 1
        const h = vv?.height ?? window.innerHeight
        const o = vv?.offsetTop ?? 0
        const ih = window.innerHeight
        const cur = { h, o, ih }
        if (
          last &&
          Math.abs(cur.h - last.h) <= STABLE_TOLERANCE_PX &&
          Math.abs(cur.o - last.o) <= STABLE_TOLERANCE_PX &&
          Math.abs(cur.ih - last.ih) <= STABLE_TOLERANCE_PX
        ) {
          consecutive += 1
        } else {
          consecutive = 0
        }
        last = cur

        if (consecutive >= STABLE_FRAMES_REQUIRED || framesChecked >= STABLE_MAX_FRAMES) {
          stabilizeRafId = 0

          // Re-evaluate current state now, not the state captured when the
          // wait started — a new focus or user scroll may have happened
          // during the wait.
          const decision = decideScrollRestore({
            preFocusScrollY: capturedPreFocusScrollY,
            currentScrollY: window.scrollY,
            userScrolledDuringCycle: capturedUserScrolled || userScrolledDuringCycle,
            hasEditableFocus,
            keyboardOpen: hasEditableFocus || keyboardOpenFromViewportNow(),
            toleranceRestorePx: RESTORE_TOLERANCE_PX,
          })

          // Diagnostic-only — see the Window.__iosScrollRestoreDebug
          // declaration above. Pure observability, no effect on `decision`
          // or on what happens next.
          window.__iosScrollRestoreDebug = {
            preFocusScrollY: capturedPreFocusScrollY,
            currentScrollYAtDecision: window.scrollY,
            shouldRestore: decision.shouldRestore,
            restoreReason: decision.shouldRestore ? null : decision.reason,
            restoreTargetScrollY: decision.shouldRestore ? decision.target : null,
            decidedAt: Date.now(),
          }

          if (decision.shouldRestore) {
            performRestore(decision.target)
          }
          // If focus moved to a new editable while we were waiting for the
          // viewport to settle, a fresh cycle is already under way (started
          // by handleFocusIn, which preserved this same preFocusScrollY via
          // resolveCycleStart) — resetting now would wipe the state that
          // new cycle still needs when it eventually closes.
          if (!hasEditableFocus) {
            resetCycle()
          }
          return
        }
        stabilizeRafId = window.requestAnimationFrame(tick)
      }
      stabilizeRafId = window.requestAnimationFrame(tick)
    }

    const keyboardOpenFromViewportNow = (): boolean => {
      const viewportHeight = vv?.height ?? window.innerHeight
      const offsetTop = vv?.offsetTop ?? 0
      const heightDiff = Math.max(0, window.innerHeight - viewportHeight)
      const keyboardOffset = Math.max(0, heightDiff - offsetTop)
      return heightDiff > keyboardThreshold || keyboardOffset > keyboardThreshold
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

      // IOS-24-POSITION-FIX: keyboard just transitioned open -> closed
      // while a restore cycle is active. keyboardOpen can only be false
      // here if hasEditableFocus is also false (keyboardOpen = hasEditableFocus
      // || keyboardOpenFromViewport), so this also covers "no editable
      // currently focused" for free.
      if (lastKeyboardOpen && !keyboardOpen && keyboardCycleActive) {
        waitForViewportStableThenMaybeRestore()
      }
      lastKeyboardOpen = keyboardOpen
    }

    const scheduleUpdate = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(updateViewportState)
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (!isEditableTarget(event.target)) return
      hasEditableFocus = true

      // IOS-24-POSITION-FIX: capture (or preserve) preFocusScrollY. Reading
      // window.scrollY synchronously here — before iOS has a chance to
      // auto-scroll the focused input into view — is what makes this the
      // real pre-focus position. An editable-to-editable transition within
      // the same still-open cycle must NOT overwrite it with the
      // already-displaced value (resolveCycleStart handles this).
      const resolved = resolveCycleStart({
        keyboardCycleActive,
        preFocusScrollY,
        currentScrollY: window.scrollY,
      })
      keyboardCycleActive = resolved.keyboardCycleActive
      preFocusScrollY = resolved.preFocusScrollY

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

    // IOS-24-POSITION-FIX: distinguish iOS's own auto-scroll (which also
    // fires `scroll`/visualViewport `scroll` events) from a deliberate user
    // scroll gesture. A bare touchstart is just the tap that focuses the
    // input — only a touchmove past a small threshold counts as intent.
    // Observers only — never preventDefault/stopPropagation.
    const handleTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? null
    }
    const handleTouchMove = (event: TouchEvent) => {
      if (!keyboardCycleActive || userScrolledDuringCycle) return
      const y = event.touches[0]?.clientY
      if (touchStartY !== null && y !== undefined && Math.abs(y - touchStartY) > TOUCH_MOVE_THRESHOLD_PX) {
        userScrolledDuringCycle = true
      }
    }
    const handleWheel = () => {
      if (!keyboardCycleActive) return
      userScrolledDuringCycle = true
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
    document.addEventListener("touchstart", handleTouchStart, { passive: true })
    document.addEventListener("touchmove", handleTouchMove, { passive: true })
    document.addEventListener("wheel", handleWheel, { passive: true })

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      if (stabilizeRafId) window.cancelAnimationFrame(stabilizeRafId)

      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
      window.removeEventListener("resize", handleViewportChange)
      window.removeEventListener("orientationchange", handleViewportChange)
      window.removeEventListener("pageshow", handleViewportChange)
      vv?.removeEventListener("resize", handleViewportChange)
      vv?.removeEventListener("scroll", handleViewportChange)
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("wheel", handleWheel)

      for (const el of [root, body]) {
        el.classList.remove("ios-keyboard-open", "keyboard-open", "ios-device")
      }

      root.style.removeProperty("--visual-viewport-height")
      root.style.removeProperty("--visual-viewport-width")
      root.style.removeProperty("--visual-viewport-offset-top")
      root.style.removeProperty("--ios-keyboard-offset")
      delete window.__iosScrollRestoreDebug
    }
  }, [])

  return null
}
