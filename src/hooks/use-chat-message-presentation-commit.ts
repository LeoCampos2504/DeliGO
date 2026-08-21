import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { notifyServiceWorkerMessagePresented } from "@/lib/chat-push-dedupe-bridge"
import {
  evaluateCommittedCandidateEligibility,
  isContainerAtLiveEdge,
} from "@/lib/chat-push-presentation"

// ============================================
// DeliGO - Chat Message Presentation Commit (D2)
// ============================================
// Único responsable de decidir CUÁNDO un mensaje de Chat, ya comprometido
// (React-committed) y con un candidato de presentación vigente, cruza la
// línea hacia "el usuario efectivamente lo vio en foreground" y por lo tanto
// amerita avisarle al Service Worker para suprimir la Push de OS redundante.
//
// Modelo de tres capas (frozen, ver reporte D2):
//   K2 — ¿este callback pertenece al contexto de hook ACTUALMENTE vigente?
//   L2 — ¿el candidato realmente pertenece al pedido/actor/episodio/sheet
//        actual?
//   P4B — ¿el mensaje está React-committed Y el scroll está, con números
//        frescos, en el borde inferior vivo?
// Sesgo fail-open explícito: cualquier ambigüedad NUNCA suprime — como
// mucho, deja pasar una Push duplicada.

export interface ChatMessagePresentationCandidate {
  messageId: string
  pedidoId: string
  actorKey: string
  generation: number
  episodeGeneration: number
}

interface ContainerGeometry {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
}

function isDocumentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible"
}

export function useChatMessagePresentationCommit({
  presentationCandidate,
  currentEpisodeGeneration,
  currentMessages,
  pedidoId,
  actorKey,
  isSheetOpen,
  messagesContainerRef,
}: {
  presentationCandidate: ChatMessagePresentationCandidate | null
  currentEpisodeGeneration: number
  currentMessages: Array<{ id: string }>
  pedidoId: string
  actorKey: string
  isSheetOpen: boolean
  messagesContainerRef: React.RefObject<HTMLElement | null>
}): {
  notifyContainerScrolled: (geometry: ContainerGeometry) => void
  invalidatePendingPresentation: () => void
} {
  const settledGenerationRef = useRef(0)
  const activeTokenRef = useRef<object | null>(null)

  const isCandidateMessageCommitted = presentationCandidate
    ? currentMessages.some((m) => m.id === presentationCandidate.messageId)
    : false

  const invocationToken = useMemo(
    () => ({}),
    [
      presentationCandidate?.generation,
      currentEpisodeGeneration,
      pedidoId,
      actorKey,
      isSheetOpen,
      isCandidateMessageCommitted,
    ]
  )

  useLayoutEffect(() => {
    activeTokenRef.current = invocationToken
    return () => {
      if (activeTokenRef.current === invocationToken) activeTokenRef.current = null
    }
  }, [invocationToken])

  const tryConsume = useCallback(
    (geometry: ContainerGeometry | null) => {
      const candidate = presentationCandidate
      if (!candidate) return
      if (invocationToken !== activeTokenRef.current) return

      const eligible = evaluateCommittedCandidateEligibility({
        candidatePedidoId: candidate.pedidoId,
        currentPedidoId: pedidoId,
        candidateActorKey: candidate.actorKey,
        currentActorKey: actorKey,
        candidateEpisodeGeneration: candidate.episodeGeneration,
        currentEpisodeGeneration,
        isSheetOpen,
        isMessageCommitted: isCandidateMessageCommitted,
      })
      if (!eligible) {
        settledGenerationRef.current = Math.max(settledGenerationRef.current, candidate.generation)
        return
      }

      if (candidate.generation <= settledGenerationRef.current) return

      if (!isDocumentVisible() || !document.hasFocus()) {
        settledGenerationRef.current = candidate.generation
        return
      }

      if (!geometry || !isContainerAtLiveEdge(geometry)) return

      notifyServiceWorkerMessagePresented(candidate.messageId)
      settledGenerationRef.current = candidate.generation
    },
    [
      presentationCandidate,
      invocationToken,
      pedidoId,
      actorKey,
      currentEpisodeGeneration,
      isSheetOpen,
      isCandidateMessageCommitted,
    ]
  )

  useEffect(() => {
    const container = messagesContainerRef.current
    const geometry: ContainerGeometry | null = container
      ? {
          scrollHeight: container.scrollHeight,
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
        }
      : null
    tryConsume(geometry)
  }, [tryConsume, messagesContainerRef])

  const notifyContainerScrolled = useCallback(
    (geometry: ContainerGeometry) => {
      tryConsume(geometry)
    },
    [tryConsume]
  )

  const invalidatePendingPresentation = useCallback(() => {
    if (!presentationCandidate) return
    if (invocationToken !== activeTokenRef.current) return
    settledGenerationRef.current = Math.max(settledGenerationRef.current, presentationCandidate.generation)
  }, [presentationCandidate, invocationToken])

  return { notifyContainerScrolled, invalidatePendingPresentation }
}
