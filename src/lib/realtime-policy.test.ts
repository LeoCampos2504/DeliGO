import { describe, expect, test } from "bun:test"
import { authorizeRealtimeOrder, normalizeRequestedScopes, type RealtimeOrderSnapshot } from "@/lib/realtime-policy"

const enabledOrder: RealtimeOrderSnapshot = {
  id: "pedido-a",
  clienteId: "cliente-a",
  negocioId: "negocio-a",
  repartidorId: "repartidor-a",
  estado: "en_camino",
  metodoEntrega: "domicilio",
  seguimientoDeliveryActivo: true,
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
