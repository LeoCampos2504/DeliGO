/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests: contrato client-safe de cancelación de pedidos de mesa (23-A2)
// ============================================
// Puro: sin red, sin DB, sin React. Cubre la sección 22 del prompt 23-A2
// (26 casos mínimos de lógica) para visibilidad, validación de motivo y el
// gate del botón de confirmación.

import { describe, test, expect } from "bun:test"
import {
  ESTADOS_PENDIENTES_MESA,
  MOTIVO_CANCELACION_MAX_LEN,
  MOTIVO_CANCELACION_MIN_LEN,
  puedeConfirmarCancelacionPedidoMesa,
  puedeMostrarCancelacionPedidoMesa,
  validarMotivoCancelacionMesa,
} from "./mesa-pedido-cancelacion-contract"

describe("23-A2 — puedeMostrarCancelacionPedidoMesa (visibilidad)", () => {
  test("1. mesa + estado cancelable -> visible", () => {
    for (const estado of ESTADOS_PENDIENTES_MESA) {
      expect(puedeMostrarCancelacionPedidoMesa({ estado, metodoEntrega: "mesa" })).toBe(true)
    }
  })

  test("2. mesa + estado no cancelable (entregado) -> oculta", () => {
    expect(puedeMostrarCancelacionPedidoMesa({ estado: "entregado", metodoEntrega: "mesa" })).toBe(false)
  })

  test("2b. mesa + cancelado -> oculta", () => {
    expect(puedeMostrarCancelacionPedidoMesa({ estado: "cancelado", metodoEntrega: "mesa" })).toBe(false)
  })

  test("3. delivery -> oculta", () => {
    expect(puedeMostrarCancelacionPedidoMesa({ estado: "recibido", metodoEntrega: "domicilio" })).toBe(false)
  })

  test("4. retiro -> oculta", () => {
    expect(puedeMostrarCancelacionPedidoMesa({ estado: "recibido", metodoEntrega: "retiro" })).toBe(false)
  })

  test("5. estado desconocido -> oculta (deny-by-default, nunca 'por las dudas')", () => {
    expect(puedeMostrarCancelacionPedidoMesa({ estado: "en_camino", metodoEntrega: "mesa" })).toBe(false)
    expect(puedeMostrarCancelacionPedidoMesa({ estado: "estado_futuro_desconocido", metodoEntrega: "mesa" })).toBe(false)
  })

  test("6. método de entrega desconocido -> oculta", () => {
    expect(puedeMostrarCancelacionPedidoMesa({ estado: "recibido", metodoEntrega: "drone" })).toBe(false)
    expect(puedeMostrarCancelacionPedidoMesa({ estado: "recibido", metodoEntrega: "" })).toBe(false)
  })

  test("datos con forma inesperada (no string/undefined/null) -> oculta, nunca lanza", () => {
    expect(puedeMostrarCancelacionPedidoMesa({ estado: 123, metodoEntrega: "mesa" })).toBe(false)
    expect(puedeMostrarCancelacionPedidoMesa({ estado: null, metodoEntrega: "mesa" })).toBe(false)
    expect(puedeMostrarCancelacionPedidoMesa({ estado: undefined, metodoEntrega: "mesa" })).toBe(false)
    expect(puedeMostrarCancelacionPedidoMesa({ estado: "recibido", metodoEntrega: null })).toBe(false)
    expect(puedeMostrarCancelacionPedidoMesa({ estado: "recibido", metodoEntrega: undefined })).toBe(false)
  })

  test("allowlist usada es exactamente ESTADOS_PENDIENTES_MESA (misma referencia que el CAS server-side, src/lib/mesa-cuenta.ts) — no una copia divergente", () => {
    expect(ESTADOS_PENDIENTES_MESA).toEqual(["recibido", "preparando", "listo_para_retirar"])
    // Ningún estado fuera de la allowlist queda visible, ni siquiera uno "cercano".
    for (const estado of ["pendiente", "confirmado", "en_preparacion", "listo", "servido"]) {
      expect(puedeMostrarCancelacionPedidoMesa({ estado, metodoEntrega: "mesa" })).toBe(false)
    }
  })
})

describe("23-A2 — validarMotivoCancelacionMesa (reexportado, mismo comportamiento que 23-A1)", () => {
  test("8. motivo vacío -> inválido", () => {
    expect(validarMotivoCancelacionMesa("").ok).toBe(false)
  })

  test("9. solo espacios -> inválido", () => {
    expect(validarMotivoCancelacionMesa("      ").ok).toBe(false)
  })

  test("10. cuatro caracteres tras trim -> inválido", () => {
    expect(validarMotivoCancelacionMesa("  hola  ").ok).toBe(false)
  })

  test("11. cinco caracteres -> válido", () => {
    const r = validarMotivoCancelacionMesa("a".repeat(MOTIVO_CANCELACION_MIN_LEN))
    expect(r.ok).toBe(true)
  })

  test("12. quinientos caracteres -> válido", () => {
    const r = validarMotivoCancelacionMesa("a".repeat(MOTIVO_CANCELACION_MAX_LEN))
    expect(r.ok).toBe(true)
  })

  test("13. quinientos uno -> inválido", () => {
    const r = validarMotivoCancelacionMesa("a".repeat(MOTIVO_CANCELACION_MAX_LEN + 1))
    expect(r.ok).toBe(false)
  })

  test("14. se envía con trim (espacios externos no cuentan para el límite ni se envían)", () => {
    const r = validarMotivoCancelacionMesa("  Pedido cargado a la mesa equivocada  ")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.motivo).toBe("Pedido cargado a la mesa equivocada")
  })

  test("undefined/null/número/objeto -> inválido, nunca lanza", () => {
    expect(validarMotivoCancelacionMesa(undefined).ok).toBe(false)
    expect(validarMotivoCancelacionMesa(null).ok).toBe(false)
    expect(validarMotivoCancelacionMesa(12345).ok).toBe(false)
    expect(validarMotivoCancelacionMesa({ motivo: "x" }).ok).toBe(false)
  })
})

describe("23-A2 — puedeConfirmarCancelacionPedidoMesa (gate del botón de confirmación)", () => {
  const base = { pedidoId: "pedido-1", motivo: "Pedido cargado por error", submitting: false, elegible: true }

  test("7. id de pedido faltante -> deshabilitado", () => {
    expect(puedeConfirmarCancelacionPedidoMesa({ ...base, pedidoId: "" })).toBe(false)
    expect(puedeConfirmarCancelacionPedidoMesa({ ...base, pedidoId: null })).toBe(false)
    expect(puedeConfirmarCancelacionPedidoMesa({ ...base, pedidoId: undefined })).toBe(false)
  })

  test("pedido dejó de ser elegible -> deshabilitado", () => {
    expect(puedeConfirmarCancelacionPedidoMesa({ ...base, elegible: false })).toBe(false)
  })

  test("solicitud en curso -> deshabilitado (evita doble envío desde la lógica, no solo la UI)", () => {
    expect(puedeConfirmarCancelacionPedidoMesa({ ...base, submitting: true })).toBe(false)
  })

  test("motivo inválido -> deshabilitado", () => {
    expect(puedeConfirmarCancelacionPedidoMesa({ ...base, motivo: "" })).toBe(false)
    expect(puedeConfirmarCancelacionPedidoMesa({ ...base, motivo: "hola" })).toBe(false)
  })

  test("todo válido -> habilitado", () => {
    expect(puedeConfirmarCancelacionPedidoMesa(base)).toBe(true)
  })
})
