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

// IOS-STANDALONE-FINAL-VISUAL-FIX-R4 §14: geometry-only diagnostic hook for
// the keyboard-region backdrop filler, so the final real-device JSON can
// prove (not just assert) that it now reaches the true physical bottom and
// is no longer clipped by a `overflow-hidden` ancestor. `parent*` fields
// describe its actual DOM parent (document.body after this fix) — a
// visible/non-hidden overflow there is itself evidence the R3 clipping
// cause no longer applies.
export interface ChatKeyboardBackdropGeometry {
  rect: RectGeometry
  computedPosition: string
  computedTop: string
  computedBottom: string
  computedHeight: string
  computedVisibility: string
  computedBackgroundColor: string
  computedZIndex: string
  computedPointerEvents: string
  parentOverflow: string
  parentOverflowY: string
  parentZIndex: string
}

export interface BrowserModeInfo {
  standalone: boolean
  displayModeStandalone: boolean
  visualViewportAvailable: boolean
  userAgent: string | null
}

// ============================================
// IOS-STANDALONE-POST-KEYBOARD-NAV-OCCLUSION-R6 — paint/occlusion probes
// ============================================
// R5 proved geometry (rect.bottom, the CSS `bottom` compensation) can be
// fully PASS while the operator still visually sees BottomNav partially
// hidden after a keyboard close/open cycle — a contradiction geometry
// alone can never explain. These types support a SAFE `elementsFromPoint`
// hit-test: they only ever carry structural, non-user-generated data
// (tag name, our own `data-ios-debug-role` attribute, a fixed ARIA role
// string, computed layout/paint style strings) — never innerText,
// textContent, form values, or dataset business/user/order identifiers.
// classNameSample and staticId are further sanitized (see
// sanitizeClassNameSample/sanitizeStaticId below) so that even a
// misbehaving ancestor component can never leak arbitrary page content
// through this path.
export interface SafePaintElementInfo {
  tagName: string
  debugRole: string | null
  ariaRole: string | null
  staticId: string | null
  classNameSample: string | null
  computedPosition: string
  computedZIndex: string
  computedPointerEvents: string
  computedVisibility: string
  computedOpacity: string
}

export interface OcclusionProbeResult {
  label: string
  x: number
  y: number
  elements: SafePaintElementInfo[]
  navElementPresent: boolean
  navStackIndex: number | null
  topElementIsNavOrDescendant: boolean
}

export interface DerivedGeometry {
  fixedViewportBottom: number
  // LEGACY (kept for report/test compatibility with R1-R4): a
  // self-consistency check between rect.bottom and the CSS `bottom`
  // formula through fixedViewportBottom — NOT a physical on-screen
  // distance. IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5 proved this
  // tautologically reads back whatever `bottom` the CSS declares,
  // regardless of whether the element is actually rendering in the
  // correct place on the physical screen — real R4 data showed it stays
  // "42" even during confirmed clipping. Use navPhysicalScreenBottomDistance
  // below as authority for "is this actually 42px from the real screen edge."
  navBottomDistance: number | null
  fabBottomDistance: number | null
  fabNavGap: number | null
  visualLayoutHeightDelta: number | null
  keyboardOffsetCandidate: number | null
  sheetVisibleGapBottom: number | null
  overlayVisibleGapBottom: number | null
  composerBottomGap: number | null
  // IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5 §13-14: the actually-
  // proven physical-screen metrics. innerHeight - rect.bottom, with NO
  // offsetTop term — real R4 data (133 keyboard-closed samples) proved
  // this is the formula that clusters tightly around the 42px design
  // target (variance 56) while `innerHeight - (rect.bottom + offsetTop)`
  // does not (variance 954, mean ~22) and would have called a confirmed
  // real ~110px floating state "correct." rect.bottom itself already IS
  // the physical on-screen Y-coordinate for a `position:fixed` element on
  // this WebKit build — no further adjustment needed.
  navPhysicalScreenBottomDistance: number | null
  fabPhysicalScreenBottomDistance: number | null
  navPhysicalOverflowBottom: number | null
  fabPhysicalOverflowBottom: number | null
  navPhysicalFullyVisible: boolean | null
  fabPhysicalFullyVisible: boolean | null
}

