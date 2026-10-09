// ============================================
// F10-B0 — Caja checkout attempt identity (client side, D9 online-only)
// ============================================
// One Idempotency-Key per checkout ATTEMPT, bound to the exact request content
// (canonicalVentaCajaRequest). Rules:
//   - same content retried after an uncertain outcome → SAME key → the server
//     replays the sale it may already have committed (never sells twice);
//   - different content (cart or method changed) → NEW key → a new attempt;
//   - the attempt is persisted in sessionStorage from the moment it is sent
//     until a definitive answer, so a reload / killed PWA keeps the cart and
//     the key instead of letting the cashier ring the sale up again.
// No offline queue: nothing is ever sent automatically; the user retries.

import { isValidVentaIdempotencyKey, isValidMetodoPagoVenta, type CartLine, type MetodoPagoVenta } from "@/lib/caja-venta"

export interface PendingCheckoutAttempt {
  key: string
  canonical: string
  /** Owner-only physical register bound to this attempt, if selected. */
  cajaFisicaId?: string
  metodoPago: MetodoPagoVenta
  cart: CartLine[]
  createdAt: number
}

export type CheckoutOutcome = "success" | "uncertain" | "definitive_failure" | "key_conflict"

export const CHECKOUT_UNCERTAIN_MESSAGE =
  "No pudimos confirmar la venta. Revisá la conexión y tocá Confirmar de nuevo con el mismo medio: si ya se registró, no se cobra dos veces."
export const CHECKOUT_OFFLINE_MESSAGE =
  "Sin conexión a internet: la venta NO se registró. Cuando vuelva la conexión, tocá Confirmar de nuevo."

const STORAGE_PREFIX = "deligo:caja:checkout-attempt:v1:"

/**
 * null status = the request never got an HTTP answer (network error/timeout).
 * 5xx and no-answer are UNCERTAIN (the sale may have committed) → keep the key.
 * A reused-key 409 → drop the key. Any other 4xx is a definitive rejection
 * (the transaction rolled back, nothing was written).
 */
export function classifyCheckoutResponse(status: number | null, code?: unknown): CheckoutOutcome {
  if (status === null) return "uncertain"
  if (status >= 200 && status < 300) return "success"
  if (status >= 500) return "uncertain"
  if (status === 409 && code === "IDEMPOTENCY_KEY_REUSED") return "key_conflict"
  return "definitive_failure"
}

/** Reuse the pending key only for the exact same content. */
export function resolveAttemptKey(pending: PendingCheckoutAttempt | null, canonical: string): string | null {
  return pending && pending.canonical === canonical ? pending.key : null
}

export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === "function") return c.randomUUID()
  // RFC 4122 v4 fallback from getRandomValues (older WebViews).
  const bytes = new Uint8Array(16)
  c?.getRandomValues?.(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null
  } catch {
    return null
  }
}

export function readPendingAttempt(negocioId: string): PendingCheckoutAttempt | null {
  try {
    const raw = storage()?.getItem(STORAGE_PREFIX + negocioId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingCheckoutAttempt>
    if (
      !isValidVentaIdempotencyKey(parsed.key) ||
      typeof parsed.canonical !== "string" ||
      (parsed.cajaFisicaId !== undefined && typeof parsed.cajaFisicaId !== "string") ||
      !isValidMetodoPagoVenta(parsed.metodoPago) ||
      !Array.isArray(parsed.cart) ||
      parsed.cart.length === 0
    ) {
      return null
    }
    return parsed as PendingCheckoutAttempt
  } catch {
    return null
  }
}

export function writePendingAttempt(negocioId: string, attempt: PendingCheckoutAttempt): void {
  try {
    storage()?.setItem(STORAGE_PREFIX + negocioId, JSON.stringify(attempt))
  } catch {
    // best effort: the in-memory attempt still protects retries in this session
  }
}

export function clearPendingAttempt(negocioId: string): void {
  try {
    storage()?.removeItem(STORAGE_PREFIX + negocioId)
  } catch {
    // ignore
  }
}
