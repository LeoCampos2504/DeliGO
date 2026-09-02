import type { RealtimeConnectionState } from "@/lib/realtime-types"

export type ChatConnectionTone = "connected" | "connecting" | "idle" | "disconnected"

export interface ChatConnectionPresentation {
  tone: ChatConnectionTone
  label: string
  showRetry: boolean
}

// P2-T20: `idle` and `stopped` mean the realtime transport is deliberately at
// rest — no chat room currently has open demand (see RealtimeManager's
// scheduleIdleDisconnect / hasGlobalRealtimeDemand), or the manager hasn't
// been started for this actor yet. Neither is a failure: showing "Sin
// conexión" for them (the previous catch-all behavior) misrepresented an
// intentional, cost-saving idle state as a connectivity problem — exactly
// the symptom reported ("leave the chat, it briefly still says Conectado,
// then flips to Sin conexión with no real outage"). `error` and `offline`
// are real, user-relevant disconnections and keep the retry affordance.
export function deriveChatConnectionPresentation(state: RealtimeConnectionState): ChatConnectionPresentation {
  switch (state) {
    case "connected":
      return { tone: "connected", label: "Conectado", showRetry: false }
    case "connecting":
    case "reauthenticating":
      return { tone: "connecting", label: "Conectando...", showRetry: false }
    case "reconnecting":
      return { tone: "connecting", label: "Reconectando...", showRetry: false }
    case "error":
    case "offline":
      return { tone: "disconnected", label: "Sin conexión", showRetry: true }
    case "idle":
    case "stopped":
    default:
      return { tone: "idle", label: "Listo", showRetry: false }
  }
}
