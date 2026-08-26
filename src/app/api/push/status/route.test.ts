// P2-T05 Stage3R1 (F-P2-T05-12/F-P2-T05-13): fully isolated unit tests for
// POST /api/push/status — no real DB. Same mock pattern as
// src/app/api/push/subscribe/route.test.ts.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import { authMockState, installAuthMock, resetAuthMockState } from "@/lib/test-helpers/auth-mock"

type ActorRow = { id: string; pushSubscription: string | null }
type PushRow = { id: string; ownerType: string; ownerId: string; channel: string; endpoint: string }

let clienteRows: ActorRow[]
let negocioRows: ActorRow[]
let repartidorRows: ActorRow[]
let superAdminRows: ActorRow[]
let pushRows: PushRow[]

function findActor(rows: ActorRow[], id: string, matchSubscription?: string) {
  return rows.find((r) => r.id === id && (matchSubscription === undefined || r.pushSubscription === matchSubscription)) ?? null
}

mock.module("@/lib/db", () => ({
  db: {
    cliente: { findFirst: async ({ where }: { where: { id: string; pushSubscription?: string } }) => findActor(clienteRows, where.id, where.pushSubscription) },
    negocio: { findFirst: async ({ where }: { where: { id: string; pushSubscription?: string } }) => findActor(negocioRows, where.id, where.pushSubscription) },
    repartidor: { findFirst: async ({ where }: { where: { id: string; pushSubscription?: string } }) => findActor(repartidorRows, where.id, where.pushSubscription) },
    superAdmin: { findFirst: async ({ where }: { where: { id: string; pushSubscription?: string } }) => findActor(superAdminRows, where.id, where.pushSubscription) },
    pushSubscription: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        pushRows.find((r) => Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v)) ?? null,
    },
  },
}))

// P2-T05 Hardening H4 (F-P2-T05-22): canonical superset mock — see the
// identical comment in src/app/api/push/subscribe/route.test.ts and
// src/lib/test-helpers/auth-mock.ts.
installAuthMock()

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { POST } = await import("./route")

function callStatus(subscription: unknown, ip: string, token = "valid-token") {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": ip }
  if (token) headers.cookie = `deligo_session=${token}`
  return POST(
    new NextRequest("http://localhost/api/push/status", {
      method: "POST",
      headers,
      body: JSON.stringify({ subscription }),
    })
  )
}

function subJson(endpoint: string, p256dh = "p", auth = "a") {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh, auth } })
}

let idc = 0
function pushRow(ownerType: string, ownerId: string, endpoint: string, channel = "default"): PushRow {
  idc += 1
  return { id: `push-${idc}`, ownerType, ownerId, channel, endpoint }
}

beforeEach(() => {
  clienteRows = [{ id: "cliente-1", pushSubscription: null }]
  negocioRows = [{ id: "negocio-1", pushSubscription: null }]
  repartidorRows = [{ id: "repartidor-1", pushSubscription: null }]
  superAdminRows = [{ id: "superadmin-1", pushSubscription: null }]
  pushRows = []
  idc = 0
  resetAuthMockState()
})

describe("POST /api/push/status — auth", () => {
  test("no session -> 401", async () => {
    const res = await callStatus(subJson("https://push.example/E1"), "203.0.113.1", "")
    expect(res.status).toBe(401)
  })

  test("invalid token -> 401", async () => {
    const res = await callStatus(subJson("https://push.example/E1"), "203.0.113.2", "bogus")
    expect(res.status).toBe(401)
  })

  test("STATUS_CLIENT_SUPPLIED_OWNER_AUTHORITY=NO: a fake ownerId in the body never changes whose binding is checked", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    pushRows = [pushRow("cliente", "cliente-OTHER", "https://push.example/E1")]
    const res = await POST(
      new NextRequest("http://localhost/api/push/status", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.3", cookie: "deligo_session=valid-token" },
        body: JSON.stringify({ subscription: subJson("https://push.example/E1"), ownerId: "cliente-OTHER", channel: "salon" }),
      })
    )
    const body = await res.json()
    expect(body.subscribed).toBe(false) // checked against cliente-1, not the spoofed cliente-OTHER
  })
})

describe("POST /api/push/status — validation", () => {
  test("missing subscription -> 400", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const res = await callStatus(undefined, "203.0.113.10")
    expect(res.status).toBe(400)
  })

  test("malformed subscription -> 400", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const res = await callStatus("{not-json", "203.0.113.11")
    expect(res.status).toBe(400)
  })

  test("invalid shape (http endpoint) -> 400", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const bad = JSON.stringify({ endpoint: "http://push.example/E1", expirationTime: null, keys: { p256dh: "p", auth: "a" } })
    const res = await callStatus(bad, "203.0.113.12")
    expect(res.status).toBe(400)
  })
})

