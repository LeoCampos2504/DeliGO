import { describe, expect, test } from "bun:test"
import {
  authorizeRealtimeOrder,
  isTrackingCoreEligible,
  normalizeRequestedScopes,
  type RealtimeOrderSnapshot,
} from "@/lib/realtime-policy"

const enabledOrder: RealtimeOrderSnapshot = {
  id: "pedido-a",
  clienteId: "cliente-a",
  negocioId: "negocio-a",
  repartidorId: "repartidor-a",
  estado: "en_camino",
  metodoEntrega: "domicilio",
  seguimientoDeliveryActivo: true,
  seguimientoDeliveryHabilitado: true,
  repartidorAssociationValid: true,
}

describe("realtime room policy", () => {
  test("normalizes only unique allowlisted scopes", () => {
    expect(normalizeRequestedScopes(["chat:read", "chat:typing"])).toEqual(["chat:read", "chat:typing"])
    expect(normalizeRequestedScopes(["chat:read", "chat:read"])).toBeNull()
    expect(normalizeRequestedScopes(["admin"])).toBeNull()
  })

  test("isolates Cliente chat and tracking to the owned live order", () => {
    expect(authorizeRealtimeOrder({ userId: "cliente-a", userType: "cliente" }, enabledOrder, ["chat:read", "tracking:watch"])).toEqual({
      ok: true,
      scopes: ["chat:read", "tracking:watch"],
    })
    expect(authorizeRealtimeOrder({ userId: "cliente-b", userType: "cliente" }, enabledOrder, ["chat:read"])).toEqual({
      ok: false,
      code: "ROOM_FORBIDDEN",
    })
  })

  test("gates tracking live on the Negocio policy", () => {
    expect(authorizeRealtimeOrder(
      { userId: "cliente-a", userType: "cliente" },
      { ...enabledOrder, seguimientoDeliveryActivo: false },
      ["tracking:watch"]
    )).toEqual({ ok: false, code: "TRACKING_DISABLED" })
  })

  test("P2T01-05/23: gates tracking on the Pedido's immutable snapshot too, even when the Negocio's live flag is currently true (watch AND publish, same shared core semantic)", () => {
    const snapshotFalse = { ...enabledOrder, seguimientoDeliveryHabilitado: false }
    expect(authorizeRealtimeOrder({ userId: "cliente-a", userType: "cliente" }, snapshotFalse, ["tracking:watch"])).toEqual({
      ok: false,
      code: "TRACKING_DISABLED",
    })
    expect(authorizeRealtimeOrder({ userId: "repartidor-a", userType: "repartidor" }, snapshotFalse, ["tracking:publish"])).toEqual({
      ok: false,
      code: "TRACKING_DISABLED",
    })
  })

  test("allows only the assigned associated Repartidor to publish location", () => {
    expect(authorizeRealtimeOrder({ userId: "repartidor-a", userType: "repartidor" }, enabledOrder, ["tracking:publish"])).toEqual({
      ok: true,
      scopes: ["tracking:publish"],
    })
    expect(authorizeRealtimeOrder({ userId: "repartidor-b", userType: "repartidor" }, enabledOrder, ["tracking:publish"])).toEqual({
      ok: false,
      code: "ROOM_FORBIDDEN",
    })
  })

  test("does not grant tracking to Negocio or chat to Repartidor", () => {
    expect(authorizeRealtimeOrder({ userId: "negocio-a", userType: "negocio" }, enabledOrder, ["tracking:watch"])).toEqual({
      ok: false,
      code: "ROOM_FORBIDDEN",
    })
    expect(authorizeRealtimeOrder({ userId: "repartidor-a", userType: "repartidor" }, enabledOrder, ["chat:read"])).toEqual({
      ok: false,
      code: "ROOM_FORBIDDEN",
    })
  })
})

describe("P2T01-22 — isTrackingCoreEligible: truth table, each condition independently false", () => {
  const trueOrder = { estado: "en_camino", metodoEntrega: "domicilio", seguimientoDeliveryHabilitado: true }
  const trueNegocio = { seguimientoDeliveryActivo: true }

  test("all four conditions true — eligible", () => {
    expect(isTrackingCoreEligible(trueOrder, trueNegocio)).toBe(true)
  })

  test("estado not en_camino — ineligible", () => {
    expect(isTrackingCoreEligible({ ...trueOrder, estado: "listo_para_retirar" }, trueNegocio)).toBe(false)
  })

  test("metodoEntrega not domicilio — ineligible", () => {
    expect(isTrackingCoreEligible({ ...trueOrder, metodoEntrega: "retiro" }, trueNegocio)).toBe(false)
  })

  test("pedido snapshot (seguimientoDeliveryHabilitado) false — ineligible even if negocio is currently active", () => {
    expect(isTrackingCoreEligible({ ...trueOrder, seguimientoDeliveryHabilitado: false }, trueNegocio)).toBe(false)
  })

  test("negocio live flag false — ineligible even if the pedido snapshot is true", () => {
    expect(isTrackingCoreEligible(trueOrder, { seguimientoDeliveryActivo: false })).toBe(false)
  })

  test("pure function: no actor identity parameter exists in its signature", () => {
    expect(isTrackingCoreEligible.length).toBe(2)
  })
})
