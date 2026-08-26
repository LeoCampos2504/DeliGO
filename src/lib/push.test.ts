// P2-T05 Stage4: normalized multi-device send fan-out + safe legacy
// fallback / dead-endpoint cleanup — fully isolated unit tests, no real DB,
// no real Web Push. `web-push`, `@/lib/db` and
// `@/lib/push-subscription-repository` are replaced via mock.module before
// `push.ts` is imported (same pattern as the route test files in this repo).
import { beforeEach, describe, expect, mock, test } from "bun:test"

type LegacyModel = "cliente" | "negocio" | "repartidor" | "empleado" | "superAdmin"
type LegacyRow = { pushSubscription: string | null; pushSubscriptionSalon?: string | null }

const EP = (suffix: string) => `https://push.example/${suffix}`

function sub(endpointSuffix: string, p256dh = "P", auth = "A") {
  return JSON.stringify({ endpoint: EP(endpointSuffix), keys: { p256dh, auth }, expirationTime: null })
}

let legacyStore: Record<LegacyModel, Record<string, LegacyRow>>
let normalizedByOwner: Map<string, Array<{ endpoint: string; p256dh: string; auth: string; expirationTime: Date | null }>>
let normalizedQueryShouldThrow: boolean
let sweepCalls: string[]
let notificacionCreateCalls: Array<{ userId: string; userType: string }>
let webpushBehavior: Map<string, "success" | 404 | 410 | 500 | "network">
let webpushCallLog: string[]
/** Fires exactly once, right after a `findUnique` read resolves its return
 * value but before the caller sees it, to simulate a genuine race: the
 * store mutates DURING the read-then-CAS-write window (D5). */
let raceOnNextRead: (() => void) | null

function ownerKey(ownerType: string, ownerId: string, channel: string) {
  return `${ownerType}|${ownerId}|${channel}`
}

function makeLegacyModel(model: LegacyModel) {
  return {
    findUnique: async ({ where, select }: { where: { id: string }; select: Record<string, boolean> }) => {
      const row = legacyStore[model][where.id]
      if (!row) return null
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(select)) {
        result[key] = (row as Record<string, unknown>)[key] ?? null
      }
      if (raceOnNextRead) {
        const hook = raceOnNextRead
        raceOnNextRead = null
        hook()
      }
      return result
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; pushSubscription?: string | null; pushSubscriptionSalon?: string | null }
      data: Record<string, string | null>
    }) => {
      const row = legacyStore[model][where.id]
      if (!row) return { count: 0 }
      const field = "pushSubscriptionSalon" in where ? "pushSubscriptionSalon" : "pushSubscription"
      const expected = (where as Record<string, unknown>)[field]
      if ((row as Record<string, unknown>)[field] !== expected) return { count: 0 }
      Object.assign(row, data)
      return { count: 1 }
    },
  }
}

mock.module("web-push", () => ({
  default: {
    setVapidDetails: () => {},
    generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }),
    sendNotification: async (subscription: { endpoint: string }) => {
      // Sólo se controla el resultado para endpoints del propio fixture de
      // este archivo (`https://push.example/...`) — cualquier otro endpoint
      // (p.ej. el sentinel TEST-NET-3 de push-log-sanitization.test.ts, que
      // corre en la MISMA suite de `bun test` y necesita un fallo real, no
      // "success") falla por defecto, nunca succeeds silenciosamente.
      webpushCallLog.push(subscription.endpoint)
      if (!subscription.endpoint.startsWith("https://push.example/")) {
        throw new Error("simulated network failure (unrecognized endpoint outside this test's fixture domain)")
      }
      const behavior = webpushBehavior.get(subscription.endpoint) ?? "success"
      if (behavior === "success") return { statusCode: 201 }
      if (behavior === "network") throw new Error("simulated network failure")
      const err = new Error(`simulated ${behavior}`) as Error & { statusCode: number }
      err.statusCode = behavior
      throw err
    },
  },
}))

