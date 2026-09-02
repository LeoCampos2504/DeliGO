"use client"

import { useEffect, useLayoutEffect, useRef, useCallback, useState } from "react"
import { createPortal } from "react-dom"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useChatStore } from "@/store/chat-store"
import { useAuthStore } from "@/store/auth-store"
import { ConversationList } from "./conversation-list"
import { ChatView } from "./chat-view"
import { MessageCircle, Loader2, WifiOff, RefreshCw } from "lucide-react"
import { SheetDescription } from "@/components/ui/sheet"
import { useRealtime } from "@/hooks/use-realtime"
import {
  applyForegroundEpisodeEvent,
  createForegroundEpisodeState,
  selectConversationsPollInterval,
  shouldResyncTriggerChatCatchup,
} from "@/lib/chat-polling"
import { createCoverageToken, type ChatRoomCoverageToken } from "@/lib/chat-history-resync"
import { evaluateReceiptEligibility } from "@/lib/chat-push-presentation"
import { deriveChatConnectionPresentation } from "@/lib/chat-connection-presentation"
import type { ChatMessagePresentationCandidate } from "@/hooks/use-chat-message-presentation-commit"

function isDocumentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible"
}

export function ChatSheet() {
  const {
    isSheetOpen,
    setSheetOpen,
    activePedidoId,
    addMessage,
    addTypingUser,
    removeTypingUser,
    conversations,
    setConversations,
    setArchivedConversations,
    setLoadingConversations,
    setUnreadCount,
    updateConversationUnread,
    updateConversationLastMessage,
  } = useChatStore()

  const user = useAuthStore((s) => s.user)
  const { client, snapshot } = useRealtime()
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
  const conversationsRef = useRef(conversations)
  const activePedidoIdRef = useRef(activePedidoId)
  const [retryNonce, setRetryNonce] = useState(0)
  const [documentVisible, setDocumentVisible] = useState(isDocumentVisible)

  // Exact Chat room coverage token (V6 Model B) — published ONLY from a
  // CURRENT, non-cancelled acquireOrderRoom success below. Correlation
  // metadata only: never authorization, never persisted, never sent to the
  // server. See CODEX_REPORT.md, "SHARED REALTIME — CHAT ACTIVE-MESSAGE
  // RESYNC — V6 LOCAL IMPLEMENTATION FINAL".
  const actorKey = user ? `${user.type}:${user.id}` : null
  const [coverageToken, setCoverageToken] = useState<ChatRoomCoverageToken | null>(null)
  const coverageGenerationRef = useRef(0)

  // D2 — Foreground Push / Socket Dedupe. `presentationCandidate` is a
  // single-slot, newest-replaces-oldest pending "the user may have just
  // seen this message" signal, created only at receipt time (never for
  // history loads) and consumed by ChatView's presentation-commit hook.
  // `isSheetOpenRef` mirrors the same pattern as `activePedidoIdRef` above:
  // the realtime-subscription effect below is keyed only on user id/type,
  // so its `new-message` closure would otherwise read a stale `isSheetOpen`.
  const isSheetOpenRef = useRef(isSheetOpen)
  const [presentationCandidate, setPresentationCandidate] =
    useState<ChatMessagePresentationCandidate | null>(null)
  const presentationGenerationRef = useRef(0)
  // Episode generation: increments only on a genuine pedido/actor/sheet
  // transition (see the layout effect below), never on unrelated
  // re-renders. Deliberately a ref, not state — a same-commit transition's
  // props to ChatView must still observe the PRE-increment value for that
  // one render (the increment lands in a later layout effect within the
  // same commit and cannot retroactively rewrite already-passed props);
  // this is why candidate eligibility also compares direct pedido/actor/
  // sheet fields rather than relying on episode equality alone.
  const presentationEpisodeGenerationRef = useRef(0)
  const presentationEpisodeKeyRef = useRef<string | null>(null)

  // sole GET /api/chat/conversaciones production owner for the Chat UI —
  // one response is authoritative for both conversations and archived
  // (see src/lib/chat-polling.ts and the focal design correction).
  const isListView = isSheetOpen && activePedidoId === null
  const conversationsFetchingRef = useRef(false)
  const conversationsAbortRef = useRef<AbortController | null>(null)
  const hasLoadedConversationsRef = useRef(false)

  // P2-T20: idle/stopped (no active room demand) are deliberate rest states,
  // never presented as "Sin conexión" — see chat-connection-presentation.ts.
  const connectionPresentation = deriveChatConnectionPresentation(snapshot.state)

  useEffect(() => {
    conversationsRef.current = conversations
    activePedidoIdRef.current = activePedidoId
  }, [activePedidoId, conversations])

  useEffect(() => {
    isSheetOpenRef.current = isSheetOpen
  }, [isSheetOpen])

  // D2 — episode generation: a monotonic counter bumped once per genuine
  // (pedido, actor, sheet-open) transition. `useLayoutEffect` (not
  // `useEffect`) so the bump is commit-synchronous and ordered before any
  // subsequent browser event the presentation-commit hook might react to.
  // The very first render only establishes the baseline key — it must
  // never count as a "transition" (there is nothing to invalidate yet).
  useLayoutEffect(() => {
    const key = `${String(isSheetOpen)}:${activePedidoId ?? ""}:${actorKey ?? ""}`
    if (presentationEpisodeKeyRef.current === null) {
      presentationEpisodeKeyRef.current = key
      return
    }
    if (presentationEpisodeKeyRef.current !== key) {
      presentationEpisodeKeyRef.current = key
      presentationEpisodeGenerationRef.current += 1
    }
  }, [isSheetOpen, activePedidoId, actorKey])

  // Shared subscription registry: Chat owns no physical socket or raw listener.
  useEffect(() => {
    if (!user || user.type === "repartidor") return

    const clearTypingTimeouts = () => {
      for (const timeout of Object.values(typingTimeoutRef.current)) clearTimeout(timeout)
      typingTimeoutRef.current = {}
    }

    const unsubscribers = [
      client.subscribe("new-message", (message) => {
        if (!message?.pedidoId) return
        addMessage(message.pedidoId, message)
        updateConversationLastMessage(message.pedidoId, message)

        if (message.remitente !== getRemitenteForUserType(user.type)) {
          const conv = conversationsRef.current.find((conversation) => conversation.pedidoId === message.pedidoId)
          if (conv && activePedidoIdRef.current !== message.pedidoId) {
            updateConversationUnread(message.pedidoId, conv.unreadCount + 1)
          }
        }

        if (
          actorKey &&
          message.id &&
          evaluateReceiptEligibility({
            isOwnMessage: message.remitente === getRemitenteForUserType(user.type),
            isSheetOpen: isSheetOpenRef.current,
            messagePedidoId: message.pedidoId,
            activePedidoId: activePedidoIdRef.current,
            isDocumentVisible: isDocumentVisible(),
            isDocumentFocused: document.hasFocus(),
          })
        ) {
          presentationGenerationRef.current += 1
          setPresentationCandidate({
            messageId: message.id,
            pedidoId: message.pedidoId,
            actorKey,
            generation: presentationGenerationRef.current,
            episodeGeneration: presentationEpisodeGenerationRef.current,
          })
        }
      }),
      client.subscribe("user-typing", (data) => {
        // F-P1-02: the server excludes only the emitting socket, never other
        // sockets of the same actor — a sibling tab of the SAME account must
        // not render its own typing back to itself.
        if (data.userId === user.id) return
        addTypingUser(data.pedidoId, {
          userId: data.userId,
          userType: data.userType,
          userName: data.userName || "Usuario",
        })
        const timeoutKey = `${data.pedidoId}:${data.userId}`
        if (typingTimeoutRef.current[timeoutKey]) clearTimeout(typingTimeoutRef.current[timeoutKey])
        typingTimeoutRef.current[timeoutKey] = setTimeout(() => {
          removeTypingUser(data.pedidoId, data.userId)
          delete typingTimeoutRef.current[timeoutKey]
        }, 3000)
      }),
      client.subscribe("user-stop-typing", (data) => {
        removeTypingUser(data.pedidoId, data.userId)
        const timeoutKey = `${data.pedidoId}:${data.userId}`
        if (typingTimeoutRef.current[timeoutKey]) {
          clearTimeout(typingTimeoutRef.current[timeoutKey])
          delete typingTimeoutRef.current[timeoutKey]
        }
      }),
      client.subscribe("unread-update", (data) => {
        setUnreadCount(data.count)
      }),
      client.subscribe("messages-read", (data) => {
        // F-P1-01: only a same-actor sibling tab reading its own unread
        // messages should clear this tab's badge locally — a cross-actor
        // "the counterpart read what I sent" notification must remain a
        // no-op here (no read-receipt UI exists yet). HTTP polling remains
        // the fallback/reconciliation path for every other case.
        if (data.readBy === user.id) {
          updateConversationUnread(data.pedidoId, 0)
        }
      }),
    ]

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      clearTypingTimeouts()
    }
  }, [addMessage, addTypingUser, client, removeTypingUser, setUnreadCount, updateConversationLastMessage, updateConversationUnread, user?.id, user?.type])

  // A Chat room is a lease, not a physical socket owned by this component.
  useEffect(() => {
    if (!isSheetOpen || !activePedidoId || !user || user.type === "repartidor") return

    let cancelled = false
    let lease: { release: () => void } | null = null
    const controller = new AbortController()
    void client.acquireOrderRoom(activePedidoId, ["chat:read", "chat:typing"], { signal: controller.signal })
      .then((nextLease) => {
        if (cancelled) {
          nextLease.release()
          return
        }
        lease = nextLease
        client.markMessagesRead(activePedidoId)
        // Exact Chat room coverage: publish a fresh token ONLY for this
        // still-current acquire success — covers first join, manual retry
        // (retryNonce), pedido reopen, and actor switch, each as a
        // distinguishable fresh generation. A late/cancelled invocation's
        // success (including a StrictMode-superseded first mount) never
        // reaches here, since `cancelled` already returned above.
        if (actorKey) {
          coverageGenerationRef.current += 1
          setCoverageToken(createCoverageToken(actorKey, activePedidoId, coverageGenerationRef.current))
        }
      })
      .catch(() => {
        // HTTP polling and GET message authorization remain the fallback in this phase.
      })

    return () => {
      cancelled = true
      controller.abort()
      lease?.release()
    }
  }, [actorKey, activePedidoId, client, isSheetOpen, retryNonce, user?.id, user?.type])

  // Track tab visibility, drives the recurring-interval decision and the
  // foreground-episode coalescing below.
  useEffect(() => {
    const onVisibilityChange = () => setDocumentVisible(isDocumentVisible())
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])

  // Single-flight-guarded /api/chat/conversaciones fetch. One HTTP response
  // is authoritative for both conversations and archived — see
  // ConversationList, which is now presentation/store-only.
  const loadConversations = useCallback(async () => {
    if (conversationsFetchingRef.current) return
    conversationsFetchingRef.current = true
    const isFirstLoad = !hasLoadedConversationsRef.current
    hasLoadedConversationsRef.current = true
    if (isFirstLoad) setLoadingConversations(true)
    const controller = new AbortController()
    conversationsAbortRef.current = controller
    try {
      // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): selector explícito de
      // familia — mismo transporte ?actorFamily= ya certificado en Fase 2,
      // requerido para que /api/chat/conversaciones resuelva sin ambigüedad
      // cuando coexisten 2+ cookies de familia. Fuente: useAuthStore().user?.type
      // (nunca pathname: ChatSheet se monta desde el layout raíz).
      const url = user?.type
        ? `/api/chat/conversaciones?actorFamily=${user.type}`
        : "/api/chat/conversaciones"
      const res = await fetch(url, { signal: controller.signal })
      if (controller.signal.aborted || !res.ok) return
      const data = await res.json()
      if (controller.signal.aborted) return
      setConversations(data.conversations || [])
      setArchivedConversations(data.archived || [])
    } catch {
      // silently fail
    } finally {
      // Release ownership only if this request is still the one being
      // tracked — same rationale as ChatFab's fetchUnread. A stale/
      // superseded request's finally must never clear a newer request's
      // guard or its loading-spinner lifecycle.
      if (conversationsAbortRef.current === controller) {
        conversationsAbortRef.current = null
        conversationsFetchingRef.current = false
        if (isFirstLoad) setLoadingConversations(false)
      }
    }
  }, [setArchivedConversations, setConversations, setLoadingConversations, user?.type])

  // Teardown on actor change / capability loss: abort any in-flight request
  // and reset the single-flight guard and first-load flag so a stale
  // response can never set the next actor's conversations, and the next
  // actor gets a fresh loading indicator.
  useEffect(() => {
    return () => {
      conversationsAbortRef.current?.abort()
      conversationsAbortRef.current = null
      conversationsFetchingRef.current = false
      hasLoadedConversationsRef.current = false
    }
  }, [user?.id, user?.type])

  // Immediate catch-up on entering list view — covers BOTH a fresh sheet
  // open into the list AND returning from ChatView to the list (one
  // state-transition mechanism represents both; see the focal design
  // correction). Keyed only to isSheetOpen/activePedidoId, independent of
  // documentVisible: both transitions only ever happen as a direct result
  // of user interaction, which cannot occur on a hidden tab.
  const wasListViewRef = useRef(isListView)
  useEffect(() => {
    if (user?.type === "repartidor") return
    if (isListView && !wasListViewRef.current) void loadConversations()
    wasListViewRef.current = isListView
  }, [isListView, loadConversations, user?.type])

  // Recurring timer while the list is the visible, relevant view. Fully
  // suspended (no timer at all) whenever a specific conversation is active,
  // the sheet is closed, or the tab is hidden.
  useEffect(() => {
    if (user?.type === "repartidor") return
    const intervalMs = selectConversationsPollInterval({ isSheetOpen, activePedidoId, documentVisible })
    if (intervalMs === null) return
    const interval = setInterval(() => void loadConversations(), intervalMs)
    return () => clearInterval(interval)
  }, [isSheetOpen, activePedidoId, documentVisible, loadConversations, user?.type])

  // Foreground-episode coalescing, scoped to "list is currently the active
  // view." This is orthogonal to the entry-transition effect above (which
  // never reacts to visibility) — it covers the case where the list was
  // already showing the whole time and the tab itself was backgrounded and
  // came back (including the OS focus-without-visibilitychange edge case).
  useEffect(() => {
    if (user?.type === "repartidor" || !isListView) return
    const episode = createForegroundEpisodeState(isDocumentVisible())
    const handle = (event: "blur" | "hidden" | "visible" | "focus") => {
      const result = applyForegroundEpisodeEvent(episode, event, isDocumentVisible())
      if (result.shouldCatchup) void loadConversations()
    }
    const onVisibilityChange = () => handle(document.visibilityState === "visible" ? "visible" : "hidden")
    const onBlur = () => handle("blur")
    const onFocus = () => handle("focus")
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("blur", onBlur)
    window.addEventListener("focus", onFocus)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("focus", onFocus)
    }
  }, [isListView, loadConversations, user?.type])

  // Realtime resync catch-up, filtered by shouldResyncTriggerChatCatchup
  // ("foreground" excluded — the listener above already owns that case) AND
  // additionally gated on "list is currently the active view": a resync
  // while an active conversation is showing must not fetch conversations.
  useEffect(() => {
    if (user?.type === "repartidor") return
    return client.registerResync((reason) => {
      if (!shouldResyncTriggerChatCatchup(reason)) return
      if (isSheetOpen && activePedidoId === null && isDocumentVisible()) void loadConversations()
    })
  }, [activePedidoId, client, isSheetOpen, loadConversations, user?.type])

  // Retry connection manually
  const handleRetryConnection = useCallback(() => {
    if (activePedidoId) setRetryNonce((current) => current + 1)
  }, [activePedidoId])

  if (!user || user.type === "repartidor") return null

  // IOS-STANDALONE-FINAL-VISUAL-FIX-R4: the keyboard-region backdrop filler
  // used to be the first child of SheetContent (R3), but real standalone
  // device evidence proved it never painted past y≈394 out of a 797px
  // screen — SheetContent has `overflow-hidden`, and CSS overflow clipping
  // applies to the paint/clip tree regardless of a descendant's own
  // `position:fixed`, so the filler was clipped to the exact same shifted
  // boundary as the content it was meant to extend past. Portaled directly
  // to document.body instead — a sibling of Radix's own Sheet portal tree,
  // not a descendant of the clipping SheetContent — same pattern BottomNav
  // already uses for the same category of reason. Its own CSS rule in
  // globals.css (.ios-chat-keyboard-backdrop) is unchanged: still a no-op
  // (0 height) whenever there's no residual visual-viewport offset, still
  // only mounted while the Sheet itself is open.
  const keyboardBackdrop =
    isSheetOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="ios-chat-keyboard-backdrop"
            aria-hidden="true"
            data-ios-debug-role="chat-keyboard-backdrop"
          />,
          document.body
        )
      : null

  return (
    <>
      {keyboardBackdrop}
      <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden h-dvh"
          data-ios-debug-role="chat-sheet"
        >
        <SheetTitle className="sr-only">Chat de pedidos</SheetTitle>
        <SheetDescription className="sr-only">Conversaciones de chat sobre tus pedidos</SheetDescription>
        {activePedidoId ? (
          <ChatView
            pedidoId={activePedidoId}
            onBack={() => useChatStore.getState().closeConversation()}
            coverageToken={coverageToken}
            presentationCandidate={presentationCandidate}
            currentEpisodeGeneration={presentationEpisodeGenerationRef.current}
          />
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base">Chats</h2>
                    <p className="text-xs text-muted-foreground">
                      {connectionPresentation.tone === "connected" ? (
                        <span className="text-emerald-500">● {connectionPresentation.label}</span>
                      ) : connectionPresentation.showRetry ? (
                        <button
                          onClick={handleRetryConnection}
                          className="flex items-center gap-1 text-amber-500 hover:text-amber-600 transition-colors"
                        >
                          <WifiOff className="h-3 w-3" />
                          {connectionPresentation.label} · Reintentar
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      ) : connectionPresentation.tone === "connecting" ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {connectionPresentation.label}
                        </span>
                      ) : (
                        <span>{connectionPresentation.label}</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversation List */}
            <ConversationList />
          </div>
        )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function getRemitenteForUserType(userType: string): string {
  switch (userType) {
    case "cliente":
      return "cliente"
    case "negocio":
      return "vendedor"
    case "repartidor":
      return "repartidor"
    default:
      return ""
  }
}
