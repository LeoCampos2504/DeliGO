"use client"

import type { RealtimeScope } from "@/lib/realtime-policy"
import type { RealtimeActorTokenResult, RealtimeCapabilityResult } from "@/lib/realtime-types"

export function getRealtimeSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_CHAT_SERVICE_URL) return process.env.NEXT_PUBLIC_CHAT_SERVICE_URL
  if (process.env.NODE_ENV === "development") return "http://localhost:3003"
  if (typeof window !== "undefined") return window.location.origin
  return "http://localhost:3003"
}

export async function fetchRealtimeTokenResult(options: { signal?: AbortSignal } = {}): Promise<RealtimeActorTokenResult> {
  const response = await fetch("/api/realtime/token", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  })
  if (!response.ok) throw realtimeRequestError("No se pudo autenticar realtime", response.status)
  const data = await response.json() as { token?: unknown; expiresIn?: unknown }
  if (typeof data.token !== "string" || !data.token) throw new Error("Respuesta realtime inválida")
  return {
    token: data.token,
    ...(typeof data.expiresIn === "number" && Number.isFinite(data.expiresIn) && data.expiresIn > 0
      ? { expiresIn: data.expiresIn }
      : {}),
  }
}

export async function authorizeRealtimeRoomResult(
  pedidoId: string,
  requestedScopes: RealtimeScope[],
  options: { signal?: AbortSignal } = {}
): Promise<RealtimeCapabilityResult> {
  const response = await fetch("/api/realtime/authorize", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pedidoId, requestedScopes }),
    signal: options.signal,
  })
  if (!response.ok) throw realtimeRequestError("Sin autorización realtime para el pedido", response.status)
  const data = await response.json() as {
    token?: unknown
    expiresIn?: unknown
    room?: unknown
    scopes?: unknown
  }
  if (typeof data.token !== "string" || !data.token) throw new Error("Capability realtime inválida")
  return {
    token: data.token,
    ...(typeof data.expiresIn === "number" && Number.isFinite(data.expiresIn) && data.expiresIn > 0
      ? { expiresIn: data.expiresIn }
      : {}),
    ...(typeof data.room === "string" && data.room ? { room: data.room } : {}),
    ...(Array.isArray(data.scopes) && data.scopes.every((scope): scope is RealtimeScope =>
      typeof scope === "string" && ["chat:read", "chat:typing", "tracking:watch", "tracking:publish"].includes(scope)
    ) ? { scopes: data.scopes } : {}),
  }
}

function realtimeRequestError(message: string, status: number): Error & { status: number } {
  const error = new Error(message) as Error & { status: number }
  error.status = status
  return error
}
