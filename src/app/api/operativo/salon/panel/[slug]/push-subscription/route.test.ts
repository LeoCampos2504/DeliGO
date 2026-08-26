// Logout-B1 (P0 rollout-safe Phase O1): fully isolated unit tests for
// DELETE /api/operativo/salon/panel/[slug]/push-subscription — mirrors
// mozo/panel/[slug]/push-subscription/route.test.ts exactly, but exercises
// Salon's own resolver (resolveOperativoAreaForSlug) rather than importing
// or reusing the Mozo route's test. No real DB, no real Railway secret.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import { installAuthMock, resetAuthMockState } from "@/lib/test-helpers/auth-mock"

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

type PushRow = { id: string; ownerType: string; ownerId: string; channel: string; endpoint: string; p256dh: string; auth: string }

let empleadoRows: EmpleadoRow[]
let authResult: Auth
let updateManyCalls: Array<{ where: Record<string, unknown> }>
let resolveAreaCalls: Array<{ area: string }>
let pushRows: PushRow[]
let pushIdCounter: number
let singletonWriteCalls: number
let txWriteCalls: number

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
  pushIdCounter += 1
  const row: PushRow = { id: `push-${pushIdCounter}`, ...args.create }
  pushRows.push(row)
  return row
}

function pushDeleteManyImpl(where: Record<string, unknown>) {
  const before = pushRows.length
  pushRows = pushRows.filter((r) => !Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
  return { count: before - pushRows.length }
}

function makeDbClient(kind: "singleton" | "tx") {
  return {
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
    pushSubscription: {
      upsert: async (args: Parameters<typeof pushUpsertImpl>[0]) => {
        if (kind === "singleton") singletonWriteCalls += 1
        else txWriteCalls += 1
        return pushUpsertImpl(args)
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (kind === "singleton") singletonWriteCalls += 1
        else txWriteCalls += 1
        return pushDeleteManyImpl(where)
      },
    },
  }
}

const singletonDbClient = makeDbClient("singleton")
const txDbClient = makeDbClient("tx")

mock.module("@/lib/db", () => ({
  db: {
    ...singletonDbClient,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(txDbClient),
  },
}))

// P2-T05 Hardening H4 (F-P2-T05-22): canonical superset mock — see the
// identical comment in
// operativo/mozo/panel/[slug]/push-subscription/route.test.ts and
// src/lib/test-helpers/auth-mock.ts.
installAuthMock()

mock.module("@/lib/operativo-mozo", () => ({
  noStore: <T>(response: T): T => response,
  resolveOperativoAreaForSlug: async (_req: unknown, _slug: string, area: string) => {
    resolveAreaCalls.push({ area })
    return authResult
  },
  // Also stubbed (unused by this route) so this mock stays a superset of
  // the real module's exports regardless of module-cache load order with
  // the sibling Mozo route test, which mocks the same shared module.
  resolveOperativoMozoForSlug: async () => authResult,
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
  return new NextRequest("http://localhost/api/operativo/salon/panel/test-slug/push-subscription", {
    method: "DELETE",
    headers,
    body: requestBody,
  })
}

function callDelete(body?: unknown, rawBody?: string) {
  return DELETE(buildDeleteRequest(body, rawBody), { params: Promise.resolve({ slug: "test-slug" }) })
}

beforeEach(() => {
  resetAuthMockState()
  empleadoRows = []
  updateManyCalls = []
  resolveAreaCalls = []
  pushRows = []
  pushIdCounter = 0
  singletonWriteCalls = 0
  txWriteCalls = 0
})

describe("DELETE /api/operativo/salon/panel/[slug]/push-subscription — exact-match detach (Logout-B1)", () => {
  test("uses the Salon area resolver, not Mozo's", async () => {
    setAuthorized()
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "salon", activo: true, eliminado: false, pushSubscription: "EA" },
    ]
    await callDelete({ subscription: "EA" })
    expect(resolveAreaCalls).toEqual([{ area: "salon" }])
  })

  test("exact match: stored EA + request EA -> exact update, removed:true", async () => {
    setAuthorized()
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "salon", activo: true, eliminado: false, pushSubscription: "EA" },
    ]

    const res = await callDelete({ subscription: "EA" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(empleadoRows[0].pushSubscription).toBeNull()
    expect(updateManyCalls[0].where.areaOperativa).toBe("salon")
  })

  test("mismatch: stored EB + request EA -> exact predicate uses EA, removed:false, EB is never cleared", async () => {
    setAuthorized()
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "salon", activo: true, eliminado: false, pushSubscription: "EB" },
    ]

    const res = await callDelete({ subscription: "EA" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
    expect(updateManyCalls[0].where.pushSubscription).toBe("EA")
    expect(empleadoRows[0].pushSubscription).toBe("EB")
  })

  test("missing body -> 400, no DB write", async () => {
    setAuthorized()
    const res = await callDelete(undefined)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ ok: false, error: "subscription es obligatorio" })
    expect(updateManyCalls.length).toBe(0)
  })

  test("malformed/wrong-type/empty subscription -> 400, no DB write", async () => {
    setAuthorized()

    const resMalformed = await callDelete(undefined, "{not-json")
    expect(resMalformed.status).toBe(400)

    const resWrongType = await callDelete({ subscription: 42 })
    expect(resWrongType.status).toBe(400)

    const resEmpty = await callDelete({ subscription: "   " })
    expect(resEmpty.status).toBe(400)

    expect(updateManyCalls.length).toBe(0)
  })

  test("malicious/arbitrary subscription value stays scoped to the authenticated actor", async () => {
    setAuthorized({ empleadoId: "empleado-1", negocioId: "negocio-1", cuentaId: "cuenta-1" })
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "salon", activo: true, eliminado: false, pushSubscription: "EA" },
      { id: "empleado-other", negocioId: "negocio-2", cuentaOperativaId: "cuenta-2", areaOperativa: "salon", activo: true, eliminado: false, pushSubscription: "EV" },
    ]

    const res = await callDelete({ subscription: "EV" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: false })
    expect(updateManyCalls[0].where.id).toBe("empleado-1")
    expect(empleadoRows[1].pushSubscription).toBe("EV")
  })

  test("unauthorized/invalid slug/session behavior remains unchanged", async () => {
    authResult = { ok: false, status: 403, state: "acceso_no_disponible" }
    const res = await callDelete({ subscription: "EA" })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(updateManyCalls.length).toBe(0)
  })

  test("regression: POST's write path never applies an exact-match filter", async () => {
    setAuthorized()
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "salon", activo: true, eliminado: false, pushSubscription: "OLD" },
    ]
    const subscription = { endpoint: "https://push.example/abc", expirationTime: null, keys: { p256dh: "p", auth: "a" } }
    const res = await POST(
      new NextRequest("http://localhost/api/operativo/salon/panel/test-slug/push-subscription", {
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

function callPost(body?: unknown) {
  return POST(
    new NextRequest("http://localhost/api/operativo/salon/panel/test-slug/push-subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
    { params: Promise.resolve({ slug: "test-slug" }) }
  )
}

function validSub(endpoint: string) {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh: "p", auth: "a" } })
}

describe("POST /api/operativo/salon/panel/[slug]/push-subscription — atomic dual-write (Stage3 §15/§27)", () => {
  test("legacy + normalized write in the SAME transaction, owner is `empleado`/channel `default` (NOT negocio/salon)", async () => {
    setAuthorized()
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "salon", activo: true, eliminado: false, pushSubscription: null },
    ]

    const res = await callPost({ subscription: validSub("https://push.example/E1") })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, subscribed: true })
    expect(pushRows.length).toBe(1)
    expect(pushRows[0]).toMatchObject({ ownerType: "empleado", ownerId: "empleado-1", channel: "default", endpoint: "https://push.example/E1" })
    expect(txWriteCalls).toBe(1)
    expect(singletonWriteCalls).toBe(0)
  })

  test("rejects http:// endpoint (unified validation, F-P2-T05-01)", async () => {
    setAuthorized()
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "salon", activo: true, eliminado: false, pushSubscription: null },
    ]
    const bad = JSON.stringify({ endpoint: "http://push.example/E1", expirationTime: null, keys: { p256dh: "p", auth: "a" } })
    const res = await callPost({ subscription: bad })
    expect(res.status).toBe(400)
    expect(pushRows.length).toBe(0)
  })
})