// P2-T05 Stage4: no se mockea `@/lib/push-subscription-repository` como
// módulo completo — reemplazar sólo 2 de sus exports rompería a CUALQUIER
// otro archivo de test en la misma corrida de `bun test` que necesite
// `registerPushSubscription`/`detachPushSubscriptionByEndpoint` reales
// (mock.module es global al proceso). En su lugar se deja correr el
// repository REAL contra un mock de `@/lib/db.pushSubscription` — mismo
// patrón ya usado en el resto de esta suite.
mock.module("@/lib/db", () => ({
  db: {
    cliente: makeLegacyModel("cliente"),
    negocio: makeLegacyModel("negocio"),
    repartidor: makeLegacyModel("repartidor"),
    empleado: makeLegacyModel("empleado"),
    superAdmin: makeLegacyModel("superAdmin"),
    notificacion: {
      create: async ({ data }: { data: { userId: string; userType: string } }) => {
        notificacionCreateCalls.push({ userId: data.userId, userType: data.userType })
        return { id: `notif-${notificacionCreateCalls.length}` }
      },
    },
    pushSubscription: {
      findMany: async ({ where }: { where: { ownerType: string; ownerId: string; channel: string } }) => {
        if (normalizedQueryShouldThrow) throw new Error("simulated normalized query failure")
        return normalizedByOwner.get(ownerKey(where.ownerType, where.ownerId, where.channel)) ?? []
      },
      deleteMany: async ({ where }: { where: { endpoint: string } }) => {
        sweepCalls.push(where.endpoint)
        return { count: 1 }
      },
    },
  },
}))

const push = await import("./push")

beforeEach(() => {
  legacyStore = { cliente: {}, negocio: {}, repartidor: {}, empleado: {}, superAdmin: {} }
  normalizedByOwner = new Map()
  normalizedQueryShouldThrow = false
  sweepCalls = []
  notificacionCreateCalls = []
  webpushBehavior = new Map()
  webpushCallLog = []
  raceOnNextRead = null
})

// ============================================
// resolveCorePushTargets — F1-F7
// ============================================
describe("resolveCorePushTargets — normalized UNION legacy (F1-F7)", () => {
  test("F1: normalized E1,E2 + legacy E1 (duplicate) -> 2 unique targets, E1 not doubled", async () => {
    normalizedByOwner.set(ownerKey("cliente", "c1", "default"), [
      { endpoint: EP("E1"), p256dh: "p1", auth: "a1", expirationTime: null },
      { endpoint: EP("E2"), p256dh: "p2", auth: "a2", expirationTime: null },
    ])
    const targets = await push.resolveCorePushTargets("cliente", "c1", sub("E1", "p1", "a1"))
    expect(targets.length).toBe(2)
    expect(targets.map((t) => t.endpoint).sort()).toEqual([EP("E1"), EP("E2")])
  })

  test("F2: normalized empty + legacy E1 valid -> send E1 once", async () => {
    const targets = await push.resolveCorePushTargets("cliente", "c1", sub("E1"))
    expect(targets.length).toBe(1)
    expect(targets[0].endpoint).toBe(EP("E1"))
  })

  test("F3: normalized E1 + legacy E2 distinct -> both present, total=2", async () => {
    normalizedByOwner.set(ownerKey("cliente", "c1", "default"), [
      { endpoint: EP("E1"), p256dh: "p1", auth: "a1", expirationTime: null },
    ])
    const targets = await push.resolveCorePushTargets("cliente", "c1", sub("E2"))
    expect(targets.map((t) => t.endpoint).sort()).toEqual([EP("E1"), EP("E2")])
  })

  test("F4: normalized E1,E2,E3 -> 3 targets resolved (1 logical notification produces 3 sends, see createNotification test)", async () => {
    normalizedByOwner.set(ownerKey("cliente", "c1", "default"), [
      { endpoint: EP("E1"), p256dh: "p1", auth: "a1", expirationTime: null },
      { endpoint: EP("E2"), p256dh: "p2", auth: "a2", expirationTime: null },
      { endpoint: EP("E3"), p256dh: "p3", auth: "a3", expirationTime: null },
    ])
    const targets = await push.resolveCorePushTargets("cliente", "c1", null)
    expect(targets.length).toBe(3)
  })

  test("F5: normalized query throws + legacy E1 valid -> degrades to legacy-only, E1 still attempted", async () => {
    normalizedQueryShouldThrow = true
    const targets = await push.resolveCorePushTargets("cliente", "c1", sub("E1"))
    expect(targets.length).toBe(1)
    expect(targets[0].endpoint).toBe(EP("E1"))
  })

  test("F6: legacy malformed + normalized E1,E2 valid -> E1,E2 still resolved, malformed legacy silently skipped", async () => {
    normalizedByOwner.set(ownerKey("cliente", "c1", "default"), [
      { endpoint: EP("E1"), p256dh: "p1", auth: "a1", expirationTime: null },
      { endpoint: EP("E2"), p256dh: "p2", auth: "a2", expirationTime: null },
    ])
    const targets = await push.resolveCorePushTargets("cliente", "c1", "{not-json")
    expect(targets.map((t) => t.endpoint).sort()).toEqual([EP("E1"), EP("E2")])
  })

  test("F7: a malformed legacy (e.g. http:// not https://) never aborts already-resolved normalized targets", async () => {
    normalizedByOwner.set(ownerKey("cliente", "c1", "default"), [
      { endpoint: EP("E2"), p256dh: "p2", auth: "a2", expirationTime: null },
    ])
    const malformedLegacy = JSON.stringify({ endpoint: "http://push.example/insecure", keys: { p256dh: "p", auth: "a" }, expirationTime: null })
    const targets = await push.resolveCorePushTargets("cliente", "c1", malformedLegacy)
    expect(targets.length).toBe(1)
    expect(targets[0].endpoint).toBe(EP("E2"))
  })
})

