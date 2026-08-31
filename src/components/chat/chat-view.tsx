"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  ArrowLeft,
  Send,
  ImageIcon,
  Loader2,
  Store,
  User,
  Bike,
  Clock,
  CreditCard,
  Shield,
  Paperclip,
  FileText,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useChatStore, type ChatMessage, type PedidoInfo } from "@/store/chat-store"
import { useAuthStore } from "@/store/auth-store"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import { PdfViewerModal } from "./pdf-viewer-modal"
import { useRealtime } from "@/hooks/use-realtime"
import { applyForegroundEpisodeEvent, createForegroundEpisodeState } from "@/lib/chat-polling"
import {
  ACTIVE_HISTORY_SAFETY_INTERVAL_MS,
  ACTIVE_HISTORY_SINGLE_REQUEST_DEADLINE_MS,
  buildHistoryRequestQuery,
  buildLocalIdSet,
  buildLocalIndexMap,
  createHistoryCoordinatorState,
  evaluateHistoryResponse,
  isFreshCoverageSignal,
  isHistoryResyncReasonAllowed,
  reconcileHistoryMessages,
  resetHistoryCoordinatorState,
  resolveCoverageBaseline,
  runHistoryRequestWithDeadline,
  settleHistoryFetch,
  triggerSafetyIntervalTick,
  triggerSemanticHistoryFetch,
  type ChatRoomCoverageToken,
} from "@/lib/chat-history-resync"
import {
  useChatMessagePresentationCommit,
  type ChatMessagePresentationCandidate,
} from "@/hooks/use-chat-message-presentation-commit"

function isDocumentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible"
}

// ============================================
// Types
// ============================================
interface ChatViewProps {
  pedidoId: string
  onBack: () => void
  coverageToken: ChatRoomCoverageToken | null
  presentationCandidate: ChatMessagePresentationCandidate | null
  currentEpisodeGeneration: number
}

interface PendingAttachment {
  type: "image" | "file"
  url: string
  nombre: string
  fileType: string
  preview?: string // Data URL for image preview
  publicId?: string
}

// ============================================
// File size limits
// ============================================
const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10MB
const MAX_FILE_SIZE = 5 * 1024 * 1024     // 5MB

