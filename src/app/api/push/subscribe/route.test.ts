// P2-T05 Stage3 (F-P2-T05-01/F-P0-03): fully isolated unit tests for
// POST /api/push/subscribe — no real DB. @/lib/db and @/lib/auth are
// replaced via mock.module before the route is imported (same pattern as
// src/app/api/operativo/mozo/panel/[slug]/push-subscription/route.test.ts).
// @/lib/rate-limit is real (pure, no I/O) — tests use distinct IPs to stay
// under the 10/min "push" bucket.
//
// The mocked db simulates a per-row store for cliente/negocio/repartidor/
// superAdmin PLUS a normalized push_subscriptions store, with an atomic
// $transaction (snapshot + rollback-on-throw) so SUBSCRIBE_PARTIAL_SUCCESS_
// ALLOWED=NO can be proven directly, not just asserted. Two independent call
// counters (singleton-level vs tx-level) prove the normalized write never
// escapes the transaction (NORMALIZED_WRITE_ESCAPES_TRANSACTION=NO).
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

type ActorRow = { id: string; pushSubscription: string | null }
type PushRow = {
  id: string
  ownerType: string
  ownerId: string
  channel: string
  endpoint: string
  p256dh: string
  auth: string
  expirationTime: Date | null
}

let clienteRows: ActorRow[]
let negocioRows: ActorRow[]
let repartidorRows: ActorRow[]
let superAdminRows: ActorRow[]
let pushRows: PushRow[]
let idCounter: number
let singletonUpsertCalls: number
let txUpsertCalls: number
let currentUser: { id: string; type: string } | null

function matchWhere(rows: ActorRow[], id: string) {
  return rows.find((r) => r.id === id)
}

function pushUpsertImpl(args: {
  where: { ownerType_ownerId_channel_endpoint: { ownerType: string; ownerId: string; channel: string; endpoint: string } }
  create: Omit<PushRow, "id">
  update: Partial<PushRow>
}) {
  const key = args.where.ownerType_ownerId_channel_endpoint
  const existing = pushRows.find(
    (r) => r.ownerType === key.ownerType && r.ownerId === key.ownerId && r.channel === key.channel && r.endpoint === key.endpoint
  )
  if (existing) {
    Object.assign(existing, args.update)
    return existing
  }
  idCounter += 1
  const row: PushRow = { id: `push-${idCounter}`, ...args.create }
  pushRows.push(row)
  return row
}

function makeClient(kind: "singleton" | "tx") {
  return {
    cliente: {
      update: async ({ where, data }: { where: { id: string }; data: { pushSubscription: string | null } }) => {
        const row = matchWhere(clienteRows, where.id)
        if (!row) throw new Error("cliente not found")
        row.pushSubscription = data.pushSubscription
        return row
      },
    },
    negocio: {
      update: async ({ where, data }: { where: { id: string }; data: { pushSubscription: string | null } }) => {
        const row = matchWhere(negocioRows, where.id)
        if (!row) throw new Error("negocio not found")
        row.pushSubscription = data.pushSubscription
        return row
      },
    },
    repartidor: {
      update: async ({ where, data }: { where: { id: string }; data: { pushSubscription: string | null } }) => {
        const row = matchWhere(repartidorRows, where.id)
        if (!row) throw new Error("repartidor not found")
        row.pushSubscription = data.pushSubscription
        return row
      },
    },
    superAdmin: {
      update: async ({ where, data }: { where: { id: string }; data: { pushSubscription: string | null } }) => {
        const row = matchWhere(superAdminRows, where.id)
        if (!row) throw new Error("superAdmin not found")
        row.pushSubscription = data.pushSubscription
        return row
      },
    },
    pushSubscription: {
      upsert: async (args: Parameters<typeof pushUpsertImpl>[0]) => {
        if (kind === "singleton") singletonUpsertCalls += 1
        else txUpsertCalls += 1
        return pushUpsertImpl(args)
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        pushRows.filter((r) => Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v)),
    },
  }
}

const singletonClient = makeClient("singleton")
const txClient = makeClient("tx")

