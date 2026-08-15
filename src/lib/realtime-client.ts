"use client"

import type { RealtimeScope } from "@/lib/realtime-policy"

export function getRealtimeSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_CHAT_SERVICE_URL) return process.env.NEXT_PUBLIC_CHAT_SERVICE_URL
  if (process.env.NODE_ENV === "development") return "http://localhost:3003"
  if (typeof window !== "undefined") return window.location.origin
  return "http://localhost:3003"
}

export async function fetchRealtimeToken(): Promise<string> {
  const response = await fetch("/api/realtime/token", { method: "POST", credentials: "include" })
  if (!response.ok) throw new Error("No se pudo autenticar realtime")
  const data = await response.json() as { token?: unknown }
  if (typeof data.token !== "string" || !data.token) throw new Error("Respuesta realtime inválida")
  return data.token
}

export async function authorizeRealtimeRoom(
  pedidoId: string,
  requestedScopes: RealtimeScope[]
): Promise<string> {
  const response = await fetch("/api/realtime/authorize", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pedidoId, requestedScopes }),
  })
  if (!response.ok) throw new Error("Sin autorización realtime para el pedido")
  const data = await response.json() as { token?: unknown }
  if (typeof data.token !== "string" || !data.token) throw new Error("Capability realtime inválida")
  return data.token
}
