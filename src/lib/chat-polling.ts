// Pure, browser-agnostic decision helpers for Chat HTTP polling cadence.
// See CODEX_REPORT.md, "SHARED REALTIME — CHAT POLLING REDUCTION" (baseline
// design, then a focal correction) for the full rationale. Every function
// here is a pure function of its explicit inputs — no fetch, no cookies,
// no token/JWT, no localStorage/sessionStorage, no raw socket, no room
// leases, no DB/Railway knowledge.
//
// CORRECTED AUTHORITY MODEL: deliberately never takes RealtimeConnectionState
// / `snapshot.state` as an input. Chat's own room lease is acquired only
// while one specific conversation is open (never while closed, never while
// showing the conversation list, never covering more than one pedido at a
// time — see chat-sheet.tsx's lease effect), so a generic "connected"
// physical-socket signal proves nothing about whether the GLOBAL unread
// count (`/api/chat/no-leidos`, aggregated across every active pedido) or
// the GLOBAL conversation list (`/api/chat/conversaciones`, active+archived
// across every pedido) is actually covered by realtime. Socket state must
// never gate either endpoint's polling cadence — only UI visibility state
// does.

import type { RealtimeResyncReason } from "@/lib/realtime-types"

export const UNREAD_VISIBLE_INTERVAL_MS = 15_000
export const CONVERSATIONS_LIST_INTERVAL_MS = 10_000

// `null` means "suspended — no recurring timer should run right now."
export type ChatPollInterval = number | null

export interface UnreadPollInputs {
  canChat: boolean
  documentVisible: boolean
}

// ChatFab is the sole recurring owner of /api/chat/no-leidos. Its cadence
// depends only on chat eligibility and tab visibility — never on socket
// state, never on whether the Chat sheet itself is open (the sheet's own
// open/close state does not change whether the GLOBAL unread count needs
// refreshing; it only ever adds an immediate one-shot catch-up, handled
// separately in the component, not by this recurring-interval decision).
export function selectUnreadPollInterval(inputs: UnreadPollInputs): ChatPollInterval {
  if (!inputs.canChat) return null
  if (!inputs.documentVisible) return null
  return UNREAD_VISIBLE_INTERVAL_MS
}

export interface ConversationsPollInputs {
  isSheetOpen: boolean
  activePedidoId: string | null
  documentVisible: boolean
}

// ChatSheet is the sole recurring owner of /api/chat/conversaciones. Its
// cadence depends only on: is the sheet open, is a specific conversation
// currently active (if so the list isn't visible, so suspend entirely —
// not merely slow down; see the focal design correction's ACTIVE_CHATVIEW
// section), and tab visibility. Never socket state.
export function selectConversationsPollInterval(inputs: ConversationsPollInputs): ChatPollInterval {
  if (!inputs.isSheetOpen) return null
  if (!inputs.documentVisible) return null
  if (inputs.activePedidoId !== null) return null
  return CONVERSATIONS_LIST_INTERVAL_MS
}

// Explicit allowlist, not a default-allow catch-all. A resync reason
// triggers a Chat catch-up only when BOTH:
//   (a) it currently has a real call site in realtime-manager.ts (verified
//       by grep against requestResync()/scheduleWake() call sites), and
//   (b) it represents a genuine connection-lifecycle event Chat's own
//       foreground-episode listener cannot otherwise observe.
//
// "foreground" is excluded even though it is reachable: it can only ever
// fire while Chat itself already holds a room lease (handleVisibilityChange
// is gated by hasGlobalRealtimeDemand()), which is exactly the case where
// Chat's own foreground-episode listener already independently observed
// the same visibilitychange/focus transition directly — a manager-relayed
// duplicate adds nothing.
//
// "reconnect", "suspected-gap", and "manual" exist in the
// RealtimeResyncReason type but have NO current call site anywhere in
// realtime-manager.ts. They deliberately default to false (not true) so
// that a future call site added for an unrelated purpose cannot silently
// start a Chat HTTP fetch without an explicit, reviewed addition to this
// allowlist.
const CHAT_CATCHUP_RESYNC_REASONS: ReadonlySet<RealtimeResyncReason> = new Set([
  "initial-connect", // first-ever connection: Chat has no other signal a socket just came alive
  "reauth", // token refresh cycle: server-side state may have drifted while it was in flight
  "room-rejoin", // a room was silently dropped and rejoined: worth confirming nothing was missed
  "online", // network connectivity recovered: Chat does not listen to navigator.onLine itself
])

export function shouldResyncTriggerChatCatchup(reason: RealtimeResyncReason): boolean {
  return CHAT_CATCHUP_RESYNC_REASONS.has(reason)
}

// Foreground-episode coalescing: a lifecycle semantic, not a timing/TTL
// heuristic. One real "the user was away and came back" episode — however
// it is actually signaled by the browser (visibilitychange alone, blur+
// focus alone, or blur+hidden together followed by focus+visible together,
// in either order) — must produce exactly one catch-up, not one per event.
//
// Rule: `blur` or `hidden` marks a catch-up as pending (idempotent — firing
// either or both while already pending changes nothing). Whichever of
// `visible` or `focus` fires FIRST while a catch-up is pending consumes it
// (clears `pending`) and reports that a catch-up should run; `focus` only
// consumes while the tab is also currently visible (so a focus event that
// arrives while the tab is still hidden — e.g. focusing a background browser
// window — does not itself trigger a catch-up; the later `visible` event
// will). Whichever event consumes it first wins; the other becomes a no-op
// for that same episode. Initial mount is a separate, independent
// immediate-fetch reason and never touches this state at all.
export type ForegroundEpisodeEvent = "blur" | "hidden" | "visible" | "focus"

export interface ForegroundEpisodeState {
  pending: boolean
}

// Seeded from the CURRENT document visibility at the moment tracking starts
// (effect setup), not a hardcoded `false`. If the document is already
// hidden when tracking begins (e.g. the tab was backgrounded before this
// effect instance ever registered its `blur`/`hidden` listeners — a
// hidden-mount, or a hidden re-registration caused by a dependency change),
// no `hidden` DOM event will ever fire during this instance's lifetime to
// set `pending` — the transition into hidden already happened. Without this
// seed, the eventual `visible` event would see `pending: false` and
// silently skip the catch-up the whole mechanism exists to guarantee.
export function createForegroundEpisodeState(documentVisible: boolean): ForegroundEpisodeState {
  return { pending: !documentVisible }
}

export interface ForegroundEpisodeResult {
  shouldCatchup: boolean
}

// Mutates `state` in place (the caller owns one instance per polling
// owner/effect lifetime) and returns whether this specific event should
// trigger a catch-up fetch.
export function applyForegroundEpisodeEvent(
  state: ForegroundEpisodeState,
  event: ForegroundEpisodeEvent,
  documentVisible: boolean,
): ForegroundEpisodeResult {
  if (event === "blur" || event === "hidden") {
    state.pending = true
    return { shouldCatchup: false }
  }
  if (event === "visible") {
    if (!state.pending) return { shouldCatchup: false }
    state.pending = false
    return { shouldCatchup: true }
  }
  // event === "focus"
  if (!state.pending || !documentVisible) return { shouldCatchup: false }
  state.pending = false
  return { shouldCatchup: true }
}
