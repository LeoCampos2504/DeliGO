"use client"

// ============================================
// F4-A — POST with one Idempotency-Key per canonical body. The key is kept
// for 5xx / network failures, so a retry of the SAME data can never apply the
// operation twice; a 4xx (nothing written) releases it. Shared by the sale
// detail forms and «Gestionar venta».
// ============================================

import { useRef } from "react"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"

export type ResultadoPost = { ok: true; json: Record<string, unknown> } | { ok: false; message: string; code?: string }

export function useIdempotentPost() {
  const keys = useRef(new Map<string, string>())
  return async (url: string, body: unknown): Promise<ResultadoPost> => {
    const canonical = JSON.stringify(body)
    let key = keys.current.get(canonical)
    if (!key) { key = newIdempotencyKey(); keys.current.set(canonical, key) }
    let response: Response
    try {
      response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: canonical })
    } catch {
      return { ok: false, message: "No pudimos confirmar la operación por un problema de conexión. Podés reintentar sin duplicarla." }
    }
    const json = await response.json().catch(() => ({}))
    if (response.ok && json.ok) { keys.current.clear(); return { ok: true, json } }
    if (response.status < 500) keys.current.delete(canonical)
    return {
      ok: false,
      message: response.status >= 500 ? "No pudimos registrar la operación por un error del servidor. Podés reintentar sin duplicarla." : (json.error ?? "No pudimos registrar la operación."),
      ...(typeof json.code === "string" ? { code: json.code } : {}),
    }
  }
}
