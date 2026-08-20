// Logout-B1 (P0 rollout-safe Phase O1): fully isolated unit tests for
// DELETE /api/operativo/mozo/panel/[slug]/push-subscription — no real DB, no
// real Railway secret. @/lib/operativo-mozo, @/lib/auth and @/lib/db are
// replaced via mock.module before the route is imported (same pattern as
// src/app/api/repartidor/ubicacion/route.test.ts). GET/POST are intentionally
// NOT touched by this Phase — only their pass-through wiring through the same
// mocked resolveOperativoMozoForSlug/db.empleado.updateMany is exercised here
// as a light regression check that the new optional `matchSubscription`
// parameter never leaks into POST's write path.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

type EmpleadoRow = {
  id: string
  negocioId: string
  cuentaOperativaId: string
  areaOperativa: string
  activo: boolean
  eliminado: boolean
  pushSubscription: string | null
}

type Auth =
  | { ok: true; empleado: { id: string }; negocio: { id: string }; cuenta: { id: string } }
  | { ok: false; status: 401 | 403; state: string; clearSession?: boolean }

let empleadoRows: EmpleadoRow[]
let authResult: Auth
let updateManyCalls: Array<{ where: Record<string, unknown> }>

mock.module("@/lib/db", () => ({
  db: {
    empleado: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { pushSubscription: string | null } }) => {
        updateManyCalls.push({ where })
        let count = 0
        for (const row of empleadoRows) {
          const matches =
            row.id === where.id &&
            row.negocioId === where.negocioId &&
            row.cuentaOperativaId === where.cuentaOperativaId &&
            row.areaOperativa === where.areaOperativa &&
            row.activo === where.activo &&
            row.eliminado === where.eliminado &&
            (!("pushSubscription" in where) || row.pushSubscription === where.pushSubscription)
          if (matches) {
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
}))

mock.module("@/lib/operativo-mozo", () => ({
  noStore: <T>(response: T): T => response,
  resolveOperativoMozoForSlug: async () => authResult,
  // Also stubbed (unused by this route) so this mock stays a superset of
  // the real module's exports regardless of module-cache load order with
  // the sibling Salon route test, which mocks the same shared module.
  resolveOperativoAreaForSlug: async () => authResult,
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { DELETE, POST } = await import("./route")

function setAuthorized(overrides?: Partial<{ empleadoId: string; negocioId: string; cuentaId: string }>) {
  authResult = {
    ok: true,
    empleado: { id: overrides?.empleadoId ?? "empleado-1" },
    negocio: { id: overrides?.negocioId ?? "negocio-1" },
    cuenta: { id: overrides?.cuentaId ?? "cuenta-1" },
  }
}

function buildDeleteRequest(body?: unknown, rawBody?: string) {
  const headers: Record<string, string> = {}
  let requestBody: string | undefined
  if (rawBody !== undefined) {
    headers["content-type"] = "application/json"
    requestBody = rawBody
  } else if (body !== undefined) {
    headers["content-type"] = "application/json"
    requestBody = JSON.stringify(body)
  }
  return new NextRequest("http://localhost/api/operativo/mozo/panel/test-slug/push-subscription", {
    method: "DELETE",
    headers,
    body: requestBody,
  })
}

function callDelete(body?: unknown, rawBody?: string) {
  return DELETE(buildDeleteRequest(body, rawBody), { params: Promise.resolve({ slug: "test-slug" }) })
}

beforeEach(() => {
  empleadoRows = []
  updateManyCalls = []
})

describe("DELETE /api/operativo/mozo/panel/[slug]/push-subscription — exact-match detach (Logout-B1)", () => {
  test("M1: valid actor + stored EA + request EA -> exact update, removed:true", async () => {
    setAuthorized()
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "mozo", activo: true, eliminado: false, pushSubscription: "EA" },
    ]

    const res = await callDelete({ subscription: "EA" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(empleadoRows[0].pushSubscription).toBeNull()
    expect(updateManyCalls[0].where.pushSubscription).toBe("EA")
  })

  test("M2: valid actor + stored EB + request EA -> exact predicate uses EA, removed:false, EB is never cleared", async () => {
    setAuthorized()
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "mozo", activo: true, eliminado: false, pushSubscription: "EB" },
    ]

    const res = await callDelete({ subscription: "EA" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
    expect(updateManyCalls[0].where.pushSubscription).toBe("EA")
    expect(empleadoRows[0].pushSubscription).toBe("EB")
  })

  test("M3: missing body -> 400, no DB write", async () => {
    setAuthorized()
    const res = await callDelete(undefined)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ ok: false, error: "subscription es obligatorio" })
    expect(updateManyCalls.length).toBe(0)
  })

  test("M4: malformed/wrong-type/empty subscription -> 400, no DB write", async () => {
    setAuthorized()

    const resMalformed = await callDelete(undefined, "{not-json")
    expect(resMalformed.status).toBe(400)

    const resWrongType = await callDelete({ subscription: 42 })
    expect(resWrongType.status).toBe(400)

    const resEmpty = await callDelete({ subscription: "   " })
    expect(resEmpty.status).toBe(400)

    expect(updateManyCalls.length).toBe(0)
  })

  test("M5: malicious/arbitrary subscription value stays scoped to the authenticated actor, never a global lookup", async () => {
    setAuthorized({ empleadoId: "empleado-1", negocioId: "negocio-1", cuentaId: "cuenta-1" })
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "mozo", activo: true, eliminado: false, pushSubscription: "EA" },
      { id: "empleado-other", negocioId: "negocio-2", cuentaOperativaId: "cuenta-2", areaOperativa: "mozo", activo: true, eliminado: false, pushSubscription: "EV" },
    ]

    const res = await callDelete({ subscription: "EV" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
    expect(updateManyCalls[0].where.id).toBe("empleado-1")
    expect(empleadoRows[1].pushSubscription).toBe("EV") // unrelated actor's row untouched
  })

  test("M6: unauthorized/invalid slug/session behavior remains unchanged", async () => {
    authResult = { ok: false, status: 401, state: "sin_sesion" }
    const res = await callDelete({ subscription: "EA" })
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(updateManyCalls.length).toBe(0)
  })

  test("regression: POST's write path never applies an exact-match filter (matchSubscription stays undefined for POST)", async () => {
    setAuthorized()
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "mozo", activo: true, eliminado: false, pushSubscription: "OLD" },
    ]
    const subscription = { endpoint: "https://push.example/abc", expirationTime: null, keys: { p256dh: "p", auth: "a" } }
    const res = await POST(
      new NextRequest("http://localhost/api/operativo/mozo/panel/test-slug/push-subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: JSON.stringify(subscription) }),
      }),
      { params: Promise.resolve({ slug: "test-slug" }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, subscribed: true })
    expect("pushSubscription" in updateManyCalls[0].where).toBe(false)
    expect(empleadoRows[0].pushSubscription).toBe(JSON.stringify(subscription))
  })
})
