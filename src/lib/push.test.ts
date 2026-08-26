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
let concurrencyGate: ReturnType<typeof createConcurrencyGate> | null
/** Fires exactly once, right after a `findUnique` read resolves its return
 * value but before the caller sees it, to simulate a genuine race: the
 * store mutates DURING the read-then-CAS-write window (D5). */
let raceOnNextRead: (() => void) | null

function createConcurrencyGate() {
  let released = false
  let started = 0
  let active = 0
  let maxActive = 0
  let release!: () => void
  const releasePromise = new Promise<void>((resolve) => { release = resolve })
  const startedWaiters: Array<{ count: number; resolve: () => void }> = []

  return {
    get started() { return started },
    get maxActive() { return maxActive },
    enter() {
      started += 1
      active += 1
      maxActive = Math.max(maxActive, active)
      for (let i = startedWaiters.length - 1; i >= 0; i -= 1) {
        if (started >= startedWaiters[i].count) startedWaiters.splice(i, 1)[0].resolve()
      }
    },
    leave() {
      active -= 1
    },
    waitForRelease() {
      return releasePromise
    },
    release() {
      if (!released) {
        released = true
        release()
      }
    },
    waitForStarted(count: number) {
      if (started >= count) return Promise.resolve()
      return new Promise<void>((resolve) => startedWaiters.push({ count, resolve }))
    },
  }
}

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
      const gate = concurrencyGate
      if (gate) {
        gate.enter()
        try {
          await gate.waitForRelease()
        } finally {
          gate.leave()
        }
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
  concurrencyGate = null
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

describe("sendPushToTargets — H2 bounded Web Push concurrency", () => {
  function targets(count: number, prefix: string) {
    return Array.from({ length: count }, (_, index) => ({
      endpoint: EP(`${prefix}-${index}`),
      raw: sub(`${prefix}-${index}`),
    }))
  }

  async function runGated(count: number, prefix: string) {
    const gate = createConcurrencyGate()
    concurrencyGate = gate
    try {
      const sendPromise = push.sendPushToTargets(targets(count, prefix), { title: "t", body: "b" })
      await gate.waitForStarted(Math.min(8, count))
      const startedBeforeRelease = gate.started
      gate.release()
      const result = await sendPromise
      return { gate, startedBeforeRelease, result }
    } finally {
      gate.release()
      concurrencyGate = null
    }
  }

  test("zero targets return immediately without provider work", async () => {
    const result = await push.sendPushToTargets([], { title: "t", body: "b" })
    expect(result).toEqual({ attempted: 0, delivered: 0 })
    expect(webpushCallLog).toEqual([])
  })

  test("one target is attempted once with max concurrency 1", async () => {
    const { gate, result } = await runGated(1, "bounded-one")
    expect(gate.maxActive).toBe(1)
    expect(result.attempted).toBe(1)
    expect(webpushCallLog).toEqual([EP("bounded-one-0")])
  })

  test("seven targets all run and never exceed seven active sends", async () => {
    const { gate, result } = await runGated(7, "bounded-seven")
    expect(gate.maxActive).toBe(7)
    expect(result.attempted).toBe(7)
    expect(webpushCallLog.length).toBe(7)
  })

  test("exactly eight targets fill the approved cap", async () => {
    const { gate, result } = await runGated(8, "bounded-eight")
    expect(gate.started).toBe(8)
    expect(gate.maxActive).toBe(8)
    expect(result.attempted).toBe(8)
  })

  test("the ninth target waits for a worker slot and max active remains eight", async () => {
    const { gate, startedBeforeRelease, result } = await runGated(9, "bounded-nine")
    expect(startedBeforeRelease).toBe(8)
    expect(gate.started).toBe(9)
    expect(gate.maxActive).toBe(8)
    expect(result.attempted).toBe(9)
  })

  test("seventeen targets complete in bounded waves with observed max eight", async () => {
    const { gate, result } = await runGated(17, "bounded-seventeen")
    expect(gate.started).toBe(17)
    expect(gate.maxActive).toBe(8)
    expect(result.attempted).toBe(17)
    expect(webpushCallLog.length).toBe(17)
  })

  test("a failed target does not stop queued targets and each endpoint is attempted once", async () => {
    webpushBehavior.set(EP("bounded-failure-0"), 500)
    const { gate, result } = await runGated(9, "bounded-failure")
    expect(gate.maxActive).toBe(8)
    expect(result.attempted).toBe(9)
    expect(result.delivered).toBe(8)
    expect(new Set(webpushCallLog).size).toBe(9)
    expect(webpushCallLog.length).toBe(9)
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
      cleanup: { model: "cliente", id: "c1", field: "pushSubscription" as const },
    }
    await push.sendPushToTargets([staleTarget], { title: "t", body: "b" })
    expect(legacyStore.cliente["c1"].pushSubscription).toBe(sub("E1", "NEW_KEY", "NEW_AUTH"))
  })

  test("D4: current legacy malformed + normalized target E1 dies via 404 -> normalized sweep works, legacy not blindly cleared", async () => {
    legacyStore.cliente["c1"] = { pushSubscription: "{not-json" }
    webpushBehavior.set(EP("E1"), 404)
    const target = { endpoint: EP("E1"), raw: sub("E1"), cleanup: { model: "cliente", id: "c1", field: "pushSubscription" as const } }
    await push.sendPushToTargets([target], { title: "t", body: "b" })
    expect(sweepCalls).toEqual([EP("E1")])
    expect(legacyStore.cliente["c1"].pushSubscription).toBe("{not-json")
  })

  test("D5: CAS race — value changes DURING the read-then-write window -> count 0, newer value survives", async () => {
    const raw = sub("E1", "p1", "a1")
    legacyStore.cliente["c1"] = { pushSubscription: raw }
    webpushBehavior.set(EP("E1"), 410)
    const target = { endpoint: EP("E1"), raw, cleanup: { model: "cliente", id: "c1", field: "pushSubscription" as const } }
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
// P2-T05 Hardening H1 (F-P2-T05-20): same endpoint / divergent Push keys
// across different owners — deterministic fail-closed per-endpoint policy
// ============================================
describe("mergePushFanoutTargets — divergent key resolution (F-P2-T05-20)", () => {
  function fanoutTarget(endpoint: string, p256dh: string, auth: string, ownerId: string) {
    return {
      endpoint: EP(endpoint),
      raw: sub(endpoint, p256dh, auth),
      cleanup: { model: "empleado", id: ownerId, field: "pushSubscription" as const },
    }
  }

  test("A: duplicate endpoint, SAME keys, different owners -> exactly 1 send target", () => {
    const merged = push.mergePushFanoutTargets([
      [fanoutTarget("SHARED", "K", "A", "e1")],
      [fanoutTarget("SHARED", "K", "A", "e2")],
    ])
    expect(merged.length).toBe(1)
  })

  test("B: duplicate endpoint, SAME keys -> cleanup contexts of both owners preserved via additionalLegacyOwners", () => {
    const merged = push.mergePushFanoutTargets([
      [fanoutTarget("SHARED", "K", "A", "e1")],
      [fanoutTarget("SHARED", "K", "A", "e2")],
    ])
    expect(merged[0].cleanup?.id).toBe("e1")
    expect(merged[0].cleanup?.additionalLegacyOwners?.map((o) => o.id)).toEqual(["e2"])
  })

  test("C: same-owner normalized+legacy union (resolveCorePushTargets) merged through mergePushFanoutTargets -> normalized authority untouched", async () => {
    normalizedByOwner.set(ownerKey("empleado", "e1", "default"), [
      { endpoint: EP("E1"), p256dh: "NORM_KEY", auth: "NORM_AUTH", expirationTime: null },
    ])
    const targets = await push.resolveCorePushTargets("empleado", "e1", sub("E1", "LEGACY_KEY", "LEGACY_AUTH"))
    const merged = push.mergePushFanoutTargets([targets])
    // Normalized already won inside resolveCorePushTargets (F1-F7) — merging
    // that single-owner list through mergePushFanoutTargets must not alter it.
    expect(merged.length).toBe(1)
    expect(merged).toEqual(targets)
  })

  test("D: duplicate endpoint, DIFFERENT keys, different owners -> endpoint conflicted, excluded from the wave", () => {
    const merged = push.mergePushFanoutTargets([
      [fanoutTarget("SHARED", "KEY_A", "AUTH_A", "e1")],
      [fanoutTarget("SHARED", "KEY_B", "AUTH_B", "e2")],
    ])
    expect(merged.length).toBe(0)
  })

  test("E/F: scenario D -> no normalized sweep / no DB delete attempted (conflict never reaches sendPushToTargets)", async () => {
    const merged = push.mergePushFanoutTargets([
      [fanoutTarget("SHARED", "KEY_A", "AUTH_A", "e1")],
      [fanoutTarget("SHARED", "KEY_B", "AUTH_B", "e2")],
    ])
    await push.sendPushToTargets(merged, { title: "t", body: "b" })
    expect(sweepCalls).toEqual([])
    expect(webpushCallLog).toEqual([])
  })

  test("G: scenario D -> no legacy CAS cleanup for either owner", async () => {
    legacyStore.empleado["e1"] = { pushSubscription: sub("SHARED", "KEY_A", "AUTH_A") }
    legacyStore.empleado["e2"] = { pushSubscription: sub("SHARED", "KEY_B", "AUTH_B") }
    const merged = push.mergePushFanoutTargets([
      [fanoutTarget("SHARED", "KEY_A", "AUTH_A", "e1")],
      [fanoutTarget("SHARED", "KEY_B", "AUTH_B", "e2")],
    ])
    await push.sendPushToTargets(merged, { title: "t", body: "b" })
    expect(legacyStore.empleado["e1"].pushSubscription).toBe(sub("SHARED", "KEY_A", "AUTH_A"))
    expect(legacyStore.empleado["e2"].pushSubscription).toBe(sub("SHARED", "KEY_B", "AUTH_B"))
  })

  test("H: scenario D plus a second healthy endpoint -> the healthy endpoint still sends", async () => {
    const merged = push.mergePushFanoutTargets([
      [fanoutTarget("SHARED", "KEY_A", "AUTH_A", "e1"), fanoutTarget("HEALTHY", "K", "A", "e1")],
      [fanoutTarget("SHARED", "KEY_B", "AUTH_B", "e2")],
    ])
    expect(merged.map((t) => t.endpoint).sort()).toEqual([EP("HEALTHY")])
    await push.sendPushToTargets(merged, { title: "t", body: "b" })
    expect(webpushCallLog).toEqual([EP("HEALTHY")])
  })

  test("I: scenario D -> the sanitized diagnostic never contains endpoint/key/owner material", () => {
    const originalWarn = console.warn
    const warnCalls: unknown[][] = []
    console.warn = (...args: unknown[]) => { warnCalls.push(args) }
    try {
      push.mergePushFanoutTargets([
        [fanoutTarget("SHARED", "KEY_A", "AUTH_A", "e1")],
        [fanoutTarget("SHARED", "KEY_B", "AUTH_B", "e2")],
      ])
    } finally {
      console.warn = originalWarn
    }
    expect(warnCalls.length).toBe(1)
    const serialized = warnCalls[0].map((a) => String(a)).join(" ")
    expect(serialized).not.toContain(EP("SHARED"))
    expect(serialized).not.toContain("KEY_A")
    expect(serialized).not.toContain("KEY_B")
    expect(serialized).not.toContain("AUTH_A")
    expect(serialized).not.toContain("AUTH_B")
    expect(serialized).not.toContain("e1")
    expect(serialized).not.toContain("e2")
  })

  test("J: conflict detected regardless of input order -> same result both ways", () => {
    const forward = push.mergePushFanoutTargets([
      [fanoutTarget("SHARED", "KEY_A", "AUTH_A", "e1")],
      [fanoutTarget("SHARED", "KEY_B", "AUTH_B", "e2")],
    ])
    const reversed = push.mergePushFanoutTargets([
      [fanoutTarget("SHARED", "KEY_B", "AUTH_B", "e2")],
      [fanoutTarget("SHARED", "KEY_A", "AUTH_A", "e1")],
    ])
    expect(forward.length).toBe(0)
    expect(reversed.length).toBe(0)
    expect(forward).toEqual(reversed)
  })

  test("a third duplicate with keys matching the FIRST owner does not resurrect an already-conflicted endpoint", () => {
    const merged = push.mergePushFanoutTargets([
      [fanoutTarget("SHARED", "KEY_A", "AUTH_A", "e1")],
      [fanoutTarget("SHARED", "KEY_B", "AUTH_B", "e2")],
      [fanoutTarget("SHARED", "KEY_A", "AUTH_A", "e3")],
    ])
    expect(merged.length).toBe(0)
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
      cleanupExpired: { model: "negocio", id: "n1", channel: "salon", field: "pushSubscriptionSalon" },
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
      cleanupExpired: { model: "negocio", id: "n1", channel: "salon", field: "pushSubscriptionSalon" },
      awaitPush: true,
    })
    expect(legacyStore.negocio["n1"].pushSubscriptionSalon).toBeNull()
    expect(legacyStore.negocio["n1"].pushSubscription).toBe(sub("PERSONAL_E1")) // untouched
  })

  test("P2-T05 Hardening H1 (F-P2-T05-19): field:\"pushSubscriptionSalon\" is a TypeScript compile error without channel:\"salon\" — the invariant is enforced by the type system, not just by convention", () => {
    // @ts-expect-error - field:"pushSubscriptionSalon" without channel:"salon" must not typecheck (SALON_FIELD_DEFAULT_CHANNEL_TYPE_STATE_REJECTED).
    const missingChannel: import("./push").PushSubscriptionCleanup = { model: "negocio", id: "n1", field: "pushSubscriptionSalon" }
    // @ts-expect-error - field:"pushSubscriptionSalon" with the WRONG explicit channel ("default") must also not typecheck.
    const wrongChannel: import("./push").PushSubscriptionCleanup = { model: "negocio", id: "n1", channel: "default", field: "pushSubscriptionSalon" }
    void missingChannel
    void wrongChannel
    expect(true).toBe(true)
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
