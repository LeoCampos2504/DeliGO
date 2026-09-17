// P2-T44-R1P2 (gap G5): notifyPyrChatMessage — mismo estilo de wiring test
// que los otros 2 productores PyR nuevos. Este productor NUNCA decide si
// notifica según remitente (eso lo filtra el call-site real,
// src/app/api/chat/mensajes/[pedidoId]/route.ts, antes de invocarlo) — acá
// se testea únicamente la resolución de destinatarios, el payload y el
// dedupe cross-owner.
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

const { notifyPyrChatMessage } = await import("./pyr-chat-notification")

function baseParams(pedidoId: string) {
  return {
    pedidoId,
    negocioId: "negocio-1",
    senderName: "Cliente",
    messagePreview: "Hola, ¿cuánto falta?",
  }
}

beforeEach(() => {
  empleados = [{ id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: null }]
  negocioSlug = "mi-negocio"
  notificacionRows = []
  accountLevelRowsByAccountId = new Map()
  webpushCallLog = []
})

describe("notifyPyrChatMessage", () => {
  test("sin empleados PyR -> ningún Push, ninguna Notificacion", async () => {
    empleados = []
    const result = await notifyPyrChatMessage(baseParams("pedido-1"))
    expect(result.attemptedEndpoints).toEqual([])
    expect(notificacionRows.length).toBe(0)
  })

  test("con destinatario -> persiste Notificacion tipo operaciones_pyr_chat y envía Push", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1", p256dh: "p", auth: "a", expirationTime: null }])
    await notifyPyrChatMessage(baseParams("pedido-2"))
    expect(notificacionRows).toEqual([
      { userId: "empleado-1", tipo: "operaciones_pyr_chat", pedidoId: "pedido-2", negocioId: "negocio-1" },
    ])
    expect(webpushCallLog).toEqual(["https://push.example/cuenta-1"])
  })

  test("Negocio y PyR comparten el mismo endpoint -> PyR no reenvía físicamente, fila lógica se preserva", async () => {
    const sharedEndpoint = "https://push.example/shared"
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: sharedEndpoint, p256dh: "p", auth: "a", expirationTime: null }])
    const reservedPushEndpoints = new Set<string>([sharedEndpoint])

    const result = await notifyPyrChatMessage({ ...baseParams("pedido-3"), reservedPushEndpoints })

    expect(webpushCallLog).toEqual([])
    expect(result.attemptedEndpoints).toEqual([])
    expect(notificacionRows.length).toBe(1)
  })

  test("Negocio y PyR con endpoints distintos -> ambos reciben Push", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/pyr-device", p256dh: "p", auth: "a", expirationTime: null }])
    const reservedPushEndpoints = new Set<string>(["https://push.example/negocio-device"])
    await notifyPyrChatMessage({ ...baseParams("pedido-4"), reservedPushEndpoints })
    expect(webpushCallLog).toEqual(["https://push.example/pyr-device"])
  })

  test("múltiples cuentas PyR con endpoints distintos -> cada una recibe su propio Push, 2 filas lógicas", async () => {
    empleados = [
      { id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: null },
      { id: "empleado-2", cuentaOperativaId: "cuenta-2", pushSubscription: null },
    ]
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1", p256dh: "p", auth: "a", expirationTime: null }])
    accountLevelRowsByAccountId.set("cuenta-2", [{ endpoint: "https://push.example/cuenta-2", p256dh: "p", auth: "a", expirationTime: null }])
    await notifyPyrChatMessage(baseParams("pedido-5"))
    expect(webpushCallLog.sort()).toEqual(["https://push.example/cuenta-1", "https://push.example/cuenta-2"])
    expect(notificacionRows.length).toBe(2)
  })

  test("negocio inexistente -> no revienta", async () => {
    negocioSlug = null
    const result = await notifyPyrChatMessage(baseParams("pedido-6"))
    expect(result.attemptedEndpoints).toEqual([])
  })
})
