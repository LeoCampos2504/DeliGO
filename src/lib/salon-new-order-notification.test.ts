// P2-T05 Stage4: wiring test — verifies notifySalonNewOrderForOperations
// resolves EACH salon empleado's core multi-device targets through the REAL
// push.ts fan-out primitives (never a fake @/lib/push mock — see
// mesa-order-ready-notification.test.ts for why), merges/dedupes across the
// whole recipient wave, while persisting 1 Notificacion row PER recipient.
//
// P2-T44-R1I (reconciliation): see operations-cancellation-notification.test.ts
// for the full explanation of the staleness this fixes — the fixture never
// carried `cuentaOperativaId` (so resolveOperationalPushTargets saw
// accountIds=[] and returned zero targets outright) and the
// `pushSubscription.findMany` mock hardcoded `ownerType: "empleado"`
// regardless of what was actually queried, plus its query-count assertions
// assumed the old single-phase call pattern.
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

mock.module("@/lib/notification-deep-link", () => ({
  buildPedidoDeepLinkUrl: (base: string, pedidoId: string) => `${base}?pedidoId=${pedidoId}`,
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { notifySalonNewOrderForOperations } = await import("./salon-new-order-notification")

function legacySub(endpoint: string) {
  return JSON.stringify({ endpoint, keys: { p256dh: "p", auth: "a" }, expirationTime: null })
}

function orderParams(pedidoId: string) {
  return {
    pedidoId,
    negocioId: "negocio-1",
    slug: "mi-negocio",
    mesaNumero: 3,
    clienteNombre: "Cliente",
    total: 100,
  }
}

beforeEach(() => {
  // Dos empleados de salón de DOS cuentas operativas distintas.
  empleados = [
    { id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: legacySub("https://push.example/empleado-1-legacy") },
    { id: "empleado-2", cuentaOperativaId: "cuenta-2", pushSubscription: legacySub("https://push.example/empleado-2-legacy") },
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

describe("notifySalonNewOrderForOperations — real multi-recipient core fan-out", () => {
  test("SALON_LEGACY_FALLBACK_TEST: sin filas account-level -> ambos caen a legacy, 1 Notificacion PER recipient (never merged in-app)", async () => {
    await notifySalonNewOrderForOperations(orderParams("pedido-1"))

    expect(webpushCallLog.sort()).toEqual([
      "https://push.example/empleado-1-legacy",
      "https://push.example/empleado-2-legacy",
    ])
    expect(notificacionRows.length).toBe(2)
  })

  test("SALON_ACCOUNT_LEVEL_TEST: ambas cuentas tienen fila account-level -> CuentaOperativa recibe Push, la fase empleado nunca se consulta", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1-device", p256dh: "p1", auth: "a1", expirationTime: null }])
    accountLevelRowsByAccountId.set("cuenta-2", [{ endpoint: "https://push.example/cuenta-2-device", p256dh: "p2", auth: "a2", expirationTime: null }])

    await notifySalonNewOrderForOperations(orderParams("pedido-2"))

    expect(accountBatchCalls.length).toBe(1)
    expect(accountBatchCalls[0].where.ownerType).toBe("cuenta_operativa")
    expect(accountBatchCalls[0].where.channel).toBe("default")
    expect(accountBatchCalls[0].where.ownerId).toEqual({ in: ["cuenta-1", "cuenta-2"] })
    expect(employeeBatchCalls.length).toBe(0)
    expect(webpushCallLog.sort()).toEqual(["https://push.example/cuenta-1-device", "https://push.example/cuenta-2-device"])
    expect(notificacionRows.length).toBe(2)
  })

  test("SALON_NO_DOUBLE_FANOUT_TEST: una cuenta con account-level y otra sin ella -> resolución independiente, sin duplicar la que ya tiene account-level", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1-device", p256dh: "p1", auth: "a1", expirationTime: null }])
    // cuenta-2 sigue sin fila account-level -> cae a legacy (empleado-2).
    // El legacy de empleado-1 (cuenta-1) nunca debe usarse.

    await notifySalonNewOrderForOperations(orderParams("pedido-3"))

    expect(employeeBatchCalls.length).toBe(1)
    expect(employeeBatchCalls[0].where.ownerId).toEqual({ in: ["empleado-2"] })
    expect(webpushCallLog.sort()).toEqual(["https://push.example/cuenta-1-device", "https://push.example/empleado-2-legacy"])
    expect(webpushCallLog).not.toContain("https://push.example/empleado-1-legacy")
    expect(notificacionRows.length).toBe(2)
  })

  test("misma CuentaOperativa vinculada a múltiples relaciones (2 empleados de salón, mismos owner) -> no genera fan-out duplicado", async () => {
    // Mismo cuentaOperativaId para ambos empleados — la MISMA cuenta cubre
    // dos relaciones de salón (p.ej. dos sucursales) sin tener dos
    // subscriptions separadas.
    empleados = [
      { id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: null },
      { id: "empleado-2", cuentaOperativaId: "cuenta-1", pushSubscription: null },
    ]
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1-device", p256dh: "p1", auth: "a1", expirationTime: null }])

    await notifySalonNewOrderForOperations(orderParams("pedido-4"))

    expect(accountBatchCalls.length).toBe(1)
    expect(accountBatchCalls[0].where.ownerId).toEqual({ in: ["cuenta-1"] }) // una sola cuenta, deduplicada, no dos
    expect(webpushCallLog).toEqual(["https://push.example/cuenta-1-device"]) // un solo send físico
    expect(notificacionRows.length).toBe(2) // pero 1 Notificacion in-app por recipient, sin fusionar
  })

  test("resiliencia: falla la query account-level -> continúa vía fallback empleado sin abortar", async () => {
    accountQueryShouldThrow = true
    await notifySalonNewOrderForOperations(orderParams("pedido-5"))

    expect(accountBatchCalls.length).toBe(1)
    expect(employeeBatchCalls.length).toBe(1)
    expect(webpushCallLog.sort()).toEqual([
      "https://push.example/empleado-1-legacy",
      "https://push.example/empleado-2-legacy",
    ])
    expect(notificacionRows.length).toBe(2)
  })

  test("legacy malformado de un recipient no aborta al recipient sano", async () => {
    empleados[0].pushSubscription = "{not-json"
    await notifySalonNewOrderForOperations(orderParams("pedido-6"))
    expect(webpushCallLog).toEqual(["https://push.example/empleado-2-legacy"])
    expect(notificacionRows.length).toBe(2)
  })

  test("dos empleados de cuentas distintas compartiendo el MISMO endpoint físico legacy (shared display) -> exactamente 1 send físico, 2 filas Notificacion", async () => {
    const sharedRaw = legacySub("https://push.example/shared-display")
    empleados = [
      { id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: sharedRaw },
      { id: "empleado-2", cuentaOperativaId: "cuenta-2", pushSubscription: sharedRaw },
    ]
    await notifySalonNewOrderForOperations(orderParams("pedido-7"))
    expect(webpushCallLog).toEqual(["https://push.example/shared-display"]) // never doubled
    expect(notificacionRows.length).toBe(2)
  })

  test("no salon empleados -> no send calls, no Notificacion rows, ninguna query normalizada de ninguna fase", async () => {
    empleados = []
    const result = await notifySalonNewOrderForOperations(orderParams("pedido-8"))
    expect(result.attemptedEndpoints).toEqual([])
    expect(webpushCallLog.length).toBe(0)
    expect(notificacionRows.length).toBe(0)
    expect(accountBatchCalls.length).toBe(0)
    expect(employeeBatchCalls.length).toBe(0)
  })
})
