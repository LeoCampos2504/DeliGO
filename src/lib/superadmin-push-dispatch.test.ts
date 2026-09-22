// P2-T39-R3: wiring test para dispatchSuperadminPush — verifica el fan-out
// REAL de push.ts (resolveCorePushTargets/sendPushToTargets/
// mergePushFanoutTargets) para el owner moderno "superadmin", sin mockear
// `@/lib/push` (colisionaría con el propio mock.module de push.test.ts, ya
// que `./push` y `@/lib/push` resuelven al mismo módulo en todo el proceso —
// ver el comentario equivalente en mesa-order-ready-notification.test.ts).
// Sólo se mockean `@/lib/db` y `web-push`.
import { beforeEach, describe, expect, mock, test } from "bun:test"

type NormalizedRow = { endpoint: string; p256dh: string; auth: string; expirationTime: Date | null }

const ADMIN_A = "superadmin-a"
const ADMIN_B = "superadmin-b"

let rowsByAdmin: Map<string, NormalizedRow[]>
let webpushCallLog: string[]
let webpushShouldThrow: boolean

mock.module("@/lib/db", () => ({
  db: {
    pushSubscription: {
      // resolveCorePushTargets() -> getPushSubscriptionsForOwner() (singular)
      // consulta UN owner por vez con `where.ownerId` como string plano —
      // nunca `{in: [...]}` (eso es getPushSubscriptionsForOwners, plural,
      // que este dispatcher deliberadamente no usa: resuelve cada
      // recipientId con su propia llamada, igual que cualquier otro core
      // owner ya lo hace en push.ts).
      findMany: async ({ where }: { where: { ownerType: string; ownerId: string; channel: string } }) => {
        if (where.ownerType !== "superadmin") return []
        const adminRows = rowsByAdmin.get(where.ownerId) ?? []
        return adminRows.map((row) => ({ ...row, ownerType: "superadmin", ownerId: where.ownerId, channel: "default" }))
      },
      deleteMany: async () => ({ count: 1 }),
    },
  },
}))

// push.ts lee VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY en constantes de MÓDULO, una
// única vez al importarse — deben existir ANTES del import de abajo (un
// beforeEach seria demasiado tarde, el import ya ejecutó).
process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "test-public-key"
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "test-private-key"

mock.module("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: async (subscription: { endpoint: string }, payloadJson: string) => {
      // Ver comentario en push.test.ts / mesa-order-ready-notification.test.ts:
      // sólo se controla el resultado para endpoints del fixture de este
      // archivo; cualquier otro falla por defecto, nunca succeeds en silencio.
      if (!subscription.endpoint.startsWith("https://push.example/superadmin-")) {
        throw new Error("simulated network failure (unrecognized endpoint outside this test's fixture domain)")
      }
      webpushCallLog.push(payloadJson)
      if (webpushShouldThrow) {
        throw new Error("simulated provider failure")
      }
      return { statusCode: 201 }
    },
  },
}))

const { dispatchSuperadminPush } = await import("./superadmin-push-dispatch")

beforeEach(() => {
  rowsByAdmin = new Map()
  webpushCallLog = []
  webpushShouldThrow = false
})