mock.module("@/lib/db", () => ({
  db: {
    ...singletonClient,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const snapshot = {
        cliente: structuredClone(clienteRows),
        negocio: structuredClone(negocioRows),
        repartidor: structuredClone(repartidorRows),
        superAdmin: structuredClone(superAdminRows),
        push: structuredClone(pushRows),
      }
      try {
        return await fn(txClient)
      } catch (e) {
        clienteRows = snapshot.cliente
        negocioRows = snapshot.negocio
        repartidorRows = snapshot.repartidor
        superAdminRows = snapshot.superAdmin
        pushRows = snapshot.push
        throw e
      }
    },
  },
}))

// P2-T05 Stage3: @/lib/auth is mocked as a SUPERSET of every export any
// sibling push/operativo route test might need — Bun's mock.module patches
// the module registry process-wide, so when many test files run in the same
// `bun test` invocation, whichever file's mock loads last wins for ALL of
// them (same hazard already documented in the operativo salon/mozo panel
// route tests). Only SESSION_COOKIE_NAME/getUserFromToken are actually used
// by this route; the OPERATIONAL_* fields are inert stubs for cross-file
// safety.
mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME: "deligo_session",
  getUserFromToken: async (token: string) => (token === "valid-token" ? currentUser : null),
  OPERATIONAL_SESSION_COOKIE_NAME: "deligo_operativo_session",
  validateOperationalSession: async () => null,
  deleteOperationalSession: async () => {},
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { POST } = await import("./route")

function callSubscribe(subscription: unknown, ip: string, token = "valid-token") {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": ip }
  if (token) headers.cookie = `deligo_session=${token}`
  return POST(
    new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      headers,
      body: JSON.stringify({ subscription }),
    })
  )
}

const VALID_SUB_SHAPE = {
  endpoint: "https://push.example/E1",
  expirationTime: null,
  keys: { p256dh: "P256DH_1", auth: "AUTH_1" },
}
const VALID_SUB = JSON.stringify(VALID_SUB_SHAPE)

beforeEach(() => {
  clienteRows = [{ id: "cliente-1", pushSubscription: null }]
  negocioRows = [{ id: "negocio-1", pushSubscription: null }]
  repartidorRows = [{ id: "repartidor-1", pushSubscription: null }]
  superAdminRows = [{ id: "superadmin-1", pushSubscription: null }]
  pushRows = []
  idCounter = 0
  singletonUpsertCalls = 0
  txUpsertCalls = 0
  currentUser = null
})

describe("POST /api/push/subscribe — unified validation (F-P2-T05-01)", () => {
  test("B0: old valid client body still accepted", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const res = await callSubscribe(VALID_SUB, "203.0.113.1")
    expect(res.status).toBe(200)
  })

  test("rejects http:// endpoint", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const bad = JSON.stringify({ endpoint: "http://push.example/E1", expirationTime: null, keys: { p256dh: "p", auth: "a" } })
    const res = await callSubscribe(bad, "203.0.113.2")
    expect(res.status).toBe(400)
    expect(clienteRows[0].pushSubscription).toBeNull()
  })

  test("rejects empty p256dh", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const bad = JSON.stringify({ endpoint: "https://push.example/E1", expirationTime: null, keys: { p256dh: "", auth: "a" } })
    const res = await callSubscribe(bad, "203.0.113.3")
    expect(res.status).toBe(400)
  })

  test("rejects empty auth", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const bad = JSON.stringify({ endpoint: "https://push.example/E1", expirationTime: null, keys: { p256dh: "p", auth: "" } })
    const res = await callSubscribe(bad, "203.0.113.4")
    expect(res.status).toBe(400)
  })

  test("rejects invalid expirationTime", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const bad = JSON.stringify({ endpoint: "https://push.example/E1", expirationTime: "not-a-number", keys: { p256dh: "p", auth: "a" } })
    const res = await callSubscribe(bad, "203.0.113.5")
    expect(res.status).toBe(400)
  })

  test("accepts valid epoch expirationTime", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const ok = JSON.stringify({ endpoint: "https://push.example/E1", expirationTime: 1893456000000, keys: { p256dh: "p", auth: "a" } })
    const res = await callSubscribe(ok, "203.0.113.6")
    expect(res.status).toBe(200)
    expect(pushRows[0].expirationTime).toEqual(new Date(1893456000000))
  })
})

