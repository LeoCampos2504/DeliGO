"use client"

// ============================================
// TEMPORARY IOS-24 DIAGNOSTIC
// REMOVE AFTER IOS-24 ROOT CAUSE CONFIRMATION
// ============================================
//
// Read-only runtime instrumentation for IOS-24 (residual scroll / visual
// viewport position left incorrect after the iOS keyboard opens/closes, and
// the residual BottomNav drift observed during manual scroll). This is NOT
// a fix — it never calls scrollTo/preventDefault, never writes body/html
// styles or classes, never touches BottomNav/Chat/IOSKeyboardFix. It only
// observes window/document/visualViewport/the nav's own DOM node and
// displays the values.
//
// Activation: exclusively via `?iosdebug=1` in the URL. Once activated, a
// sessionStorage flag keeps the panel visible across internal navigation
// (which drops the query param) for the duration of the diagnostic session.
// It is never activated automatically by device/user-agent/environment.
//
// `keyboardFromViewport`/`keyboardOpen` below are a diagnostic-only copy of
// the same concept `src/components/pwa/ios-keyboard-fix.tsx` uses — this
// file does NOT import or read that component's internal/private state, it
// independently recomputes the same public browser APIs read-only.
//
// IOS-24-NAV-RUNTIME-DIAGNOSTIC: adds read-only geometry of the BottomNav
// itself, located exclusively via the existing `.ios-bottom-nav` class (no
// new productive class/id was added). `getBoundingClientRect()` and
// `getComputedStyle()` are pure reads — nothing here writes to the nav's
// style/class, moves it, or changes its behavior in any way.

import { useEffect, useRef, useState, type CSSProperties } from "react"

const STORAGE_KEY = "deligo-iosdebug"
const EDITABLE_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [contenteditable="true"], [contenteditable=""]'
const NAV_SELECTOR = ".ios-bottom-nav"
const KEYBOARD_THRESHOLD = 80
const STABLE_FRAMES_REQUIRED = 6
const STABLE_TOLERANCE_PX = 1
const STABLE_MAX_FRAMES = 180
const MAX_EVENT_LOG = 20

type ExtendedVisualViewport = VisualViewport & { pageTop?: number; pageLeft?: number }

type Metrics = {
  scrollY: number
  pageYOffset: number
  htmlScrollTop: number
  bodyScrollTop: number
  innerHeight: number
  vvHeight: number | null
  vvWidth: number | null
  vvOffsetTop: number | null
  vvOffsetLeft: number | null
  vvPageTop: number | null
  vvPageLeft: number | null
  focusTag: string
  focusType: string
  editableFocus: boolean
  keyboardFromViewport: boolean
  keyboardOpen: boolean
  path: string
  timestamp: number
  // NAV geometry — IOS-24-NAV-RUNTIME-DIAGNOSTIC, all read-only.
  navCount: number
  navParentTag: string | null
  navParentIsBody: boolean
  navRectTop: number | null
  navRectBottom: number | null
  navRectLeft: number | null
  navRectRight: number | null
  navRectWidth: number | null
  navRectHeight: number | null
  navComputedPosition: string | null
  navComputedTop: string | null
  navComputedBottom: string | null
  navComputedLeft: string | null
  navComputedRight: string | null
  navComputedTransform: string | null
  navComputedVisibility: string | null
  navComputedDisplay: string | null
  navComputedZIndex: string | null
  layoutViewportBottom: number
  visualViewportTop: number
  visualViewportBottom: number
  // Why these matter (diagnostic only, never used to change behavior):
  // - If navRectTop stays stable while window.scrollY changes, the nav is
  //   behaving as fixed relative to the viewport (correct).
  // - If navDocumentTop (rect.top + scrollY) stays roughly constant while
  //   scrollY changes, the nav is visually behaving like part of the
  //   document/absolute-positioned content, even if computed position still
  //   reports "fixed" — a strong signal of a WebKit fixed-layer/compositor
  //   issue rather than a CSS mistake.
  navGapToLayoutBottom: number | null
  navGapToVisualBottom: number | null
  navDocumentTop: number | null
  navDocumentBottom: number | null
}