// IOS-STANDALONE-REAL-DEVICE-FIX-R3 §18: read-only mirror of
// Window.__iosScrollRestoreDebug (declared and written by
// ios-keyboard-fix.tsx — see that file for the single write site). Only
// numeric scroll positions and a fixed, non-sensitive reason string ever
// end up here — never input values or message content.
export interface ScrollRestoreDebugSnapshot {
  preFocusScrollY: number | null
  currentScrollYAtDecision: number
  shouldRestore: boolean
  restoreReason: string | null
  restoreTargetScrollY: number | null
  decidedAt: number
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
  chatKeyboardBackdrop: ChatKeyboardBackdropGeometry | null
  browserMode: BrowserModeInfo
  derived: DerivedGeometry
  scrollRestoreDebug: ScrollRestoreDebugSnapshot | null
  // IOS-STANDALONE-POST-KEYBOARD-NAV-OCCLUSION-R6: null whenever this
  // particular capture opted out of the elementsFromPoint hit-test (the
  // high-frequency live resize/scroll ticks skip it deliberately — see
  // ios-viewport-debug-panel.tsx's captureSnapshot — so the extra DOM work
  // never competes with the very scroll/compositor behavior under
  // investigation) or BottomNav itself wasn't found in the DOM.
  navOcclusionProbes: OcclusionProbeResult[] | null
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

  // IOS-STANDALONE-NAV-PHYSICAL-COORDINATE-FIX-R5: rect.bottom (raw, as
  // getBoundingClientRect reports it) already IS the physical on-screen
  // Y-coordinate for a position:fixed element on this WebKit build — no
  // offsetTop adjustment. innerHeight - rect.bottom is therefore the
  // actual physical distance from the true screen bottom, proven against
  // 133 real keyboard-closed R4 samples (median exactly 42, variance 56)
  // — see the module-level comment on DerivedGeometry.navBottomDistance
  // for why that older field is NOT this.
  const navPhysicalScreenBottomDistance = bottomNav ? windowInnerHeight - bottomNav.rect.bottom : null
  const fabPhysicalScreenBottomDistance = chatFab ? windowInnerHeight - chatFab.rect.bottom : null
  const navPhysicalOverflowBottom = bottomNav
    ? Math.max(0, bottomNav.rect.bottom - windowInnerHeight)
    : null
  const fabPhysicalOverflowBottom = chatFab ? Math.max(0, chatFab.rect.bottom - windowInnerHeight) : null
  const navPhysicalFullyVisible = navPhysicalOverflowBottom !== null ? navPhysicalOverflowBottom <= 1 : null
  const fabPhysicalFullyVisible = fabPhysicalOverflowBottom !== null ? fabPhysicalOverflowBottom <= 1 : null

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
    navPhysicalScreenBottomDistance,
    fabPhysicalScreenBottomDistance,
    navPhysicalOverflowBottom,
    fabPhysicalOverflowBottom,
    navPhysicalFullyVisible,
    fabPhysicalFullyVisible,
  }
}

// ─── R6: nav paint/occlusion probe geometry + sanitization (pure) ──────
// Five points sampled from BottomNav's own live rect, clamped at least
// NAV_PROBE_EDGE_MARGIN_PX inside its bounds so a probe can never land on
// a neighboring element merely due to sub-pixel rounding at the exact
// edge. TOP/MIDDLE/BOTTOM_CENTER answer "is nav occluded uniformly or
// only partially" (§9-10 — the operator specifically reported only PART
// of the nav disappearing); BOTTOM_LEFT/BOTTOM_RIGHT catch an occluder
// that only covers one side (e.g. a safe-area/notch-relative element).
export const NAV_PROBE_EDGE_MARGIN_PX = 2

export interface NavProbePoint {
  label: string
  x: number
  y: number
}

function clampToRange(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2
  return Math.min(Math.max(value, min), max)
}

