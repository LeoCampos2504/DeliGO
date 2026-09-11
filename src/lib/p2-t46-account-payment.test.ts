/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { buildCuentaMesa, withCuentaMesaPayment } from "./mesa-cuenta"

const item = {
  id: "item-1",
  nombre: "Café",
  precio: 100,
  cantidad: 1,
  agregados: [],
  secciones: {},
  ingredientesQuitados: [],
  talle: "",
  color: "",
}

describe("P2-T46-R1 — autoridad de pago por ocupación", () => {
  test("la cuenta canónica suma solo entregados y conserva notas históricas", () => {
    const cuenta = buildCuentaMesa([
      { id: "served", estado: "entregado", fecha: "2026-09-10T12:00:00Z", total: 100, notas: "sin azúcar", items: [item] },
      { id: "pending", estado: "preparando", fecha: "2026-09-10T12:01:00Z", total: 200, items: [item] },
      { id: "cancelled", estado: "cancelado", fecha: "2026-09-10T12:02:00Z", total: 300, items: [item] },
    ])

    expect(cuenta.totalGeneral).toBe(100)
    expect(cuenta.pedidosPendientesCount).toBe(1)
    expect(cuenta.puedeCerrar).toBe(false)
    expect(cuenta.pedidos[0]?.notas).toBe("sin azúcar")
    expect(cuenta.estadoPago).toBe("pendiente")
  })

  test("el pago confirmado vive en la ocupación y no muta el total canónico", () => {
    const base = buildCuentaMesa([{ id: "served", estado: "entregado", fecha: new Date(), total: 1250, items: [item] }])
    const confirmed = withCuentaMesaPayment(base, {
      metodoPago: "transferencia",
      pagoConfirmadoEn: "2026-09-10T12:10:00.000Z",
    })

    expect(confirmed.totalGeneral).toBe(1250)
    expect(confirmed.metodoPago).toBe("transferencia")
    expect(confirmed.estadoPago).toBe("confirmado")
    expect(confirmed.pagoConfirmadoEn).toBe("2026-09-10T12:10:00.000Z")
    expect(base.metodoPago).toBeNull()
  })

  test("método inválido o timestamp ausente nunca se presenta como pago confirmado", () => {
    const account = buildCuentaMesa([])
    const result = withCuentaMesaPayment(account, { metodoPago: "tarjeta", pagoConfirmadoEn: null })
    expect(result.metodoPago).toBeNull()
    expect(result.estadoPago).toBe("pendiente")
  })
})