type Snapshot = Metrics & { label: string }

type EventLogEntry = {
  time: number
  event: string
  scrollY: number
  vvOffsetTop: number | null
  vvHeight: number | null
  innerHeight: number
  navRectTop: number | null
  navRectBottom: number | null
  navGapToLayoutBottom: number | null
  navGapToVisualBottom: number | null
  navDocumentTop: number | null
  navCount: number
}

type NavBaseline = {
  rectTop: number
  rectBottom: number
  gapLayout: number
  gapVisual: number
  scrollY: number
} | null

function isEditableTarget(target: EventTarget | Element | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || Boolean(target.closest(EDITABLE_SELECTOR))
}

function focusDescriptor(el: Element | null): { tag: string; type: string } {
  if (!(el instanceof HTMLElement)) return { tag: "NONE", type: "" }
  const tag = el.tagName
  const type = tag === "INPUT" ? (el as HTMLInputElement).type || "text" : ""
  return { tag, type }
}

function readMetrics(hasEditableFocus: boolean): Metrics {
  const vv = window.visualViewport as ExtendedVisualViewport | null
  const focus = focusDescriptor(document.activeElement)
  const viewportHeight = vv?.height ?? window.innerHeight
  const offsetTop = vv?.offsetTop ?? 0
  const heightDiff = Math.max(0, window.innerHeight - viewportHeight)
  const keyboardOffset = Math.max(0, heightDiff - offsetTop)
  const keyboardFromViewport = heightDiff > KEYBOARD_THRESHOLD || keyboardOffset > KEYBOARD_THRESHOLD

  // NAV geometry — read-only. `.ios-bottom-nav` is the existing productive
  // class already used by globals.css for keyboard-open hiding; no new
  // class/id was added to BottomNav for this diagnostic.
  const navs = document.querySelectorAll<HTMLElement>(NAV_SELECTOR)
  const navCount = navs.length
  const nav = navs[0] ?? null
  const layoutViewportBottom = window.innerHeight
  const visualViewportTop = offsetTop
  const visualViewportBottom = offsetTop + viewportHeight

  let navGeometry: Pick<
    Metrics,
    | "navParentTag"
    | "navParentIsBody"
    | "navRectTop"
    | "navRectBottom"
    | "navRectLeft"
    | "navRectRight"
    | "navRectWidth"
    | "navRectHeight"
    | "navComputedPosition"
    | "navComputedTop"
    | "navComputedBottom"
    | "navComputedLeft"
    | "navComputedRight"
    | "navComputedTransform"
    | "navComputedVisibility"
    | "navComputedDisplay"
    | "navComputedZIndex"
    | "navGapToLayoutBottom"
    | "navGapToVisualBottom"
    | "navDocumentTop"
    | "navDocumentBottom"
  >

  if (nav) {
    const rect = nav.getBoundingClientRect()
    const computed = window.getComputedStyle(nav)
    const parent = nav.parentElement
    navGeometry = {
      navParentTag: parent?.tagName ?? null,
      navParentIsBody: parent === document.body,
      navRectTop: rect.top,
      navRectBottom: rect.bottom,
      navRectLeft: rect.left,
      navRectRight: rect.right,
      navRectWidth: rect.width,
      navRectHeight: rect.height,
      navComputedPosition: computed.position,
      navComputedTop: computed.top,
      navComputedBottom: computed.bottom,
      navComputedLeft: computed.left,
      navComputedRight: computed.right,
      navComputedTransform: computed.transform,
      navComputedVisibility: computed.visibility,
      navComputedDisplay: computed.display,
      navComputedZIndex: computed.zIndex,
      navGapToLayoutBottom: layoutViewportBottom - rect.bottom,
      navGapToVisualBottom: visualViewportBottom - rect.bottom,
      navDocumentTop: rect.top + window.scrollY,
      navDocumentBottom: rect.bottom + window.scrollY,
    }
  } else {
    navGeometry = {
      navParentTag: null,
      navParentIsBody: false,
      navRectTop: null,
      navRectBottom: null,
      navRectLeft: null,
      navRectRight: null,
      navRectWidth: null,
      navRectHeight: null,
      navComputedPosition: null,
      navComputedTop: null,
      navComputedBottom: null,
      navComputedLeft: null,
      navComputedRight: null,
      navComputedTransform: null,
      navComputedVisibility: null,
      navComputedDisplay: null,
      navComputedZIndex: null,
      navGapToLayoutBottom: null,
      navGapToVisualBottom: null,
      navDocumentTop: null,
      navDocumentBottom: null,
    }
  }

  return {
    scrollY: window.scrollY,
    pageYOffset: window.pageYOffset,
    htmlScrollTop: document.documentElement.scrollTop,
    bodyScrollTop: document.body.scrollTop,
    innerHeight: window.innerHeight,
    vvHeight: vv?.height ?? null,
    vvWidth: vv?.width ?? null,
    vvOffsetTop: vv?.offsetTop ?? null,
    vvOffsetLeft: vv?.offsetLeft ?? null,
    vvPageTop: typeof vv?.pageTop === "number" ? vv.pageTop : null,
    vvPageLeft: typeof vv?.pageLeft === "number" ? vv.pageLeft : null,
    focusTag: focus.tag,
    focusType: focus.type,
    editableFocus: hasEditableFocus,
    keyboardFromViewport,
    keyboardOpen: hasEditableFocus || keyboardFromViewport,
    path: window.location.pathname,
    timestamp: Date.now(),
    navCount,
    layoutViewportBottom,
    visualViewportTop,
    visualViewportBottom,
    ...navGeometry,
  }
}