export function computeNavProbePoints(rect: RectGeometry): NavProbePoint[] {
  const centerX = (rect.left + rect.right) / 2
  const topY = clampToRange(rect.top + NAV_PROBE_EDGE_MARGIN_PX, rect.top, rect.bottom)
  const middleY = (rect.top + rect.bottom) / 2
  const bottomY = clampToRange(rect.bottom - NAV_PROBE_EDGE_MARGIN_PX, rect.top, rect.bottom)
  const leftX = clampToRange(rect.left + NAV_PROBE_EDGE_MARGIN_PX, rect.left, rect.right)
  const rightX = clampToRange(rect.right - NAV_PROBE_EDGE_MARGIN_PX, rect.left, rect.right)

  return [
    { label: "NAV_TOP_CENTER", x: centerX, y: topY },
    { label: "NAV_MIDDLE_CENTER", x: centerX, y: middleY },
    { label: "NAV_BOTTOM_CENTER", x: centerX, y: bottomY },
    { label: "NAV_BOTTOM_LEFT", x: leftX, y: bottomY },
    { label: "NAV_BOTTOM_RIGHT", x: rightX, y: bottomY },
  ]
}

// Only ever exposes Tailwind/structural utility tokens relevant to
// diagnosing stacking/paint (position, z-index, opacity, backdrop/blur,
// overflow, transform, our own `ios-` prefix) — never arbitrary text, since
// no user/business content is ever encoded as a className token in this
// codebase's cn()-built classNames.
const SAFE_CLASS_TOKEN_PATTERN =
  /^(fixed|absolute|sticky|relative|static|isolate|isolation-|inset-|top-|bottom-|left-|right-|z-|opacity-|backdrop-|blur|filter|overflow-|translate-|transform|will-change-|contain-|mix-blend-|ios-|bg-|border|shadow|rounded)/

export function sanitizeClassNameSample(className: string): string | null {
  if (!className) return null
  const tokens = className
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && SAFE_CLASS_TOKEN_PATTERN.test(t))
  if (tokens.length === 0) return null
  return tokens.slice(0, 12).join(" ")
}

// Rejects anything containing digits, uppercase, underscores, or colons —
// the shape of generated/dynamic ids (Radix's `radix-:r3a:`, order/user
// ids) — only a plain lowercase-and-hyphen static id can ever pass, and
// this codebase has no such ids marking sensitive elements.
const SAFE_STATIC_ID_PATTERN = /^[a-z][a-z-]{0,40}$/

export function sanitizeStaticId(id: string): string | null {
  if (!id) return null
  return SAFE_STATIC_ID_PATTERN.test(id) ? id : null
}

export const SAFE_PAINT_ELEMENT_ALLOWED_KEYS = [
  "tagName",
  "debugRole",
  "ariaRole",
  "staticId",
  "classNameSample",
  "computedPosition",
  "computedZIndex",
  "computedPointerEvents",
  "computedVisibility",
  "computedOpacity",
].sort()

export const OCCLUSION_PROBE_RESULT_ALLOWED_KEYS = [
  "label",
  "x",
  "y",
  "elements",
  "navElementPresent",
  "navStackIndex",
  "topElementIsNavOrDescendant",
].sort()

// NOT_OCCLUDED_DOM / OCCLUDED_BY_ELEMENT is exactly what elementsFromPoint
// can prove from the DOM paint order. A third possible real-world class,
// UNKNOWN_COMPOSITOR (geometry PASS + hit-test says nav topmost + physical
// screenshot still shows it missing — §9, §20), is deliberately NOT
// something this function can return: it requires comparing this result
// against the operator's physical screenshot, a judgment call made when
// writing the report, not a DOM-observable fact.
export type OcclusionClass = "NOT_OCCLUDED_DOM" | "OCCLUDED_BY_ELEMENT"

export function classifyProbeOcclusion(probe: {
  topElementIsNavOrDescendant: boolean
}): OcclusionClass {
  return probe.topElementIsNavOrDescendant ? "NOT_OCCLUDED_DOM" : "OCCLUDED_BY_ELEMENT"
}

