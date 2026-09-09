// P2-T31-R8 (PUSH-RATE-LIMIT-429-STATE-CONSISTENCY-FIX): F-P2-T31-R8-04 —
// DIRECT unit tests for the pure error-message helper subscribe()/
// unsubscribe() use to pick a clearer message on a 429 rate-limit rejection.
// Safe to import the real module directly (no jsdom needed): these are
// plain exported functions/classes, never React hook invocations.
import { describe, expect, test } from "bun:test"
import { PushMutationHttpError, pushMutationFailureMessage } from "./use-push-notifications"

describe("PushMutationHttpError", () => {
  test("carries the real HTTP status alongside the message", () => {
    const err = new PushMutationHttpError("Error saving subscription", 429)
    expect(err.httpStatus).toBe(429)
    expect(err.message).toBe("Error saving subscription")
    expect(err).toBeInstanceOf(Error)
  })
})

describe("pushMutationFailureMessage", () => {
  test("429 -> the specific rate-limit message, never the generic fallback", () => {
    const err = new PushMutationHttpError("Error saving subscription", 429)
    expect(pushMutationFailureMessage(err, "Error al activar notificaciones")).toBe(
      "Demasiados intentos. Esperá unos segundos e intentá nuevamente."
    )
  })

  test("500 -> falls back to the generic message, not the rate-limit one", () => {
    const err = new PushMutationHttpError("Error saving subscription", 500)
    expect(pushMutationFailureMessage(err, "Error al activar notificaciones")).toBe("Error al activar notificaciones")
  })

  test("a plain Error (network failure, no HTTP status at all) falls back to the generic message", () => {
    const err = new Error("network down")
    expect(pushMutationFailureMessage(err, "Error al activar notificaciones")).toBe("Error al activar notificaciones")
  })

  test("a non-Error thrown value falls back to the generic message without throwing", () => {
    expect(pushMutationFailureMessage("not an error object", "Error al desactivar notificaciones")).toBe(
      "Error al desactivar notificaciones"
    )
    expect(pushMutationFailureMessage(undefined, "Error al desactivar notificaciones")).toBe(
      "Error al desactivar notificaciones"
    )
  })

  test("the rate-limit message never mentions internal details (no HTTP status, no header name, no bucket name)", () => {
    const err = new PushMutationHttpError("Error saving subscription", 429)
    const message = pushMutationFailureMessage(err, "fallback")
    expect(message).not.toMatch(/429|Retry-After|pushMutation|rate.?limit/i)
  })

  test("works identically for the subscribe fallback and the unsubscribe fallback — only the fallback text differs", () => {
    const err = new PushMutationHttpError("x", 429)
    expect(pushMutationFailureMessage(err, "Error al activar notificaciones")).toBe(
      pushMutationFailureMessage(err, "Error al desactivar notificaciones")
    )
  })
})