describe("dispatchSuperadminPush — real core fan-out for the superadmin owner", () => {
  test("A — SUPERADMIN_SINGLE_RECIPIENT_TEST: un recipient con una subscription recibe exactamente un Push con el envelope correcto", async () => {
    rowsByAdmin.set(ADMIN_A, [{ endpoint: "https://push.example/superadmin-a-device", p256dh: "p", auth: "a", expirationTime: null }])

    await dispatchSuperadminPush([ADMIN_A], {
      type: "negocio_pendiente",
      titulo: "Nuevo negocio pendiente",
      cuerpo: "Test Negocio verificó su email y espera aprobación.",
      entityId: "negocio-1",
      navigateTo: "pendientes",
    })

    expect(webpushCallLog.length).toBe(1)
    const payload = JSON.parse(webpushCallLog[0])
    expect(payload.title).toBe("Nuevo negocio pendiente")
    expect(payload.data.type).toBe("negocio_pendiente")
    expect(payload.data.actorFamily).toBe("superadmin")
    expect(payload.data.url).toBe("/admin")
    expect(payload.data.entityId).toBe("negocio-1")
    expect(payload.data.navigateTo).toBe("pendientes")
  })

  test("B — SUPERADMIN_MULTI_RECIPIENT_TEST: dos recipients con endpoints distintos reciben cada uno su propio Push", async () => {
    rowsByAdmin.set(ADMIN_A, [{ endpoint: "https://push.example/superadmin-a-device", p256dh: "p", auth: "a", expirationTime: null }])
    rowsByAdmin.set(ADMIN_B, [{ endpoint: "https://push.example/superadmin-b-device", p256dh: "p", auth: "a", expirationTime: null }])

    await dispatchSuperadminPush([ADMIN_A, ADMIN_B], {
      type: "denuncia_nueva",
      titulo: "Nueva denuncia registrada",
      cuerpo: "Un negocio denunció a un cliente.",
    })

    expect(webpushCallLog.length).toBe(2)
  })

  test("C — SUPERADMIN_SHARED_ENDPOINT_DEDUP_TEST: dos recipients que comparten el MISMO endpoint físico reciben un solo Push", async () => {
    const sharedRow: NormalizedRow = { endpoint: "https://push.example/superadmin-shared-device", p256dh: "p", auth: "a", expirationTime: null }
    rowsByAdmin.set(ADMIN_A, [sharedRow])
    rowsByAdmin.set(ADMIN_B, [sharedRow])

    await dispatchSuperadminPush([ADMIN_A, ADMIN_B], {
      type: "negocio_deuda",
      titulo: "Alerta de deuda",
      cuerpo: "Un negocio superó el 80% de su límite de deuda.",
    })

    expect(webpushCallLog.length).toBe(1)
  })

  test("D — SUPERADMIN_ZERO_RECIPIENTS_TEST: recipientIds vacío nunca toca la DB ni envía nada", async () => {
    await dispatchSuperadminPush([], { type: "review_moderation", titulo: "t", cuerpo: "c" })
    expect(webpushCallLog.length).toBe(0)
  })

  test("E — SUPERADMIN_NO_SUBSCRIPTIONS_TEST: recipient sin ninguna subscription no envía nada y no lanza", async () => {
    await expect(
      dispatchSuperadminPush([ADMIN_A], { type: "destacado_solicitud", titulo: "t", cuerpo: "c" })
    ).resolves.toBeUndefined()
    expect(webpushCallLog.length).toBe(0)
  })

  test("F — SUPERADMIN_PROVIDER_FAILURE_NEVER_THROWS_TEST: un fallo del proveedor Push nunca se propaga (best-effort)", async () => {
    rowsByAdmin.set(ADMIN_A, [{ endpoint: "https://push.example/superadmin-a-device", p256dh: "p", auth: "a", expirationTime: null }])
    webpushShouldThrow = true

    await expect(
      dispatchSuperadminPush([ADMIN_A], { type: "negocio_pendiente", titulo: "t", cuerpo: "c" })
    ).resolves.toBeUndefined()
  })

  test("G — SUPERADMIN_DUPLICATE_RECIPIENT_IDS_TEST: recipientIds duplicados se dedupean antes de resolver targets", async () => {
    rowsByAdmin.set(ADMIN_A, [{ endpoint: "https://push.example/superadmin-a-device", p256dh: "p", auth: "a", expirationTime: null }])

    await dispatchSuperadminPush([ADMIN_A, ADMIN_A, ADMIN_A], {
      type: "negocio_pendiente",
      titulo: "t",
      cuerpo: "c",
    })

    expect(webpushCallLog.length).toBe(1)
  })
})