// Mirrors isIosDebugFlagEnabled's shape — the solid/no-backdrop A/B
// compositor probe (§12) is a STRICT subset of the debug flag: it can
// never activate on its own, only when both are present, so a stray
// `?navPaintProbe=solid` alone (e.g. a bookmarked/shared URL) can never
// change what a normal user sees.
export function isNavPaintProbeSolidEnabled(search: string): boolean {
  const params = new URLSearchParams(search)
  return isIosDebugFlagEnabled(search) && params.get("navPaintProbe") === "solid"
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

// IOS-STANDALONE-REAL-DEVICE-FIX-R3 §19: a real standalone capture proved
// AUTO_CHAT_KEYBOARD_OPEN_STABLE fired too early — the DOM class
// (`ios-keyboard-open` + ChatSheet present) was already stable for 2
// observations, but the underlying visualViewport geometry was still
// mid-transition (vv.height=729/offsetTop=49, then ~155ms later the real
// settled state vv.height=394/offsetTop=403). Class-only stability is not
// enough; this now also requires vv.height/offsetTop to be unchanged
// (within MILESTONE_GEOMETRY_STABLE_TOLERANCE_PX) across the same
// observations — the same tolerance-based "hasn't moved in N ticks" idea
// ios-keyboard-fix.tsx's own waitForViewportStableThenMaybeRestore already
// uses (STABLE_TOLERANCE_PX), applied here to milestone classification
// instead of restore timing.
export interface MilestoneGeometry {
  vvHeight: number | null
  vvOffsetTop: number | null
}

export const MILESTONE_GEOMETRY_STABLE_TOLERANCE_PX = 1

function isGeometryStable(previous: MilestoneGeometry | null, current: MilestoneGeometry): boolean {
  if (!previous) return false
  if (previous.vvHeight === null || current.vvHeight === null) return true
  if (previous.vvOffsetTop === null || current.vvOffsetTop === null) return true
  return (
    Math.abs(previous.vvHeight - current.vvHeight) <= MILESTONE_GEOMETRY_STABLE_TOLERANCE_PX &&
    Math.abs(previous.vvOffsetTop - current.vvOffsetTop) <= MILESTONE_GEOMETRY_STABLE_TOLERANCE_PX
  )
}

export const MILESTONE_STABLE_THRESHOLD = 2

export interface MilestoneTrackerState {
  lastClass: KeyboardMilestoneClass | null
  lastGeometry: MilestoneGeometry | null
  stableCount: number
  baselineFired: boolean
  baselineGeometry: MilestoneGeometry | null
}

export function createInitialMilestoneTrackerState(): MilestoneTrackerState {
  return {
    lastClass: null,
    lastGeometry: null,
    stableCount: 0,
    baselineFired: false,
    baselineGeometry: null,
  }
}

export type MilestoneLabel =
  | "AUTO_BASELINE_STABLE"
  | "AUTO_KEYBOARD_OPEN_STABLE"
  | "AUTO_CHAT_KEYBOARD_OPEN_STABLE"
  | "AUTO_AFTER_KEYBOARD_CLOSE"
  | "AUTO_VIEWPORT_RESTORED_TO_BASELINE"

export interface MilestoneTrackerResult {
  state: MilestoneTrackerState
  fire: MilestoneLabel | null
}

// Called once per new classification+geometry observation (e.g. once per
// throttled live-update tick). Fires AUTO_BASELINE_STABLE the first time
// the page is observed "closed" (no keyboard) with stable class AND stable
// geometry for MILESTONE_STABLE_THRESHOLD consecutive observations — only
// once, ever, per tracker instance; its geometry is remembered as the
// baseline to compare future restorations against.
// AUTO_*_KEYBOARD_OPEN_STABLE fires every time a keyboard class AND its
// geometry hold stable for that same threshold (re-arms on the next open).
// AUTO_AFTER_KEYBOARD_CLOSE fires immediately on the class edge back to
// "closed" from either keyboard class — no stability wait, it just marks
// "the keyboard just closed" for the timeline (§20: this is a TEMPORAL
// marker only, not a claim the viewport geometry is actually correct — see
// IOS-MOBILE-REAL-DEVICE-R2-PWA-PREPARATION's own AUTO_FINAL_STABLE, fired
// by the component on a fixed delay after this, which is ALSO purely
// temporal). AUTO_VIEWPORT_RESTORED_TO_BASELINE is the geometry-verified
// counterpart: it only fires once "closed" is stable again AND its
// geometry actually matches the recorded baseline — distinguishing "time
// has passed and nothing is visibly changing" (which R3's real device
// proved can still be the STALE, wrong 68px-residual state) from "the
// viewport genuinely returned to where it started."
export function advanceMilestoneTracker(
  state: MilestoneTrackerState,
  cls: KeyboardMilestoneClass,
  geometry: MilestoneGeometry
): MilestoneTrackerResult {
  const sameClass = state.lastClass === cls
  const stableCount = sameClass && isGeometryStable(state.lastGeometry, geometry) ? state.stableCount + 1 : 1
  const justStabilized = stableCount === MILESTONE_STABLE_THRESHOLD
  const closedAfterKeyboard =
    state.lastClass !== null &&
    state.lastClass !== cls &&
    cls === "closed" &&
    (state.lastClass === "normal-keyboard" || state.lastClass === "chat-keyboard")

  let fire: MilestoneLabel | null = null
  let baselineFired = state.baselineFired
  let baselineGeometry = state.baselineGeometry

  if (!baselineFired && cls === "closed" && justStabilized) {
    fire = "AUTO_BASELINE_STABLE"
    baselineFired = true
    baselineGeometry = geometry
  } else if (justStabilized && cls === "normal-keyboard") {
    fire = "AUTO_KEYBOARD_OPEN_STABLE"
  } else if (justStabilized && cls === "chat-keyboard") {
    fire = "AUTO_CHAT_KEYBOARD_OPEN_STABLE"
  } else if (closedAfterKeyboard) {
    fire = "AUTO_AFTER_KEYBOARD_CLOSE"
  } else if (
    baselineFired &&
    baselineGeometry &&
    cls === "closed" &&
    justStabilized &&
    isGeometryStable(baselineGeometry, geometry)
  ) {
    fire = "AUTO_VIEWPORT_RESTORED_TO_BASELINE"
  }

  return {
    state: { lastClass: cls, lastGeometry: geometry, stableCount, baselineFired, baselineGeometry },
    fire,
  }
}

// ─── Query-flag gate (pure, testable) ────────────────────────────────────
// IOS-PWA-DEBUG-LAUNCH-FIX-R2A: this used to be supplemented by a
// localStorage flag (IOS_DEBUG_STORAGE_KEY) meant to carry ?iosDebug=1
// from a Safari tab into the installed standalone PWA. That never could
// have worked — Safari and an installed Home Screen web app are separate
// WebKit storage contexts on iOS and do not share localStorage — confirmed
// by the operator's real device (panel worked in Safari, not after
// installing). Removed. The actual fix is
// public/manifest-cliente.json's start_url, which now embeds
// ?iosDebug=1 directly for TESTING, so every cold launch from the
// installed icon already carries the flag — this function alone is
// sufficient again.
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
  "chatKeyboardBackdrop",
  "browserMode",
  "derived",
  "scrollRestoreDebug",
  "navOcclusionProbes",
].sort()

export const SCROLL_RESTORE_DEBUG_ALLOWED_KEYS = [
  "preFocusScrollY",
  "currentScrollYAtDecision",
  "shouldRestore",
  "restoreReason",
  "restoreTargetScrollY",
  "decidedAt",
].sort()

export const CHAT_KEYBOARD_BACKDROP_ALLOWED_KEYS = [
  "rect",
  "computedPosition",
  "computedTop",
  "computedBottom",
  "computedHeight",
  "computedVisibility",
  "computedBackgroundColor",
  "computedZIndex",
  "computedPointerEvents",
  "parentOverflow",
  "parentOverflowY",
  "parentZIndex",
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
  "navPhysicalScreenBottomDistance",
  "fabPhysicalScreenBottomDistance",
  "navPhysicalOverflowBottom",
  "fabPhysicalOverflowBottom",
  "navPhysicalFullyVisible",
  "fabPhysicalFullyVisible",
].sort()
