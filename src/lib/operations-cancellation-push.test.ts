import { describe, expect, test } from "bun:test"
import {
  buildOperationsCancellationUrl,
  operacionesOrderCancelledNotification,
  reservePushEndpoint,
} from "./push"

describe("shared cancellation push — current Operations contract", () => {
  test("salon payload uses current panel URL, stable tag, icon and minimal data", () => {
    const url = buildOperationsCancellationUrl("mi-local", "salon", "pedido-1")
    const payload = operacionesOrderCancelledNotification("pedido-1", "salon", "cliente", url, 12)

    expect(payload.data).toEqual({
      type: "operaciones_order_cancelled",
      pedidoId: "pedido-1",
      area: "salon",
      url: "/operaciones/mi-panel/mi-local/salon?pedidoId=pedido-1",
    })
    expect(payload.title).toBe("Pedido cancelado ❌")
    expect(payload.body).toContain("mesa 12")
    expect(payload.tag).toBe("operaciones-order-cancelled-pedido-1")
    expect(payload.icon).toBe("/icon-salon-192x192.png")
    expect(payload.badge).toBe("/icon-salon-192x192.png")
    expect(payload.data?.url).not.toMatch(/\/e\/|\/m\/|\/s\//)
  })

  test("PyR payload targets the current pedidos panel and does not include PII", () => {
    const url = buildOperationsCancellationUrl("local con espacio", "pyr", "pedido/2")
    const payload = operacionesOrderCancelledNotification("pedido/2", "pyr", "sistema", url)

    expect(payload.data?.url).toBe(
      "/operaciones/mi-panel/local%20con%20espacio/pyr/pedidos?pedidoId=pedido%2F2"
    )
    expect(payload.body).toContain("automáticamente")
    expect(payload.data).not.toHaveProperty("clienteNombre")
    expect(payload.data).not.toHaveProperty("telefono")
    expect(payload.data).not.toHaveProperty("direccion")
  })

  test("one cancellation event has one deterministic logical tag", () => {
    const first = operacionesOrderCancelledNotification(
      "pedido-3",
      "salon",
      "vendedor",
      "/operaciones/mi-panel/local/salon?pedidoId=pedido-3"
    )
    const second = operacionesOrderCancelledNotification(
      "pedido-3",
      "salon",
      "vendedor",
      "/operaciones/mi-panel/local/salon?pedidoId=pedido-3"
    )

    expect(first.tag).toBe(second.tag)
    expect(first.tag).toBe("operaciones-order-cancelled-pedido-3")
  })

  test("cross-channel reuse sends once per physical endpoint and preserves distinct devices", () => {
    const reserved = new Set<string>()
    const personalEndpoint = JSON.stringify({ endpoint: "https://push.example/shared" })
    const operationsSameEndpoint = JSON.stringify({ endpoint: "https://push.example/shared" })
    const secondDevice = JSON.stringify({ endpoint: "https://push.example/second-device" })

    expect(reservePushEndpoint(personalEndpoint, reserved)).toBe(true)
    expect(reservePushEndpoint(operationsSameEndpoint, reserved)).toBe(false)
    expect(reservePushEndpoint(secondDevice, reserved)).toBe(true)
  })
})
