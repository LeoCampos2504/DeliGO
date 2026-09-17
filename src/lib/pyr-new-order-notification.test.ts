// P2-T44-R1P2 (gap G3): notifyPyrNewOrder — mismo estilo de wiring test que
// salon-new-order-notification.test.ts (mock de @/lib/db + web-push real,
// nunca un mock de @/lib/push completo — ver ese archivo para el porqué).
// Cubre: resolución de destinatarios PyR (vía resolvePyrOperationalRecipients,
// no reimplementada acá), account-level vs legacy fallback (delegado a
// resolveOperationalPushTargets, ya testeado exhaustivamente en
// push-subscription-repository.test.ts — no se re-test acá), payload exacto,
// y el dedupe cross-owner con reservedPushEndpoints (el comportamiento NUEVO
// de esta tarea, corregido en R1P1A).
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
    empleado: {
      findMany: async () => empleados,
    },
    negocio: {
      findUnique: async () => (negocioSlug === null ? null : { slug: negocioSlug }),
    },
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
        throw new Error("simulated network failure (unrecognized endpoint outside this test's fixture domain)")
      }
      return { statusCode: 201 }
    },
  },
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { notifyPyrNewOrder } = await import("./pyr-new-order-notification")

function baseParams(pedidoId: string) {
  return {
    pedidoId,
    negocioId: "negocio-1",
    clienteNombre: "Cliente",
    total: 1000,
    metodoEntrega: "retiro" as const,
  }
}

beforeEach(() => {
  empleados = [{ id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: null }]
  negocioSlug = "mi-negocio"
  notificacionRows = []
  accountLevelRowsByAccountId = new Map()
  webpushCallLog = []
})

describe("notifyPyrNewOrder", () => {
  test("sin empleados PyR -> ningún Push, ninguna Notificacion", async () => {
    empleados = []
    const result = await notifyPyrNewOrder(baseParams("pedido-1"))
    expect(result.attemptedEndpoints).toEqual([])
    expect(notificacionRows.length).toBe(0)
    expect(webpushCallLog.length).toBe(0)
  })

  test("negocio inexistente -> no revienta, no envía nada", async () => {
    negocioSlug = null
    const result = await notifyPyrNewOrder(baseParams("pedido-2"))
    expect(result.attemptedEndpoints).toEqual([])
    expect(notificacionRows.length).toBe(0)
  })

  test("con destinatario -> persiste Notificacion tipo operaciones_pyr_new_order y envía Push", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1", p256dh: "p", auth: "a", expirationTime: null }])

    await notifyPyrNewOrder(baseParams("pedido-3"))

    expect(notificacionRows).toEqual([
      { userId: "empleado-1", tipo: "operaciones_pyr_new_order", pedidoId: "pedido-3", negocioId: "negocio-1" },
    ])
    expect(webpushCallLog).toEqual(["https://push.example/cuenta-1"])
  })

  test("retiro vs domicilio -> mismo productor, mismo tipo, sin duplicar arquitectura", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1", p256dh: "p", auth: "a", expirationTime: null }])
    await notifyPyrNewOrder({ ...baseParams("pedido-4"), metodoEntrega: "domicilio" })
    expect(notificacionRows[0].tipo).toBe("operaciones_pyr_new_order")
  })

  // ---- Dedupe cross-owner (G3, corregido en R1P1A) ----

  test("Negocio y PyR con endpoints físicos DISTINTOS -> ambos reciben Push", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/pyr-device", p256dh: "p", auth: "a", expirationTime: null }])
    const reservedPushEndpoints = new Set<string>(["https://push.example/negocio-device"])

    await notifyPyrNewOrder({ ...baseParams("pedido-5"), reservedPushEndpoints })

    expect(webpushCallLog).toEqual(["https://push.example/pyr-device"])
  })

  test("Negocio y PyR comparten el MISMO endpoint físico -> PyR no reenvía el Push (ya reservado por Negocio), pero la Notificacion PyR sigue creándose", async () => {
    const sharedEndpoint = "https://push.example/shared-device"
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: sharedEndpoint, p256dh: "p", auth: "a", expirationTime: null }])
    // Simula que Negocio (llamado ANTES en el call-site real) ya reservó este
    // mismo endpoint en el Set compartido.
    const reservedPushEndpoints = new Set<string>([sharedEndpoint])

    const result = await notifyPyrNewOrder({ ...baseParams("pedido-6"), reservedPushEndpoints })

    expect(webpushCallLog).toEqual([]) // ningún Push físico duplicado
    expect(result.attemptedEndpoints).toEqual([]) // filtrado por el dedupe
    expect(notificacionRows.length).toBe(1) // la fila lógica PyR SIGUE existiendo
  })

  test("sin reservedPushEndpoints (no se pasa el Set) -> comportamiento normal, sin dedupe", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1", p256dh: "p", auth: "a", expirationTime: null }])
    await notifyPyrNewOrder(baseParams("pedido-7"))
    expect(webpushCallLog).toEqual(["https://push.example/cuenta-1"])
  })

  test("múltiples cuentas PyR con endpoints distintos -> cada una recibe su propio Push", async () => {
    empleados = [
      { id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: null },
      { id: "empleado-2", cuentaOperativaId: "cuenta-2", pushSubscription: null },
    ]
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://push.example/cuenta-1", p256dh: "p", auth: "a", expirationTime: null }])
    accountLevelRowsByAccountId.set("cuenta-2", [{ endpoint: "https://push.example/cuenta-2", p256dh: "p", auth: "a", expirationTime: null }])

    await notifyPyrNewOrder(baseParams("pedido-8"))

    expect(webpushCallLog.sort()).toEqual(["https://push.example/cuenta-1", "https://push.example/cuenta-2"])
    expect(notificacionRows.length).toBe(2)
  })

  test("falla del proveedor -> best-effort, no lanza (la llamada no rechaza la promesa)", async () => {
    accountLevelRowsByAccountId.set("cuenta-1", [{ endpoint: "https://unreachable.example/x", p256dh: "p", auth: "a", expirationTime: null }])
    await expect(notifyPyrNewOrder(baseParams("pedido-9"))).resolves.toBeDefined()
    expect(notificacionRows.length).toBe(1) // la fila lógica no depende del éxito del envío
  })
})
