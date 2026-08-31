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
  fixedViewportBottom: number
  navBottomDistance: number | null
  fabBottomDistance: number | null
  fabNavGap: number | null
  visualLayoutHeightDelta: number | null
  keyboardOffsetCandidate: number | null
  sheetVisibleGapBottom: number | null
  overlayVisibleGapBottom: number | null
  composerBottomGap: number | null
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

// ─── Derived values (§17, corrected by IOS-MOBILE-REAL-DEVICE-R2) ───────
// IOS-MOBILE-REAL-DEVICE-R2-PWA-PREPARATION: the R1 version of this function
// used `window.innerHeight` (and, for the sheet/overlay pair, `offsetTop +
// height`) as "the" viewport-bottom reference for every fixed-position
// element. A real iPhone Safari capture (18.7, Safari 26.0.1) proved that
// wrong: getBoundingClientRect() on this WebKit build reports `fixed`
// elements' rects in a frame that is shifted by `visualViewport.offsetTop`
// whenever it is non-zero (Safari toolbar collapse, or the layout resize
// iOS does under `interactiveWidget:"resizes-content"` when the keyboard
// opens) — confirmed on real BottomNav data (its CSS `bottom` is a
// hardcoded static 42px; `innerHeight - rect.bottom` matched that 42px in
// only 131/165 real captures, while `(innerHeight - offsetTop) -
// rect.bottom` matched it in all 165/165, including every state where
// offsetTop was 10px or ~359px). The same correction fixes the sheet/
// overlay/composer gap formulas, which the R1 panel reported as ~359px
// during keyboard-open even though 146/146 real Overlay+Sheet paired
// snapshots showed 0px actual top/bottom/height difference between them —
// the "gap" was a diagnostic artifact of the wrong reference frame, not a
// real layout bug (see codex-reports/IOS_MOBILE_REAL_DEVICE_R2_PWA_PREPARATION.md).
//
// fixedViewportBottom is that corrected reference frame, exposed directly
// (not just baked into each *_bottom field) so a future analysis never has
// to silently recompute it. Falls back to windowInnerHeight when
// visualViewport itself is unavailable (offsetTop assumed 0), matching the
// old behavior for browsers without the API. Still returns null
// field-by-field when the corresponding element is absent — never
// fabricates a value for a missing element.
export function computeDerivedGeometry(input: {
  windowInnerHeight: number
  visualViewport: VisualViewportGeometry | null
  bottomNav: DockElementGeometry | null
  chatFab: DockElementGeometry | null
  chatSheet: SheetElementGeometry | null
  chatOverlay: OverlayElementGeometry | null
  chatComposer: ComposerElementGeometry | null
}): DerivedGeometry {
  const { windowInnerHeight, visualViewport, bottomNav, chatFab, chatSheet, chatOverlay, chatComposer } =
    input

  const fixedViewportBottom = windowInnerHeight - (visualViewport?.offsetTop ?? 0)

  const navBottomDistance = bottomNav ? fixedViewportBottom - bottomNav.rect.bottom : null
  const fabBottomDistance = chatFab ? fixedViewportBottom - chatFab.rect.bottom : null
  // fabNavGap is a difference between two rects already in the same
  // coordinate frame, so it needs no fixedViewportBottom correction — a
  // frame shift cancels out of a rect-to-rect subtraction.
  const fabNavGap = bottomNav && chatFab ? bottomNav.rect.top - chatFab.rect.bottom : null

  const visualLayoutHeightDelta = visualViewport ? windowInnerHeight - visualViewport.height : null
  const keyboardOffsetCandidate = visualViewport
    ? Math.max(0, windowInnerHeight - visualViewport.height - visualViewport.offsetTop)
    : null

  const sheetVisibleGapBottom = chatSheet ? fixedViewportBottom - chatSheet.rect.bottom : null
  const overlayVisibleGapBottom = chatOverlay ? fixedViewportBottom - chatOverlay.rect.bottom : null
  const composerBottomGap = chatComposer ? fixedViewportBottom - chatComposer.rect.bottom : null

  return {
    fixedViewportBottom,
    navBottomDistance,
    fabBottomDistance,
    fabNavGap,
    visualLayoutHeightDelta,
    keyboardOffsetCandidate,
    sheetVisibleGapBottom,
    overlayVisibleGapBottom,
    composerBottomGap,
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

// ─── Automatic milestone capture (IOS-MOBILE-REAL-DEVICE-R2-PWA-PREPARATION §10) ─
// Pure classification + edge-detection so the panel can label meaningful
// moments (baseline, a normal input's keyboard opening, the chat
// composer's keyboard opening, keyboard closing) WITHOUT the operator
// having to tap a capture button while the native keyboard is on screen —
// tapping the panel itself can trigger a focusout and contaminate the very
// state being measured. classifyKeyboardMilestone/advanceMilestoneTracker
// take plain data (never touch the DOM) so they're unit-testable exactly
// like the rest of this module; the impure polling (feeding them a new
// classification on every viewport/focus event) lives in the React
// component.
export type KeyboardMilestoneClass = "closed" | "normal-keyboard" | "chat-keyboard"

export function classifyKeyboardMilestone(input: {
  keyboardOpen: boolean
  hasChatSheet: boolean
}): KeyboardMilestoneClass {
  if (!input.keyboardOpen) return "closed"
  return input.hasChatSheet ? "chat-keyboard" : "normal-keyboard"
}

export const MILESTONE_STABLE_THRESHOLD = 2

export interface MilestoneTrackerState {
  lastClass: KeyboardMilestoneClass | null
  stableCount: number
  baselineFired: boolean
}

export function createInitialMilestoneTrackerState(): MilestoneTrackerState {
  return { lastClass: null, stableCount: 0, baselineFired: false }
}

export type MilestoneLabel =
  | "AUTO_BASELINE_STABLE"
  | "AUTO_KEYBOARD_OPEN_STABLE"
  | "AUTO_CHAT_KEYBOARD_OPEN_STABLE"
  | "AUTO_AFTER_KEYBOARD_CLOSE"

export interface MilestoneTrackerResult {
  state: MilestoneTrackerState
  fire: MilestoneLabel | null
}

// Called once per new classification observation (e.g. once per throttled
// live-update tick). Fires AUTO_BASELINE_STABLE the first time the page is
// observed "closed" (no keyboard) for MILESTONE_STABLE_THRESHOLD
// consecutive observations — only once, ever, per tracker instance.
// AUTO_*_KEYBOARD_OPEN_STABLE fires every time a keyboard class holds
// stable for that same threshold (re-arms on the next open, since the
// operator may reproduce the cycle more than once). AUTO_AFTER_KEYBOARD_CLOSE
// fires immediately on the edge back to "closed" from either keyboard
// class — no stability wait needed, it just marks "the keyboard just
// closed" for the timeline.
export function advanceMilestoneTracker(
  state: MilestoneTrackerState,
  cls: KeyboardMilestoneClass
): MilestoneTrackerResult {
  const stableCount = state.lastClass === cls ? state.stableCount + 1 : 1
  const justStabilized = stableCount === MILESTONE_STABLE_THRESHOLD
  const closedAfterKeyboard =
    state.lastClass !== null &&
    state.lastClass !== cls &&
    cls === "closed" &&
    (state.lastClass === "normal-keyboard" || state.lastClass === "chat-keyboard")

  let fire: MilestoneLabel | null = null
  let baselineFired = state.baselineFired

  if (!baselineFired && cls === "closed" && justStabilized) {
    fire = "AUTO_BASELINE_STABLE"
    baselineFired = true
  } else if (justStabilized && cls === "normal-keyboard") {
    fire = "AUTO_KEYBOARD_OPEN_STABLE"
  } else if (justStabilized && cls === "chat-keyboard") {
    fire = "AUTO_CHAT_KEYBOARD_OPEN_STABLE"
  } else if (closedAfterKeyboard) {
    fire = "AUTO_AFTER_KEYBOARD_CLOSE"
  }

  return { state: { lastClass: cls, stableCount, baselineFired }, fire }
}

// ─── Query-flag gate (pure, testable) ───────────────────────────────────
export function isIosDebugFlagEnabled(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get("iosDebug") === "1"
}

// ─── Standalone-PWA persistence (IOS-MOBILE-REAL-DEVICE-R2-PWA-PREPARATION) ─
// manifest-cliente.json's start_url is "/cliente" with no query string, so
// launching the installed TESTING PWA from the Home Screen icon always
// lands on a URL without ?iosDebug=1 — the query flag alone can never
// re-arm the panel after installation. IOS_DEBUG_STORAGE_KEY is the
// localStorage key the panel writes once it sees the query flag (so a
// single "open the link once in Safari, tap Add to Home Screen" is enough)
// and reads on every mount thereafter — scoped to this TESTING origin
// only, never touching manifest.json/start_url/scope, and with zero effect
// on any user who never passed ?iosDebug=1 in the first place.
export const IOS_DEBUG_STORAGE_KEY = "deligo-ios-debug-enabled"

export function resolveIosDebugEnabled(search: string, storedFlag: string | null): boolean {
  return isIosDebugFlagEnabled(search) || storedFlag === "1"
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

export const DERIVED_GEOMETRY_ALLOWED_KEYS = [
  "fixedViewportBottom",
  "navBottomDistance",
  "fabBottomDistance",
  "fabNavGap",
  "visualLayoutHeightDelta",
  "keyboardOffsetCandidate",
  "sheetVisibleGapBottom",
  "overlayVisibleGapBottom",
  "composerBottomGap",
].sort()
