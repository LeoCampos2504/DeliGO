// ============================================
// DeliGO - Chat Push Presentation Predicates (D2)
// ============================================
// Funciones puras, sin efectos ni dependencias de framework. No leen DOM,
// no leen refs, no tienen estado propio — todo lo que necesitan entra por
// parámetro. Esto permite probarlas exhaustivamente sin React ni un
// Service Worker real, y mantiene toda la lógica de decisión auditable en
// un solo lugar.

// Evalúa, en el momento en que llega un mensaje por socket, si corresponde
// crear un candidato de "presentación" para ese mensaje (paso previo a
// avisarle al Service Worker). Nunca se usa para mensajes de historial — el
// único llamador real es el handler de "new-message" en tiempo real.
export function evaluateReceiptEligibility({
  isOwnMessage,
  isSheetOpen,
  messagePedidoId,
  activePedidoId,
  isDocumentVisible,
  isDocumentFocused,
}: {
  isOwnMessage: boolean
  isSheetOpen: boolean
  messagePedidoId: string
  activePedidoId: string | null
  isDocumentVisible: boolean
  isDocumentFocused: boolean
}): boolean {
  if (isOwnMessage) return false
  if (!isSheetOpen) return false
  if (!activePedidoId) return false
  if (messagePedidoId !== activePedidoId) return false
  if (!isDocumentVisible) return false
  if (!isDocumentFocused) return false
  return true
}

// Layer 2 — decide si un candidato ya committeado en React todavía pertenece
// al contexto ACTUAL (pedido/actor/episodio/sheet), independientemente de
// que el callback que lo evalúa sea o no el "vigente" (eso lo resuelve K2,
// por separado, en el hook). Comparación exclusivamente por campos directos
// y por generación de episodio — sin geometría, sin visibilidad/foco (esos
// se evalúan en vivo, aparte).
export function evaluateCommittedCandidateEligibility({
  candidatePedidoId,
  currentPedidoId,
  candidateActorKey,
  currentActorKey,
  candidateEpisodeGeneration,
  currentEpisodeGeneration,
  isSheetOpen,
  isMessageCommitted,
}: {
  candidatePedidoId: string
  currentPedidoId: string
  candidateActorKey: string
  currentActorKey: string
  candidateEpisodeGeneration: number
  currentEpisodeGeneration: number
  isSheetOpen: boolean
  isMessageCommitted: boolean
}): boolean {
  return (
    candidatePedidoId === currentPedidoId &&
    candidateActorKey === currentActorKey &&
    candidateEpisodeGeneration === currentEpisodeGeneration &&
    isSheetOpen === true &&
    isMessageCommitted === true
  )
}

// Layer 3 (P4B) — geometría pura: ¿el contenedor de mensajes está,
// AHORA MISMO, con el scroll en el borde inferior "vivo"? Recibe siempre
// números primitivos frescos (nunca un HTMLElement ni un ref) para que no
// pueda haber lectura de geometría vieja/cacheada.
export function isContainerAtLiveEdge({
  scrollHeight,
  scrollTop,
  clientHeight,
  thresholdPx = 100,
}: {
  scrollHeight: number
  scrollTop: number
  clientHeight: number
  thresholdPx?: number
}): boolean {
  return scrollHeight - scrollTop - clientHeight < thresholdPx
}
