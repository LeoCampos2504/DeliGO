/// <reference types="bun-types" />
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

type Employee = {
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

let authResult: Auth
let employees: Employee[]
let normalizedRows: Array<{ ownerType: string; ownerId: string; channel: string; endpoint: string }>
let areaCalls: string[]
let updateCalls: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>
let registerCalls: Array<{ owner: Record<string, unknown>; input: Record<string, unknown> }>
let detachCalls: Array<{ owner: Record<string, unknown>; input: Record<string, unknown> }>

const tx = {
  empleado: {
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      updateCalls.push({ where, data })
      let count = 0
      for (const employee of employees) {
        const matches = Object.entries(where).every(([key, value]) => (employee as Record<string, unknown>)[key] === value)
        if (matches) {
          employee.pushSubscription = data.pushSubscription as string | null
          count += 1
        }
      }
      return { count }
    },
  },
}

const dbMock = {
  empleado: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      employees.find((employee) => Object.entries(where).every(([key, value]) => (employee as Record<string, unknown>)[key] === value)) ?? null,
    updateMany: tx.empleado.updateMany,
  },
  $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
}

mock.module("@/lib/auth", () => ({ OPERATIONAL_SESSION_COOKIE_NAME: "deligo_operativo_session" }))
mock.module("@/lib/db", () => ({ db: dbMock }))
mock.module("@/lib/operativo-mozo", () => ({
  noStore: <T>(response: T): T => response,
  resolveOperativoAreaForSlug: async (_req: unknown, _slug: string, area: string) => {
    areaCalls.push(area)
    return authResult
  },
}))
mock.module("@/lib/log-safe-error", () => ({ safeErrorForLog: (error: unknown) => error }))
mock.module("@/lib/push-subscription-http", () => ({
  parsePushSubscriptionShape: (value: unknown) => {
    if (typeof value !== "string") return null
    try {
      const parsed = JSON.parse(value) as { endpoint?: string; keys?: { p256dh?: string; auth?: string }; expirationTime?: string | null }
      if (!parsed.endpoint || !parsed.keys?.p256dh || !parsed.keys.auth) return null
      return { endpoint: parsed.endpoint, keys: { p256dh: parsed.keys.p256dh, auth: parsed.keys.auth }, expirationTime: parsed.expirationTime ?? null }
    } catch {
      return null
    }
  },
  toNormalizedPushSubscriptionInput: (subscription: { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime: string | null }) => ({
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    expirationTime: subscription.expirationTime ? new Date(subscription.expirationTime) : null,
  }),
}))
mock.module("@/lib/push-subscription-repository", () => ({
  getPushSubscriptionsForOwner: async (owner: Record<string, unknown>) => {
    registerCalls.push({ owner: { ...owner, operation: "status-read" }, input: {} })
    return normalizedRows
  },
  registerPushSubscription: async (owner: Record<string, unknown>, input: Record<string, unknown>) => {
    registerCalls.push({ owner, input })
    return { id: "push-1" }
  },
  detachPushSubscriptionByEndpoint: async (owner: Record<string, unknown>, input: Record<string, unknown>) => {
    detachCalls.push({ owner, input })
    return { detached: true }
  },
}))

const { DELETE, GET, POST } = await import("./route")

function authorized(overrides?: Partial<{ empleadoId: string; negocioId: string; cuentaId: string }>) {
  authResult = {
    ok: true,
    empleado: { id: overrides?.empleadoId ?? "empleado-pyr-1" },
    negocio: { id: overrides?.negocioId ?? "negocio-1" },
    cuenta: { id: overrides?.cuentaId ?? "cuenta-1" },
  }
}

function employee(overrides?: Partial<Employee>): Employee {
  return {
    id: "empleado-pyr-1",
    negocioId: "negocio-1",
    cuentaOperativaId: "cuenta-1",
    areaOperativa: "pyr",
    activo: true,
    eliminado: false,
    pushSubscription: null,
    ...overrides,
  }
}

function request(method: "GET" | "POST" | "DELETE", body?: unknown) {
  return new NextRequest("http://localhost/api/operativo/pyr/panel/test-slug/push-subscription", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = { params: Promise.resolve({ slug: "test-slug" }) }

beforeEach(() => {
  authorized()
  employees = []
  normalizedRows = []
  areaCalls = []
  updateCalls = []
  registerCalls = []
  detachCalls = []
})

describe("P2-T44-R1 PyR personal push subscription", () => {
  test("GET requires an authenticated PyR area resolution", async () => {
    authResult = { ok: false, status: 401, state: "sin_sesion" }
    const response = await GET(request("GET"), params)
    expect(response.status).toBe(401)
    expect(areaCalls).toEqual(["pyr"])
  })

  test("GET is business/area scoped and reports a normalized subscription even with no legacy value", async () => {
    employees = [employee()]
    normalizedRows = [{ ownerType: "empleado", ownerId: "empleado-pyr-1", channel: "default", endpoint: "https://push.example/pyr-1" }]
    const response = await GET(request("GET"), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, subscribed: true })
    expect(areaCalls).toEqual(["pyr"])
  })

  test("GET fails closed when the linked employee is not active PyR in the authenticated business", async () => {
    employees = [employee({ areaOperativa: "mozo", negocioId: "other-business" })]
    const response = await GET(request("GET"), params)
    expect(response.status).toBe(403)
  })

  test("POST dual-writes the authenticated employee owner and ignores arbitrary body actor ids", async () => {
    employees = [employee()]
    const subscription = JSON.stringify({ endpoint: "https://push.example/pyr-1", expirationTime: null, keys: { p256dh: "p256", auth: "auth" } })
    const response = await POST(request("POST", { subscription, empleadoId: "other-employee", negocioId: "other-business" }), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, subscribed: true })
    expect(updateCalls[0].where).toMatchObject({ id: "empleado-pyr-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "pyr" })
    const write = registerCalls.find((call) => call.input.endpoint === "https://push.example/pyr-1")
    expect(write?.owner).toEqual({ ownerType: "empleado", ownerId: "empleado-pyr-1", channel: "default" })
  })

  test("DELETE exact-matches the same employee owner and leaves another business untouched", async () => {
    const subscription = JSON.stringify({ endpoint: "https://push.example/pyr-1", expirationTime: null, keys: { p256dh: "p256", auth: "auth" } })
    employees = [employee({ pushSubscription: subscription }), employee({ id: "other", negocioId: "other-business", cuentaOperativaId: "other-account", pushSubscription: "OTHER" })]
    const response = await DELETE(request("DELETE", { subscription }), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, removed: true })
    expect(employees[0].pushSubscription).toBeNull()
    expect(employees[1].pushSubscription).toBe("OTHER")
    expect(detachCalls[0].owner).toEqual({ ownerType: "empleado", ownerId: "empleado-pyr-1", channel: "default" })
    expect(updateCalls[0].where).toMatchObject({ id: "empleado-pyr-1", negocioId: "negocio-1", areaOperativa: "pyr", pushSubscription: subscription })
  })
})
