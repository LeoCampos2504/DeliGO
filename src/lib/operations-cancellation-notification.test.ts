// P2-T05 Stage4: wiring test — verifies notifyOperationsOrderCancelled
// resolves EACH recipient's core multi-device targets through the REAL
// push.ts fan-out primitives (never a fake @/lib/push mock — see
// mesa-order-ready-notification.test.ts for why), merges/dedupes across the
// whole recipient wave, and still honors `reservedPushEndpoints`.
//
// P2-T44-R1I (reconciliation): this file predates R1D's account-level
// two-phase resolution. Its `EmpleadoRow` fixture never carried
// `cuentaOperativaId` (so resolveOperationalPushTargets saw accountIds=[]
// and returned zero targets for every recipient — a total, not partial,
// break), and its `pushSubscription.findMany` mock hardcoded
// `ownerType: "empleado"` on every row regardless of which ownerType was
// actually queried, plus its query-count assertions ("exactly one batch
// query") assumed the OLD single-phase call pattern. The mock below is
// `where.ownerType`-aware across BOTH phases (cuenta_operativa first,
// empleado fallback only for accounts with zero account-level rows) and
// the assertions below test the real two-phase contract instead.
import { beforeEach, describe, expect, mock, test } from "bun:test"

type EmpleadoRow = { id: string; cuentaOperativaId: string | null; pushSubscription: string | null }
type NormalizedRow = { endpoint: string; p256dh: string; auth: string; expirationTime: Date | null }

let empleados: EmpleadoRow[]
let notificacionRows: Array<{ userId: string }>
let accountLevelRowsByAccountId: Map<string, NormalizedRow[]>
let employeeNormalizedRowsByEmployeeId: Map<string, NormalizedRow[]>
let accountBatchCalls: Array<{ where: Record<string, unknown> }>
let employeeBatchCalls: Array<{ where: Record<string, unknown> }>
let accountQueryShouldThrow: boolean
let employeeQueryShouldThrow: boolean
let webpushCallLog: string[]

mock.module("@/lib/db", () => ({
  db: {
    negocio: {
      findUnique: async () => ({ slug: "mi-negocio" }),
    },
    empleado: {
      findMany: async () => empleados,
    },
    notificacion: {
      create: async ({ data }: { data: { userId: string } }) => {
        notificacionRows.push({ userId: data.userId })
        return { id: `n-${notificacionRows.length}` }
      },
    },
    // P2-T05 Stage4: no se mockea `@/lib/push-subscription-repository` como
    // módulo completo (rompería a otros archivos de test que necesitan sus
    // demás exports reales) — se deja correr el repository REAL contra este
    // mock de `pushSubscription`, congruente con `where.ownerType` en AMBAS
    // fases (cuenta_operativa primero, empleado como fallback acotado).
    pushSubscription: {
      findMany: async ({ where }: { where: { ownerType: string; ownerId: { in: string[] }; channel: string } }) => {
        const ids = where.ownerId.in
        if (where.ownerType === "cuenta_operativa") {
          accountBatchCalls.push({ where })
          if (accountQueryShouldThrow) throw new Error("simulated account-level batch query failure")
          return ids.flatMap((id) =>
            (accountLevelRowsByAccountId.get(id) ?? []).map((row) => ({ ...row, ownerType: "cuenta_operativa", ownerId: id, channel: "default" }))
          )
        }
        if (where.ownerType === "empleado") {
          employeeBatchCalls.push({ where })
          if (employeeQueryShouldThrow) throw new Error("simulated employee fallback batch query failure")
          return ids.flatMap((id) =>
            (employeeNormalizedRowsByEmployeeId.get(id) ?? []).map((row) => ({ ...row, ownerType: "empleado", ownerId: id, channel: "default" }))
          )
        }
        return []
      },
      deleteMany: async () => ({ count: 1 }),
    },
  },
}))

