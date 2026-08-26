// P2-T05 Stage4: wiring test — verifies notifySalonNewOrderForOperations
// resolves EACH salon empleado's core multi-device targets through the REAL
// push.ts fan-out primitives (never a fake @/lib/push mock — see
// mesa-order-ready-notification.test.ts for why), merges/dedupes across the
// whole recipient wave, while persisting 1 Notificacion row PER recipient.
import { beforeEach, describe, expect, mock, test } from "bun:test"

type EmpleadoRow = { id: string; pushSubscription: string | null }

let empleados: EmpleadoRow[]
let notificacionRows: Array<{ userId: string }>
let normalizedByOwnerId: Map<string, Array<{ endpoint: string; p256dh: string; auth: string; expirationTime: Date | null }>>
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
    // mock de `pushSubscription`.
    pushSubscription: {
      findMany: async ({ where }: { where: { ownerId: string } }) => normalizedByOwnerId.get(where.ownerId) ?? [],
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

beforeEach(() => {
  empleados = [
    { id: "empleado-1", pushSubscription: JSON.stringify({ endpoint: "https://push.example/empleado-1-legacy", keys: { p256dh: "p", auth: "a" }, expirationTime: null }) },
    { id: "empleado-2", pushSubscription: JSON.stringify({ endpoint: "https://push.example/empleado-2-legacy", keys: { p256dh: "p", auth: "a" }, expirationTime: null }) },
  ]
  normalizedByOwnerId = new Map()
  notificacionRows = []
  webpushCallLog = []
})

describe("notifySalonNewOrderForOperations — real multi-recipient core fan-out", () => {
  test("sends to each recipient's own device, 1 Notificacion PER recipient (never merged in-app)", async () => {
    await notifySalonNewOrderForOperations({
      pedidoId: "pedido-1",
      negocioId: "negocio-1",
      slug: "mi-negocio",
      mesaNumero: 3,
      clienteNombre: "Cliente",
      total: 100,
    })

    expect(webpushCallLog.sort()).toEqual([
      "https://push.example/empleado-1-legacy",
      "https://push.example/empleado-2-legacy",
    ])
    expect(notificacionRows.length).toBe(2)
  })

  test("two empleados sharing the SAME physical legacy endpoint (shared display) -> exactly 1 physical send, still 2 Notificacion rows", async () => {
    const sharedRaw = JSON.stringify({ endpoint: "https://push.example/shared-display", keys: { p256dh: "p", auth: "a" }, expirationTime: null })
    empleados = [
      { id: "empleado-1", pushSubscription: sharedRaw },
      { id: "empleado-2", pushSubscription: sharedRaw },
    ]
    await notifySalonNewOrderForOperations({
      pedidoId: "pedido-2",
      negocioId: "negocio-1",
      slug: "mi-negocio",
      mesaNumero: 5,
      clienteNombre: "Cliente",
      total: 20,
    })
    expect(webpushCallLog).toEqual(["https://push.example/shared-display"]) // never doubled
    expect(notificacionRows.length).toBe(2)
  })

  test("no salon empleados -> no send calls, no Notificacion rows", async () => {
    empleados = []
    const result = await notifySalonNewOrderForOperations({
      pedidoId: "pedido-3",
      negocioId: "negocio-1",
      slug: "mi-negocio",
      mesaNumero: 1,
      clienteNombre: "Cliente",
      total: 50,
    })
    expect(result.attemptedEndpoints).toEqual([])
    expect(webpushCallLog.length).toBe(0)
    expect(notificacionRows.length).toBe(0)
  })
})
