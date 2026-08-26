// Logout-B1 (P0 rollout-safe Phase O1): fully isolated unit tests for
// POST /api/operativo/logout — no real DB, no real Railway secret. @/lib/auth
// and @/lib/db are replaced via mock.module before the route is imported
// (same pattern as src/app/api/repartidor/ubicacion/route.test.ts).
//
// The mocked db.empleado.updateMany simulates a real per-row store so tests
// can prove actual multi-device/multi-account behavior (a different device's
// or a different account's stored subscription survives), not just assert on
// call arguments.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import { authMockHooks, authMockState, installAuthMock, resetAuthMockState } from "@/lib/test-helpers/auth-mock"

type EmpleadoRow = {
  id: string
  cuentaOperativaId: string
  pushSubscription: string | null
}
type PushRow = { id: string; ownerType: string; ownerId: string; channel: string; endpoint: string }

let empleadoRows: EmpleadoRow[]
let updateManyCalls: Array<{ where: Record<string, unknown> }>
let updateManyThrows: Error | null
let callOrder: string[]
let pushRows: PushRow[]
let pushDeleteManyCalls: number
let transactionThrows: Error | null

function pushDeleteManyImpl(where: Record<string, unknown>) {
  pushDeleteManyCalls += 1
  const before = pushRows.length
  pushRows = pushRows.filter((r) => !Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
  return { count: before - pushRows.length }
}

const txClient = {
  empleado: {
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { pushSubscription: string | null } }) => {
      updateManyCalls.push({ where })
      callOrder.push("push-detach")
      if (updateManyThrows) throw updateManyThrows
      let count = 0
      for (const row of empleadoRows) {
        if (
          row.cuentaOperativaId === where.cuentaOperativaId &&
          row.pushSubscription === where.pushSubscription
        ) {
          row.pushSubscription = data.pushSubscription
          count += 1
        }
      }
      return { count }
    },
    findMany: async ({ where }: { where: { cuentaOperativaId: string } }) =>
      empleadoRows.filter((r) => r.cuentaOperativaId === where.cuentaOperativaId).map((r) => ({ id: r.id })),
  },
  pushSubscription: {
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => pushDeleteManyImpl(where),
  },
}

mock.module("@/lib/db", () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      if (transactionThrows) throw transactionThrows
      return fn(txClient)
    },
  },
}))

// P2-T05 Hardening H4 (F-P2-T05-22): canonical superset mock, shared with
// the other six Push-related test files — see src/lib/test-helpers/auth-mock.ts
// for why a per-file partial mock.module("@/lib/auth", ...) is unsafe. This
// file additionally needs to prove call-ORDERING against its own push-detach
// mock (see `callOrder` below) — `authMockHooks.onDeleteOperationalSession`
// is a shared, mutable singleton field for exactly that, so this file never
// needs a second, competing `mock.module("@/lib/auth", ...)` registration.
installAuthMock()

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { POST } = await import("./route")

function buildRequest(body?: unknown, opts?: { rawBody?: string; noCookie?: boolean; token?: string }) {
  const headers: Record<string, string> = {}
  if (!opts?.noCookie) headers.cookie = `deligo_operativo_session=${opts?.token ?? "fake-token"}`
  let requestBody: string | undefined
  if (opts?.rawBody !== undefined) {
    headers["content-type"] = "application/json"
    requestBody = opts.rawBody
  } else if (body !== undefined) {
    headers["content-type"] = "application/json"
    requestBody = JSON.stringify(body)
  }
  return new NextRequest("http://localhost/api/operativo/logout", { method: "POST", headers, body: requestBody })
}

beforeEach(() => {
  empleadoRows = []
  resetAuthMockState()
  updateManyCalls = []
  updateManyThrows = null
  callOrder = []
  authMockHooks.onDeleteOperationalSession = (_token) => {
    callOrder.push("session-delete")
  }
  pushRows = []
  pushDeleteManyCalls = 0
  transactionThrows = null
})

let pushIdCounter = 0
function pushRow(ownerId: string, endpoint: string): PushRow {
  pushIdCounter += 1
  return { id: `push-${pushIdCounter}`, ownerType: "empleado", ownerId, channel: "default", endpoint }
}
function subJson(endpoint: string) {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh: "p", auth: "a" } })
}