mock.module("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }),
    sendNotification: async (subscription: { endpoint: string }) => {
      // Sólo se responde success para endpoints del fixture de este archivo
      // (`https://push.example/...`) — cualquier otro endpoint (otros
      // archivos de la misma suite `bun test`) falla por defecto.
      webpushCallLog.push(subscription.endpoint)
      if (!subscription.endpoint.startsWith("https://push.example/")) {
        throw new Error("simulated network failure (unrecognized endpoint outside this test's fixture domain)")
      }
      return { statusCode: 201 }
    },
  },
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { notifyOperationsOrderCancelled } = await import("./operations-cancellation-notification")

function legacySub(endpoint: string) {
  return JSON.stringify({ endpoint, keys: { p256dh: "p", auth: "a" }, expirationTime: null })
}

function cancelParams(pedidoId: string, extra: Record<string, unknown> = {}) {
  return {
    pedidoId,
    negocioId: "negocio-1",
    metodoEntrega: "mesa",
    canceladoPor: "cliente",
    mesaNumero: 4,
    ...extra,
  }
}

beforeEach(() => {
  // Dos empleados de DOS cuentas operativas distintas — mismo escenario que
  // "cada mozo/pyr/salón puede pertenecer a una CuentaOperativa diferente"
  // que la notificación de cancelación siempre tuvo que resolver por
  // recipient, ahora con el owner real (account-level primero) expuesto.
  empleados = [
    { id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: legacySub("https://push.example/empleado-1") },
    { id: "empleado-2", cuentaOperativaId: "cuenta-2", pushSubscription: legacySub("https://push.example/empleado-2") },
  ]
  accountLevelRowsByAccountId = new Map()
  employeeNormalizedRowsByEmployeeId = new Map()
  accountBatchCalls = []
  employeeBatchCalls = []
  accountQueryShouldThrow = false
  employeeQueryShouldThrow = false
  notificacionRows = []
  webpushCallLog = []
})

