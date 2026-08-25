// P2-T05 Stage3 (F-P2-T05-03): fully isolated unit tests for
// POST /api/push/unsubscribe — no real DB. Same mock pattern as
// src/app/api/push/subscribe/route.test.ts, extended with a normalized
// push_subscriptions store that supports exact-match deleteMany (mirroring
// detachPushSubscriptionByEndpoint's real query shape).
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
}

let clienteRows: ActorRow[]
let negocioRows: ActorRow[]
let pushRows: PushRow[]
let idCounter: number
let singletonDeleteManyCalls: number
let txDeleteManyCalls: number
let currentUser: { id: string; type: string } | null

function matchWhere(rows: ActorRow[], id: string, pushSubscription?: string) {
  return rows.find((r) => r.id === id && (pushSubscription === undefined || r.pushSubscription === pushSubscription))
}

function pushDeleteManyImpl(where: Record<string, unknown>) {
  const before = pushRows.length
  pushRows = pushRows.filter((r) => !Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
  return { count: before - pushRows.length }
}

function makeClient(kind: "singleton" | "tx") {
  return {
    cliente: {
      updateMany: async ({ where, data }: { where: { id: string; pushSubscription: string }; data: { pushSubscription: string | null } }) => {
        const row = matchWhere(clienteRows, where.id, where.pushSubscription)
        if (!row) return { count: 0 }
        row.pushSubscription = data.pushSubscription
        return { count: 1 }
      },
    },
    negocio: {
      updateMany: async ({ where, data }: { where: { id: string; pushSubscription: string }; data: { pushSubscription: string | null } }) => {
        const row = matchWhere(negocioRows, where.id, where.pushSubscription)
        if (!row) return { count: 0 }
        row.pushSubscription = data.pushSubscription
        return { count: 1 }
      },
    },
    pushSubscription: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (kind === "singleton") singletonDeleteManyCalls += 1
        else txDeleteManyCalls += 1
        return pushDeleteManyImpl(where)
      },
    },
  }
}

const singletonClient = makeClient("singleton")
const txClient = makeClient("tx")

mock.module("@/lib/db", () => ({
  db: {
    ...singletonClient,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient),
  },
}))

// P2-T05 Stage3: superset mock — see the identical comment in
// src/app/api/push/subscribe/route.test.ts for why.
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

function callUnsubscribe(subscription: unknown, ip: string) {
  return POST(
    new NextRequest("http://localhost/api/push/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip, cookie: "deligo_session=valid-token" },
      body: JSON.stringify({ subscription }),
    })
  )
}

function subJson(endpoint: string, p256dh = "p", auth = "a") {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh, auth } })
}

let idc = 0
function pushRow(ownerType: string, ownerId: string, endpoint: string): PushRow {
  idc += 1
  return { id: `push-${idc}`, ownerType, ownerId, channel: "default", endpoint, p256dh: "p", auth: "a" }
}

beforeEach(() => {
  clienteRows = [{ id: "cliente-1", pushSubscription: null }]
  negocioRows = [{ id: "negocio-1", pushSubscription: null }]
  pushRows = []
  idCounter = 0
  idc = 0
  singletonDeleteManyCalls = 0
  txDeleteManyCalls = 0
  currentUser = null
})

describe("POST /api/push/unsubscribe — multi-device stale-device semantics (§17)", () => {
  test("stale device E1 detaches its own normalized row without requiring legacy exact-match", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const e1 = subJson("https://push.example/E1")
    const e2 = subJson("https://push.example/E2")
    clienteRows[0].pushSubscription = e2 // legacy currently holds the NEWER device (last-write-wins)
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/E1"), pushRow("cliente", "cliente-1", "https://push.example/E2")]

    const res = await callUnsubscribe(e1, "203.0.113.40")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true }) // normalizedRemoved=true even though legacy didn't match
    expect(clienteRows[0].pushSubscription).toBe(e2) // STALE_DEVICE_CAN_CLEAR_NEWER_LEGACY_BINDING=NO
    expect(pushRows.map((r) => r.endpoint)).toEqual(["https://push.example/E2"]) // E1 gone, E2 survives
  })

  test("cross-actor: unsubscribe from A never touches B's binding on the same endpoint", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const shared = subJson("https://push.example/SHARED")
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/SHARED"), pushRow("negocio", "negocio-1", "https://push.example/SHARED")]

    const res = await callUnsubscribe(shared, "203.0.113.41")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.removed).toBe(true)
    expect(pushRows.length).toBe(1)
    expect(pushRows[0].ownerType).toBe("negocio") // B's binding survives untouched
  })

  test("both legacy and normalized removed in the same transaction, never the singleton", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const e1 = subJson("https://push.example/E1")
    clienteRows[0].pushSubscription = e1
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/E1")]

    const res = await callUnsubscribe(e1, "203.0.113.42")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(clienteRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
    expect(txDeleteManyCalls).toBe(1)
    expect(singletonDeleteManyCalls).toBe(0) // NORMALIZED_WRITE_ESCAPES_TRANSACTION=NO
  })

  test("no subscription in body -> removed:false, no writes (unchanged legacy contract)", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const res = await callUnsubscribe(undefined, "203.0.113.43")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
    expect(pushRows.length).toBe(0)
  })

  test("neither legacy nor normalized match -> removed:false", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const other = subJson("https://push.example/UNKNOWN")
    const res = await callUnsubscribe(other, "203.0.113.44")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
  })

  test("USER_UNSUBSCRIBE_CAN_CALL_GLOBAL_DEAD_ENDPOINT_SWEEP=NO: only the caller's own owner scope is ever touched", async () => {
    currentUser = { id: "cliente-1", type: "cliente" }
    const shared = subJson("https://push.example/SHARED")
    pushRows = [
      pushRow("cliente", "cliente-1", "https://push.example/SHARED"),
      pushRow("cliente", "cliente-OTHER", "https://push.example/SHARED"),
      pushRow("negocio", "negocio-1", "https://push.example/SHARED"),
    ]
    await callUnsubscribe(shared, "203.0.113.45")
    expect(pushRows.length).toBe(2) // only cliente-1's own row is gone
    expect(pushRows.some((r) => r.ownerId === "cliente-OTHER")).toBe(true)
    expect(pushRows.some((r) => r.ownerType === "negocio")).toBe(true)
  })
})
