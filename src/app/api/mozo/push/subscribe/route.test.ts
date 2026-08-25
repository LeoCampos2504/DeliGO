// P2-T05 Stage3 (F-P2-T05-01/F-P0-03): fully isolated unit tests for
// POST /api/mozo/push/subscribe — no real DB. Same mock pattern as
// src/app/api/push/subscribe/route.test.ts. @/lib/area-operativa and
// @/lib/rate-limit are real (pure, no I/O), matching this route's own
// dependency shape (same as mozo/push/unsubscribe/route.test.ts).
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

type EmpleadoRow = {
  id: string
  token: string
  activo: boolean
  eliminado: boolean
  rol: string
  areaOperativa: string
  pushSubscription: string | null
}
type PushRow = {
  id: string
  ownerType: string
  ownerId: string
  channel: string
  endpoint: string
  p256dh: string
  auth: string
}

let empleadoRows: EmpleadoRow[]
let pushRows: PushRow[]
let idCounter: number
let singletonUpsertCalls: number
let txUpsertCalls: number

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
    empleado: {
      findFirst: async ({ where }: { where: { token: string; activo: boolean; eliminado: boolean } }) => {
        const row = empleadoRows.find((r) => r.token === where.token && r.activo === where.activo && r.eliminado === where.eliminado)
        if (!row) return null
        return { id: row.id, rol: row.rol, areaOperativa: row.areaOperativa }
      },
      update: async ({ where, data }: { where: { id: string }; data: { pushSubscription: string | null } }) => {
        const row = empleadoRows.find((r) => r.id === where.id)
        if (!row) throw new Error("empleado not found")
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

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { POST } = await import("./route")

function callSubscribe(body: unknown, ip: string) {
  return POST(
    new NextRequest("http://localhost/api/mozo/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    })
  )
}

const VALID_SUB = JSON.stringify({
  endpoint: "https://push.example/E1",
  expirationTime: null,
  keys: { p256dh: "P1", auth: "A1" },
})

beforeEach(() => {
  empleadoRows = [
    { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "mozo", areaOperativa: "mozo", pushSubscription: null },
  ]
  pushRows = []
  idCounter = 0
  singletonUpsertCalls = 0
  txUpsertCalls = 0
})

describe("POST /api/mozo/push/subscribe — unified validation + dual-write (Stage3)", () => {
  test("valid body -> 200, legacy + normalized dual-write in the same transaction", async () => {
    const res = await callSubscribe({ mozoToken: "tok-a", subscription: VALID_SUB }, "198.51.100.20")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(empleadoRows[0].pushSubscription).toBe(VALID_SUB) // LEGACY_STORAGE_FORMAT_CHANGED=NO (raw string)
    expect(pushRows.length).toBe(1)
    expect(pushRows[0]).toMatchObject({ ownerType: "empleado", ownerId: "empleado-1", channel: "default", endpoint: "https://push.example/E1" })
    expect(txUpsertCalls).toBe(1)
    expect(singletonUpsertCalls).toBe(0) // NORMALIZED_WRITE_ESCAPES_TRANSACTION=NO
  })

  test("LEGACY_MOZO_CLIENT_BODY_CHANGED=NO: unchanged body shape from /m/[token] still works", async () => {
    // Exact shape sent today by src/app/m/[token]/page.tsx.
    const res = await callSubscribe({ mozoToken: "tok-a", subscription: VALID_SUB }, "198.51.100.21")
    expect(res.status).toBe(200)
  })

  test("rejects http:// endpoint (unified validation)", async () => {
    const bad = JSON.stringify({ endpoint: "http://push.example/E1", expirationTime: null, keys: { p256dh: "p", auth: "a" } })
    const res = await callSubscribe({ mozoToken: "tok-a", subscription: bad }, "198.51.100.22")
    expect(res.status).toBe(400)
    expect(empleadoRows[0].pushSubscription).toBeNull()
    expect(pushRows.length).toBe(0)
  })

  test("rejects empty p256dh/auth", async () => {
    const bad = JSON.stringify({ endpoint: "https://push.example/E1", expirationTime: null, keys: { p256dh: "", auth: "a" } })
    const res = await callSubscribe({ mozoToken: "tok-a", subscription: bad }, "198.51.100.23")
    expect(res.status).toBe(400)
  })

  test("rejects invalid expirationTime", async () => {
    const bad = JSON.stringify({ endpoint: "https://push.example/E1", expirationTime: "nope", keys: { p256dh: "p", auth: "a" } })
    const res = await callSubscribe({ mozoToken: "tok-a", subscription: bad }, "198.51.100.24")
    expect(res.status).toBe(400)
  })

  test("invalid mozoToken -> 401, no writes, empleadoId never derives from body", async () => {
    const res = await callSubscribe({ mozoToken: "not-real", subscription: VALID_SUB }, "198.51.100.25")
    expect(res.status).toBe(401)
    expect(pushRows.length).toBe(0)
  })

  test("CLIENT_SUPPLIED_OWNER_AUTHORITY=NO: a fake empleadoId in the body never changes the server-derived owner", async () => {
    const res = await callSubscribe(
      { mozoToken: "tok-a", subscription: VALID_SUB, empleadoId: "attacker-controlled", channel: "salon" },
      "198.51.100.26"
    )
    expect(res.status).toBe(200)
    expect(pushRows[0].ownerId).toBe("empleado-1")
    expect(pushRows[0].channel).toBe("default")
  })

  test("non-mozo area token -> 401, unchanged guard, no writes", async () => {
    empleadoRows = [
      { id: "empleado-1", token: "tok-a", activo: true, eliminado: false, rol: "salon", areaOperativa: "salon", pushSubscription: null },
    ]
    const res = await callSubscribe({ mozoToken: "tok-a", subscription: VALID_SUB }, "198.51.100.27")
    expect(res.status).toBe(401)
    expect(pushRows.length).toBe(0)
  })
})