describe("notifyOperationsOrderCancelled — real multi-recipient core fan-out", () => {
  test("PYR_LEGACY_FALLBACK_TEST: ninguna cuenta tiene fila account-level -> ambas caen a legacy, 1 Notificacion por recipient", async () => {
    await notifyOperationsOrderCancelled(cancelParams("pedido-1"))

    expect(accountBatchCalls.length).toBe(1) // se intenta la fase account-level para ambas cuentas
    expect(employeeBatchCalls.length).toBe(1) // ambas cuentas la necesitan -> UNA sola query batch de fallback, no N
    expect(webpushCallLog.sort()).toEqual(["https://push.example/empleado-1", "https://push.example/empleado-2"])
    expect(notificacionRows.length).toBe(2)
  })

  test("PYR_ACCOUNT_LEVEL_TEST: ambas cuentas tienen fila account-level -> Push va a cuenta_operativa, la fase empleado NUNCA se consulta", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1-device", p256dh: "p1", auth: "a1", expirationTime: null }])
    accountLevelRowsByAccountId.set("cuenta-2", [{ endpoint: "https://push.example/cuenta-2-device", p256dh: "p2", auth: "a2", expirationTime: null }])

    await notifyOperationsOrderCancelled(cancelParams("pedido-2"))

    expect(accountBatchCalls.length).toBe(1)
    expect(accountBatchCalls[0].where.ownerType).toBe("cuenta_operativa")
    expect(accountBatchCalls[0].where.ownerId).toEqual({ in: ["cuenta-1", "cuenta-2"] })
    expect(employeeBatchCalls.length).toBe(0) // ninguna cuenta necesita fallback -> cero queries de empleado
    expect(webpushCallLog.sort()).toEqual(["https://push.example/cuenta-1-device", "https://push.example/cuenta-2-device"])
    expect(notificacionRows.length).toBe(2)
  })

  test("PYR_NO_DOUBLE_FANOUT_TEST: una cuenta con account-level Y otra sin ella -> cada una se resuelve de forma independiente, sin duplicar la que ya tiene account-level", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1-device", p256dh: "p1", auth: "a1", expirationTime: null }])
    // cuenta-2 NO tiene fila account-level -> debe caer a legacy (empleado-2 ya trae legacy en el fixture).
    // empleado-1 TODAVÍA tiene su legacy poblado (dispositivo viejo) — nunca debe usarse porque cuenta-1 ya tiene account-level.

    await notifyOperationsOrderCancelled(cancelParams("pedido-3"))

    expect(employeeBatchCalls.length).toBe(1)
    expect(employeeBatchCalls[0].where.ownerId).toEqual({ in: ["empleado-2"] }) // sólo la cuenta que SÍ necesita fallback (cuenta-2, vía empleado-2) entra a esta query
    expect(webpushCallLog.sort()).toEqual(["https://push.example/cuenta-1-device", "https://push.example/empleado-2"])
    expect(webpushCallLog).not.toContain("https://push.example/empleado-1") // el legacy de empleado-1 nunca se usa
    expect(notificacionRows.length).toBe(2)
  })

  test("dedupe: dos dispositivos de la MISMA cuenta account-level reciben Push, sin duplicar Notificacion", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [
      { endpoint: "https://push.example/cuenta-1-device-a", p256dh: "pa", auth: "aa", expirationTime: null },
      { endpoint: "https://push.example/cuenta-1-device-b", p256dh: "pb", auth: "ab", expirationTime: null },
    ])
    accountLevelRowsByAccountId.set("cuenta-2", [{ endpoint: "https://push.example/cuenta-2-device", p256dh: "p2", auth: "a2", expirationTime: null }])

    await notifyOperationsOrderCancelled(cancelParams("pedido-4"))

    expect(webpushCallLog.sort()).toEqual([
      "https://push.example/cuenta-1-device-a",
      "https://push.example/cuenta-1-device-b",
      "https://push.example/cuenta-2-device",
    ])
    expect(notificacionRows.length).toBe(2) // 1 Notificacion por recipient, no por dispositivo
  })

  test("resiliencia: falla la query account-level -> continúa vía fallback empleado para todos, sin abortar", async () => {
    accountQueryShouldThrow = true
    await notifyOperationsOrderCancelled(cancelParams("pedido-5"))

    expect(accountBatchCalls.length).toBe(1)
    expect(employeeBatchCalls.length).toBe(1) // el catch interno deja accountRows vacío -> todas las cuentas caen a fallback
    expect(webpushCallLog.sort()).toEqual(["https://push.example/empleado-1", "https://push.example/empleado-2"])
    expect(notificacionRows.length).toBe(2)
  })

  test("resiliencia: falla la query de fallback empleado -> continúa legacy-only (string) sin abortar al recipient sano", async () => {
    employeeQueryShouldThrow = true
    await notifyOperationsOrderCancelled(cancelParams("pedido-6"))

    expect(employeeBatchCalls.length).toBe(1)
    // Sin filas normalizadas de empleado (por el throw), cada recipient
    // igual recibe su legacy string — el throw nunca bloquea el envío.
    expect(webpushCallLog.sort()).toEqual(["https://push.example/empleado-1", "https://push.example/empleado-2"])
    expect(notificacionRows.length).toBe(2)
  })

  test("legacy malformado de un recipient no aborta al recipient sano", async () => {
    empleados[0].pushSubscription = "{not-json"
    await notifyOperationsOrderCancelled(cancelParams("pedido-7"))
    expect(webpushCallLog).toEqual(["https://push.example/empleado-2"])
    expect(notificacionRows.length).toBe(2)
  })

  test("reservedPushEndpoints filtra un endpoint ya cubierto por otro canal del MISMO evento lógico", async () => {
    const reserved = new Set<string>(["https://push.example/empleado-1"])
    await notifyOperationsOrderCancelled(cancelParams("pedido-8", { reservedPushEndpoints: reserved }))

    // El endpoint de empleado-1 ya estaba reservado -> se filtra del envío,
    // pero su Notificacion in-app se crea igual (independiente del push).
    expect(notificacionRows.length).toBe(2)
    expect(webpushCallLog).toEqual(["https://push.example/empleado-2"])
  })

  test("sin recipients no dispara ninguna query normalizada de ninguna fase", async () => {
    empleados = []
    await notifyOperationsOrderCancelled(cancelParams("pedido-9"))
    expect(accountBatchCalls.length).toBe(0)
    expect(employeeBatchCalls.length).toBe(0)
    expect(notificacionRows.length).toBe(0)
    expect(webpushCallLog.length).toBe(0)
  })
})