// ============================================
// sendPushToTargets — failure isolation P1-P4
// ============================================
describe("sendPushToTargets — per-endpoint failure isolation (P1-P4)", () => {
  test("P1: E1 provider 500, E2 success -> E2 delivered, wave completes, no cleanup for E1", async () => {
    webpushBehavior.set(EP("E1"), 500)
    webpushBehavior.set(EP("E2"), "success")
    const targets = [
      { endpoint: EP("E1"), raw: sub("E1") },
      { endpoint: EP("E2"), raw: sub("E2") },
    ]
    const result = await push.sendPushToTargets(targets, { title: "t", body: "b" })
    expect(result.attempted).toBe(2)
    expect(result.delivered).toBe(1)
    expect(sweepCalls).toEqual([])
  })

  test("P2: E1 network exception, E2 success -> E2 delivered, no cleanup for E1", async () => {
    webpushBehavior.set(EP("E1"), "network")
    webpushBehavior.set(EP("E2"), "success")
    const targets = [
      { endpoint: EP("E1"), raw: sub("E1") },
      { endpoint: EP("E2"), raw: sub("E2") },
    ]
    const result = await push.sendPushToTargets(targets, { title: "t", body: "b" })
    expect(result.delivered).toBe(1)
    expect(sweepCalls).toEqual([])
  })

  test("P3: E1 404, E2 success -> normalized sweep(E1) called, E2 still sent", async () => {
    webpushBehavior.set(EP("E1"), 404)
    webpushBehavior.set(EP("E2"), "success")
    const targets = [
      { endpoint: EP("E1"), raw: sub("E1") },
      { endpoint: EP("E2"), raw: sub("E2") },
    ]
    const result = await push.sendPushToTargets(targets, { title: "t", body: "b" })
    expect(result.delivered).toBe(1)
    expect(sweepCalls).toEqual([EP("E1")])
  })

  test("P4: E1 410, E2 success -> same as 404, no automatic retry (each endpoint attempted exactly once)", async () => {
    webpushBehavior.set(EP("E1"), 410)
    webpushBehavior.set(EP("E2"), "success")
    const targets = [
      { endpoint: EP("E1"), raw: sub("E1") },
      { endpoint: EP("E2"), raw: sub("E2") },
    ]
    await push.sendPushToTargets(targets, { title: "t", body: "b" })
    expect(webpushCallLog.filter((e) => e === EP("E1")).length).toBe(1)
    expect(webpushCallLog.filter((e) => e === EP("E2")).length).toBe(1)
  })
})

