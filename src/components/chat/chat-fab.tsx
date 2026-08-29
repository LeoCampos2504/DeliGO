"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { useChatStore } from "@/store/chat-store"
import { useAuthStore } from "@/store/auth-store"
import { esRutaCatalogoNegocio } from "@/lib/cliente-catalog-navigation"
import { isChatEligibleUser } from "@/lib/chat-eligibility"
import { useRealtime } from "@/hooks/use-realtime"
import {
  applyForegroundEpisodeEvent,
  createForegroundEpisodeState,
  selectUnreadPollInterval,
  shouldResyncTriggerChatCatchup,
} from "@/lib/chat-polling"

function isDocumentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible"
}

export function ChatFab() {
  const { unreadCount, setSheetOpen, setUnreadCount, isSheetOpen } = useChatStore()
  const user = useAuthStore((s) => s.user)
  const pathname = usePathname()
  const { client } = useRealtime()

  const canChat = isChatEligibleUser(user)
  // Hide chat on: catalog pages (public or Cliente-scoped), mozo/mesas link (/m/), salon link (/s/), repartidor page
  // Show chat on: employee orders/reviews link (/e/) — chat is for cliente-negocio only, not for mozo mesas or delivery
  const isHidden = esRutaCatalogoNegocio(pathname) || pathname.startsWith("/m/") || pathname.startsWith("/s/") || pathname.startsWith("/repartidor")

  const [documentVisible, setDocumentVisible] = useState(isDocumentVisible)

  // ChatFab is the SOLE production owner of GET /api/chat/no-leidos — see
  // src/lib/chat-polling.ts's module comment for why generic Shared
  // Realtime connection state is never used to decide this cadence.
  // Single-flight: at most one unresolved request at a time, regardless of
  // which trigger below (mount, timer, sheet-open, foreground, resync)
  // started it. Sequential, semantically-distinct triggers are NOT
  // suppressed once the previous request has actually completed — only an
  // in-flight request blocks a new one.
  const fetchingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchUnread = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    try {
      // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): selector explícito de
      // familia, requerido para que /api/chat/no-leidos resuelva sin
      // ambigüedad cuando coexisten 2+ cookies de familia en el mismo
      // navegador — mismo transporte ?actorFamily= ya certificado en Fase 2,
      // fuente confiable useAuthStore().user?.type (nunca pathname: ChatFab
      // se monta desde el layout raíz, activo en cualquier ruta).
      const url = user?.type
        ? `/api/chat/no-leidos?actorFamily=${user.type}`
        : "/api/chat/no-leidos"
      const res = await fetch(url, { signal: controller.signal })
      if (controller.signal.aborted || !res.ok) return
      const data = await res.json()
      if (controller.signal.aborted) return
      setUnreadCount(data.noLeidos || 0)
    } catch {
      // Silently fail — includes AbortError (actor/unmount cleanup), never
      // user-facing; the next trigger retries naturally.
    } finally {
      // Release ownership only if this request is still the one being
      // tracked. A stale/superseded request's finally runs asynchronously
      // (after abort()) and must never clear a NEWER request's guard — the
      // effect cleanup that superseded us already did its own direct reset.
      if (abortRef.current === controller) {
        abortRef.current = null
        fetchingRef.current = false
      }
    }
  }, [setUnreadCount, user?.type])

  // Track tab visibility, drives both the recurring-interval decision and
  // the foreground-episode coalescing below.
  useEffect(() => {
    const onVisibilityChange = () => setDocumentVisible(isDocumentVisible())
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])

  // Initial immediate fetch whenever Chat capability becomes active (mount,
  // or canChat flips from false to true, e.g. after login resolves) — and
  // teardown (abort any in-flight request, reset the single-flight guard)
  // whenever the actor changes or capability is lost, so a stale response
  // for a previous actor can never set the next actor's unread count.
  useEffect(() => {
    if (!canChat) return
    void fetchUnread()
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
      fetchingRef.current = false
    }
  }, [canChat, fetchUnread, user?.id, user?.type])

  // Recurring visible-tab safety poll. Never keyed to socket/connection
  // state — see chat-polling.ts.
  useEffect(() => {
    const intervalMs = selectUnreadPollInterval({ canChat, documentVisible })
    if (intervalMs === null) return
    const interval = setInterval(() => void fetchUnread(), intervalMs)
    return () => clearInterval(interval)
  }, [canChat, documentVisible, fetchUnread])

  // Immediate catch-up on a meaningful ChatSheet closed→open transition.
  // ChatFab and ChatSheet are guaranteed sibling-mounted under the same
  // ChatProvider, so this store read never needs a new provider/store field.
  const wasSheetOpenRef = useRef(isSheetOpen)
  useEffect(() => {
    if (isSheetOpen && !wasSheetOpenRef.current && canChat) void fetchUnread()
    wasSheetOpenRef.current = isSheetOpen
  }, [isSheetOpen, canChat, fetchUnread])

  // Foreground-episode coalescing (visibilitychange + blur/focus consumed
  // as one lifecycle episode, not two independent triggers) — see
  // chat-polling.ts's applyForegroundEpisodeEvent for the exact semantic.
  useEffect(() => {
    if (!canChat) return
    const episode = createForegroundEpisodeState(isDocumentVisible())
    const handle = (event: "blur" | "hidden" | "visible" | "focus") => {
      const result = applyForegroundEpisodeEvent(episode, event, isDocumentVisible())
      if (result.shouldCatchup) void fetchUnread()
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
  }, [canChat, fetchUnread])

  // Realtime resync catch-up. "foreground" is deliberately excluded — the
  // listener above already owns that exact case (see
  // shouldResyncTriggerChatCatchup's doc comment). Registering a resync
  // handler is pure local bookkeeping in the manager and never itself
  // creates realtime demand or opens a socket. Additionally gated on
  // current document visibility: a background tab can still hold a live
  // socket (Tracking demand, or Chat's own room), so a non-foreground
  // resync (e.g. reauth) can genuinely fire while hidden — spending HTTP on
  // it would help nobody. Deferring is free: the foreground-episode
  // listener already guarantees a catch-up on the next real return to the
  // tab regardless of whether a resync happened while away.
  useEffect(() => {
    if (!canChat) return
    return client.registerResync((reason) => {
      if (!shouldResyncTriggerChatCatchup(reason)) return
      if (!isDocumentVisible()) return
      void fetchUnread()
    })
  }, [canChat, client, fetchUnread])

  if (!canChat || isHidden) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setSheetOpen(true)}
        className="ios-keyboard-hide keyboard-hide-when-editing fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label="Abrir chat"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1"
          >
            <Badge className="h-5 min-w-5 px-1.5 flex items-center justify-center bg-red-500 text-white border-2 border-background text-[10px] font-bold p-0">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          </motion.div>
        )}
      </motion.button>
    </AnimatePresence>
  )
}