// ============================================
// Main ChatView Component
// ============================================
export function ChatView({
  pedidoId,
  onBack,
  coverageToken,
  presentationCandidate,
  currentEpisodeGeneration,
}: ChatViewProps) {
  const {
    messages,
    pedidoInfo,
    typingUsers,
    isLoadingMessages,
    isSending,
    isSheetOpen,
    setMessages,
    addMessage,
    setPedidoInfo,
    setLoadingMessages,
    setSending,
    updateConversationUnread,
    updateConversationLastMessage,
  } = useChatStore()

  const user = useAuthStore((s) => s.user)
  const { client } = useRealtime()
  const actorKey = user ? `${user.type}:${user.id}` : null
  const isCurrentActor = useCallback(() => {
    const currentUser = useAuthStore.getState().user
    return actorKey === (currentUser ? `${currentUser.type}:${currentUser.id}` : null)
  }, [actorKey])

  const [messageText, setMessageText] = useState("")
  const [telefonoFiltrado, setTelefonoFiltrado] = useState(false)
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [attachPopoverOpen, setAttachPopoverOpen] = useState(false)
  const [pdfViewer, setPdfViewer] = useState<{ open: boolean; url: string; fileName: string }>({
    open: false,
    url: "",
    fileName: "",
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isAtBottomRef = useRef(true)

  // Active-message resync (V6): one semantic single-flight + queued
  // post-flight catch-up coordinator per current ChatView lifecycle. The
  // AbortController created for each history request IS this coordinator's
  // opaque request-identity token — see chat-history-resync.ts.
  const coordinatorRef = useRef(createHistoryCoordinatorState<AbortController>())
  // True only after this lifecycle has observed its first fresh, matching
  // exact Chat room coverage token — gates whether the manager's
  // (imprecise) `room-rejoin` may trigger a catch-up. Reset on every fresh
  // pedido/actor lifecycle.
  const hasExactCoverageForCurrentLifecycleRef = useRef(false)
  // `undefined` = no observation yet this lifecycle (baseline not seeded);
  // `null` = seeded, but no matching token was present; a number = the
  // last generation this lifecycle has already consumed as its baseline
  // or as a genuine fresh signal.
  const lastSeenCoverageGenerationRef = useRef<number | null | undefined>(undefined)
  // True once ANY successful reconciliation has landed for this lifecycle
  // — distinguishes "still establishing initial authority" (primary
  // loading indicator, deferred error finalization) from "background
  // catch-up" (silent, never disturbs the UI) for every subsequent
  // request in the same lifecycle.
  const hasCompletedInitialLoadRef = useRef(false)
  // Live mirror of the current pedido's message array, read at the exact
  // moment each request starts/settles — never a stale closure over
  // `currentMessages`, and never a fetch-effect dependency (a new realtime
  // message must not itself recreate the fetch/timer machinery).
  const messagesRef = useRef<ChatMessage[]>(messages[pedidoId] || [])
  // P2-T04 MODEL_R: the last `chatRevision` this lifecycle has confirmed via
  // a successful FULL authoritative reconciliation — `undefined` until the
  // first one lands. Purely in-memory for this component instance, never
  // persisted anywhere, never advanced by realtime or by this tab's own
  // local POST (see KNOWN_REVISION_ADVANCES_* markers, CODEX_REPORT.md
  // P2-T04 Stage 2) — only ever read/written here.
  const knownHistoryRevisionRef = useRef<number | undefined>(undefined)

  const [documentVisible, setDocumentVisible] = useState(isDocumentVisible)

  const currentMessages = messages[pedidoId] || []
  const currentPedidoInfo = pedidoInfo[pedidoId]
  const currentTyping = typingUsers[pedidoId] || []
  const isLoading = isLoadingMessages[pedidoId] || false
  const myRemitente =
    user?.type === "cliente"
      ? "cliente"
      : user?.type === "negocio"
      ? "vendedor"
      : "repartidor"

  // Live mirror of the current pedido's messages, kept in sync but never
  // used as a fetch-effect dependency (see messagesRef declaration above).
  useEffect(() => {
    messagesRef.current = currentMessages
  }, [currentMessages])

  // Track tab visibility — drives the 90s active-visible safety cadence
  // and the foreground-episode coalescing below. Mirrors ChatSheet's own
  // identical pattern for /api/chat/conversaciones.
  useEffect(() => {
    const onVisibilityChange = () => setDocumentVisible(isDocumentVisible())
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])

  // Executes one history GET under the frozen 10s application-level
  // deadline, reconciles a successful response (V3/ORDER3_A), and hands
  // the settlement to the coordinator — which may launch exactly one
  // queued follow-up. `isPartOfInitialAuthority` governs UI visibility
  // only (primary loading indicator, deferred error finalization); it
  // never affects liveness/single-flight semantics, which are TO1-uniform
  // regardless of success, ordinary failure, or timeout.
  const runFetchFor = useCallback(
    async (controller: AbortController, isPartOfInitialAuthority: boolean, kind: "semantic" | "safety") => {
      const requestStartIds = buildLocalIdSet(messagesRef.current)
      const previousLocalIndexMap = buildLocalIndexMap(messagesRef.current)

      if (isPartOfInitialAuthority) setLoadingMessages(pedidoId, true)

      // P2-T04 MODEL_R: `mode=safety` is sent ONLY for safety-tick requests
      // — semantic requests never send it (server always treats a request
      // without it as full, which also gives old-server rolling
      // compatibility for free). `knownRevision` is included only once this
      // lifecycle actually knows one — never invented as 0.
      const sentKnownRevision = kind === "safety" ? knownHistoryRevisionRef.current : undefined
      const query = buildHistoryRequestQuery({ kind, knownRevision: sentKnownRevision })
      // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): selector explícito de
      // familia — mismo transporte ?actorFamily= ya certificado en Fase 2,
      // requerido para que /api/chat/mensajes/[pedidoId] resuelva sin
      // ambigüedad bajo 2+ cookies de familia coexistiendo. Preserva
      // `query` (mode=safety/knownRevision) tal cual, sólo agrega el
      // selector como parámetro adicional.
      const familyParam = user?.type ? `actorFamily=${user.type}` : ""
      const historyUrl = familyParam
        ? `/api/chat/mensajes/${pedidoId}${query}${query ? "&" : "?"}${familyParam}`
        : `/api/chat/mensajes/${pedidoId}${query}`

      const result = await runHistoryRequestWithDeadline(
        controller,
        ACTIVE_HISTORY_SINGLE_REQUEST_DEADLINE_MS,
        async () => {
          const res = await fetch(historyUrl, { signal: controller.signal })
          if (!res.ok) throw new Error("history-http-error")
          return (await res.json()) as {
            mensajes?: ChatMessage[]
            pedido?: PedidoInfo
            unchanged?: boolean
            historyRevision?: number
          }
        },
      )

      const nextController = new AbortController()
      const { state, action } = settleHistoryFetch(coordinatorRef.current, controller, nextController)
      coordinatorRef.current = state

      // Section 36/CODEX_REPORT.md P2-T04 Stage 2: `evaluateHistoryResponse`
      // (pure, unit-tested against the full equality/mismatch/malformed
      // matrix in chat-history-resync.test.ts) decides trust — never on the
      // mere presence of `unchanged`. A "force-full-refetch" outcome is
      // non-conclusive (its `mensajes` cannot be trusted as a real
      // snapshot) and triggers exactly one corrective full re-fetch
      // afterward — self-terminating, since a semantic request server-side
      // is always full and can never itself come back claiming `unchanged`.
      let forceFullRefetch = false

      // Stale: lifecycle teardown already invalidated this request, or a
      // newer request already superseded it. No store/UI mutation — the
      // classic "old finally must never mutate a newer lifecycle" guard.
      if (action.type !== "stale") {
        if (result.ok) {
          const data = result.value
          const evaluation = evaluateHistoryResponse(sentKnownRevision, data)

          if (evaluation.outcome === "force-full-refetch") {
            forceFullRefetch = true
            if (isPartOfInitialAuthority) setLoadingMessages(pedidoId, false)
          } else if (evaluation.outcome === "unchanged") {
            // Genuine no-op: no reconcile, no store write, no render, no
            // known-revision change (it already equals what we confirmed).
            if (isPartOfInitialAuthority) setLoadingMessages(pedidoId, false)
          } else {
            // FULL authoritative response — reused for both an explicit
            // safety mismatch and every semantic response, and (rolling
            // compatibility) for an old server that never sets `unchanged`
            // at all — the exact same, unmodified V6 reconciler either way.
            const reconciled = reconcileHistoryMessages({
              serverMessages: data.mensajes || [],
              requestStartIds,
              previousLocalIndexMap,
              liveLocalMessages: messagesRef.current,
            })
            setMessages(pedidoId, reconciled)
            if (data.pedido) setPedidoInfo(pedidoId, data.pedido)
            updateConversationUnread(pedidoId, 0)
            hasCompletedInitialLoadRef.current = true
            // Advance known revision ONLY after a successful FULL
            // reconciliation just landed — never from realtime, never from
            // a local POST echo, never from an untrusted/malformed response.
            if (evaluation.historyRevision !== undefined) knownHistoryRevisionRef.current = evaluation.historyRevision
            if (isPartOfInitialAuthority) setLoadingMessages(pedidoId, false)
          }
        } else if (isPartOfInitialAuthority) {
          if (action.type === "start") {
            // A follow-up is about to run as a continuation of initial
            // load authority — keep loading, no error toast yet, so a
            // transient failure/timeout immediately healed by the next
            // attempt never flashes an error to the user.
          } else {
            setLoadingMessages(pedidoId, false)
            toast.error("Error al cargar mensajes")
          }
        }
        // Background (non-initial) failures are fully silent: no loading
        // indicator touch, no toast, no spam under persistent failure —
        // existing messages remain untouched and future attempts (90s
        // safety tick, next semantic signal) remain available.
      }

      if (action.type === "start") {
        void runFetchFor(action.token, !hasCompletedInitialLoadRef.current, "semantic")
      } else if (forceFullRefetch) {
        const correctiveController = new AbortController()
        const { state: correctiveState, action: correctiveAction } = triggerSemanticHistoryFetch(
          coordinatorRef.current,
          correctiveController,
        )
        coordinatorRef.current = correctiveState
        if (correctiveAction.type === "start") {
          void runFetchFor(correctiveAction.token, !hasCompletedInitialLoadRef.current, "semantic")
        }
      }
    },
    [pedidoId, setLoadingMessages, setMessages, setPedidoInfo, updateConversationUnread, user?.type],
  )

  // Single entry point for every non-mount history trigger: an allowed
  // manager resync reason, the exact ChatSheet coverage signal, the local
  // foreground episode, or the 90s safety tick. Always synchronous/void —
  // the manager's resync handler must never await Chat's history HTTP.
  const triggerHistoryFetch = useCallback(
    (kind: "semantic" | "safety") => {
      const nextController = new AbortController()
      const { state, action } =
        kind === "semantic"
          ? triggerSemanticHistoryFetch(coordinatorRef.current, nextController)
          : triggerSafetyIntervalTick(coordinatorRef.current, nextController)
      coordinatorRef.current = state
      if (action.type === "start") {
        void runFetchFor(action.token, !hasCompletedInitialLoadRef.current, kind)
      }
    },
    [runFetchFor],
  )

  // Lifecycle-scoped coordinator: resets all per-lifecycle state, performs
  // the immediate mount GET (never waits for socket/room coverage), and
  // registers the manager resync handler (VOID — fire-and-forget). This
  // reset deliberately lives inside the effect body itself (keyed on
  // `pedidoId`/actor identity), NOT only in a fresh useRef initializer:
  // ChatSheet has no `key` on <ChatView>, and chat-provider.tsx's
  // useChatDeepLink can call openConversation(B) — via a focus/
  // visibilitychange-triggered notification deep link — while ChatView is
  // already showing a DIFFERENT pedido A, producing a direct A->B prop
  // update on the SAME component instance rather than an unmount/remount.
  // Resetting here, not only on mount, is what keeps that path correct.
  useEffect(() => {
    coordinatorRef.current = resetHistoryCoordinatorState()
    hasExactCoverageForCurrentLifecycleRef.current = false
    lastSeenCoverageGenerationRef.current = undefined
    hasCompletedInitialLoadRef.current = false
    // P2-T04: known revision never survives an actor/pedido/remount switch
    // — undefined again until the mount fetch below lands its first FULL
    // reconciliation.
    knownHistoryRevisionRef.current = undefined

    triggerHistoryFetch("semantic")

    const unregisterResync = client.registerResync((reason) => {
      if (isHistoryResyncReasonAllowed(reason, hasExactCoverageForCurrentLifecycleRef.current)) {
        triggerHistoryFetch("semantic")
      }
    })

    return () => {
      const controller = coordinatorRef.current.currentToken
      if (controller) controller.abort()
      coordinatorRef.current = resetHistoryCoordinatorState()
      unregisterResync()
      if (isCurrentActor()) setLoadingMessages(pedidoId, false)
    }
  }, [client, isCurrentActor, pedidoId, setLoadingMessages, triggerHistoryFetch])

  // Exact Chat room coverage token consumption. A token already held by
  // ChatSheet when this lifecycle mounts is seeded as a baseline only —
  // never treated as a fresh event merely because the initial prop is
  // non-null. Only a LATER generation change, matching this lifecycle's
  // own actor+pedido identity, is fresh and triggers exactly one catch-up.
  useEffect(() => {
    if (!actorKey) return
    if (lastSeenCoverageGenerationRef.current === undefined) {
      lastSeenCoverageGenerationRef.current = resolveCoverageBaseline(coverageToken, actorKey, pedidoId)
      return
    }
    if (coverageToken && isFreshCoverageSignal(coverageToken, actorKey, pedidoId, lastSeenCoverageGenerationRef.current)) {
      lastSeenCoverageGenerationRef.current = coverageToken.generation
      hasExactCoverageForCurrentLifecycleRef.current = true
      triggerHistoryFetch("semantic")
    }
  }, [actorKey, coverageToken, pedidoId, triggerHistoryFetch])

  // 90s active-visible full-history safety poll (TIMER_A: fixed cadence,
  // tick silently skipped — never queued — while a request is already in
  // flight). Fully suspended (no timer at all) while the tab is hidden.
  useEffect(() => {
    if (!documentVisible) return
    const interval = setInterval(() => triggerHistoryFetch("safety"), ACTIVE_HISTORY_SAFETY_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [documentVisible, pedidoId, triggerHistoryFetch])

  // D2 — Foreground Push / Socket Dedupe. Owns the sole decision of whether
  // a committed candidate has genuinely been presented to the user; see
  // use-chat-message-presentation-commit.ts for the frozen K2/L2/P4B model.
  // Declared here (before the foreground-episode effect below, which reads
  // invalidatePendingPresentationRef) so the read-before-use isn't purely a
  // closure-timing argument — it's also true in source order.
  const { notifyContainerScrolled, invalidatePendingPresentation } = useChatMessagePresentationCommit({
    presentationCandidate,
    currentEpisodeGeneration,
    currentMessages,
    pedidoId,
    actorKey: actorKey ?? "",
    isSheetOpen,
    messagesContainerRef,
  })
  // Read live from the foreground-episode effect below without adding it to
  // that effect's dependency array — this callback's identity changes on
  // every new candidate, and re-running that effect would reset its
  // hidden/blur coalescing state mid-episode.
  const invalidatePendingPresentationRef = useRef(invalidatePendingPresentation)
  useEffect(() => {
    invalidatePendingPresentationRef.current = invalidatePendingPresentation
  }, [invalidatePendingPresentation])

  // Local foreground-episode catch-up — the manager's own `"foreground"`
  // resync reason is deliberately denied (see isHistoryResyncReasonAllowed);
  // Chat owns this transition directly, coalescing a hidden/blur episode
  // and the following visible/focus event into exactly one catch-up.
  useEffect(() => {
    const episode = createForegroundEpisodeState(isDocumentVisible())
    const handle = (event: "blur" | "hidden" | "visible" | "focus") => {
      if (event === "hidden" || event === "blur") invalidatePendingPresentationRef.current()
      const result = applyForegroundEpisodeEvent(episode, event, isDocumentVisible())
      if (result.shouldCatchup) triggerHistoryFetch("semantic")
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
  }, [pedidoId, triggerHistoryFetch])

  // Auto-scroll to bottom
  useEffect(() => {
    const container = messagesContainerRef.current
    if (isAtBottomRef.current && container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
    }
  }, [currentMessages])

  // Detect if user is at bottom of messages
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    isAtBottomRef.current = atBottom
    notifyContainerScrolled({
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
    })
  }, [notifyContainerScrolled])

  // Upload file to Cloudinary
  const uploadFileToCloudinary = useCallback(
    async (file: File, type: "image" | "file"): Promise<{ url: string; publicId: string } | null> => {
      setIsUploading(true)
      setUploadProgress(0)

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("category", "chat")
        formData.append("slug", pedidoId)
        formData.append("type", type)

        // Use XMLHttpRequest for progress tracking
        const result = await new Promise<{ url: string; publicId: string } | null>(
          (resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open("POST", "/api/upload")

            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100)
                setUploadProgress(pct)
              }
            }

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText)
                  resolve(data)
                } catch {
                  reject(new Error("Error al procesar respuesta"))
                }
              } else {
                try {
                  const data = JSON.parse(xhr.responseText)
                  reject(new Error(data.error || "Error al subir archivo"))
                } catch {
                  reject(new Error("Error al subir archivo"))
                }
              }
            }

            xhr.onerror = () => reject(new Error("Error de conexión"))
            xhr.send(formData)
          }
        )

        return result
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al subir archivo")
        return null
      } finally {
        setIsUploading(false)
        setUploadProgress(0)
      }
    },
    [pedidoId]
  )

  // Handle image selection
  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""

      if (!file) return

      // Validate file size
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error("La imagen es muy grande. Máximo 10MB.")
        return
      }

      // Create preview
      const preview = await readFileAsDataUrl(file)

      // Upload to Cloudinary
      const result = await uploadFileToCloudinary(file, "image")
      if (!result) return

      setPendingAttachment({
        type: "image",
        url: result.url,
        nombre: file.name,
        fileType: file.type,
        preview,
        publicId: result.publicId,
      })

      inputRef.current?.focus()
    },
    [uploadFileToCloudinary]
  )

  // Handle PDF selection
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""

      if (!file) return

      // Validate it's a PDF
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        toast.error("Solo se permiten archivos PDF.")
        return
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error("El archivo es muy grande. Máximo 5MB para PDFs.")
        return
      }

      // Upload to Cloudinary
      const result = await uploadFileToCloudinary(file, "file")
      if (!result) return

      setPendingAttachment({
        type: "file",
        url: result.url,
        nombre: file.name,
        fileType: file.type || "application/pdf",
        publicId: result.publicId,
      })

      inputRef.current?.focus()
    },
    [uploadFileToCloudinary]
  )

  // Remove pending attachment
  const removePendingAttachment = useCallback(() => {
    setPendingAttachment(null)
  }, [])

  // Send message (with or without attachment)
  const sendMessage = useCallback(async () => {
    const text = messageText.trim()
    const attachment = pendingAttachment

    if (!text && !attachment) return
    if (isSending || isUploading) return

    setSending(true)
    setTelefonoFiltrado(false)

    try {
      const body: Record<string, string> = {}

      if (text) {
        body.texto = text
      }

      if (attachment) {
        if (attachment.type === "image") {
          body.imagenUrl = attachment.url
        } else {
          body.archivoUrl = attachment.url
          body.archivoNombre = attachment.nombre
          body.archivoTipo = attachment.fileType
        }
      }

      // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): selector explícito de
      // familia — mismo transporte ?actorFamily= ya certificado en Fase 2,
      // requerido para que POST /api/chat/mensajes/[pedidoId] resuelva sin
      // ambigüedad bajo 2+ cookies de familia coexistiendo.
      const sendUrl = user?.type
        ? `/api/chat/mensajes/${pedidoId}?actorFamily=${user.type}`
        : `/api/chat/mensajes/${pedidoId}`
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!isCurrentActor()) return
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Error al enviar mensaje")
        return
      }

      const data = await res.json()
      if (!isCurrentActor()) return

      if (data.telefonoFiltrado) {
        setTelefonoFiltrado(true)
        toast("🔒 Por seguridad, los números de teléfono fueron filtrados", {
          duration: 4000,
        })
      }

      // Add message to local state. Realtime delivery is now server-authoritative
      // (the route publishes chat.message.created after persisting) — this local
      // add is what makes the sender's own tab show the message immediately,
      // and stays safe even if the server's realtime echo also reaches this same
      // tab, since addMessage is idempotent by message.id.
      if (data.mensaje) {
        addMessage(pedidoId, data.mensaje)
        updateConversationLastMessage(pedidoId, data.mensaje)
      }

      setMessageText("")
      setPendingAttachment(null)
      isAtBottomRef.current = true

      // Stop typing
      client.sendStopTyping(pedidoId)
    } catch {
      if (isCurrentActor()) toast.error("Error al enviar mensaje")
    } finally {
      if (isCurrentActor()) setSending(false)
    }
  }, [messageText, pendingAttachment, isSending, isUploading, pedidoId, addMessage, client, isCurrentActor, updateConversationLastMessage, setSending, user?.type])

  // Typing indicator
  const handleTyping = useCallback(
    (text: string) => {
      setMessageText(text)

      if (text.trim()) {
        client.sendTyping(pedidoId)

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
          client.sendStopTyping(pedidoId)
        }, 3000)
      } else {
        client.sendStopTyping(pedidoId)
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = null
        }
      }
    },
    [client, pedidoId]
  )

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
      client.sendStopTyping(pedidoId)
    }
  }, [client, pedidoId])

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage]
  )

  // Clear telefono filtrado after 5 seconds
  useEffect(() => {
    if (telefonoFiltrado) {
      const timer = setTimeout(() => setTelefonoFiltrado(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [telefonoFiltrado])

  // Determine if send button should be enabled
  const canSend = (messageText.trim() || pendingAttachment) && !isSending && !isUploading

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {user?.type === "cliente" ? (
                <Store className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <User className="h-4 w-4 text-primary shrink-0" />
              )}
              <span className="font-semibold text-sm truncate">
                {currentPedidoInfo
                  ? user?.type === "cliente"
                    ? currentPedidoInfo.negocioNombre
                    : currentPedidoInfo.clienteNombre
                  : "Cargando..."}
              </span>
            </div>
            {currentPedidoInfo && (
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-4 font-semibold",
                    getEstadoColor(currentPedidoInfo.estado)
                  )}
                >
                  {getEstadoLabel(currentPedidoInfo.estado)}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatPrice(currentPedidoInfo.total)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Order context banner */}
        {currentPedidoInfo && (
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              {currentPedidoInfo.metodoEntrega === "domicilio" ? (
                <>
                  <Bike className="h-3 w-3" /> Delivery
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" /> Retiro
                </>
              )}
            </span>
            <span className="flex items-center gap-0.5">
              <CreditCard className="h-3 w-3" />
              {currentPedidoInfo.metodoPago === "efectivo"
                ? "Efectivo"
                : "Transferencia"}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : currentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm font-semibold">Iniciá la conversación</p>
            <p className="text-xs text-muted-foreground">
              Enviale un mensaje para consultar sobre tu pedido
            </p>
          </div>
        ) : (
          <>
            {currentMessages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isMine={msg.remitente === myRemitente}
                showSender={
                  msg.remitente !== myRemitente &&
                  (i === 0 || currentMessages[i - 1]?.remitente !== msg.remitente)
                }
                userType={user?.type || "cliente"}
                onOpenPdf={(url, name) => setPdfViewer({ open: true, url, fileName: name })}
              />
            ))}
          </>
        )}

        {/* Typing indicator */}
        {currentTyping.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-muted/60 max-w-[70%]">
              <div className="flex gap-0.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {getTypingLabel(currentTyping)}
              </span>
            </div>
          </div>
        )}

        {/* Phone filter warning */}
        {telefonoFiltrado && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
            <Shield className="h-4 w-4 shrink-0" />
            <span className="text-xs">
              Por seguridad, los números de teléfono fueron filtrados
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Upload progress bar */}
      {isUploading && (
        <div className="shrink-0 px-3 pt-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">Subiendo archivo...</span>
          </div>
          <Progress value={uploadProgress} className="h-1.5 mt-1" />
        </div>
      )}

      {/* Pending attachment preview */}
      {pendingAttachment && !isUploading && (
        <div className="shrink-0 px-3 pt-2">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/50 border border-border/50">
            {pendingAttachment.type === "image" && pendingAttachment.preview ? (
              <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <img
                  src={pendingAttachment.preview}
                  alt="Vista previa"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <FileText className="h-6 w-6 text-red-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {pendingAttachment.type === "image" ? "📷 Imagen" : "📄 Archivo"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {pendingAttachment.nombre}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={removePendingAttachment}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div
        className="shrink-0 px-3 py-3 border-t border-border/50 bg-card"
        data-ios-debug-role="chat-composer"
      >
        <div className="flex items-center gap-1.5">
          {/* Paperclip attachment popover */}
          <Popover open={attachPopoverOpen} onOpenChange={setAttachPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl shrink-0 text-muted-foreground hover:text-foreground"
                disabled={isSending || isUploading}
              >
                <Paperclip className="h-4.5 w-4.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              className="w-48 p-1 rounded-xl"
            >
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg hover:bg-muted/80 transition-colors text-left"
                onClick={() => {
                  setAttachPopoverOpen(false)
                  imageInputRef.current?.click()
                }}
              >
                <ImageIcon className="h-4 w-4 text-emerald-600" />
                <span>📷 Imagen</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg hover:bg-muted/80 transition-colors text-left"
                onClick={() => {
                  setAttachPopoverOpen(false)
                  fileInputRef.current?.click()
                }}
              >
                <FileText className="h-4 w-4 text-red-500" />
                <span>📄 Archivo (PDF)</span>
              </button>
            </PopoverContent>
          </Popover>

          {/* Quick image attach button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl shrink-0 text-muted-foreground hover:text-foreground"
            disabled={isSending || isUploading}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageIcon className="h-4.5 w-4.5" />
          </Button>

          <Input
            ref={inputRef}
            value={messageText}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingAttachment ? "Agregá un mensaje (opcional)..." : "Escribí un mensaje..."}
            disabled={isSending || isUploading}
            className="flex-1 h-10 rounded-xl text-sm"
            maxLength={500}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!canSend}
            className="h-10 w-10 rounded-xl shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* PDF Viewer Modal */}
      <PdfViewerModal
        open={pdfViewer.open}
        onClose={() => setPdfViewer({ open: false, url: "", fileName: "" })}
        url={pdfViewer.url}
        fileName={pdfViewer.fileName}
      />
    </div>
  )
}

// ============================================
// Message Bubble
// ============================================
function MessageBubble({
  message,
  isMine,
  showSender,
  userType,
  onOpenPdf,
}: {
  message: ChatMessage
  isMine: boolean
  showSender: boolean
  userType: string
  onOpenPdf: (url: string, name: string) => void
}) {
  const time = new Date(message.fecha).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const senderLabel = getSenderLabel(message.remitente, userType)

  return (
    <div className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
      {/* Sender name */}
      {showSender && !isMine && (
        <span className="text-[10px] text-muted-foreground px-1 mb-0.5 flex items-center gap-1">
          {message.remitente === "vendedor" ? (
            <Store className="h-2.5 w-2.5" />
          ) : message.remitente === "repartidor" ? (
            <Bike className="h-2.5 w-2.5" />
          ) : (
            <User className="h-2.5 w-2.5" />
          )}
          {senderLabel}
        </span>
      )}

      <div
        className={cn(
          "max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
          isMine
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        )}
      >
        {/* Image */}
        {message.imagenUrl && (
          <div className="mb-1.5">
            <img
              src={message.imagenUrl}
              alt="Imagen adjunta"
              className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.imagenUrl!, "_blank")}
            />
          </div>
        )}

        {/* File attachment */}
        {message.archivoUrl && (
          <button
            onClick={() => onOpenPdf(message.archivoUrl!, message.archivoNombre || "Documento PDF")}
            className="flex items-center gap-2 p-2 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors mb-1.5 w-full text-left"
          >
            <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {message.archivoNombre || "Archivo"}
              </p>
              <p className="text-[10px] opacity-60">
                {message.archivoTipo === "application/pdf" ? "PDF" : "Archivo"} — Tocá para ver
              </p>
            </div>
          </button>
        )}

        {/* Text */}
        {message.texto && <p className="whitespace-pre-wrap break-words">{message.texto}</p>}

        {/* Expired content notice (message had a file that was auto-cleaned) */}
        {!message.texto && !message.imagenUrl && !message.archivoUrl && (
          <p className="text-xs italic opacity-40 whitespace-pre-wrap break-words">
            Archivo ya no disponible
          </p>
        )}

        {/* Time and read status */}
        <div
          className={cn(
            "flex items-center gap-1 mt-0.5",
            isMine ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isMine
                ? "text-primary-foreground/60"
                : "text-muted-foreground"
            )}
          >
            {time}
          </span>
          {isMine && (
            <span
              className={cn(
                "text-[10px]",
                message.leido
                  ? "text-primary-foreground/80"
                  : "text-primary-foreground/40"
              )}
            >
              {message.leido ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Helpers
// ============================================
function getSenderLabel(remitente: string, userType: string): string {
  if (remitente === "vendedor") return "Negocio"
  if (remitente === "repartidor") return "Repartidor"
  if (remitente === "cliente") return "Cliente"
  return remitente
}

function getTypingLabel(users: Array<{ userName: string; userType: string }>): string {
  if (users.length === 1) {
    const u = users[0]
    return `${u.userName} está escribiendo...`
  }
  return "Alguien está escribiendo..."
}

function getEstadoColor(estado: string): string {
  switch (estado) {
    case "recibido":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    case "preparando":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    case "en_camino":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
    case "listo_para_retirar":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function getEstadoLabel(estado: string): string {
  switch (estado) {
    case "recibido":
      return "Recibido"
    case "preparando":
      return "Preparando"
    case "en_camino":
      return "En camino"
    case "listo_para_retirar":
      return "Listo"
    case "entregado":
      return "Entregado"
    case "cancelado":
      return "Cancelado"
    default:
      return estado
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => resolve("")
    reader.readAsDataURL(file)
  })
}