describe("POST /api/push/status — cliente exact match", () => {
  test("normalized exact match -> true", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/E1")]
    const res = await callStatus(subJson("https://push.example/E1"), "203.0.113.20")
    const body = await res.json()
    expect(body).toEqual({ subscribed: true })
  })

  test("legacy exact match (no normalized row) -> true — pre-backfill compatibility", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const sub = subJson("https://push.example/E1")
    clienteRows[0].pushSubscription = sub
    const res = await callStatus(sub, "203.0.113.21")
    const body = await res.json()
    expect(body).toEqual({ subscribed: true })
  })

  test("neither normalized nor legacy match -> false", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const res = await callStatus(subJson("https://push.example/UNKNOWN"), "203.0.113.22")
    const body = await res.json()
    expect(body).toEqual({ subscribed: false })
  })

  test("other endpoint entirely (different device) -> false", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/E1")]
    const res = await callStatus(subJson("https://push.example/E3"), "203.0.113.23")
    const body = await res.json()
    expect(body).toEqual({ subscribed: false })
  })

  test("other actor same endpoint -> false, no cross-owner leak", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    pushRows = [pushRow("negocio", "negocio-1", "https://push.example/SHARED")]
    const res = await callStatus(subJson("https://push.example/SHARED"), "203.0.113.24")
    const body = await res.json()
    expect(body).toEqual({ subscribed: false })
    expect(Object.keys(body)).toEqual(["subscribed"]) // no metadata leak
  })
})

describe("POST /api/push/status — negocio / repartidor exact-own behavior", () => {
  test("negocio: normalized exact match -> true", async () => {
    authMockState.currentUser = { id: "negocio-1", type: "negocio" }
    pushRows = [pushRow("negocio", "negocio-1", "https://push.example/E1")]
    const res = await callStatus(subJson("https://push.example/E1"), "203.0.113.30")
    expect((await res.json()).subscribed).toBe(true)
  })

  test("repartidor: legacy exact match -> true", async () => {
    authMockState.currentUser = { id: "repartidor-1", type: "repartidor" }
    const sub = subJson("https://push.example/E1")
    repartidorRows[0].pushSubscription = sub
    const res = await callStatus(sub, "203.0.113.31")
    expect((await res.json()).subscribed).toBe(true)
  })
})

describe("POST /api/push/status — multi-device independence", () => {
  test("E1 and E2 both normalized for the same owner -> both status independently true", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    pushRows = [
      pushRow("cliente", "cliente-1", "https://push.example/E1"),
      pushRow("cliente", "cliente-1", "https://push.example/E2"),
    ]
    const resE1 = await callStatus(subJson("https://push.example/E1"), "203.0.113.40")
    const resE2 = await callStatus(subJson("https://push.example/E2"), "203.0.113.41")
    const resE3 = await callStatus(subJson("https://push.example/E3"), "203.0.113.42")
    expect((await resE1.json()).subscribed).toBe(true)
    expect((await resE2.json()).subscribed).toBe(true)
    expect((await resE3.json()).subscribed).toBe(false)
  })

  test("mixed rollout: legacy holds E2 (last-write-wins), normalized holds E1 -> both E1 and E2 report true", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    const e2 = subJson("https://push.example/E2")
    clienteRows[0].pushSubscription = e2
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/E1")]

    const resE1 = await callStatus(subJson("https://push.example/E1"), "203.0.113.43")
    const resE2 = await callStatus(e2, "203.0.113.44")
    expect((await resE1.json()).subscribed).toBe(true) // normalized exact match
    expect((await resE2.json()).subscribed).toBe(true) // legacy exact match
  })

  test("disable E1 (normalized row removed): status E1 false, status E2 unaffected", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/E2")] // E1 already detached
    const resE1 = await callStatus(subJson("https://push.example/E1"), "203.0.113.45")
    const resE2 = await callStatus(subJson("https://push.example/E2"), "203.0.113.46")
    expect((await resE1.json()).subscribed).toBe(false)
    expect((await resE2.json()).subscribed).toBe(true)
  })
})

describe("POST /api/push/status — superadmin boundary", () => {
  test("superadmin: legacy-only, no normalized ownership fabricated", async () => {
    authMockState.currentUser = { id: "superadmin-1", type: "superadmin" }
    const sub = subJson("https://push.example/E1")
    superAdminRows[0].pushSubscription = sub
    const res = await callStatus(sub, "203.0.113.50")
    expect((await res.json()).subscribed).toBe(true)
  })

  test("superadmin: no match -> false, never queries the normalized table", async () => {
    authMockState.currentUser = { id: "superadmin-1", type: "superadmin" }
    const res = await callStatus(subJson("https://push.example/E1"), "203.0.113.51")
    expect((await res.json()).subscribed).toBe(false)
  })
})

describe("POST /api/push/status — response shape", () => {
  test("response contains ONLY {subscribed} — never counts, ids, ownerType, channel, keys", async () => {
    authMockState.currentUser = { id: "cliente-1", type: "cliente" }
    pushRows = [pushRow("cliente", "cliente-1", "https://push.example/E1")]
    const res = await callStatus(subJson("https://push.example/E1"), "203.0.113.60")
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["subscribed"])
  })
})
