import { describe, expect, test } from "bun:test"
import { deriveChatConnectionPresentation } from "@/lib/chat-connection-presentation"
import type { RealtimeConnectionState } from "@/lib/realtime-types"

describe("deriveChatConnectionPresentation — P2-T20 connection status semantics", () => {
  test("connected — active, healthy", () => {
    expect(deriveChatConnectionPresentation("connected")).toEqual({
      tone: "connected",
      label: "Conectado",
      showRetry: false,
    })
  })

  test("connecting and reauthenticating both present as the initial-connect label", () => {
    for (const state of ["connecting", "reauthenticating"] as RealtimeConnectionState[]) {
      expect(deriveChatConnectionPresentation(state)).toEqual({
        tone: "connecting",
        label: "Conectando...",
        showRetry: false,
      })
    }
  })

  test("reconnecting gets its own distinct label (source already distinguishes it from a fresh connect)", () => {
    expect(deriveChatConnectionPresentation("reconnecting")).toEqual({
      tone: "connecting",
      label: "Reconectando...",
      showRetry: false,
    })
  })

  test("error and offline are real disconnections while a chat is active — both keep the retry affordance", () => {
    for (const state of ["error", "offline"] as RealtimeConnectionState[]) {
      expect(deriveChatConnectionPresentation(state)).toEqual({
        tone: "disconnected",
        label: "Sin conexión",
        showRetry: true,
      })
    }
  })

  test("idle and stopped are deliberate rest states (no active room demand) — never rendered as a failure", () => {
    for (const state of ["idle", "stopped"] as RealtimeConnectionState[]) {
      const presentation = deriveChatConnectionPresentation(state)
      expect(presentation.tone).toBe("idle")
      expect(presentation.label).not.toBe("Sin conexión")
      expect(presentation.showRetry).toBe(false)
    }
  })

  test("idle/stopped never collapse into the same tone as a real disconnection", () => {
    const idleTone = deriveChatConnectionPresentation("idle").tone
    const errorTone = deriveChatConnectionPresentation("error").tone
    expect(idleTone).not.toBe(errorTone)
  })
})
