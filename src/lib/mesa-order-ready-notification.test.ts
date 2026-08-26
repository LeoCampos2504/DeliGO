// P2-T05 Stage4: wiring test — verifies notifyMesaOrderReadyForMozo resolves
// the mozo's CORE multi-device targets (normalized UNION legacy) through
// the REAL push.ts fan-out primitives (never a fake @/lib/push mock — that
// would collide with push.test.ts's own mock.module("@/lib/push", ...),
// since `./push` and `@/lib/push` resolve to the same module process-wide).
// Only @/lib/db, @/lib/push-subscription-repository and web-push are mocked.
import { beforeEach, describe, expect, mock, test } from "bun:test"

type EmpleadoLegacyRow = { id: string; pushSubscription: string | null; areaOperativa: string; activo: boolean; eliminado: boolean; negocioId: string }

let empleadoRow: EmpleadoLegacyRow | null
let notificacionRows: Array<{ userId: string; userType: string; tipo: string; pedidoId: string | null }>
let normalizedRows: Array<{ endpoint: string; p256dh: string; auth: string; expirationTime: Date | null }>
let webpushCallLog: string[]
let webpushBehavior: Map<string, "success" | 404 | 410>

mock.module("@/lib/db", () => ({
  db: {
    empleado: {
      findFirst: async () => (empleadoRow ? { id: empleadoRow.id, pushSubscription: empleadoRow.pushSubscription } : null),
      updateMany: async () => ({ count: 0 }),
    },
    mesa: {
      findFirst: async ({ select }: { select: Record<string, unknown> }) => {
        if ("numero" in select) return { numero: 7 }
        return empleadoRow ? { empleado: { ...empleadoRow } } : null
      },
    },
    notificacion: {
      findFirst: async ({ where }: { where: { userId: string; pedidoId: string } }) =>
        notificacionRows.find((n) => n.userId === where.userId && n.pedidoId === where.pedidoId) ?? null,
      create: async ({ data }: { data: { userId: string; userType: string; tipo: string; pedidoId: string | null } }) => {
        notificacionRows.push(data)
        return { id: `n-${notificacionRows.length}` }
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        notificacion: {
          findFirst: async ({ where }: { where: { userId: string; pedidoId: string } }) =>
            notificacionRows.find((n) => n.userId === where.userId && n.pedidoId === where.pedidoId) ?? null,
          create: async ({ data }: { data: { userId: string; userType: string; tipo: string; pedidoId: string | null } }) => {
            notificacionRows.push(data)
            return { id: `n-${notificacionRows.length}` }
          },
        },
      }),
    // P2-T05 Stage4: no se mockea `@/lib/push-subscription-repository` como
    // módulo completo (rompería a otros archivos de test que necesitan sus
    // demás exports reales) — se deja correr el repository REAL contra este
    // mock de `pushSubscription`.
    pushSubscription: {
      findMany: async () => normalizedRows,
      deleteMany: async () => ({ count: 1 }),
    },
  },
}))

mock.module("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }),
    sendNotification: async (subscription: { endpoint: string }) => {
      // Ver comentario equivalente en push.test.ts: sólo se controla el
      // resultado para endpoints del fixture `https://push.example/...` de
      // este archivo; cualquier otro endpoint (otros archivos de la misma
      // suite `bun test`) falla por defecto, nunca succeeds silenciosamente.
      webpushCallLog.push(subscription.endpoint)
      if (!subscription.endpoint.startsWith("https://push.example/")) {
        throw new Error("simulated network failure (unrecognized endpoint outside this test's fixture domain)")
      }
      const behavior = webpushBehavior.get(subscription.endpoint) ?? "success"
      if (behavior === "success") return { statusCode: 201 }
      const err = new Error(`simulated ${behavior}`) as Error & { statusCode: number }
      err.statusCode = behavior
      throw err
    },
  },
}))

mock.module("@/lib/notification-deep-link", () => ({
  buildPedidoDeepLinkUrl: (base: string, pedidoId: string) => `${base}?pedidoId=${pedidoId}`,
}))

const { notifyMesaOrderReadyForMozo } = await import("./mesa-order-ready-notification")

beforeEach(() => {
  empleadoRow = {
    id: "empleado-1",
    pushSubscription: JSON.stringify({ endpoint: "https://push.example/legacy-device", keys: { p256dh: "p", auth: "a" }, expirationTime: null }),
    areaOperativa: "mozo",
    activo: true,
    eliminado: false,
    negocioId: "negocio-1",
  }
  normalizedRows = [{ endpoint: "https://push.example/second-device", p256dh: "p2", auth: "a2", expirationTime: null }]
  notificacionRows = []
  webpushCallLog = []
  webpushBehavior = new Map()
})

describe("notifyMesaOrderReadyForMozo — real core multi-device fan-out", () => {
  test("sends to BOTH the legacy device AND the normalized-only device, with exactly 1 Notificacion row", async () => {
    await notifyMesaOrderReadyForMozo({
      pedido: {
        id: "pedido-1",
        negocioId: "negocio-1",
        negocioSlug: "mi-negocio",
        metodoEntrega: "mesa",
        mesaId: "mesa-1",
        mesaNumero: 7,
        empleadoId: "empleado-1",
      },
      estadoAnterior: "preparando",
    })

    expect(webpushCallLog.sort()).toEqual(["https://push.example/legacy-device", "https://push.example/second-device"])
    expect(notificacionRows.length).toBe(1) // 1 logical notification regardless of device count
  })

  test("mozo with no push subscription at all -> no send attempted, Notificacion still persisted", async () => {
    empleadoRow!.pushSubscription = null
    normalizedRows = []
    await notifyMesaOrderReadyForMozo({
      pedido: {
        id: "pedido-2",
        negocioId: "negocio-1",
        negocioSlug: "mi-negocio",
        metodoEntrega: "mesa",
        mesaId: "mesa-1",
        mesaNumero: 7,
        empleadoId: "empleado-1",
      },
      estadoAnterior: "preparando",
    })
    expect(webpushCallLog.length).toBe(0)
    expect(notificacionRows.length).toBe(1)
  })
})
