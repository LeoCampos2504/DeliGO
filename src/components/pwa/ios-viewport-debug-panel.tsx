"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import {
  advanceMilestoneTracker,
  buildExportPayload,
  buildTextSummary,
  classifyKeyboardMilestone,
  computeDerivedGeometry,
  createInitialMilestoneTrackerState,
  createRingBuffer,
  DEBUG_EVENT_BUFFER_MAX,
  IOS_DEBUG_STORAGE_KEY,
  isIosDebugFlagEnabled,
  resolveIosDebugEnabled,
  type BrowserModeInfo,
  type ComposerElementGeometry,
  type DockElementGeometry,
  type GeometrySnapshot,
  type OverlayElementGeometry,
  type SheetElementGeometry,
} from "@/lib/ios-debug-snapshot"

/**
 * IOSViewportDebugPanel — TEMPORARY, query-flag-gated real-device geometry
 * diagnostics (IOS-MOBILE-FIX-AND-REAL-DEVICE-INSTRUMENTATION-R1).
 *
 * Only mounts its DOM/listeners when the URL contains `?iosDebug=1` (or the
 * one-time-armed localStorage flag from a previous visit — see
 * IOS_DEBUG_STORAGE_KEY, needed because the installed PWA's start_url has
 * no query string) — with neither present (the normal-user case), this
 * component returns null on every render and never touches document/
 * window beyond that one-time check, exactly like BottomNav's own
 * `mounted` gate. It never reads input values, chat message text, tokens,
 * cookies, or session/business data from localStorage — the ONLY
 * localStorage key it ever touches is its own namespaced debug-enabled
 * flag. Every other field is a numeric rect or a fixed whitelist of
 * computed-style/className strings (see src/lib/ios-debug-snapshot.ts,
 * which also unit-tests that whitelist so a sensitive field can never be
 * added silently).
 *
 * This is scaffolding to collect real-iPhone evidence for the two symptoms
 * neither the Claude nor the Codex iOS diagnostics could resolve from
 * source alone (BottomNav post-focus perceived movement, ChatSheet
 * background exposure) — it intentionally does not change any existing
 * keyboard/scroll-restore behavior (IOSKeyboardFix / ios-scroll-restore-
 * decision.ts are not imported or touched here).
 */

const MANUAL_CAPTURE_LABELS = [
  "BASELINE",
  "CHROME_VISIBLE",
  "CHROME_COLLAPSED",
  "INPUT_FOCUSED",
  "KEYBOARD_OPEN",
  "CHAT_KEYBOARD_OPEN",
  "AFTER_BLUR",
  "FINAL_STABLE",
] as const

const SETTLING_FRAMES = 6
const SETTLING_STABLE_DELAY_MS = 250
const FINAL_STABLE_DELAY_MS = 1500

function readRect(el: Element) {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
}

function readDockElement(el: Element | null): DockElementGeometry | null {
  if (!el) return null
  const cs = window.getComputedStyle(el)
  return {
    rect: readRect(el),
    computedPosition: cs.position,
    computedBottom: cs.bottom,
    computedVisibility: cs.visibility,
    computedPointerEvents: cs.pointerEvents,
    computedTransform: cs.transform,
  }
}

function readOverlayElement(el: Element | null): OverlayElementGeometry | null {
  if (!el) return null
  const cs = window.getComputedStyle(el)
  return {
    rect: readRect(el),
    computedPosition: cs.position,
    computedInset: `${cs.top} ${cs.right} ${cs.bottom} ${cs.left}`,
    computedHeight: cs.height,
  }
}

function readSheetElement(el: Element | null): SheetElementGeometry | null {
  if (!el) return null
  const cs = window.getComputedStyle(el)
  return {
    rect: readRect(el),
    computedPosition: cs.position,
    computedTop: cs.top,
    computedBottom: cs.bottom,
    computedHeight: cs.height,
    computedTransform: cs.transform,
  }
}

function readComposerElement(el: Element | null): ComposerElementGeometry | null {
  if (!el) return null
  const cs = window.getComputedStyle(el)
  return {
    rect: readRect(el),
    computedPosition: cs.position,
    computedBottom: cs.bottom,
    computedTransform: cs.transform,
  }
}

function readBrowserMode(): BrowserModeInfo {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return {
    standalone: Boolean(nav.standalone),
    displayModeStandalone: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
    visualViewportAvailable: Boolean(window.visualViewport),
    userAgent: window.navigator.userAgent || null,
  }
}

