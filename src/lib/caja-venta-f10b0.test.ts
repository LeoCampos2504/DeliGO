// ============================================
// F10-B0 — pure helpers: idempotency key, canonical request, cobros, attempt rules
// ============================================
import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
afterAll(() => {
  GlobalRegistrator.unregister()
})

const {
  canonicalVentaCajaRequest,
  estadoConciliacionInicial,
  isValidVentaIdempotencyKey,
  resolveCobrosVenta,
} = await import("./caja-venta")
const {
  classifyCheckoutResponse,
  clearPendingAttempt,
  newIdempotencyKey,
  readPendingAttempt,
  resolveAttemptKey,
  writePendingAttempt,
} = await import("./caja-checkout-attempt")
const { fingerprintVentaCaja } = await import("./caja-venta-service")

describe("idempotency key + canonical content", () => {
  test("accepts UUIDs (same format as /api/pedidos), rejects anything else", () => {
    expect(isValidVentaIdempotencyKey("3f1c2b8e-7a9d-4c1e-9b2a-1f2e3d4c5b6a")).toBe(true)
    expect(isValidVentaIdempotencyKey("not-a-uuid")).toBe(false)
    expect(isValidVentaIdempotencyKey("")).toBe(false)
    expect(isValidVentaIdempotencyKey(123)).toBe(false)
  })
  test("newIdempotencyKey produces valid, distinct keys", () => {
    const keys = new Set(Array.from({ length: 50 }, () => newIdempotencyKey()))
    expect(keys.size).toBe(50)
    for (const k of keys) expect(isValidVentaIdempotencyKey(k)).toBe(true)
  })
  test("canonical form is order-insensitive, keeps repeated lines, ignores prices", () => {
    const a = canonicalVentaCajaRequest("EFECTIVO", [{ productoId: "p1", cantidad: 1 }, { productoId: "p2", varianteId: "v", cantidad: 2 }])
    const b = canonicalVentaCajaRequest("EFECTIVO", [{ productoId: "p2", varianteId: "v", cantidad: 2 }, { productoId: "p1", cantidad: 1 }])
    expect(a).toBe(b)
    expect(canonicalVentaCajaRequest("TRANSFERENCIA", [{ productoId: "p1", cantidad: 1 }])).not.toBe(canonicalVentaCajaRequest("EFECTIVO", [{ productoId: "p1", cantidad: 1 }]))
    expect(canonicalVentaCajaRequest("EFECTIVO", [{ productoId: "p1", cantidad: 1 }, { productoId: "p1", cantidad: 1 }])).not.toBe(canonicalVentaCajaRequest("EFECTIVO", [{ productoId: "p1", cantidad: 1 }]))
    expect(canonicalVentaCajaRequest("EFECTIVO", [{ productoId: "p1", cantidad: 2 }])).not.toBe(canonicalVentaCajaRequest("EFECTIVO", [{ productoId: "p1", cantidad: 1 }]))
  })
  test("server fingerprint is per business (same content, two negocios → different fingerprints)", () => {
    const lines = [{ productoId: "p1", cantidad: 1 }]
    expect(fingerprintVentaCaja("n1", "EFECTIVO", lines)).toMatch(/^[0-9a-f]{64}$/)
    expect(fingerprintVentaCaja("n1", "EFECTIVO", lines)).not.toBe(fingerprintVentaCaja("n2", "EFECTIVO", lines))
  })
})

describe("cobros (D7) and declared-vs-credited", () => {
  test("a transfer starts DECLARADO (never verified); cash/other are NO_APLICA", () => {
    expect(estadoConciliacionInicial("TRANSFERENCIA")).toBe("DECLARADO")
    expect(estadoConciliacionInicial("EFECTIVO")).toBe("NO_APLICA")
    expect(estadoConciliacionInicial("OTRO")).toBe("NO_APLICA")
  })
  test("historical sale without cobros is READ as one legacy cobro (nothing persisted)", () => {
    expect(resolveCobrosVenta({ metodoPago: "TRANSFERENCIA", total: 500 }, [])).toEqual([
      { metodo: "TRANSFERENCIA", importe: 500, estadoConciliacion: "DECLARADO", legacy: true },
    ])
  })
  test("new sale reads its real cobros, never duplicated with the legacy fallback", () => {
    const cobros = [{ metodo: "EFECTIVO", importe: 500, estadoConciliacion: "NO_APLICA" }]
    expect(resolveCobrosVenta({ metodoPago: "EFECTIVO", total: 500 }, cobros)).toEqual([{ ...cobros[0], legacy: false }])
  })
})

describe("checkout attempt rules (D9)", () => {
  beforeEach(() => window.sessionStorage.clear())
  test("no answer / 5xx are UNCERTAIN (keep key), 2xx success, reused key → conflict, other 4xx definitive", () => {
    expect(classifyCheckoutResponse(null)).toBe("uncertain")
    expect(classifyCheckoutResponse(502)).toBe("uncertain")
    expect(classifyCheckoutResponse(201)).toBe("success")
    expect(classifyCheckoutResponse(200)).toBe("success")
    expect(classifyCheckoutResponse(409, "IDEMPOTENCY_KEY_REUSED")).toBe("key_conflict")
    expect(classifyCheckoutResponse(409, "STOCK_RESERVED_FOR_ORDERS")).toBe("definitive_failure")
    expect(classifyCheckoutResponse(400)).toBe("definitive_failure")
  })
  test("the pending key is reused only for the exact same content", () => {
    const pending = { key: newIdempotencyKey(), canonical: "X", metodoPago: "EFECTIVO" as const, cart: [], createdAt: 0 }
    expect(resolveAttemptKey(pending, "X")).toBe(pending.key)
    expect(resolveAttemptKey(pending, "Y")).toBeNull()
    expect(resolveAttemptKey(null, "X")).toBeNull()
  })
  test("persisted per business in sessionStorage; invalid/foreign payloads ignored; cleared on demand", () => {
    const attempt = { key: newIdempotencyKey(), canonical: "C", metodoPago: "TRANSFERENCIA" as const, cart: [{ productoId: "p", nombre: "P", precio: 1, cantidad: 1 }], createdAt: 1 }
    writePendingAttempt("n1", attempt)
    expect(readPendingAttempt("n1")).toEqual(attempt)
    expect(readPendingAttempt("n2")).toBeNull()
    window.sessionStorage.setItem("deligo:caja:checkout-attempt:v1:n3", JSON.stringify({ ...attempt, key: "bad" }))
    expect(readPendingAttempt("n3")).toBeNull()
    clearPendingAttempt("n1")
    expect(readPendingAttempt("n1")).toBeNull()
  })
})
