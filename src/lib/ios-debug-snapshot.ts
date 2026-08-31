// ============================================
// IOS-MOBILE-FIX-AND-REAL-DEVICE-INSTRUMENTATION-R1 — pure snapshot logic
// ============================================
// Pure, DOM-free types + functions for the TEMPORARY real-iPhone geometry
// debug panel (src/components/pwa/ios-viewport-debug-panel.tsx). Kept
// separate from that component for the same reason
// src/lib/ios-scroll-restore-decision.ts is separate from
// src/components/pwa/ios-keyboard-fix.tsx: the impure DOM-reading shell is
// thin and hard to unit test, the math/serialization is not. Nothing here
// ever reads input values, message text, tokens, cookies, or localStorage —
// only numeric geometry, a fixed whitelist of computed-style strings, and
// className strings of our own known dock elements.

export interface RectGeometry {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface WindowGeometry {
  innerWidth: number
  innerHeight: number
  scrollX: number
  scrollY: number
}

export interface DocumentElementGeometry {
  clientWidth: number
  clientHeight: number
  className: string
}

export interface BodyGeometry {
  className: string
  computedPosition: string
  computedTop: string
  computedOverflow: string
  computedOverflowY: string
  computedHeight: string
  computedMinHeight: string
}

export interface VisualViewportGeometry {
  width: number
  height: number
  offsetTop: number
  offsetLeft: number
  scale: number
}

export interface DockElementGeometry {
  rect: RectGeometry
  computedPosition: string
  computedBottom: string
  computedVisibility: string
  computedPointerEvents: string
  computedTransform: string
}

export interface OverlayElementGeometry {
  rect: RectGeometry
  computedPosition: string
  computedInset: string
  computedHeight: string
}

export interface SheetElementGeometry {
  rect: RectGeometry
  computedPosition: string
  computedTop: string
  computedBottom: string
  computedHeight: string
  computedTransform: string
}

export interface ComposerElementGeometry {
  rect: RectGeometry
  computedPosition: string
  computedBottom: string
  computedTransform: string
}

export interface BrowserModeInfo {
  standalone: boolean
  displayModeStandalone: boolean
  visualViewportAvailable: boolean
  userAgent: string | null
}

export interface DerivedGeometry {
  navBottomDistance: number | null
  fabBottomDistance: number | null
  fabNavGap: number | null
  visualLayoutHeightDelta: number | null
  keyboardOffsetCandidate: number | null
  sheetVisibleGapBottom: number | null
  overlayVisibleGapBottom: number | null
}

export interface GeometrySnapshot {
  timestamp: number
  captureLabel: string
  eventType: string
  pathname: string | null
  window: WindowGeometry
  documentElement: DocumentElementGeometry
  body: BodyGeometry
  visualViewport: VisualViewportGeometry | null
  bottomNav: DockElementGeometry | null
  chatFab: DockElementGeometry | null
  chatOverlay: OverlayElementGeometry | null
  chatSheet: SheetElementGeometry | null
  chatComposer: ComposerElementGeometry | null
  browserMode: BrowserModeInfo
  derived: DerivedGeometry
}

export interface DebugExportPayload {
  version: number
  capturedAt: number
  browserMode: BrowserModeInfo
  manualCaptures: GeometrySnapshot[]
  events: GeometrySnapshot[]
}

// ─── Derived values (§17) ───────────────────────────────────────────────
// All formulas use viewport-relative rects exactly as getBoundingClientRect
// returns them (already relative to the layout viewport's top-left), so
// "viewport reference bottom" is window.innerHeight and the visual
// viewport's visible bottom is offsetTop + height. Returns null field-by-
// field when an input is missing — never fabricates a value for an absent
// element (explicit requirement).
export function computeDerivedGeometry(input: {
  windowInnerHeight: number
  visualViewport: VisualViewportGeometry | null
  bottomNav: DockElementGeometry | null
  chatFab: DockElementGeometry | null
  chatSheet: SheetElementGeometry | null
  chatOverlay: OverlayElementGeometry | null
}): DerivedGeometry {
  const { windowInnerHeight, visualViewport, bottomNav, chatFab, chatSheet, chatOverlay } = input

  const navBottomDistance = bottomNav ? windowInnerHeight - bottomNav.rect.bottom : null
  const fabBottomDistance = chatFab ? windowInnerHeight - chatFab.rect.bottom : null
  const fabNavGap = bottomNav && chatFab ? bottomNav.rect.top - chatFab.rect.bottom : null

  const visualLayoutHeightDelta = visualViewport ? windowInnerHeight - visualViewport.height : null
  const keyboardOffsetCandidate = visualViewport
    ? Math.max(0, windowInnerHeight - visualViewport.height - visualViewport.offsetTop)
    : null

  const visibleBottom = visualViewport ? visualViewport.offsetTop + visualViewport.height : null
  const sheetVisibleGapBottom =
    visibleBottom !== null && chatSheet ? visibleBottom - chatSheet.rect.bottom : null
  const overlayVisibleGapBottom =
    visibleBottom !== null && chatOverlay ? visibleBottom - chatOverlay.rect.bottom : null

  return {
    navBottomDistance,
    fabBottomDistance,
    fabNavGap,
    visualLayoutHeightDelta,
    keyboardOffsetCandidate,
    sheetVisibleGapBottom,
    overlayVisibleGapBottom,
  }
}

// ─── Bounded ring buffer (§20) ──────────────────────────────────────────
export const DEBUG_EVENT_BUFFER_MAX = 150

export interface RingBuffer<T> {
  push(item: T): void
  toArray(): T[]
  clear(): void
  readonly length: number
}

export function createRingBuffer<T>(maxSize: number): RingBuffer<T> {
  let items: T[] = []
  return {
    push(item: T) {
      items.push(item)
      if (items.length > maxSize) {
        items = items.slice(items.length - maxSize)
      }
    },
    toArray() {
      return items.slice()
    },
    clear() {
      items = []
    },
    get length() {
      return items.length
    },
  }
}

// ─── Export payload (§24) ───────────────────────────────────────────────
export function buildExportPayload(input: {
  browserMode: BrowserModeInfo
  manualCaptures: GeometrySnapshot[]
  events: GeometrySnapshot[]
  now: number
}): DebugExportPayload {
  return {
    version: 1,
    capturedAt: input.now,
    browserMode: input.browserMode,
    manualCaptures: input.manualCaptures,
    events: input.events,
  }
}

// ─── Human-readable summary (§25) ───────────────────────────────────────
export function buildTextSummary(payload: DebugExportPayload): string {
  const lines: string[] = []
  lines.push(`iOS Viewport Debug — ${payload.manualCaptures.length} manual captures`)
  for (const snap of payload.manualCaptures) {
    lines.push(`--- ${snap.captureLabel} (${snap.eventType}) ---`)
    lines.push(`innerHeight=${snap.window.innerHeight} scrollY=${snap.window.scrollY}`)
    if (snap.visualViewport) {
      lines.push(
        `vv.height=${snap.visualViewport.height} vv.offsetTop=${snap.visualViewport.offsetTop}`
      )
    }
    if (snap.bottomNav) {
      lines.push(
        `nav bottom=${snap.bottomNav.computedBottom} rect.bottom=${snap.bottomNav.rect.bottom} visibility=${snap.bottomNav.computedVisibility}`
      )
    }
    if (snap.chatFab) {
      lines.push(
        `fab bottom=${snap.chatFab.computedBottom} rect.bottom=${snap.chatFab.rect.bottom} visibility=${snap.chatFab.computedVisibility}`
      )
    }
    lines.push(`fabNavGap=${snap.derived.fabNavGap ?? "null"}`)
  }
  return lines.join("\n")
}

// ─── Query-flag gate (pure, testable) ───────────────────────────────────
export function isIosDebugFlagEnabled(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get("iosDebug") === "1"
}

// The exact whitelisted key sets every geometry object must have — used by
// tests to guarantee the serializer can never grow an extra field (input
// value, message text, token, etc.) without a test failing first.
export const GEOMETRY_SNAPSHOT_ALLOWED_KEYS = [
  "timestamp",
  "captureLabel",
  "eventType",
  "pathname",
  "window",
  "documentElement",
  "body",
  "visualViewport",
  "bottomNav",
  "chatFab",
  "chatOverlay",
  "chatSheet",
  "chatComposer",
  "browserMode",
  "derived",
].sort()

export const DOCK_ELEMENT_ALLOWED_KEYS = [
  "rect",
  "computedPosition",
  "computedBottom",
  "computedVisibility",
  "computedPointerEvents",
  "computedTransform",
].sort()

export const RECT_ALLOWED_KEYS = ["top", "left", "right", "bottom", "width", "height"].sort()