describe("POST /api/operativo/logout — exact-match push detach (Logout-B1)", () => {
  test("exact match: cuentaOperativaId=A + subscription=EA clears matching rows, logout still succeeds", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    empleadoRows = [
      { id: "empleado-1", cuentaOperativaId: "cuenta-a", pushSubscription: "EA" },
      { id: "empleado-2", cuentaOperativaId: "cuenta-a", pushSubscription: "EA" },
    ]

    const res = await POST(buildRequest({ subscription: "EA" }, { token: "tok-a" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(updateManyCalls.length).toBe(1)
    expect(updateManyCalls[0].where).toEqual({ cuentaOperativaId: "cuenta-a", pushSubscription: "EA" })
    expect(empleadoRows[0].pushSubscription).toBeNull()
    expect(empleadoRows[1].pushSubscription).toBeNull()
    expect(authMockState.deletedOperationalSessionTokens).toEqual(["tok-a"])
  })

  test("DEVICE_A_CANNOT_CLEAR_EB: other device's stored subscription under the SAME account is preserved", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    empleadoRows = [{ id: "empleado-1", cuentaOperativaId: "cuenta-a", pushSubscription: "EB" }]

    const res = await POST(buildRequest({ subscription: "EA" }, { token: "tok-a" }))
    expect(res.status).toBe(200)
    expect(updateManyCalls[0].where).toEqual({ cuentaOperativaId: "cuenta-a", pushSubscription: "EA" })
    expect(empleadoRows[0].pushSubscription).toBe("EB")
  })

  test("different account: subscription S under account B is never targeted by account A's logout", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    empleadoRows = [{ id: "empleado-b1", cuentaOperativaId: "cuenta-b", pushSubscription: "S" }]

    const res = await POST(buildRequest({ subscription: "S" }, { token: "tok-a" }))
    expect(res.status).toBe(200)
    expect(updateManyCalls[0].where.cuentaOperativaId).toBe("cuenta-a")
    expect(empleadoRows[0].pushSubscription).toBe("S")
  })

  test("no body (old client): logout still succeeds, push updateMany is never called", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })

    const res = await POST(buildRequest(undefined, { token: "tok-a" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(updateManyCalls.length).toBe(0)
    expect(authMockState.deletedOperationalSessionTokens).toEqual(["tok-a"])
  })

  test("malformed JSON body: logout continues, no push update attempted", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })

    const res = await POST(buildRequest(undefined, { rawBody: "{not-json", token: "tok-a" }))
    expect(res.status).toBe(200)
    expect(updateManyCalls.length).toBe(0)
    expect(authMockState.deletedOperationalSessionTokens).toEqual(["tok-a"])
  })

  test("wrong-type / empty subscription: logout continues, no push update attempted", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })

    const resNumber = await POST(buildRequest({ subscription: 12345 }, { token: "tok-a" }))
    expect(resNumber.status).toBe(200)
    const resEmpty = await POST(buildRequest({ subscription: "   " }, { token: "tok-a" }))
    expect(resEmpty.status).toBe(200)

    expect(updateManyCalls.length).toBe(0)
    expect(authMockState.deletedOperationalSessionTokens).toEqual(["tok-a", "tok-a"])
  })

  test("push detach DB failure: session deletion still executes, logout response unchanged", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    updateManyThrows = new Error("simulated DB failure")

    const res = await POST(buildRequest({ subscription: "EA" }, { token: "tok-a" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(authMockState.deletedOperationalSessionTokens).toEqual(["tok-a"])
  })

  test("ordering: push detach is attempted before the operational session is deleted", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    empleadoRows = [{ id: "empleado-1", cuentaOperativaId: "cuenta-a", pushSubscription: "EA" }]

    await POST(buildRequest({ subscription: "EA" }, { token: "tok-a" }))
    expect(callOrder).toEqual(["push-detach", "session-delete"])
  })

  test("no cookie: logout still succeeds (idempotent), no session/push calls attempted", async () => {
    const res = await POST(buildRequest(undefined, { noCookie: true }))
    expect(res.status).toBe(200)
    expect(updateManyCalls.length).toBe(0)
    expect(authMockState.deletedOperationalSessionTokens.length).toBe(0)
  })

  test("invalid/expired session token: logout still succeeds, no push detach attempted (no server-derived account available)", async () => {
    // no entry for "tok-invalid" in authMockState.operationalSessionByToken -> validateOperationalSession returns null
    const res = await POST(buildRequest({ subscription: "EA" }, { token: "tok-invalid" }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(updateManyCalls.length).toBe(0)
    expect(authMockState.deletedOperationalSessionTokens).toEqual(["tok-invalid"])
  })
})

describe("POST /api/operativo/logout — normalized cleanup, multi-device safe (Stage3 §19)", () => {
  test("stale device: normalized E1 detached even though legacy already holds newer E2 (own binding cleared without requiring legacy match)", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    const e1 = subJson("https://push.example/E1")
    const e2 = subJson("https://push.example/E2")
    empleadoRows = [{ id: "empleado-1", cuentaOperativaId: "cuenta-a", pushSubscription: e2 }]
    pushRows = [pushRow("empleado-1", "https://push.example/E1"), pushRow("empleado-1", "https://push.example/E2")]

    const res = await POST(buildRequest({ subscription: e1 }, { token: "tok-a" }))
    expect(res.status).toBe(200)
    expect(empleadoRows[0].pushSubscription).toBe(e2) // legacy untouched
    expect(pushRows.map((r) => r.endpoint)).toEqual(["https://push.example/E2"]) // E1 gone
  })

  test("multiple Empleado under the same cuentaOperativaId: only the one holding this endpoint loses its row", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    const e1 = subJson("https://push.example/E1")
    empleadoRows = [
      { id: "empleado-1", cuentaOperativaId: "cuenta-a", pushSubscription: null },
      { id: "empleado-2", cuentaOperativaId: "cuenta-a", pushSubscription: null },
    ]
    pushRows = [pushRow("empleado-2", "https://push.example/E1")]

    await POST(buildRequest({ subscription: e1 }, { token: "tok-a" }))
    expect(pushRows.length).toBe(0)
  })

  test("never touches another cuentaOperativaId's normalized binding, even on the same endpoint", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    const shared = subJson("https://push.example/SHARED")
    empleadoRows = [
      { id: "empleado-1", cuentaOperativaId: "cuenta-a", pushSubscription: shared },
      { id: "empleado-b1", cuentaOperativaId: "cuenta-b", pushSubscription: null },
    ]
    pushRows = [pushRow("empleado-1", "https://push.example/SHARED"), pushRow("empleado-b1", "https://push.example/SHARED")]

    await POST(buildRequest({ subscription: shared }, { token: "tok-a" }))
    expect(pushRows.length).toBe(1)
    expect(pushRows[0].ownerId).toBe("empleado-b1")
  })

  test("OPERATIVE_LOGOUT_FAILURE_BLOCKS_LOGOUT=NO: normalized cleanup throwing still lets logout proceed", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    empleadoRows = [{ id: "empleado-1", cuentaOperativaId: "cuenta-a", pushSubscription: null }]
    transactionThrows = new Error("simulated transaction failure")

    const res = await POST(buildRequest({ subscription: subJson("https://push.example/E1") }, { token: "tok-a" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(authMockState.deletedOperationalSessionTokens).toEqual(["tok-a"])
  })

  test("no endpoint extractable (malformed subscription payload that still parses as valid JSON string): legacy path still runs, no crash", async () => {
    authMockState.operationalSessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    empleadoRows = [{ id: "empleado-1", cuentaOperativaId: "cuenta-a", pushSubscription: "EA" }]

    const res = await POST(buildRequest({ subscription: "EA" }, { token: "tok-a" }))
    expect(res.status).toBe(200)
    expect(pushDeleteManyCalls).toBe(0) // no endpoint could be extracted from "EA" -> normalized detach skipped
  })
})

test("resetAuthMockState clears a previously installed logout hook before the next test", () => {
  const oldHookCalls: string[] = []
  authMockHooks.onDeleteOperationalSession = () => {
    oldHookCalls.push("old-hook")
  }

  resetAuthMockState()
  expect(authMockHooks.onDeleteOperationalSession).toBeUndefined()

  authMockHooks.onDeleteOperationalSession?.("token-after-reset")
  expect(oldHookCalls).toEqual([])
})