// ============================================
// Dead-endpoint cleanup — D1-D5
// ============================================
describe("Dead-endpoint cleanup — normalized sweep + legacy CAS (D1-D5)", () => {
  test("D1: legacy=E1, send E1 -> 410 -> normalized sweep(E1) + legacy safely cleared", async () => {
    legacyStore.cliente["c1"] = { pushSubscription: sub("E1", "p1", "a1") }
    webpushBehavior.set(EP("E1"), 410)
    const targets = await push.resolveCorePushTargets("cliente", "c1", legacyStore.cliente["c1"].pushSubscription)
    await push.sendPushToTargets(targets, { title: "t", body: "b" })
    expect(sweepCalls).toEqual([EP("E1")])
    expect(legacyStore.cliente["c1"].pushSubscription).toBeNull()
  })

  test("D2: legacy becomes E2 before the 410 for E1 arrives -> E2 survives (CAS mismatch)", async () => {
    const originalRaw = sub("E1", "p1", "a1")
    legacyStore.cliente["c1"] = { pushSubscription: originalRaw }
    webpushBehavior.set(EP("E1"), 410)
    const targets = await push.resolveCorePushTargets("cliente", "c1", originalRaw)
    // Simulate a concurrent write: legacy changes to E2 AFTER the snapshot was taken.
    legacyStore.cliente["c1"].pushSubscription = sub("E2", "p2", "a2")
    await push.sendPushToTargets(targets, { title: "t", body: "b" })
    expect(legacyStore.cliente["c1"].pushSubscription).toBe(sub("E2", "p2", "a2"))
  })

  test("D3: same endpoint but different semantic fields (stale target) -> no blind clear", async () => {
    // Current legacy has E1 but with DIFFERENT keys than what we're cleaning up for.
    legacyStore.cliente["c1"] = { pushSubscription: sub("E1", "NEW_KEY", "NEW_AUTH") }
    webpushBehavior.set(EP("E1"), 410)
    const staleTarget = {
      endpoint: EP("E1"),
      raw: sub("E1", "OLD_KEY", "OLD_AUTH"),
      cleanup: { model: "cliente", id: "c1", field: "pushSubscription" },
    }
    await push.sendPushToTargets([staleTarget], { title: "t", body: "b" })
    expect(legacyStore.cliente["c1"].pushSubscription).toBe(sub("E1", "NEW_KEY", "NEW_AUTH"))
  })

  test("D4: current legacy malformed + normalized target E1 dies via 404 -> normalized sweep works, legacy not blindly cleared", async () => {
    legacyStore.cliente["c1"] = { pushSubscription: "{not-json" }
    webpushBehavior.set(EP("E1"), 404)
    const target = { endpoint: EP("E1"), raw: sub("E1"), cleanup: { model: "cliente", id: "c1", field: "pushSubscription" } }
    await push.sendPushToTargets([target], { title: "t", body: "b" })
    expect(sweepCalls).toEqual([EP("E1")])
    expect(legacyStore.cliente["c1"].pushSubscription).toBe("{not-json")
  })

  test("D5: CAS race — value changes DURING the read-then-write window -> count 0, newer value survives", async () => {
    const raw = sub("E1", "p1", "a1")
    legacyStore.cliente["c1"] = { pushSubscription: raw }
    webpushBehavior.set(EP("E1"), 410)
    const target = { endpoint: EP("E1"), raw, cleanup: { model: "cliente", id: "c1", field: "pushSubscription" } }
    // The race fires exactly once, right after the CAS read resolves but
    // before the updateMany runs — a genuinely concurrent write, not a
    // pre-existing state difference (that's D2).
    raceOnNextRead = () => {
      legacyStore.cliente["c1"].pushSubscription = sub("E2", "p2", "a2")
    }
    await push.sendPushToTargets([target], { title: "t", body: "b" })
    expect(legacyStore.cliente["c1"].pushSubscription).toBe(sub("E2", "p2", "a2"))
  })
})

