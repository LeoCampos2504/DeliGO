// Tracking server-authoritative producer — POST /api/repartidor/ubicacion,
// fully isolated unit tests. No real DB (Prisma), no real network, no
// Railway secret: DB/auth/log-safe-error/realtime-publish are replaced via
// mock.module before the route is imported (same pattern as Chat P2's
// route.test.ts).
//
// IMPORTANT (Focal Implementation Correction #1): @/lib/rate-limit is
// deliberately NOT mocked. The route under test uses the REAL
// checkRateLimit/rateLimitResponse/RATE_LIMITS.repartidorUbicacion from
// src/lib/rate-limit.ts, so this suite proves the actual productive rate
// limit configuration (30 requests / 60000ms, keyed by repartidorId:pedidoId)
// behaves correctly — not a simulated stand-in for it. Because the real
// limiter's store is in-memory and module-scoped (persists for the lifetime
// of this test file), every test uses a freshly generated, never-reused
// repartidorId+pedidoId pair (see nextIds()) so tests can never contaminate
// each other's budget or depend on execution order.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import { RATE_LIMITS } from "@/lib/rate-limit"

let idCounter = 0
function nextIds() {
  idCounter += 1
  return {
    repartidorId: `repartidor-rl-${idCounter}`,
    pedidoId: `pedido-rl-${idCounter}`,
  }
}

let repartidorRecord: { id: string; activo: boolean } | null
let pedidoRecord: {
  id: string
  negocioId: string
  repartidorId: string
  estado: string
  metodoEntrega: string
} | null
let asociacionRecord: { repartidorId: string; negocioId: string } | null
let sessionUser: { id: string; type: string } | null
let updateManyCount: number
let updateManyThrows: Error | null
let updateManyCalls: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }>
let publishCalls: Array<Record<string, unknown>>
let publishImpl: (event: Record<string, unknown>) => Promise<unknown>

mock.module("@/lib/db", () => ({
  db: {
    repartidor: {
      findUnique: async () => repartidorRecord,
    },
    pedido: {
      findUnique: async () => pedidoRecord,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        updateManyCalls.push({ where, data })
        if (updateManyThrows) throw updateManyThrows
        return { count: updateManyCount }
      },
    },
    repartidorNegocio: {
      findUnique: async () => asociacionRecord,
    },
  },
}))

mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME: "deligo_session",
  getUserFromToken: async (_token: string) => (sessionUser ? { ...sessionUser } : null),
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

mock.module("@/lib/realtime-publish", () => ({
  publishRealtimeEvent: (event: Record<string, unknown>) => {
    publishCalls.push(event)
    return publishImpl(event)
  },
}))

const { POST } = await import("./route")

function setActor({ repartidorId, pedidoId }: { repartidorId: string; pedidoId: string }) {
  repartidorRecord = { id: repartidorId, activo: true }
  pedidoRecord = {
    id: pedidoId,
    negocioId: "negocio-1",
    repartidorId,
    estado: "en_camino",
    metodoEntrega: "domicilio",
  }
  asociacionRecord = { repartidorId, negocioId: "negocio-1" }
  sessionUser = { id: repartidorId, type: "repartidor" }
}

function buildRequest(pedidoId: string, body: Record<string, unknown> = { lat: -34.6, lng: -58.4 }) {
  return new NextRequest("http://localhost/api/repartidor/ubicacion", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "deligo_session=fake-session-token",
    },
    body: JSON.stringify({ pedidoId, ...body }),
  })
}

function callRoute(pedidoId: string, body?: Record<string, unknown>) {
  return POST(buildRequest(pedidoId, body))
}

beforeEach(() => {
  updateManyCount = 1
  updateManyThrows = null
  updateManyCalls = []
  publishCalls = []
  publishImpl = async (event) => ({ status: "success", eventId: event.eventId, attempts: 1, httpStatus: 200 })
})