function fmt(value: number | null): string {
  if (value === null) return "UNAVAILABLE"
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function fmtStr(value: string | null): string {
  return value === null ? "UNAVAILABLE" : value
}

export function IOSRuntimeDebugPanel() {
  const [active, setActive] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [live, setLive] = useState<Metrics | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [events, setEvents] = useState<EventLogEntry[]>([])
  const [navBaseline, setNavBaseline] = useState<NavBaseline>(null)
  const hasEditableFocusRef = useRef(false)
  const rafRef = useRef(0)
  const stabilizeRafRef = useRef(0)

  // Activation gate — client-only, never touches window/document on server.
  // setActive runs inside a deferred callback (not as a direct effect-body
  // statement) — same idiom already used elsewhere in this codebase for
  // this exact "detect client-only condition, then flip state" shape
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const queryFlag = params.get("iosdebug") === "1"

    let sessionFlag = false
    if (queryFlag) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, "1")
      } catch {
        // sessionStorage unavailable (private mode, etc.) — still activate for this load
      }
    } else {
      try {
        sessionFlag = window.sessionStorage.getItem(STORAGE_KEY) === "1"
      } catch {
        // sessionStorage unavailable — panel simply won't survive navigation without the query param
      }
    }

    if (!queryFlag && !sessionFlag) return

    const timer = window.setTimeout(() => setActive(true), 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!active) return
    if (typeof window === "undefined" || typeof document === "undefined") return

    hasEditableFocusRef.current = isEditableTarget(document.activeElement)

    const pushEvent = (name: string): Metrics => {
      const m = readMetrics(hasEditableFocusRef.current)
      setEvents((prev) =>
        [
          ...prev,
          {
            time: m.timestamp,
            event: name,
            scrollY: m.scrollY,
            vvOffsetTop: m.vvOffsetTop,
            vvHeight: m.vvHeight,
            innerHeight: m.innerHeight,
            navRectTop: m.navRectTop,
            navRectBottom: m.navRectBottom,
            navGapToLayoutBottom: m.navGapToLayoutBottom,
            navGapToVisualBottom: m.navGapToVisualBottom,
            navDocumentTop: m.navDocumentTop,
            navCount: m.navCount,
          },
        ].slice(-MAX_EVENT_LOG)
      )
      return m
    }

    const updateLive = () => {
      rafRef.current = 0
      setLive(readMetrics(hasEditableFocusRef.current))
    }
    const scheduleLive = () => {
      if (rafRef.current) return
      rafRef.current = window.requestAnimationFrame(updateLive)
    }

    // Stabilization: waits for STABLE_FRAMES_REQUIRED consecutive frames where
    // visualViewport.height/offsetTop and window.innerHeight stop changing
    // (within STABLE_TOLERANCE_PX) before recording a *_STABLE snapshot.
    // STABLE_MAX_FRAMES is a hard safety cap (~3s at 60fps) — never loops forever.
    const waitForStable = (label: "KEYBOARD_OPEN_STABLE" | "KEYBOARD_CLOSE_STABLE") => {
      if (stabilizeRafRef.current) window.cancelAnimationFrame(stabilizeRafRef.current)
      let consecutive = 0
      let last: { h: number; o: number; ih: number } | null = null
      let framesChecked = 0

      const tick = () => {
        framesChecked += 1
        const vv = window.visualViewport
        const cur = { h: vv?.height ?? window.innerHeight, o: vv?.offsetTop ?? 0, ih: window.innerHeight }
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
          const m = pushEvent(label)
          setSnapshots((prev) => [...prev, { ...m, label }])
          stabilizeRafRef.current = 0
          return
        }
        stabilizeRafRef.current = window.requestAnimationFrame(tick)
      }
      stabilizeRafRef.current = window.requestAnimationFrame(tick)
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (!isEditableTarget(event.target)) return
      hasEditableFocusRef.current = true
      const m = pushEvent("focusin")
      setSnapshots((prev) => [...prev, { ...m, label: "FOCUS_IN" }])
      scheduleLive()
      waitForStable("KEYBOARD_OPEN_STABLE")
    }

    const handleFocusOut = () => {
      hasEditableFocusRef.current = isEditableTarget(document.activeElement)
      const m = pushEvent("focusout")
      setSnapshots((prev) => [...prev, { ...m, label: "FOCUS_OUT" }])
      scheduleLive()
      waitForStable("KEYBOARD_CLOSE_STABLE")
    }

    const handleViewportChange = (name: string) => {
      hasEditableFocusRef.current = isEditableTarget(document.activeElement)
      pushEvent(name)
      scheduleLive()
    }

    const onResize = () => handleViewportChange("resize")
    const onOrientationChange = () => handleViewportChange("orientationchange")
    const onVvResize = () => handleViewportChange("vv:resize")
    const onVvScroll = () => handleViewportChange("vv:scroll")
    const onWindowScroll = () => handleViewportChange("scroll")

    const vv = window.visualViewport
    document.addEventListener("focusin", handleFocusIn)
    document.addEventListener("focusout", handleFocusOut)
    window.addEventListener("resize", onResize)
    window.addEventListener("orientationchange", onOrientationChange)
    window.addEventListener("scroll", onWindowScroll, { passive: true })
    vv?.addEventListener("resize", onVvResize)
    vv?.addEventListener("scroll", onVvScroll)

    const initial = readMetrics(hasEditableFocusRef.current)
    setLive(initial)
    setSnapshots((prev) => [...prev, { ...initial, label: "INITIAL" }])

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
      if (stabilizeRafRef.current) window.cancelAnimationFrame(stabilizeRafRef.current)
      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("orientationchange", onOrientationChange)
      window.removeEventListener("scroll", onWindowScroll)
      vv?.removeEventListener("resize", onVvResize)
      vv?.removeEventListener("scroll", onVvScroll)
    }
  }, [active])

  if (!active) return null

  const handleClear = () => {
    setSnapshots([])
    setEvents([])
    setNavBaseline(null)
  }

  // Captures a manual NAV snapshot. Label is chosen automatically (no extra
  // UI/dropdown, per instructions to keep the UI simple): the first capture
  // becomes the baseline; later captures are labeled by whether the keyboard
  // is currently open, so a sequence of taps tells the "before input / during
  // keyboard / after keyboard" story without the user having to pick a label.
  const handleCaptureNav = () => {
    const m = readMetrics(hasEditableFocusRef.current)
    let label: string
    if (!navBaseline && m.navRectTop !== null) {
      label = "NAV_BASELINE"
      setNavBaseline({
        rectTop: m.navRectTop,
        rectBottom: m.navRectBottom ?? m.navRectTop,
        gapLayout: m.navGapToLayoutBottom ?? 0,
        gapVisual: m.navGapToVisualBottom ?? 0,
        scrollY: m.scrollY,
      })
    } else {
      label = m.keyboardOpen ? "NAV_SCROLL_KEYBOARD_OPEN" : "NAV_SCROLL_AFTER_KEYBOARD"
    }
    setSnapshots((prev) => [...prev, { ...m, label }])
    setLive(m)
  }

  const handleCopy = () => {
    const diagnostic = {
      note: "IOS-24 diagnostic — technical metrics only, no PII",
      iosdebug: "ON",
      live,
      navBaseline,
      snapshots,
      events,
    }
    const text = JSON.stringify(diagnostic, null, 2)
    navigator.clipboard?.writeText(text).catch(() => {
      // clipboard unavailable/denied — nothing to fall back to safely, ignore
    })
  }

  const panelStyle: CSSProperties = {
    position: "fixed",
    top: "calc(env(safe-area-inset-top, 0px) + 8px)",
    right: "8px",
    zIndex: 2147483647,
    maxWidth: collapsed ? "auto" : "min(340px, calc(100vw - 16px))",
    maxHeight: collapsed ? "auto" : "min(70vh, 520px)",
    overflowY: collapsed ? "visible" : "auto",
    background: "rgba(20, 20, 20, 0.92)",
    color: "#7CFC7C",
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: "10px",
    lineHeight: 1.4,
    borderRadius: "8px",
    padding: collapsed ? "6px 10px" : "8px 10px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
    pointerEvents: "auto",
  }

  const buttonStyle: CSSProperties = {
    background: "#333",
    color: "#fff",
    border: "1px solid #555",
    borderRadius: "4px",
    padding: "2px 6px",
    fontSize: "10px",
    marginRight: "4px",
    marginBottom: "4px",
    cursor: "pointer",
  }

  const deltaRectTop = live && navBaseline && live.navRectTop !== null ? live.navRectTop - navBaseline.rectTop : null
  const deltaRectBottom =
    live && navBaseline && live.navRectBottom !== null ? live.navRectBottom - navBaseline.rectBottom : null
  const deltaGapLayout =
    live && navBaseline && live.navGapToLayoutBottom !== null ? live.navGapToLayoutBottom - navBaseline.gapLayout : null
  const deltaGapVisual =
    live && navBaseline && live.navGapToVisualBottom !== null ? live.navGapToVisualBottom - navBaseline.gapVisual : null
  const deltaScrollY = live && navBaseline ? live.scrollY - navBaseline.scrollY : null

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: collapsed ? 0 : "6px" }}>
        <strong style={{ color: "#fff" }}>iOS DEBUG</strong>
        <button type="button" style={buttonStyle} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div style={{ marginBottom: "6px" }}>
            <button type="button" style={buttonStyle} onClick={handleClear}>
              Clear
            </button>
            <button type="button" style={buttonStyle} onClick={handleCaptureNav}>
              Capture NAV
            </button>
            <button type="button" style={buttonStyle} onClick={handleCopy}>
              Copy diagnostic
            </button>
          </div>

          {live && (
            <div style={{ whiteSpace: "pre", marginBottom: "6px" }}>
              {`scrollY=${live.scrollY}
pageYOffset=${live.pageYOffset}
htmlScrollTop=${live.htmlScrollTop}
bodyScrollTop=${live.bodyScrollTop}
innerHeight=${live.innerHeight}
vvHeight=${fmt(live.vvHeight)}
vvWidth=${fmt(live.vvWidth)}
vvOffsetTop=${fmt(live.vvOffsetTop)}
vvOffsetLeft=${fmt(live.vvOffsetLeft)}
vvPageTop=${fmt(live.vvPageTop)}
vvPageLeft=${fmt(live.vvPageLeft)}
focusTag=${live.focusTag}
focusType=${live.focusType}
editableFocus=${live.editableFocus}
keyboardFromViewport=${live.keyboardFromViewport}
keyboardOpen=${live.keyboardOpen}
path=${live.path}`}
            </div>
          )}

          {live && (
            <div style={{ whiteSpace: "pre", marginBottom: "6px", borderTop: "1px solid #444", paddingTop: "4px" }}>
              {`--- NAV geometry ---
navCount=${live.navCount}
navParentTag=${fmtStr(live.navParentTag)}
navParentIsBody=${live.navParentIsBody}
navRect: top=${fmt(live.navRectTop)} bottom=${fmt(live.navRectBottom)} left=${fmt(live.navRectLeft)} right=${fmt(live.navRectRight)} w=${fmt(live.navRectWidth)} h=${fmt(live.navRectHeight)}
navComputed: position=${fmtStr(live.navComputedPosition)} top=${fmtStr(live.navComputedTop)} bottom=${fmtStr(live.navComputedBottom)} left=${fmtStr(live.navComputedLeft)} right=${fmtStr(live.navComputedRight)}
navComputed: transform=${fmtStr(live.navComputedTransform)}
navComputed: visibility=${fmtStr(live.navComputedVisibility)} display=${fmtStr(live.navComputedDisplay)} zIndex=${fmtStr(live.navComputedZIndex)}
layoutViewportBottom=${live.layoutViewportBottom}
visualViewportTop=${fmt(live.visualViewportTop)} visualViewportBottom=${fmt(live.visualViewportBottom)}
navGapToLayoutBottom=${fmt(live.navGapToLayoutBottom)}
navGapToVisualBottom=${fmt(live.navGapToVisualBottom)}
navDocumentTop=${fmt(live.navDocumentTop)} navDocumentBottom=${fmt(live.navDocumentBottom)}`}
            </div>
          )}

          {navBaseline && (
            <div style={{ whiteSpace: "pre", marginBottom: "6px", borderTop: "1px solid #444", paddingTop: "4px" }}>
              {`--- NAV baseline/delta ---
navBaselineRectTop=${navBaseline.rectTop} navBaselineRectBottom=${navBaseline.rectBottom}
navBaselineGapLayout=${navBaseline.gapLayout} navBaselineGapVisual=${navBaseline.gapVisual}
navBaselineScrollY=${navBaseline.scrollY}
navDeltaRectTop=${fmt(deltaRectTop)} navDeltaRectBottom=${fmt(deltaRectBottom)}
navDeltaGapLayout=${fmt(deltaGapLayout)} navDeltaGapVisual=${fmt(deltaGapVisual)}
navDeltaScrollY=${fmt(deltaScrollY)}`}
            </div>
          )}

          <div style={{ color: "#fff", marginBottom: "2px" }}>Snapshots ({snapshots.length})</div>
          <div style={{ maxHeight: "120px", overflowY: "auto", marginBottom: "6px" }}>
            {snapshots.map((s, i) => (
              <div key={`${s.label}-${s.timestamp}-${i}`}>
                {s.label}: y={s.scrollY} vvTop={fmt(s.vvOffsetTop)} vvH={fmt(s.vvHeight)} kb={String(s.keyboardOpen)} navTop={fmt(s.navRectTop)} navGapV={fmt(s.navGapToVisualBottom)}
              </div>
            ))}
          </div>

          <div style={{ color: "#fff", marginBottom: "2px" }}>Events ({events.length}/{MAX_EVENT_LOG})</div>
          <div style={{ maxHeight: "140px", overflowY: "auto" }}>
            {events.map((e, i) => (
              <div key={`${e.event}-${e.time}-${i}`}>
                {e.event}: y={e.scrollY} vvTop={fmt(e.vvOffsetTop)} vvH={fmt(e.vvHeight)} ih={e.innerHeight} navTop={fmt(e.navRectTop)} navGapV={fmt(e.navGapToVisualBottom)} navN={e.navCount}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
