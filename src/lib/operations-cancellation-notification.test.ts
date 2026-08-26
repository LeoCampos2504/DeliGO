// P2-T05 Stage4: wiring test — verifies notifyOperationsOrderCancelled
// resolves EACH recipient's core multi-device targets through the REAL
// push.ts fan-out primitives (never a fake @/lib/push mock — see
// mesa-order-ready-notification.test.ts for why), merges/dedupes across the
// whole recipient wave, and still honors `reservedPushEndpoints`.
import { beforeEach, describe, expect, mock, test } from "bun:test"

type EmpleadoRow = { id: string; pushSubscription: string | null }

let empleados: EmpleadoRow[]
let notificacionRows: Array<{ userId: string }>
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
    // mock de `pushSubscription` (sin filas normalizadas en este archivo:
    // sólo interesa el fan-out legacy + reservedPushEndpoints).
    pushSubscription: {
      findMany: async () => [],
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

beforeEach(() => {
  empleados = [
    { id: "empleado-1", pushSubscription: legacySub("https://push.example/empleado-1") },
    { id: "empleado-2", pushSubscription: legacySub("https://push.example/empleado-2") },
  ]
  notificacionRows = []
  webpushCallLog = []
})

describe("notifyOperationsOrderCancelled — real multi-recipient core fan-out", () => {
  test("sends to each recipient's device, 1 Notificacion per recipient", async () => {
    await notifyOperationsOrderCancelled({
      pedidoId: "pedido-1",
      negocioId: "negocio-1",
      metodoEntrega: "mesa",
      canceladoPor: "cliente",
      mesaNumero: 4,
    })

    expect(webpushCallLog.sort()).toEqual(["https://push.example/empleado-1", "https://push.example/empleado-2"])
    expect(notificacionRows.length).toBe(2)
  })

  test("reservedPushEndpoints filters out an endpoint already covered by another channel of the SAME logical event", async () => {
    const reserved = new Set<string>(["https://push.example/empleado-1"])
    await notifyOperationsOrderCancelled({
      pedidoId: "pedido-2",
      negocioId: "negocio-1",
      metodoEntrega: "mesa",
      canceladoPor: "cliente",
      mesaNumero: 4,
      reservedPushEndpoints: reserved,
    })

    // empleado-1's endpoint was already reserved -> filtered out of the send,
    // but its Notificacion row is still created (in-app notification is
    // independent of push delivery/dedup).
    expect(notificacionRows.length).toBe(2)
    expect(webpushCallLog).toEqual(["https://push.example/empleado-2"])
  })
})