// ============================================
// Cross-actor dead endpoint — §36
// ============================================
describe("Cross-actor dead endpoint (shared physical device)", () => {
  test("mergePushFanoutTargets: same endpoint from two different empleado owners -> single send, both legacy CAS-cleared on 410", async () => {
    legacyStore.empleado["e1"] = { pushSubscription: sub("SHARED", "p", "a") }
    legacyStore.empleado["e2"] = { pushSubscription: sub("SHARED", "p", "a") }
    webpushBehavior.set(EP("SHARED"), 410)

    const targetsE1 = await push.resolveCorePushTargets("empleado", "e1", legacyStore.empleado["e1"].pushSubscription)
    const targetsE2 = await push.resolveCorePushTargets("empleado", "e2", legacyStore.empleado["e2"].pushSubscription)
    const merged = push.mergePushFanoutTargets([targetsE1, targetsE2])

    expect(merged.length).toBe(1) // DEAD_ENDPOINT_GLOBAL_NORMALIZED_SWEEP_CROSS_ACTOR=EXPECTED: one physical send
    await push.sendPushToTargets(merged, { title: "t", body: "b" })
    expect(webpushCallLog.filter((e) => e === EP("SHARED")).length).toBe(1) // never sent twice
    expect(sweepCalls).toEqual([EP("SHARED")])
    expect(legacyStore.empleado["e1"].pushSubscription).toBeNull()
    expect(legacyStore.empleado["e2"].pushSubscription).toBeNull()
  })
})

// ============================================
// Endpoint dedupe — §37
// ============================================
describe("Endpoint dedupe scope (logical fanout only, never persistent)", () => {
  test("normalized E1 + legacy same E1 -> exactly 1 webpush send", async () => {
    normalizedByOwner.set(ownerKey("cliente", "c1", "default"), [
      { endpoint: EP("E1"), p256dh: "p1", auth: "a1", expirationTime: null },
    ])
    const targets = await push.resolveCorePushTargets("cliente", "c1", sub("E1", "p1", "a1"))
    await push.sendPushToTargets(targets, { title: "t", body: "b" })
    expect(webpushCallLog.filter((e) => e === EP("E1")).length).toBe(1)
  })

  test("two consecutive logical notifications, same E1 -> one send PER notification, no cross-notification suppression", async () => {
    const targets = await push.resolveCorePushTargets("cliente", "c1", sub("E1"))
    await push.sendPushToTargets(targets, { title: "t1", body: "b1" })
    await push.sendPushToTargets(targets, { title: "t2", body: "b2" })
    expect(webpushCallLog.filter((e) => e === EP("E1")).length).toBe(2)
  })
})

// ============================================
// createNotification — one logical Notificacion, multi-device fanout
// ============================================
describe("createNotification — 1 Notificacion row, N web-push sends (§38)", () => {
  test("actor with 3 normalized devices -> db.notificacion.create count=1, webpush.sendNotification count=3", async () => {
    normalizedByOwner.set(ownerKey("cliente", "c1", "default"), [
      { endpoint: EP("D1"), p256dh: "p1", auth: "a1", expirationTime: null },
      { endpoint: EP("D2"), p256dh: "p2", auth: "a2", expirationTime: null },
      { endpoint: EP("D3"), p256dh: "p3", auth: "a3", expirationTime: null },
    ])
    await push.createNotification({
      userId: "c1",
      userType: "cliente",
      tipo: "general",
      titulo: "t",
      cuerpo: "b",
      pushSubscription: null,
      pushPayload: { title: "t", body: "b" },
      awaitPush: true,
    })
    expect(notificacionCreateCalls.length).toBe(1)
    expect(webpushCallLog.length).toBe(3)
  })
})

// ============================================
// Core owner coverage — §39
// ============================================
describe("Core owner mapping coverage (cliente/negocio/repartidor/empleado, channel=default)", () => {
  test.each(["cliente", "negocio", "repartidor", "empleado"] as const)(
    "%s/default: normalized target resolved and sent",
    async (ownerType) => {
      normalizedByOwner.set(ownerKey(ownerType, "owner-1", "default"), [
        { endpoint: EP("E1"), p256dh: "p1", auth: "a1", expirationTime: null },
      ])
      const targets = await push.resolveCorePushTargets(ownerType, "owner-1", null)
      expect(targets.length).toBe(1)
      await push.sendPushToTargets(targets, { title: "t", body: "b" })
      expect(webpushCallLog).toContain(EP("E1"))
    }
  )

  test("wrong mapping never happens: cliente owner never resolves negocio/salon channel rows", async () => {
    normalizedByOwner.set(ownerKey("negocio", "n1", "salon"), [
      { endpoint: EP("SALON_E1"), p256dh: "p", auth: "a", expirationTime: null },
    ])
    const targets = await push.resolveCorePushTargets("cliente", "n1", null)
    expect(targets.length).toBe(0)
  })
})