describe("POST /api/repartidor/ubicacion — server-authoritative Tracking producer", () => {
  test("A: successful POST persists the location and publishes tracking.location.updated exactly once with the exact envelope", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })

    const res = await callRoute(pedidoId, { lat: -34.6, lng: -58.4 })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.repartidorLat).toBe(-34.6)
    expect(body.repartidorLng).toBe(-58.4)
    expect(typeof body.repartidorLastUpdate).toBe("string")

    expect(updateManyCalls.length).toBe(1)
    expect(updateManyCalls[0].where).toEqual({
      id: pedidoId,
      negocioId: "negocio-1",
      repartidorId,
      estado: "en_camino",
      metodoEntrega: "domicilio",
    })
    expect(updateManyCalls[0].data.repartidorLat).toBe(-34.6)
    expect(updateManyCalls[0].data.repartidorLng).toBe(-58.4)
    const dbTimestamp = (updateManyCalls[0].data.repartidorLastUpdate as Date).toISOString()
    expect(dbTimestamp).toBe(body.repartidorLastUpdate)

    expect(publishCalls.length).toBe(1)
    const event = publishCalls[0] as {
      version: number
      type: string
      eventId: string
      resourceId: string
      occurredAt: string
      payload: Record<string, unknown>
    }
    expect(event.version).toBe(1)
    expect(event.type).toBe("tracking.location.updated")
    expect(event.resourceId).toBe(pedidoId)
    // TRACKING_SINGLE_SERVER_TIMESTAMP_PER_ACCEPTED_UPDATE: the same server
    // `now` feeds the DB write, the HTTP response, occurredAt and the
    // payload timestamp — verified by cross-referencing them against one
    // another rather than mocking Date globally. eventId itself is a
    // server-generated UUID (see Focal Precommit Review, eventId
    // uniqueness) — NOT derived from the timestamp, precisely so two
    // concurrent accepted updates for the same pedido in the same
    // millisecond can never collide (see the dedicated test below).
    expect(event.occurredAt).toBe(body.repartidorLastUpdate)
    expect(event.eventId.startsWith(`${pedidoId}:`)).toBe(true)
    const uuidPart = event.eventId.slice(`${pedidoId}:`.length)
    expect(uuidPart).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(event.payload).toEqual({
      pedidoId,
      lat: -34.6,
      lng: -58.4,
      timestamp: body.repartidorLastUpdate,
    })
    expect(Object.keys(event.payload).sort()).toEqual(["pedidoId", "lat", "lng", "timestamp"].sort())
  })

  test("eventId uniqueness: two concurrent accepted updates for the SAME pedido at the SAME frozen millisecond produce DISTINCT eventIds", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })

    // Freezes both `new Date()` and `Date.now()` to a single fixed instant
    // for the duration of this test, so both concurrent requests below are
    // forced through the exact millisecond collision scenario described in
    // the Focal Precommit Review — this is the scenario that WOULD have
    // produced two identical `${pedidoId}:${now.getTime()}` eventIds under
    // the previous timestamp-based formula.
    const RealDate = Date
    const FROZEN_MS = RealDate.now()
    class FrozenDate extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(FROZEN_MS)
        } else {
          super(...(args as ConstructorParameters<typeof Date>))
        }
      }
      static now() {
        return FROZEN_MS
      }
    }
    // @ts-expect-error test-only global override, restored in finally below
    global.Date = FrozenDate

    try {
      const [resA, resB] = await Promise.all([
        callRoute(pedidoId, { lat: -10, lng: -10 }),
        callRoute(pedidoId, { lat: -20, lng: -20 }),
      ])
      expect(resA.status).toBe(200)
      expect(resB.status).toBe(200)
    } finally {
      global.Date = RealDate
    }

    expect(publishCalls.length).toBe(2)
    const [eventIdA, eventIdB] = publishCalls.map((event) => event.eventId as string)
    // Both requests genuinely resolved `now` to the SAME frozen millisecond
    // — proving this test actually exercised the collision scenario, not
    // just two arbitrary distinct timestamps.
    const occurredAtValues = publishCalls.map((event) => event.occurredAt as string)
    expect(occurredAtValues[0]).toBe(occurredAtValues[1])
    expect(eventIdA).not.toBe(eventIdB)
    expect(eventIdA.startsWith(`${pedidoId}:`)).toBe(true)
    expect(eventIdB.startsWith(`${pedidoId}:`)).toBe(true)
  })

  test("B: a publish failure never turns an already-persisted location update into an HTTP error", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })
    publishImpl = async (event) => ({ status: "failed", eventId: event.eventId, attempts: 2, httpStatus: 503 })

    const res = await callRoute(pedidoId)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(publishCalls.length).toBe(1)
  })

  test("B2: a disabled publish configuration also preserves HTTP success", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })
    publishImpl = async () => ({ status: "disabled", reason: "configuration_incomplete" })

    const res = await callRoute(pedidoId)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(publishCalls.length).toBe(1)
  })

  test("C: a DB updateMany failure preserves the existing error response and skips publish entirely", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })
    updateManyThrows = new Error("simulated DB failure")

    const res = await callRoute(pedidoId)
    expect(res.status).toBe(500)
    expect(publishCalls.length).toBe(0)
  })

  test("zero updated rows: preserves the existing 403 and never publishes", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })
    updateManyCount = 0

    const res = await callRoute(pedidoId)
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error).toBe("No estas asignado a este pedido")
    expect(publishCalls.length).toBe(0)
  })

  test("ordering: the HTTP response does not resolve before the awaited publish call resolves", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })

    let resolvePublish: (value: unknown) => void = () => {}
    let signalEntered: () => void = () => {}
    const entered = new Promise<void>((resolve) => {
      signalEntered = resolve
    })
    const deferred = new Promise((resolve) => {
      resolvePublish = resolve
    })
    publishImpl = () => {
      signalEntered()
      return deferred as Promise<unknown>
    }

    let settled = false
    const responsePromise = callRoute(pedidoId).then((res) => {
      settled = true
      return res
    })

    await entered
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(publishCalls.length).toBe(1)
    expect(updateManyCalls.length).toBe(1)

    resolvePublish({ status: "success", eventId: (publishCalls[0] as { eventId: string }).eventId, attempts: 1, httpStatus: 200 })
    const res = await responsePromise
    expect(settled).toBe(true)
    expect(res.status).toBe(200)
  })

  describe("real rate limit — src/lib/rate-limit.ts's repartidorUbicacion config, not a mock", () => {
    test("REAL_TRACKING_RATE_LIMIT_FIRST_30_ALLOWED / REAL_RATE_LIMITED_REQUEST_WRITES_DB / REAL_RATE_LIMITED_REQUEST_PUBLISHES_REALTIME: exactly 30 requests are allowed per repartidor+pedido/min, each writes DB and publishes; request 31 is rejected with zero additional DB writes or publishes", async () => {
      const { repartidorId, pedidoId } = nextIds()
      setActor({ repartidorId, pedidoId })

      for (let i = 0; i < 30; i += 1) {
        const dbBefore = updateManyCalls.length
        const publishBefore = publishCalls.length
        const res = await callRoute(pedidoId, { lat: -1 - i, lng: -1 - i })
        expect(res.status).toBe(200)
        expect(updateManyCalls.length).toBe(dbBefore + 1)
        expect(publishCalls.length).toBe(publishBefore + 1)
      }

      const dbBefore31 = updateManyCalls.length
      const publishBefore31 = publishCalls.length
      const res31 = await callRoute(pedidoId, { lat: -30, lng: -30 })
      expect(res31.status).toBe(429)
      expect(updateManyCalls.length).toBe(dbBefore31)
      expect(publishCalls.length).toBe(publishBefore31)
    })

    test("REAL_TRACKING_RATE_LIMIT_RESPONSE: the 429 uses the REAL rateLimitResponse() shape (status, Retry-After, error body)", async () => {
      const { repartidorId, pedidoId } = nextIds()
      setActor({ repartidorId, pedidoId })

      for (let i = 0; i < 30; i += 1) {
        const res = await callRoute(pedidoId, { lat: -1 - i, lng: -1 - i })
        expect(res.status).toBe(200)
      }

      const res = await callRoute(pedidoId, { lat: -1, lng: -1 })
      expect(res.status).toBe(429)
      const retryAfterHeader = res.headers.get("Retry-After")
      expect(retryAfterHeader).toBeTruthy()
      const retryAfter = Number(retryAfterHeader)
      expect(Number.isFinite(retryAfter)).toBe(true)
      expect(retryAfter).toBeGreaterThan(0)
      expect(retryAfter).toBeLessThanOrEqual(60)
      const body = await res.json()
      expect(typeof body.error).toBe("string")
      expect(body.error.length).toBeGreaterThan(0)
    })

    test("REAL_TRACKING_RATE_LIMIT_PEDIDO_ISOLATION: exhausting pedido A's budget does not affect pedido B for the same repartidor", async () => {
      const { repartidorId } = nextIds()
      const pedidoA = `${repartidorId}-pedido-a`
      const pedidoB = `${repartidorId}-pedido-b`

      setActor({ repartidorId, pedidoId: pedidoA })
      for (let i = 0; i < 30; i += 1) {
        const res = await callRoute(pedidoA, { lat: -1 - i, lng: -1 - i })
        expect(res.status).toBe(200)
      }
      const res31A = await callRoute(pedidoA, { lat: -1, lng: -1 })
      expect(res31A.status).toBe(429)

      setActor({ repartidorId, pedidoId: pedidoB })
      const resB = await callRoute(pedidoB, { lat: -2, lng: -2 })
      expect(resB.status).toBe(200)
    })

    test("REAL_TRACKING_RATE_LIMIT_REPARTIDOR_ISOLATION: same literal pedidoId, different repartidorId, independent budgets", async () => {
      const idsA = nextIds()
      const idsB = nextIds()
      const sharedPedidoId = `shared-pedido-${idsA.repartidorId}-${idsB.repartidorId}`

      setActor({ repartidorId: idsA.repartidorId, pedidoId: sharedPedidoId })
      for (let i = 0; i < 30; i += 1) {
        const res = await callRoute(sharedPedidoId, { lat: -1 - i, lng: -1 - i })
        expect(res.status).toBe(200)
      }
      const res31A = await callRoute(sharedPedidoId, { lat: -1, lng: -1 })
      expect(res31A.status).toBe(429)

      // Different repartidor, same literal pedidoId string — proves the key
      // is genuinely repartidorId:pedidoId (compound), not pedidoId alone.
      setActor({ repartidorId: idsB.repartidorId, pedidoId: sharedPedidoId })
      const resB = await callRoute(sharedPedidoId, { lat: -2, lng: -2 })
      expect(resB.status).toBe(200)
    })

    test("F / UNAUTHORIZED_REQUEST_CONSUMES_REAL_RATE_LIMIT_BUDGET=NO: requests rejected before the rate-limit gate (403, unassigned pedido) never consume budget for that key", async () => {
      const { repartidorId, pedidoId } = nextIds()
      setActor({ repartidorId, pedidoId })
      // Not assigned to this repartidor yet — every attempt fails at the
      // pre-rate-limit authorization gate (step 8), well before step 9.
      pedidoRecord = { ...pedidoRecord!, repartidorId: "someone-else" }

      for (let i = 0; i < 40; i += 1) {
        const res = await callRoute(pedidoId, { lat: -1 - i, lng: -1 - i })
        expect(res.status).toBe(403)
      }
      expect(updateManyCalls.length).toBe(0)
      expect(publishCalls.length).toBe(0)

      // Now make the pedido genuinely assigned — the SAME key must still
      // have its full, untouched 30-request budget.
      pedidoRecord = { ...pedidoRecord!, repartidorId }
      for (let i = 0; i < 30; i += 1) {
        const res = await callRoute(pedidoId, { lat: -1 - i, lng: -1 - i })
        expect(res.status).toBe(200)
      }
      const res31 = await callRoute(pedidoId, { lat: -1, lng: -1 })
      expect(res31.status).toBe(429)
    })

    test("G / UNAUTHENTICATED_REQUEST_CONSUMES_REAL_RATE_LIMIT_BUDGET=NO (PASS_STRUCTURAL): a request with no session cookie at all returns 401 before any key can even be constructed, with zero downstream side effects", async () => {
      const { pedidoId } = nextIds()
      // No `cookie` header at all — exercises the true `!token` branch
      // (route.ts's very first gate), distinct from an invalid/expired
      // session (which would be a 403 from getUserFromToken() returning
      // null, still before the rate-limit gate but a different code path).
      const req = new NextRequest("http://localhost/api/repartidor/ubicacion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pedidoId, lat: -1, lng: -1 }),
      })
      const res = await POST(req)
      expect(res.status).toBe(401)
      // The rate-limit key is `${user.id}:${pedidoId}` — with no token at
      // all, user.id never exists, so checkRateLimit() is structurally
      // unreachable (route.ts returns at the cookie check, several
      // `return`s before the rate-limit call). Verified here by the only
      // observable proxy available without an exported store-peek helper:
      // zero downstream side effects past the 401.
      expect(updateManyCalls.length).toBe(0)
      expect(publishCalls.length).toBe(0)
    })

    test("H / REAL_TRACKING_RATE_LIMIT_WINDOW_RESET: the real window resets after windowMs — 200 again after >60000ms with the same key (no real sleep)", async () => {
      const { repartidorId, pedidoId } = nextIds()
      setActor({ repartidorId, pedidoId })

      const realDateNow = Date.now
      const baseTime = realDateNow()
      let mockedNow = baseTime
      Date.now = () => mockedNow
      try {
        for (let i = 0; i < 30; i += 1) {
          const res = await callRoute(pedidoId, { lat: -1 - i, lng: -1 - i })
          expect(res.status).toBe(200)
        }
        const res31 = await callRoute(pedidoId, { lat: -1, lng: -1 })
        expect(res31.status).toBe(429)

        mockedNow = baseTime + 60_000 + 1
        const resAfterReset = await callRoute(pedidoId, { lat: -1, lng: -1 })
        expect(resAfterReset.status).toBe(200)
      } finally {
        Date.now = realDateNow
      }
    })

    test("I / REAL_TRACKING_RATE_LIMIT_CONFIG_EXACT: RATE_LIMITS.repartidorUbicacion has the exact approved config", () => {
      expect(RATE_LIMITS.repartidorUbicacion.maxRequests).toBe(30)
      expect(RATE_LIMITS.repartidorUbicacion.windowMs).toBe(60000)
    })
  })
})
