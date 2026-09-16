// P2-T05 Stage4: wiring test — verifies notifyMesaOrderReadyForMozo resolves
// the mozo's CORE multi-device targets (normalized UNION legacy) through
// the REAL push.ts fan-out primitives (never a fake @/lib/push mock — that
// would collide with push.test.ts's own mock.module("@/lib/push", ...),
// since `./push` and `@/lib/push` resolve to the same module process-wide).
// Only @/lib/db, @/lib/push-subscription-repository and web-push are mocked.
//
// P2-T44-R1I (reconciliation): this file's `db.pushSubscription.findMany`
// mock predated R1D's account-level two-phase resolution
// (resolveOperationalPushTargets -> getPushSubscriptionsForOwners first
// queries ownerType="cuenta_operativa", and only queries
// ownerType="empleado" for accounts with zero account-level rows). The old
// mock ignored `where` entirely and returned rows missing
// ownerType/ownerId/channel, which the repository's own defensive re-filter
// (`row.ownerType !== ownerType || row.channel !== channel` -> skip)
// silently dropped for EVERY query, always forcing the legacy-only
// fallback path regardless of what was actually being asked. The mock below
// is `where`-aware and tags every returned row with the owner it actually
// belongs to, so each of the four real scenarios (account-level only,
// legacy-only fallback, both present with account-level winning, and
// account-level multi-device fan-out) can be driven and asserted honestly.
import { beforeEach, describe, expect, mock, test } from "bun:test"

type EmpleadoLegacyRow = {
  id: string
  cuentaOperativaId: string | null
  pushSubscription: string | null
  areaOperativa: string
  activo: boolean
  eliminado: boolean
  negocioId: string
}

type NormalizedRow = { endpoint: string; p256dh: string; auth: string; expirationTime: Date | null }

const CUENTA_ID = "cuenta-1"
const EMPLEADO_ID = "empleado-1"

let empleadoRow: EmpleadoLegacyRow | null
let notificacionRows: Array<{ userId: string; userType: string; tipo: string; pedidoId: string | null }>
// Filas REALES de push_subscriptions por owner — indexadas por ownerType
// para que el mock pueda responder de forma congruente con el `where` que
// getPushSubscriptionsForOwners realmente envía en cada una de las dos
// fases (cuenta_operativa primero, empleado sólo como fallback).
let accountLevelRows: NormalizedRow[]
let employeeNormalizedRows: NormalizedRow[]
let webpushCallLog: string[]
let webpushBehavior: Map<string, "success" | 404 | 410>

