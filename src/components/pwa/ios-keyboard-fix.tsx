"use client"

import { useEffect } from "react"
import {
  resolveIosDockPlacement,
  resolveIosDockViewportMode,
  type DockViewportMode,
} from "@/lib/ios-dock-viewport-state"
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
 * 5. IOS-STANDALONE-DEGRADED-VIEWPORT-DOCK-FALLBACK-R8: on the affected
 *    standalone-PWA WebKit build, visualViewport.height itself never
 *    recovers to baseline after the first keyboard cycle (R7 certified a
 *    tested recovery technique fails deterministically on a real device —
 *    that experiment has been removed, not replaced with another attempt
 *    at forcing WebKit). Toggles `ios-dock-degraded` on <html>/<body> and
 *    writes `--ios-dock-nav-top`/`--ios-dock-fab-top` so BottomNav/ChatFab
 *    reposition entirely inside whatever region IS currently paintable,
 *    instead of continuing to target the physical screen bottom the
 *    reduced viewport can no longer reliably paint into. See
 *    src/lib/ios-dock-viewport-state.ts for the pure mode/placement logic.
 * 6. Cleans up everything on unmount
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
// IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5: how many animation frames
// to keep re-reading the live visualViewport.offsetTop after any real vv
// event, to catch WebKit's own continuous interpolation between its
// throttled/coalesced event dispatches. ~250ms at 60fps — comfortably
// longer than every real transient episode measured (max 103ms) with
// margin, self-terminating (never an always-on loop).
const DOCK_OFFSET_POLL_FRAMES = 15

// IOS-STANDALONE-DEGRADED-VIEWPORT-DOCK-FALLBACK-R8: the design heights the
// degraded-mode placement targets — matches the CSS design constants
// already established in globals.css (--ios-bottom-nav-height: 4rem,
// ChatFab's h-14/w-14) rather than reading getBoundingClientRect() (which
// this impure shell never touches for any other calculation either — every
// existing formula in this file is driven by visualViewport state, not DOM
// measurement, and R8 keeps that same discipline).
const DEGRADED_NAV_HEIGHT_PX = 64
const DEGRADED_FAB_HEIGHT_PX = 56

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

    // The real pre-keyboard visualViewport.height, captured once at mount
    // (before any editable focus has ever happened this session). R7
    // certified, on a real device, that WebKit cannot be reliably forced
    // back to this value after the first keyboard cycle (recovery attempt:
    // 729 -> 729, unchanged) — this baseline is now used only to detect the
    // resulting DEGRADED_POST_KEYBOARD dock mode below, never to attempt
    // recovering the viewport itself.
    const initialViewportHeight = vv?.height ?? window.innerHeight
    // display-mode doesn't change without a reload, so a single read at
    // mount (same idiom as initialViewportHeight above) is sufficient.
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false

    let rafId = 0
    let hasEditableFocus = isEditableTarget(document.activeElement)
    let lastKeyboardOpen = false
    // IOS-STANDALONE-DEGRADED-VIEWPORT-DOCK-FALLBACK-R8: the single
    // authority for which dock mode is active — written ONLY inside
    // updateViewportState (see updateDockMode below), read by
    // applyDockPlacement (called both from there and from the existing R5
    // synchronous offset-polling machinery, for placement freshness during
    // active scroll — see updateDockVisualOffsetSync). Never decided in two
    // places.
    let currentDockMode: DockViewportMode = "HEALTHY"

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
      // IOS-STANDALONE-DEGRADED-VIEWPORT-DOCK-FALLBACK-R8: resolved from the
      // SAME keyboardOpen value setKeyboardClasses just applied — atomic
      // with the visibility:hidden/visible transition, so the nav is never
      // revealed for even one frame at the wrong (healthy) placement before
      // switching to the degraded one (§17).
      updateDockMode(keyboardOpen)

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

    // IOS-STANDALONE-DEGRADED-VIEWPORT-DOCK-FALLBACK-R8: writes the
    // degraded-mode nav/FAB `top` targets as CSS custom properties, or
    // clears them outside degraded mode — see resolveIosDockPlacement's own
    // derivation comment for why `top` (not `bottom`) is used. Never reads
    // or writes anything else; the healthy dock's own `bottom`-based
    // compensation (R3-R5, globals.css) is untouched and simply loses the
    // cascade to the higher-specificity `.ios-dock-degraded` rule when this
    // is active (`bottom: auto` there — see globals.css) — exactly one
    // property authoritatively controls position at any given time, never
    // both simultaneously.
    const applyDockPlacement = () => {
      if (currentDockMode !== "DEGRADED_POST_KEYBOARD") {
        root.style.removeProperty("--ios-dock-nav-top")
        root.style.removeProperty("--ios-dock-fab-top")
        return
      }
      const placement = resolveIosDockPlacement({
        offsetTop: vv?.offsetTop ?? 0,
        visualViewportHeight: vv?.height ?? window.innerHeight,
        navHeightPx: DEGRADED_NAV_HEIGHT_PX,
        fabHeightPx: DEGRADED_FAB_HEIGHT_PX,
      })
      root.style.setProperty("--ios-dock-nav-top", `${placement.navTopPx}px`)
      root.style.setProperty("--ios-dock-fab-top", `${placement.fabTopPx}px`)
    }

    // The single authority (§29-31) for MODE: only ever called from
    // updateViewportState, immediately after setKeyboardClasses, using the
    // exact same keyboardOpen value — never re-decided anywhere else.
    // Placement FRESHNESS during active scroll (offsetTop changing quickly)
    // is handled separately by re-running applyDockPlacement from the
    // existing R5 synchronous polling window (updateDockVisualOffsetSync
    // below) — that reuses currentDockMode as already decided here, it
    // never re-evaluates the mode itself.
    const updateDockMode = (keyboardOpen: boolean) => {
      const nextMode = resolveIosDockViewportMode({
        keyboardOpen,
        isStandalone,
        baselineViewportHeight: initialViewportHeight,
        currentViewportHeight: vv?.height ?? window.innerHeight,
      })
      currentDockMode = nextMode
      const degraded = nextMode === "DEGRADED_POST_KEYBOARD"
      for (const el of [root, body]) {
        el.classList.toggle("ios-dock-degraded", degraded)
      }
      applyDockPlacement()
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
      // IOS-STANDALONE-DEGRADED-VIEWPORT-DOCK-FALLBACK-R8: reuses this same
      // synchronous-write + rAF-polling window (never a second, new polling
      // mechanism — see the task's own explicit "no another rAF offset
      // polling increase" constraint) to keep the degraded-mode nav/FAB
      // `top` targets fresh against live offsetTop during active scroll.
      // Placement-only refresh — never re-decides currentDockMode itself
      // (see updateDockMode, the single mode authority).
      applyDockPlacement()
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
        el.classList.remove("ios-keyboard-open", "keyboard-open", "ios-device", "ios-dock-degraded")
      }

      root.style.removeProperty("--visual-viewport-height")
      root.style.removeProperty("--visual-viewport-width")
      root.style.removeProperty("--visual-viewport-offset-top")
      root.style.removeProperty("--ios-keyboard-offset")
      root.style.removeProperty("--ios-dock-visual-offset-top")
      root.style.removeProperty("--ios-dock-nav-top")
      root.style.removeProperty("--ios-dock-fab-top")
      delete window.__iosScrollRestoreDebug
    }
  }, [])

  return null
}