function captureSnapshot(captureLabel: string, eventType: string, pathname: string | null): GeometrySnapshot {
  const vv = window.visualViewport
  const visualViewport = vv
    ? { width: vv.width, height: vv.height, offsetTop: vv.offsetTop, offsetLeft: vv.offsetLeft, scale: vv.scale }
    : null

  const bottomNav = readDockElement(document.querySelector('[data-ios-debug-role="bottom-nav"]'))
  const chatFab = readDockElement(document.querySelector('[data-ios-debug-role="chat-fab"]'))
  const chatOverlay = readOverlayElement(document.querySelector('[data-slot="sheet-overlay"]'))
  const chatSheet = readSheetElement(document.querySelector('[data-ios-debug-role="chat-sheet"]'))
  const chatComposer = readComposerElement(document.querySelector('[data-ios-debug-role="chat-composer"]'))

  const bodyStyle = window.getComputedStyle(document.body)

  return {
    timestamp: Date.now(),
    captureLabel,
    eventType,
    pathname,
    window: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    },
    documentElement: {
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      className: document.documentElement.className,
    },
    body: {
      className: document.body.className,
      computedPosition: bodyStyle.position,
      computedTop: bodyStyle.top,
      computedOverflow: bodyStyle.overflow,
      computedOverflowY: bodyStyle.overflowY,
      computedHeight: bodyStyle.height,
      computedMinHeight: bodyStyle.minHeight,
    },
    visualViewport,
    bottomNav,
    chatFab,
    chatOverlay,
    chatSheet,
    chatComposer,
    browserMode: readBrowserMode(),
    derived: computeDerivedGeometry({
      windowInnerHeight: window.innerHeight,
      visualViewport,
      bottomNav,
      chatFab,
      chatSheet,
      chatOverlay,
      chatComposer,
    }),
  }
}