describe("POST /api/push/subscribe — atomic dual-write (F-P0-03)", () => {
  test("cliente: legacy + normalized write in the SAME transaction, never the singleton", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const res = await callSubscribe(VALID_SUB, "203.0.113.10")
    expect(res.status).toBe(200)

    expect(clienteRows[0].pushSubscription).toBe(VALID_SUB)
    expect(pushRows.length).toBe(1)
    expect(pushRows[0]).toMatchObject({ ownerType: "cliente", ownerId: "cliente-1", channel: "default", endpoint: "https://push.example/E1" })

    expect(txUpsertCalls).toBe(1)
    expect(singletonUpsertCalls).toBe(0) // NORMALIZED_WRITE_ESCAPES_TRANSACTION=NO
  })

  test("negocio: dual-write also works (spot-check second branch)", async () => {
    currentUser = { id: "negocio-1", type: "negocio" }
    const res = await callSubscribe(VALID_SUB, "203.0.113.11")
    expect(res.status).toBe(200)
    expect(negocioRows[0].pushSubscription).toBe(VALID_SUB)
    expect(pushRows[0].ownerType).toBe("negocio")
  })

  test("repartidor: dual-write also works (spot-check third branch)", async () => {
    currentUser = { id: "repartidor-1", type: "repartidor" }
    const res = await callSubscribe(VALID_SUB, "203.0.113.12")
    expect(res.status).toBe(200)
    expect(repartidorRows[0].pushSubscription).toBe(VALID_SUB)
    expect(pushRows[0].ownerType).toBe("repartidor")
  })

  test("multi-device: E1 then E2 for the same cliente — both normalized rows coexist, legacy is last-write-wins E2", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    await callSubscribe(VALID_SUB, "203.0.113.13")
    const sub2 = JSON.stringify({ endpoint: "https://push.example/E2", expirationTime: null, keys: { p256dh: "p2", auth: "a2" } })
    await callSubscribe(sub2, "203.0.113.14")

    expect(pushRows.length).toBe(2)
    expect(pushRows.map((r) => r.endpoint).sort()).toEqual(["https://push.example/E1", "https://push.example/E2"])
    expect(clienteRows[0].pushSubscription).toBe(sub2) // LEGACY_LAST_WRITE_WINS_PRESERVED
  })

  test("superadmin: legacy-only, SUPERADMIN_NORMALIZED_WRITE_ATTEMPTED=NO", async () => {
    currentUser = { id: "superadmin-1", type: "superadmin" }
    const res = await callSubscribe(VALID_SUB, "203.0.113.15")
    expect(res.status).toBe(200)
    expect(superAdminRows[0].pushSubscription).toBe(VALID_SUB)
    expect(pushRows.length).toBe(0)
    expect(singletonUpsertCalls).toBe(0)
    expect(txUpsertCalls).toBe(0)
  })

  test("CLIENT_SUPPLIED_OWNER_AUTHORITY=NO: a fake ownerId/negocioId in the body never changes the server-derived owner", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const body = { subscription: VALID_SUB, ownerId: "attacker-controlled", negocioId: "attacker-controlled", channel: "salon" }
    const res = await POST(
      new NextRequest("http://localhost/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.16", cookie: "deligo_session=valid-token" },
        body: JSON.stringify(body),
      })
    )
    expect(res.status).toBe(200)
    expect(pushRows[0].ownerId).toBe("cliente-1")
    expect(pushRows[0].channel).toBe("default")
  })
})

describe("POST /api/push/subscribe — atomicity: no partial dual-write", () => {
  test("if the normalized write throws, the legacy write rolls back too (SUBSCRIBE_PARTIAL_SUCCESS_ALLOWED=NO)", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    // Empty ownerId makes registerPushSubscription's own validation throw
    // (assertValidOwner) — simulates the normalized write failing mid-tx.
    currentUser = { id: "", type: "cliente" }
    clienteRows = [{ id: "", pushSubscription: null }]

    const res = await callSubscribe(VALID_SUB, "203.0.113.20")
    expect(res.status).toBe(500)
    expect(clienteRows[0].pushSubscription).toBeNull() // rolled back
    expect(pushRows.length).toBe(0)
  })
})