describe("DELETE /api/operativo/salon/panel/[slug]/push-subscription — dual-detach (Stage3 §17/§27)", () => {
  test("stale device: normalized detach succeeds even when legacy exact-match misses", async () => {
    setAuthorized()
    const e1 = validSub("https://push.example/E1")
    const e2 = validSub("https://push.example/E2")
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "salon", activo: true, eliminado: false, pushSubscription: e2 },
    ]
    pushRows = [
      { id: "p1", ownerType: "empleado", ownerId: "empleado-1", channel: "default", endpoint: "https://push.example/E1", p256dh: "p", auth: "a" },
      { id: "p2", ownerType: "empleado", ownerId: "empleado-1", channel: "default", endpoint: "https://push.example/E2", p256dh: "p", auth: "a" },
    ]

    const res = await callDelete({ subscription: e1 })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, removed: true })
    expect(empleadoRows[0].pushSubscription).toBe(e2)
    expect(pushRows.map((r) => r.endpoint)).toEqual(["https://push.example/E2"])
  })

  test("cross-actor: never touches another empleado's normalized binding on the same endpoint", async () => {
    setAuthorized()
    const shared = validSub("https://push.example/SHARED")
    empleadoRows = [
      { id: "empleado-1", negocioId: "negocio-1", cuentaOperativaId: "cuenta-1", areaOperativa: "salon", activo: true, eliminado: false, pushSubscription: shared },
    ]
    pushRows = [
      { id: "p1", ownerType: "empleado", ownerId: "empleado-1", channel: "default", endpoint: "https://push.example/SHARED", p256dh: "p", auth: "a" },
      { id: "p2", ownerType: "empleado", ownerId: "empleado-OTHER", channel: "default", endpoint: "https://push.example/SHARED", p256dh: "p", auth: "a" },
    ]

    await callDelete({ subscription: shared })

    expect(pushRows.length).toBe(1)
    expect(pushRows[0].ownerId).toBe("empleado-OTHER")
  })
})