// ============================================
// Legacy-only coverage — §40
// ============================================
describe("Legacy-only surfaces remain untouched by normalized resolution", () => {
  test("SuperAdmin: createNotification never resolves normalized targets, single legacy send only", async () => {
    legacyStore.superAdmin["sa1"] = { pushSubscription: sub("SA_E1") }
    await push.createNotification({
      userId: "sa1",
      userType: "superadmin",
      tipo: "general",
      titulo: "t",
      cuerpo: "b",
      pushSubscription: legacyStore.superAdmin["sa1"].pushSubscription,
      pushPayload: { title: "t", body: "b" },
      cleanupExpired: { model: "superadmin", id: "sa1" },
      awaitPush: true,
    })
    expect(webpushCallLog).toEqual([EP("SA_E1")])
  })

  test("Negocio.pushSubscriptionSalon (field override) is never routed through normalized core fan-out — legacy single-send preserved", async () => {
    legacyStore.negocio["n1"] = { pushSubscription: null, pushSubscriptionSalon: sub("SALON_E1") }
    normalizedByOwner.set(ownerKey("negocio", "n1", "default"), [
      { endpoint: EP("PERSONAL_E1"), p256dh: "p", auth: "a", expirationTime: null },
    ])
    await push.createNotification({
      userId: "n1",
      userType: "negocio",
      tipo: "salon_new_order",
      titulo: "t",
      cuerpo: "b",
      pushSubscription: legacyStore.negocio["n1"].pushSubscriptionSalon,
      pushPayload: { title: "t", body: "b" },
      cleanupExpired: { model: "negocio", id: "n1", field: "pushSubscriptionSalon" },
      awaitPush: true,
    })
    // Only the salon legacy endpoint was sent — the negocio's PERSONAL
    // normalized devices (different channel/field) must never be touched by
    // a salon-channel notification.
    expect(webpushCallLog).toEqual([EP("SALON_E1")])
  })

  test("Negocio.pushSubscriptionSalon 410 cleanup clears pushSubscriptionSalon, never pushSubscription", async () => {
    legacyStore.negocio["n1"] = { pushSubscription: sub("PERSONAL_E1"), pushSubscriptionSalon: sub("SALON_E1") }
    webpushBehavior.set(EP("SALON_E1"), 410)
    await push.createNotification({
      userId: "n1",
      userType: "negocio",
      tipo: "salon_new_order",
      titulo: "t",
      cuerpo: "b",
      pushSubscription: legacyStore.negocio["n1"].pushSubscriptionSalon,
      pushPayload: { title: "t", body: "b" },
      cleanupExpired: { model: "negocio", id: "n1", field: "pushSubscriptionSalon" },
      awaitPush: true,
    })
    expect(legacyStore.negocio["n1"].pushSubscriptionSalon).toBeNull()
    expect(legacyStore.negocio["n1"].pushSubscription).toBe(sub("PERSONAL_E1")) // untouched
  })
})

// ============================================
// Web Push failure never rolls back the logical notification — §24
// ============================================
describe("Notificacion persistence is never rolled back by a Push failure", () => {
  test("all devices fail -> Notificacion row still persisted", async () => {
    normalizedByOwner.set(ownerKey("cliente", "c1", "default"), [
      { endpoint: EP("E1"), p256dh: "p1", auth: "a1", expirationTime: null },
    ])
    webpushBehavior.set(EP("E1"), 500)
    await push.createNotification({
      userId: "c1",
      userType: "cliente",
      tipo: "general",
      titulo: "t",
      cuerpo: "b",
      pushSubscription: null,
      pushPayload: { title: "t", body: "b" },
      awaitPush: true,
    })
    expect(notificacionCreateCalls.length).toBe(1)
  })
})