describe("POST /api/push/subscribe — parsed object input (P2-T05 Stage3H3, F-P2-T05-16)", () => {
  test("H3-A: raw string input — legacy write receives EXACTLY the same raw string (regression baseline, unchanged)", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const res = await callSubscribe(VALID_SUB, "203.0.113.40")
    expect(res.status).toBe(200)
    expect(clienteRows[0].pushSubscription).toBe(VALID_SUB)
    expect(typeof clienteRows[0].pushSubscription).toBe("string")
  })

  test("H3-B: cliente + parsed object — 200, legacy write receives a string (never the object), normalized write occurs, same tx", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const res = await callSubscribe(VALID_SUB_SHAPE, "203.0.113.41")
    expect(res.status).toBe(200)

    expect(typeof clienteRows[0].pushSubscription).toBe("string")
    expect(JSON.parse(clienteRows[0].pushSubscription as string)).toEqual(VALID_SUB_SHAPE)

    expect(pushRows.length).toBe(1)
    expect(pushRows[0]).toMatchObject({ ownerType: "cliente", ownerId: "cliente-1", channel: "default", endpoint: VALID_SUB_SHAPE.endpoint })
    expect(txUpsertCalls).toBe(1)
    expect(singletonUpsertCalls).toBe(0)
  })

  test("H3-C: negocio + parsed object — 200, legacy write receives a string", async () => {
    currentUser = { id: "negocio-1", type: "negocio" }
    const res = await callSubscribe(VALID_SUB_SHAPE, "203.0.113.42")
    expect(res.status).toBe(200)
    expect(typeof negocioRows[0].pushSubscription).toBe("string")
    expect(pushRows[0].ownerType).toBe("negocio")
  })

  test("H3-D: repartidor + parsed object — 200, legacy write receives a string", async () => {
    currentUser = { id: "repartidor-1", type: "repartidor" }
    const res = await callSubscribe(VALID_SUB_SHAPE, "203.0.113.43")
    expect(res.status).toBe(200)
    expect(typeof repartidorRows[0].pushSubscription).toBe("string")
    expect(pushRows[0].ownerType).toBe("repartidor")
  })

  test("H3-E: superadmin + parsed object — 200, legacy-only, legacy value is a string, SUPERADMIN_NORMALIZED_WRITE_ATTEMPTED=NO", async () => {
    currentUser = { id: "superadmin-1", type: "superadmin" }
    const res = await callSubscribe(VALID_SUB_SHAPE, "203.0.113.44")
    expect(res.status).toBe(200)
    expect(typeof superAdminRows[0].pushSubscription).toBe("string")
    expect(pushRows.length).toBe(0)
    expect(singletonUpsertCalls).toBe(0)
    expect(txUpsertCalls).toBe(0)
  })

  test("H3-F: extra properties on the parsed object never govern owner/channel and never leak into the legacy canonical string", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const withExtras = { ...VALID_SUB_SHAPE, ownerId: "attacker-controlled", channel: "salon", extra: "junk" }
    const res = await callSubscribe(withExtras, "203.0.113.45")
    expect(res.status).toBe(200)

    expect(pushRows[0].ownerId).toBe("cliente-1")
    expect(pushRows[0].channel).toBe("default")

    const stored = JSON.parse(clienteRows[0].pushSubscription as string)
    expect(stored).toEqual(VALID_SUB_SHAPE)
    expect(stored.ownerId).toBeUndefined()
    expect(stored.channel).toBeUndefined()
    expect(stored.extra).toBeUndefined()
  })

  test("H3-G: malformed object (invalid endpoint) — fail-closed 400, no DB write, unchanged from string-input behavior", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const bad = { endpoint: "http://push.example/E1", expirationTime: null, keys: { p256dh: "p", auth: "a" } }
    const res = await callSubscribe(bad, "203.0.113.46")
    expect(res.status).toBe(400)
    expect(clienteRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
  })

  test("H3-H: normalized write failure rolls back the object-derived legacy write too (same atomicity guarantee as string input)", async () => {
    currentUser = { id: "", type: "cliente" }
    clienteRows = [{ id: "", pushSubscription: null }]
    const res = await callSubscribe(VALID_SUB_SHAPE, "203.0.113.47")
    expect(res.status).toBe(500)
    expect(clienteRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
  })
})

describe("POST /api/push/subscribe — auth unchanged", () => {
  test("no session cookie -> 401, no writes", async () => {
    const res = await callSubscribe(VALID_SUB, "203.0.113.30", "")
    expect(res.status).toBe(401)
    expect(pushRows.length).toBe(0)
  })

  test("invalid token -> 401, no writes", async () => {
    const res = await callSubscribe(VALID_SUB, "203.0.113.31", "bogus-token")
    expect(res.status).toBe(401)
    expect(pushRows.length).toBe(0)
  })
})
