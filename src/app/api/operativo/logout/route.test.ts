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

type EmpleadoRow = {
  id: string
  cuentaOperativaId: string
  pushSubscription: string | null
}

let empleadoRows: EmpleadoRow[]
let sessionByToken: Map<string, { cuentaOperativaId: string } | null>
let deletedSessionTokens: string[]
let updateManyCalls: Array<{ where: Record<string, unknown> }>
let updateManyThrows: Error | null
let callOrder: string[]

mock.module("@/lib/db", () => ({
  db: {
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
    },
  },
}))

mock.module("@/lib/auth", () => ({
  OPERATIONAL_SESSION_COOKIE_NAME: "deligo_operativo_session",
  validateOperationalSession: async (token: string) => sessionByToken.get(token) ?? null,
  deleteOperationalSession: async (token: string) => {
    deletedSessionTokens.push(token)
    callOrder.push("session-delete")
  },
}))

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
  sessionByToken = new Map()
  deletedSessionTokens = []
  updateManyCalls = []
  updateManyThrows = null
  callOrder = []
})

describe("POST /api/operativo/logout — exact-match push detach (Logout-B1)", () => {
  test("exact match: cuentaOperativaId=A + subscription=EA clears matching rows, logout still succeeds", async () => {
    sessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
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
    expect(deletedSessionTokens).toEqual(["tok-a"])
  })

  test("DEVICE_A_CANNOT_CLEAR_EB: other device's stored subscription under the SAME account is preserved", async () => {
    sessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    empleadoRows = [{ id: "empleado-1", cuentaOperativaId: "cuenta-a", pushSubscription: "EB" }]

    const res = await POST(buildRequest({ subscription: "EA" }, { token: "tok-a" }))
    expect(res.status).toBe(200)
    expect(updateManyCalls[0].where).toEqual({ cuentaOperativaId: "cuenta-a", pushSubscription: "EA" })
    expect(empleadoRows[0].pushSubscription).toBe("EB")
  })

  test("different account: subscription S under account B is never targeted by account A's logout", async () => {
    sessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    empleadoRows = [{ id: "empleado-b1", cuentaOperativaId: "cuenta-b", pushSubscription: "S" }]

    const res = await POST(buildRequest({ subscription: "S" }, { token: "tok-a" }))
    expect(res.status).toBe(200)
    expect(updateManyCalls[0].where.cuentaOperativaId).toBe("cuenta-a")
    expect(empleadoRows[0].pushSubscription).toBe("S")
  })

  test("no body (old client): logout still succeeds, push updateMany is never called", async () => {
    sessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })

    const res = await POST(buildRequest(undefined, { token: "tok-a" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(updateManyCalls.length).toBe(0)
    expect(deletedSessionTokens).toEqual(["tok-a"])
  })

  test("malformed JSON body: logout continues, no push update attempted", async () => {
    sessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })

    const res = await POST(buildRequest(undefined, { rawBody: "{not-json", token: "tok-a" }))
    expect(res.status).toBe(200)
    expect(updateManyCalls.length).toBe(0)
    expect(deletedSessionTokens).toEqual(["tok-a"])
  })

  test("wrong-type / empty subscription: logout continues, no push update attempted", async () => {
    sessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })

    const resNumber = await POST(buildRequest({ subscription: 12345 }, { token: "tok-a" }))
    expect(resNumber.status).toBe(200)
    const resEmpty = await POST(buildRequest({ subscription: "   " }, { token: "tok-a" }))
    expect(resEmpty.status).toBe(200)

    expect(updateManyCalls.length).toBe(0)
    expect(deletedSessionTokens).toEqual(["tok-a", "tok-a"])
  })

  test("push detach DB failure: session deletion still executes, logout response unchanged", async () => {
    sessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    updateManyThrows = new Error("simulated DB failure")

    const res = await POST(buildRequest({ subscription: "EA" }, { token: "tok-a" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(deletedSessionTokens).toEqual(["tok-a"])
  })

  test("ordering: push detach is attempted before the operational session is deleted", async () => {
    sessionByToken.set("tok-a", { cuentaOperativaId: "cuenta-a" })
    empleadoRows = [{ id: "empleado-1", cuentaOperativaId: "cuenta-a", pushSubscription: "EA" }]

    await POST(buildRequest({ subscription: "EA" }, { token: "tok-a" }))
    expect(callOrder).toEqual(["push-detach", "session-delete"])
  })

  test("no cookie: logout still succeeds (idempotent), no session/push calls attempted", async () => {
    const res = await POST(buildRequest(undefined, { noCookie: true }))
    expect(res.status).toBe(200)
    expect(updateManyCalls.length).toBe(0)
    expect(deletedSessionTokens.length).toBe(0)
  })

  test("invalid/expired session token: logout still succeeds, no push detach attempted (no server-derived account available)", async () => {
    // sessionByToken has no entry for "tok-invalid" -> validateOperationalSession returns null
    const res = await POST(buildRequest({ subscription: "EA" }, { token: "tok-invalid" }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(updateManyCalls.length).toBe(0)
    expect(deletedSessionTokens).toEqual(["tok-invalid"])
  })
})