export function IOSViewportDebugPanel() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [manualCaptures, setManualCaptures] = useState<GeometrySnapshot[]>([])
  const [autoCount, setAutoCount] = useState(0)
  const [liveSnapshot, setLiveSnapshot] = useState<GeometrySnapshot | null>(null)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const eventsBufferRef = useRef(createRingBuffer<GeometrySnapshot>(DEBUG_EVENT_BUFFER_MAX))
  const rafRef = useRef(0)
  const hadEditableFocusRef = useRef(false)
  const settlingActiveRef = useRef(false)
  const milestoneStateRef = useRef(createInitialMilestoneTrackerState())
  const finalStableTimerRef = useRef(0)

  // Same SSR-safe "mounted" gate BottomNav uses — server and first client
  // render both render nothing, avoiding a hydration mismatch. The debug
  // flag is read from window.location AND (so the standalone PWA, whose
  // manifest start_url has no query string, keeps the panel armed after
  // install) a localStorage flag written the first time ?iosDebug=1 was
  // seen — see IOS_DEBUG_STORAGE_KEY's doc comment in ios-debug-snapshot.ts.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true)
      const queryEnabled = isIosDebugFlagEnabled(window.location.search)
      let storedFlag: string | null = null
      try {
        storedFlag = window.localStorage.getItem(IOS_DEBUG_STORAGE_KEY)
      } catch {
        // Private browsing / storage blocked — fall back to query-only.
      }
      setEnabled(resolveIosDebugEnabled(window.location.search, storedFlag))
      if (queryEnabled) {
        try {
          window.localStorage.setItem(IOS_DEBUG_STORAGE_KEY, "1")
        } catch {
          // Nothing to do — the panel still works for this session via the query flag.
        }
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const handleDisarm = () => {
    try {
      window.localStorage.removeItem(IOS_DEBUG_STORAGE_KEY)
    } catch {
      // Nothing to do.
    }
    setEnabled(false)
  }

  const pushEvent = useCallback((snap: GeometrySnapshot) => {
    eventsBufferRef.current.push(snap)
    setAutoCount(eventsBufferRef.current.length)
  }, [])

  // AUTO_FINAL_STABLE: fires once, FINAL_STABLE_DELAY_MS after the keyboard
  // last closed, IF nothing else (a new focus, a new keyboard-class change)
  // happened in the meantime — see feedMilestoneClassifier below, which
  // cancels this timer on any class change.
  const armFinalStable = useCallback(() => {
    if (finalStableTimerRef.current) window.clearTimeout(finalStableTimerRef.current)
    finalStableTimerRef.current = window.setTimeout(() => {
      finalStableTimerRef.current = 0
      const snap = captureSnapshot("AUTO_FINAL_STABLE", "auto-milestone", pathname)
      setManualCaptures((prev) => [...prev, snap])
    }, FINAL_STABLE_DELAY_MS)
  }, [pathname])

  // Automatic milestone capture (§10): classifies every snapshot into
  // closed/normal-keyboard/chat-keyboard and, via the pure edge-detecting
  // tracker in ios-debug-snapshot.ts, labels BASELINE/KEYBOARD_OPEN/
  // CHAT_KEYBOARD_OPEN/AFTER_KEYBOARD_CLOSE moments without the operator
  // ever tapping a button — tapping the panel while a native keyboard is
  // open can itself trigger a focusout and contaminate the very state
  // being measured.
  const feedMilestoneClassifier = useCallback(
    (snap: GeometrySnapshot) => {
      const keyboardOpen = snap.documentElement.className.includes("ios-keyboard-open")
      const cls = classifyKeyboardMilestone({ keyboardOpen, hasChatSheet: Boolean(snap.chatSheet) })
      const prevClass = milestoneStateRef.current.lastClass
      const result = advanceMilestoneTracker(milestoneStateRef.current, cls)
      milestoneStateRef.current = result.state

      if (prevClass !== null && prevClass !== cls && finalStableTimerRef.current) {
        window.clearTimeout(finalStableTimerRef.current)
        finalStableTimerRef.current = 0
      }

      if (result.fire) {
        const milestoneSnap = captureSnapshot(result.fire, "auto-milestone", pathname)
        setManualCaptures((prev) => [...prev, milestoneSnap])
        if (result.fire === "AUTO_AFTER_KEYBOARD_CLOSE") armFinalStable()
      }
    },
    [pathname, armFinalStable]
  )

  const scheduleLiveUpdate = useCallback(
    (eventType: string) => {
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0
        const snap = captureSnapshot("auto", eventType, pathname)
        setLiveSnapshot(snap)
        pushEvent(snap)
        feedMilestoneClassifier(snap)
      })
    },
    [pathname, pushEvent, feedMilestoneClassifier]
  )

  // Observation-only settling capture: never touches ios-keyboard-fix.tsx
  // or ios-scroll-restore-decision.ts — a separate rAF loop that just reads
  // and records geometry across the same kind of settling window the real
  // restore logic waits for, so the operator's JSON export lets us see
  // whether BottomNav's rect/visibility is ever inconsistent during it.
  const runSettlingCapture = useCallback(() => {
    if (settlingActiveRef.current) return
    settlingActiveRef.current = true
    let frame = 0
    const step = () => {
      const snap = captureSnapshot(`settling-frame-${frame}`, "focusout-settling", pathname)
      pushEvent(snap)
      feedMilestoneClassifier(snap)
      frame += 1
      if (frame <= SETTLING_FRAMES) {
        window.requestAnimationFrame(step)
      } else {
        window.setTimeout(() => {
          const stableSnap = captureSnapshot("settling-stable", "focusout-settling", pathname)
          pushEvent(stableSnap)
          feedMilestoneClassifier(stableSnap)
          settlingActiveRef.current = false
        }, SETTLING_STABLE_DELAY_MS)
      }
    }
    window.requestAnimationFrame(step)
  }, [pathname, pushEvent, feedMilestoneClassifier])

  useEffect(() => {
    if (!enabled) return

    const onResize = () => scheduleLiveUpdate("resize")
    const onScroll = () => scheduleLiveUpdate("scroll")
    const onVvResize = () => scheduleLiveUpdate("visualViewport-resize")
    const onVvScroll = () => scheduleLiveUpdate("visualViewport-scroll")
    const onOrientation = () => scheduleLiveUpdate("orientationchange")
    const onPageshow = () => scheduleLiveUpdate("pageshow")
    const onFocusIn = () => {
      hadEditableFocusRef.current = true
      scheduleLiveUpdate("focusin")
    }
    const onFocusOut = () => {
      scheduleLiveUpdate("focusout")
      if (hadEditableFocusRef.current) {
        runSettlingCapture()
        hadEditableFocusRef.current = false
      }
    }

    window.addEventListener("resize", onResize, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("orientationchange", onOrientation, { passive: true })
    window.addEventListener("pageshow", onPageshow, { passive: true })
    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    window.visualViewport?.addEventListener("resize", onVvResize)
    window.visualViewport?.addEventListener("scroll", onVvScroll)

    scheduleLiveUpdate("mount")

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
      if (finalStableTimerRef.current) window.clearTimeout(finalStableTimerRef.current)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("orientationchange", onOrientation)
      window.removeEventListener("pageshow", onPageshow)
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
      window.visualViewport?.removeEventListener("resize", onVvResize)
      window.visualViewport?.removeEventListener("scroll", onVvScroll)
    }
  }, [enabled, scheduleLiveUpdate, runSettlingCapture])

  const handleManualCapture = (label: string) => {
    const snap = captureSnapshot(label, "manual", pathname)
    setManualCaptures((prev) => [...prev, snap])
    setLiveSnapshot(snap)
  }

  const showCopyStatus = (text: string) => {
    setCopyStatus(text)
    window.setTimeout(() => setCopyStatus(null), 2000)
  }

  const handleCopyJson = async () => {
    const payload = buildExportPayload({
      browserMode: readBrowserMode(),
      manualCaptures,
      events: eventsBufferRef.current.toArray(),
      now: Date.now(),
    })
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      showCopyStatus("JSON copiado")
    } catch {
      showCopyStatus("No se pudo copiar")
    }
  }

  const handleCopySummary = async () => {
    const payload = buildExportPayload({
      browserMode: readBrowserMode(),
      manualCaptures,
      events: eventsBufferRef.current.toArray(),
      now: Date.now(),
    })
    try {
      await navigator.clipboard.writeText(buildTextSummary(payload))
      showCopyStatus("Resumen copiado")
    } catch {
      showCopyStatus("No se pudo copiar")
    }
  }

  const handleClear = () => {
    setManualCaptures([])
    eventsBufferRef.current.clear()
    setAutoCount(0)
    setLiveSnapshot(null)
  }

  if (!mounted || !enabled) return null

  return (
    <div
      className="fixed top-2 left-2 right-2 z-[9999] mx-auto max-w-sm text-[11px] font-mono"
      data-ios-debug-role="debug-panel"
    >
      <div className="bg-black/85 text-white rounded-xl shadow-lg overflow-hidden border border-white/20">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between px-3 py-2 bg-amber-600/90"
        >
          <span className="font-semibold">iOS Viewport Debug — TESTING</span>
          <span>{collapsed ? "▼" : "▲"}</span>
        </button>
        {!collapsed && (
          <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              <span>mode</span>
              <span>{liveSnapshot?.browserMode.standalone ? "standalone" : "browser"}</span>
              <span>innerH</span>
              <span>{liveSnapshot?.window.innerHeight ?? "-"}</span>
              <span>vv.h</span>
              <span>{liveSnapshot?.visualViewport?.height ?? "-"}</span>
              <span>vv.offTop</span>
              <span>{liveSnapshot?.visualViewport?.offsetTop ?? "-"}</span>
              <span>scrollY</span>
              <span>{liveSnapshot?.window.scrollY ?? "-"}</span>
              <span>nav.bottom</span>
              <span>{liveSnapshot?.bottomNav?.computedBottom ?? "-"}</span>
              <span>nav.rect.b</span>
              <span>{liveSnapshot?.bottomNav?.rect.bottom.toFixed(0) ?? "-"}</span>
              <span>nav.vis</span>
              <span>{liveSnapshot?.bottomNav?.computedVisibility ?? "-"}</span>
              <span>fab.bottom</span>
              <span>{liveSnapshot?.chatFab?.computedBottom ?? "-"}</span>
              <span>fab.rect.b</span>
              <span>{liveSnapshot?.chatFab?.rect.bottom.toFixed(0) ?? "-"}</span>
              <span>fab-nav gap</span>
              <span>{liveSnapshot?.derived.fabNavGap?.toFixed(0) ?? "-"}</span>
              <span>sheet.h</span>
              <span>{liveSnapshot?.chatSheet?.computedHeight ?? "-"}</span>
              <span>sheet.rect.b</span>
              <span>{liveSnapshot?.chatSheet?.rect.bottom.toFixed(0) ?? "-"}</span>
              <span>composer.rect.b</span>
              <span>{liveSnapshot?.chatComposer?.rect.bottom.toFixed(0) ?? "-"}</span>
              <span>fixedVB</span>
              <span>{liveSnapshot?.derived.fixedViewportBottom.toFixed(0) ?? "-"}</span>
              <span>sheet gap</span>
              <span>{liveSnapshot?.derived.sheetVisibleGapBottom?.toFixed(0) ?? "-"}</span>
              <span>composer gap</span>
              <span>{liveSnapshot?.derived.composerBottomGap?.toFixed(0) ?? "-"}</span>
            </div>

            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-white/20">
              {MANUAL_CAPTURE_LABELS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleManualCapture(label)}
                  className="bg-white/10 hover:bg-white/20 rounded px-1.5 py-1 text-left truncate"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 pt-1 border-t border-white/20">
              <button
                type="button"
                onClick={handleCopyJson}
                className="flex-1 bg-emerald-700/80 hover:bg-emerald-700 rounded px-2 py-1"
              >
                COPY JSON
              </button>
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex-1 bg-sky-700/80 hover:bg-sky-700 rounded px-2 py-1"
              >
                COPY SUMMARY
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 bg-red-800/80 hover:bg-red-800 rounded px-2 py-1"
              >
                CLEAR
              </button>
            </div>

            <button
              type="button"
              onClick={handleDisarm}
              className="w-full bg-white/5 hover:bg-white/10 text-white/60 rounded px-2 py-1 text-center"
            >
              DISARM (stop showing this panel on this device)
            </button>

            <div className="text-white/60">
              {manualCaptures.length} manual · {autoCount} auto
              {copyStatus ? ` · ${copyStatus}` : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