mock.module("@/lib/db", () => ({
  db: {
    empleado: {
      findFirst: async () =>
        empleadoRow
          ? { id: empleadoRow.id, cuentaOperativaId: empleadoRow.cuentaOperativaId, pushSubscription: empleadoRow.pushSubscription }
          : null,
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
    // mock de `pushSubscription`, ahora congruente con `where.ownerType`.
    pushSubscription: {
      findMany: async ({ where }: { where: { ownerType: string; ownerId: { in: string[] }; channel: string } }) => {
        const ids = where.ownerId.in
        if (where.ownerType === "cuenta_operativa") {
          if (!ids.includes(CUENTA_ID)) return []
          return accountLevelRows.map((r) => ({ ...r, ownerType: "cuenta_operativa", ownerId: CUENTA_ID, channel: "default" }))
        }
        if (where.ownerType === "empleado") {
          if (!ids.includes(EMPLEADO_ID)) return []
          return employeeNormalizedRows.map((r) => ({ ...r, ownerType: "empleado", ownerId: EMPLEADO_ID, channel: "default" }))
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

function pedido(id: string) {
  return {
    id,
    negocioId: "negocio-1",
    negocioSlug: "mi-negocio",
    metodoEntrega: "mesa",
    mesaId: "mesa-1",
    mesaNumero: 7,
    empleadoId: EMPLEADO_ID,
  }
}

beforeEach(() => {
  empleadoRow = {
    id: EMPLEADO_ID,
    cuentaOperativaId: CUENTA_ID,
    pushSubscription: null,
    areaOperativa: "mozo",
    activo: true,
    eliminado: false,
    negocioId: "negocio-1",
  }
  accountLevelRows = []
  employeeNormalizedRows = []
  notificacionRows = []
  webpushCallLog = []
  webpushBehavior = new Map()
})

describe("notifyMesaOrderReadyForMozo — real core multi-device fan-out", () => {
  test("A — MOZO_ACCOUNT_LEVEL_TEST: cuenta con subscription account-level -> Push se dirige a cuenta_operativa", async () => {
    accountLevelRows = [{ endpoint: "https://push.example/account-device", p256dh: "p", auth: "a", expirationTime: null }]
    // Sin legacy — el fallback a empleado ni siquiera debería consultarse.
    empleadoRow!.pushSubscription = null

    await notifyMesaOrderReadyForMozo({ pedido: pedido("pedido-a"), estadoAnterior: "preparando" })

    expect(webpushCallLog).toEqual(["https://push.example/account-device"])
    expect(notificacionRows.length).toBe(1)
  })

  test("B — MOZO_LEGACY_FALLBACK_TEST: cuenta SIN subscription account-level + empleado legacy con subscription -> fallback empleado funciona", async () => {
    accountLevelRows = [] // la cuenta no tiene ninguna fila account-level
    empleadoRow!.pushSubscription = JSON.stringify({
      endpoint: "https://push.example/legacy-device",
      keys: { p256dh: "p", auth: "a" },
      expirationTime: null,
    })

    await notifyMesaOrderReadyForMozo({ pedido: pedido("pedido-b"), estadoAnterior: "preparando" })

    expect(webpushCallLog).toEqual(["https://push.example/legacy-device"])
    expect(notificacionRows.length).toBe(1)
  })

  test("C — MOZO_NO_DOUBLE_FANOUT_TEST: cuenta con account-level Y empleado legacy -> account-level gana, sin duplicar, legacy no se usa", async () => {
    accountLevelRows = [{ endpoint: "https://push.example/account-device", p256dh: "p", auth: "a", expirationTime: null }]
    // El empleado TODAVÍA tiene un legacy poblado (dispositivo viejo) —
    // como la cuenta ya tiene fila account-level, la fase de fallback
    // empleado NUNCA debe consultarse ni usarse.
    empleadoRow!.pushSubscription = JSON.stringify({
      endpoint: "https://push.example/legacy-device",
      keys: { p256dh: "p", auth: "a" },
      expirationTime: null,
    })

    await notifyMesaOrderReadyForMozo({ pedido: pedido("pedido-c"), estadoAnterior: "preparando" })

    expect(webpushCallLog).toEqual(["https://push.example/account-device"])
    expect(webpushCallLog).not.toContain("https://push.example/legacy-device")
    expect(notificacionRows.length).toBe(1)
  })

  test("D — multi-device fan-out bajo account-level: dos dispositivos de la MISMA cuenta reciben Push, con exactamente 1 Notificacion lógica", async () => {
    accountLevelRows = [
      { endpoint: "https://push.example/account-device-1", p256dh: "p1", auth: "a1", expirationTime: null },
      { endpoint: "https://push.example/account-device-2", p256dh: "p2", auth: "a2", expirationTime: null },
    ]

    await notifyMesaOrderReadyForMozo({ pedido: pedido("pedido-d"), estadoAnterior: "preparando" })

    expect(webpushCallLog.sort()).toEqual([
      "https://push.example/account-device-1",
      "https://push.example/account-device-2",
    ])
    expect(notificacionRows.length).toBe(1) // 1 logical notification regardless of device count
  })

  test("mozo sin ninguna subscription (ni account-level ni legacy) -> no send attempted, Notificacion still persisted", async () => {
    accountLevelRows = []
    empleadoRow!.pushSubscription = null

    await notifyMesaOrderReadyForMozo({ pedido: pedido("pedido-e"), estadoAnterior: "preparando" })

    expect(webpushCallLog.length).toBe(0)
    expect(notificacionRows.length).toBe(1)
  })
})
