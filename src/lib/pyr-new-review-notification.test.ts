// P2-T44-R1P2 (gap G4): notifyPyrNewReview — mismo estilo de wiring test
// que pyr-new-order-notification.test.ts. Cubre resolución de destinatarios,
// payload exacto, y el dedupe cross-owner con el envío existente a Negocio.
import { beforeEach, describe, expect, mock, test } from "bun:test"

type EmpleadoRow = { id: string; cuentaOperativaId: string | null; pushSubscription: string | null }
type NormalizedRow = { endpoint: string; p256dh: string; auth: string; expirationTime: Date | null }

let empleados: EmpleadoRow[]
let negocioSlug: string | null
let notificacionRows: Array<{ userId: string; tipo: string; pedidoId: string | null; negocioId: string | null }>
let accountLevelRowsByAccountId: Map<string, NormalizedRow[]>
let webpushCallLog: string[]

mock.module("@/lib/db", () => ({
  db: {
    empleado: { findMany: async () => empleados },
    negocio: { findUnique: async () => (negocioSlug === null ? null : { slug: negocioSlug }) },
    notificacion: {
      create: async ({ data }: { data: { userId: string; tipo: string; pedidoId: string | null; negocioId: string | null } }) => {
        notificacionRows.push({ userId: data.userId, tipo: data.tipo, pedidoId: data.pedidoId, negocioId: data.negocioId })
        return { id: `n-${notificacionRows.length}` }
      },
    },
    pushSubscription: {
      findMany: async ({ where }: { where: { ownerType: string; ownerId: { in: string[] }; channel: string } }) => {
        const ids = where.ownerId.in
        if (where.ownerType === "cuenta_operativa") {
          return ids.flatMap((id) =>
            (accountLevelRowsByAccountId.get(id) ?? []).map((row) => ({ ...row, ownerType: "cuenta_operativa", ownerId: id, channel: "default" }))
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
      webpushCallLog.push(subscription.endpoint)
      if (!subscription.endpoint.startsWith("https://push.example/")) {
        throw new Error("simulated network failure")
      }
      return { statusCode: 201 }
    },
  },
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { notifyPyrNewReview } = await import("./pyr-new-review-notification")

function baseParams(resenaId: string) {
  return {
    resenaId,
    negocioId: "negocio-1",
    pedidoId: "pedido-1",
    puntuacion: 5,
    clienteNombre: "Cliente",
  }
}

beforeEach(() => {
  empleados = [{ id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: null }]
  negocioSlug = "mi-negocio"
  notificacionRows = []
  accountLevelRowsByAccountId = new Map()
  webpushCallLog = []
})

describe("notifyPyrNewReview", () => {
  test("sin empleados PyR -> ningún Push, ninguna Notificacion (Negocio no se toca por esta función)", async () => {
    empleados = []
    const result = await notifyPyrNewReview(baseParams("resena-1"))
    expect(result.attemptedEndpoints).toEqual([])
    expect(notificacionRows.length).toBe(0)
  })

  test("con destinatario -> persiste Notificacion tipo operaciones_pyr_new_review y envía Push", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1", p256dh: "p", auth: "a", expirationTime: null }])
    await notifyPyrNewReview(baseParams("resena-2"))
    expect(notificacionRows).toEqual([
      { userId: "empleado-1", tipo: "operaciones_pyr_new_review", pedidoId: "pedido-1", negocioId: "negocio-1" },
    ])
    expect(webpushCallLog).toEqual(["https://push.example/cuenta-1"])
  })

  test("Negocio y PyR comparten el mismo endpoint -> PyR no reenvía físicamente, fila lógica se preserva", async () => {
    const sharedEndpoint = "https://push.example/shared"
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: sharedEndpoint, p256dh: "p", auth: "a", expirationTime: null }])
    const reservedPushEndpoints = new Set<string>([sharedEndpoint])

    const result = await notifyPyrNewReview({ ...baseParams("resena-3"), reservedPushEndpoints })

    expect(webpushCallLog).toEqual([])
    expect(result.attemptedEndpoints).toEqual([])
    expect(notificacionRows.length).toBe(1)
  })

  test("Negocio y PyR con endpoints distintos -> ambos reciben Push", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/pyr-device", p256dh: "p", auth: "a", expirationTime: null }])
    const reservedPushEndpoints = new Set<string>(["https://push.example/negocio-device"])
    await notifyPyrNewReview({ ...baseParams("resena-4"), reservedPushEndpoints })
    expect(webpushCallLog).toEqual(["https://push.example/pyr-device"])
  })

  test("pedidoId ausente -> igual persiste la Notificacion (pedidoId null), no revienta", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1", p256dh: "p", auth: "a", expirationTime: null }])
    const params = baseParams("resena-5")
    // @ts-expect-error -- prueba deliberada de pedidoId ausente
    delete params.pedidoId
    await notifyPyrNewReview(params)
    expect(notificacionRows[0].pedidoId).toBeNull()
  })

  test("negocio inexistente -> no revienta", async () => {
    negocioSlug = null
    const result = await notifyPyrNewReview(baseParams("resena-6"))
    expect(result.attemptedEndpoints).toEqual([])
  })
})
