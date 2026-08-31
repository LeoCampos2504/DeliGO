"use client"

import { useEffect } from "react"
import { decideScrollRestore, resolveCycleStart } from "@/lib/ios-scroll-restore-decision"
import { decideViewportRecovery, VIEWPORT_RECOVERY_HEIGHT_TOLERANCE_PX } from "@/lib/ios-viewport-recovery-decision"

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
    // IOS-STANDALONE-POST-KEYBOARD-VIEWPORT-RECOVERY-R7: opt-in TESTING
    // experiment toggle. Written ONLY by IOSViewportDebugPanel's own toggle
    // button (itself only ever mounted/interactive behind ?iosDebug=1 — see
    // that file), read here on every keyboard-close settle. Never true for
    // a normal user with no query flag; absent entirely (undefined) is the
    // same as explicitly false.
    __iosViewportRecoveryExperiment?: boolean
    // Read-only diagnostic mirror of the last recovery attempt — same
    // pattern as __iosScrollRestoreDebug above: written once per keyboard-
    // close settle, right after the decision is made, never read by any
    // application code, never influences control flow.
    __iosViewportRecoveryDebug?: {
      attempted: boolean
      experimentEnabled: boolean
      isStandalone: boolean
      reason: string | null
      baselineViewportHeight: number | null
      heightBeforeAttempt: number | null
      heightAfterAttempt: number | null
      recovered: boolean | null
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
// IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5: how many animation frames
// to keep re-reading the live visualViewport.offsetTop after any real vv
// event, to catch WebKit's own continuous interpolation between its
// throttled/coalesced event dispatches. ~250ms at 60fps — comfortably
// longer than every real transient episode measured (max 103ms) with
// margin, self-terminating (never an always-on loop).
const DOCK_OFFSET_POLL_FRAMES = 15

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

    // IOS-STANDALONE-POST-KEYBOARD-VIEWPORT-RECOVERY-R7: the real pre-
    // keyboard visualViewport.height, captured once at mount (before any
    // editable focus has ever happened this session) — R6's complete real
    // device JSON proved this is the value visualViewport.height should
    // return to after a keyboard close but, on affected iOS/WebKit builds,
    // never does (stuck at a shorter value for the rest of the session).
    // Only ever used by the opt-in recovery experiment below; the existing
    // certified keyboard-detection/restore logic above never reads it.
    const initialViewportHeight = vv?.height ?? window.innerHeight

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

    // IOS-STANDALONE-POST-KEYBOARD-VIEWPORT-RECOVERY-R7: opt-in TESTING
    // experiment only — see the Window.__iosViewportRecoveryExperiment
    // declaration above. No real device was available to verify this
    // technique (documented independently by multiple sources for this
    // exact WebKit standalone-PWA bug: toggle `display:none` -> restore on
    // the full-viewport-height root, forcing a synchronous reflow with no
    // paint in between, to make WebKit re-measure visualViewport.height)
    // actually recovers the viewport on this codebase's real devices before
    // shipping it — so it is entirely inert unless the operator explicitly
    // arms it via the debug panel toggle, and only ever runs AFTER the
    // existing, already-certified scroll-restore decision above has
    // already completed (see the single call site in
    // waitForViewportStableThenMaybeRestore's tick()) — it can never race
    // or interfere with that logic, and always re-applies the exact scrollY
    // that logic already settled on if the reflow toggle disturbs it.
    const attemptViewportRecovery = () => {
      const experimentEnabled = window.__iosViewportRecoveryExperiment === true
      const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false
      const heightBeforeAttempt = vv?.height ?? window.innerHeight

      const decision = decideViewportRecovery({
        experimentEnabled,
        isStandalone,
        keyboardJustClosed: true,
        baselineViewportHeight: initialViewportHeight,
        currentViewportHeight: heightBeforeAttempt,
        toleranceViewportHeightPx: VIEWPORT_RECOVERY_HEIGHT_TOLERANCE_PX,
      })

      if (!decision.shouldAttemptRecovery) {
        window.__iosViewportRecoveryDebug = {
          attempted: false,
          experimentEnabled,
          isStandalone,
          reason: decision.reason,
          baselineViewportHeight: initialViewportHeight,
          heightBeforeAttempt,
          heightAfterAttempt: null,
          recovered: null,
          decidedAt: Date.now(),
        }
        return
      }

      const target = body.firstElementChild as HTMLElement | null
      const preScrollY = window.scrollY
      let heightAfterAttempt = heightBeforeAttempt

      if (target) {
        const previousDisplay = target.style.display
        target.style.display = "none"
        void target.offsetHeight // synchronous reflow, no paint between the two writes
        target.style.display = previousDisplay

        if (Math.abs(window.scrollY - preScrollY) > RESTORE_TOLERANCE_PX) {
          window.scrollTo({ top: preScrollY, left: window.scrollX, behavior: "auto" })
        }

        heightAfterAttempt = window.visualViewport?.height ?? window.innerHeight
      }

      window.__iosViewportRecoveryDebug = {
        attempted: Boolean(target),
        experimentEnabled,
        isStandalone,
        reason: target ? null : "no-root-element",
        baselineViewportHeight: initialViewportHeight,
        heightBeforeAttempt,
        heightAfterAttempt,
        recovered: target
          ? Math.abs(initialViewportHeight - heightAfterAttempt) <= VIEWPORT_RECOVERY_HEIGHT_TOLERANCE_PX
          : null,
        decidedAt: Date.now(),
      }
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
          // new cycle still needs when it eventually closes. The recovery
          // experiment only runs on a genuine close-and-settle, same as the
          // restore logic above — never mid-cycle.
          if (!hasEditableFocus) {
            resetCycle()
            attemptViewportRecovery()
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

    // IOS-STANDALONE-FINAL-VISUAL-FIX-R4: a real standalone-PWA capture
    // proved --visual-viewport-offset-top (updated only inside
    // updateViewportState, which scheduleUpdate defers by one
    // requestAnimationFrame) can lag the *actual*, current
    // visualViewport.offsetTop by a full frame or more during a fast
    // scroll fling — several native `scroll` events can fire before that
    // rAF callback runs. The standalone dock compensation (globals.css)
    // subtracts this value from BottomNav/ChatFab's `bottom`, so a stale
    // value briefly renders the dock at the wrong physical position —
    // real numbers observed: offsetTop=41.34 while the CSS was still
    // compensating for a stale ~66px, leaving the dock only ~17px (then,
    // one event later, ~0.66px) from the true bottom edge — a visible
    // partial disappearance. --ios-dock-visual-offset-top is a SEPARATE,
    // synchronously-updated variable dedicated to that compensation only
    // — written directly here, in the native event handler itself,
    // before scheduleUpdate's rAF hop, so it can never be more than one
    // real browser event behind. The general keyboard-detection pipeline
    // (CSS classes, --ios-keyboard-offset, the stabilization wait) keeps
    // its existing rAF/stabilization semantics unchanged — those exist
    // for good reasons (avoiding class-toggle flicker, racing the restore
    // logic) that don't apply to this single, idempotent style write.
    const updateDockVisualOffsetSync = () => {
      root.style.setProperty("--ios-dock-visual-offset-top", `${vv?.offsetTop ?? 0}px`)
    }

    // IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5: real standalone data
    // proved the R4 synchronous write above is still not enough during a
    // fast scroll fling — not because the JS write is delayed, but because
    // WebKit's own `visualViewport` `scroll`/`resize` EVENTS are throttled/
    // coalesced and do not fire on every compositor frame while the visual
    // viewport is actively panning. Independently re-derived from the full
    // R4 payload: 91% of keyboard-closed samples already matched the
    // design target (42px, median exactly 42) proving the compensation
    // FORMULA itself is correct — removing it was proven to REINTRODUCE a
    // sustained ~110px floating bug (offsetTop=68 held for many real
    // samples). The remaining error is 3 brief episodes (max 103ms, max
    // 52px) exactly at the moments the browser's own event dispatch lags
    // behind its continuously-interpolating internal value — confirmed by
    // cross-checking computedBottom against what it should read for the
    // CURRENT offsetTop: the actual CSS value matches what the PREVIOUS
    // event's offsetTop would have produced, every single time, in both
    // magnitude and sign.
    // Fix: a short, self-terminating rAF-polling window (not an always-on
    // loop) that re-reads the live visualViewport.offsetTop every frame
    // for DOCK_OFFSET_POLL_FRAMES frames after any real vv event — closing
    // the gap between sparse events without polling indefinitely. Fully
    // independent of the keyboard-detection pipeline's own rAF/
    // stabilization timing, which is untouched.
    let dockOffsetPollRafId = 0
    let dockOffsetPollFramesLeft = 0

    const pollDockOffsetTick = () => {
      dockOffsetPollRafId = 0
      updateDockVisualOffsetSync()
      dockOffsetPollFramesLeft -= 1
      if (dockOffsetPollFramesLeft > 0) {
        dockOffsetPollRafId = window.requestAnimationFrame(pollDockOffsetTick)
      }
    }

    const startDockOffsetPolling = () => {
      dockOffsetPollFramesLeft = DOCK_OFFSET_POLL_FRAMES
      if (!dockOffsetPollRafId) {
        dockOffsetPollRafId = window.requestAnimationFrame(pollDockOffsetTick)
      }
    }

    const handleViewportChange = () => {
      updateDockVisualOffsetSync()
      startDockOffsetPolling()
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
    updateDockVisualOffsetSync()

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
      if (dockOffsetPollRafId) window.cancelAnimationFrame(dockOffsetPollRafId)

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
      root.style.removeProperty("--ios-dock-visual-offset-top")
      delete window.__iosScrollRestoreDebug
      delete window.__iosViewportRecoveryDebug
    }
  }, [])

  return null
}
