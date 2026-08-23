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
//
// Focal Realtime Ordering Implementation: the route's write moved from
// `db.pedido.updateMany` to a parameterized `db.$queryRaw` tagged-template
// `UPDATE ... RETURNING` (see route.ts §5-6) so it can atomically advance
// Pedido.locationRevision alongside the coordinate write. `$queryRaw` is
// invoked with JS's native tagged-template calling convention — the mock
// below receives it exactly as `(strings: TemplateStringsArray, ...values)`,
// the same way the real `db.$queryRaw` would. The mock's default
// implementation simulates a real atomic per-pedido increment (a
// `Map<pedidoId, number>` counter) so most tests get realistic, internally
// consistent revision values without manually specifying them; it does NOT
// and cannot prove real Postgres row-locking/atomicity — that is out of
// scope for this LOCAL-implementation task and is explicitly deferred to the
// real-Postgres concurrency suite (see route.concurrency.integration.test.ts
// and REAL_DB_VERSION_CONCURRENCY_RUNTIME_REQUIRED in CODEX_REPORT.md).
//
// P2-T01 Stage 1B: the write became a locking CTE (MODEL-LOCK-A) — `WITH
// eligible_business AS (SELECT ... FROM negocios ... FOR SHARE) UPDATE
// pedidos ... FROM eligible_business ...` — so the bound parameter order is
// now [pedido.negocioId, lat, lng, now, pedidoId, repartidorId] (the CTE's
// own WHERE binds first, since it appears first in the tagged template).
// This mock still cannot prove the FOR SHARE row-lock semantics itself —
// that is exactly what the separate real-Postgres concurrency suite proves.
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
  seguimientoDeliveryHabilitado: boolean
  negocio: { seguimientoDeliveryActivo: boolean } | null
} | null
let asociacionRecord: { repartidorId: string; negocioId: string } | null
let sessionUser: { id: string; type: string } | null

type QueryRawRow = { repartidorLat: number; repartidorLng: number; repartidorLastUpdate: Date; locationRevision: number }
let queryRawCalls: Array<{ text: string; values: unknown[] }>
let queryRawThrows: Error | null
let queryRawRowOverride: QueryRawRow[] | null // null = use the default realistic per-pedido-increment simulation
let locationRevisionByPedido: Map<string, number>
let publishCalls: Array<Record<string, unknown>>
let publishImpl: (event: Record<string, unknown>) => Promise<unknown>

mock.module("@/lib/db", () => ({
  db: {
    repartidor: {
      findUnique: async () => repartidorRecord,
    },
    pedido: {
      findUnique: async () => pedidoRecord,
    },
    repartidorNegocio: {
      findUnique: async () => asociacionRecord,
    },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?")
      queryRawCalls.push({ text, values })
      if (queryRawThrows) throw queryRawThrows
      if (queryRawRowOverride !== null) return queryRawRowOverride
      const [, lat, lng, now, pedidoId] = values as [string, number, number, Date, string, string]
      const current = locationRevisionByPedido.get(pedidoId) ?? 0
      const next = current + 1
      locationRevisionByPedido.set(pedidoId, next)
      const row: QueryRawRow = { repartidorLat: lat, repartidorLng: lng, repartidorLastUpdate: now, locationRevision: next }
      return [row]
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
    seguimientoDeliveryHabilitado: true,
    negocio: { seguimientoDeliveryActivo: true },
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
  queryRawCalls = []
  queryRawThrows = null
  queryRawRowOverride = null
  locationRevisionByPedido = new Map()
  publishCalls = []
  publishImpl = async (event) => ({ status: "success", eventId: event.eventId, attempts: 1, httpStatus: 200 })
})

describe("POST /api/repartidor/ubicacion — server-authoritative Tracking producer", () => {
  test("A: successful POST persists the location, atomically advances locationRevision, and publishes tracking.location.updated exactly once with the exact envelope", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })

    const res = await callRoute(pedidoId, { lat: -34.6, lng: -58.4 })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.repartidorLat).toBe(-34.6)
    expect(body.repartidorLng).toBe(-58.4)
    expect(typeof body.repartidorLastUpdate).toBe("string")
    expect(body.locationRevision).toBe(1) // first accepted update for a fresh pedido

    expect(queryRawCalls.length).toBe(1)
    const call = queryRawCalls[0]
    // Raw SQL safety: exact bound values, in interpolation order (CTE WHERE
    // binds first, then SET, then UPDATE WHERE), and the hardcoded state
    // predicates remain present as literal SQL text (never interpolated
    // from the request) — see route.ts §5, MODEL-LOCK-A.
    expect(call.values).toEqual(["negocio-1", -34.6, -58.4, call.values[3], pedidoId, repartidorId])
    expect(call.text).toContain("FOR SHARE")
    expect(call.text).toContain('UPDATE "pedidos"')
    expect(call.text).toContain('"locationRevision" = "locationRevision" + 1')
    expect(call.text).toContain("'en_camino'")
    expect(call.text).toContain("'domicilio'")
    expect(call.text).toContain('"seguimientoDeliveryHabilitado" = true')
    expect(call.text).toContain("RETURNING")
    expect(call.text).not.toContain("DROP")
    expect(call.text).not.toContain("DELETE")

    const dbTimestamp = (call.values[3] as Date).toISOString()
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
    expect(event.version).toBe(1) // Internal Publish envelope schema version — unrelated to locationRevision
    expect(event.type).toBe("tracking.location.updated")
    expect(event.resourceId).toBe(pedidoId)
    // TRACKING_SINGLE_SERVER_TIMESTAMP_PER_ACCEPTED_UPDATE: the same server
    // `now` feeds the DB write, the HTTP response, occurredAt and the
    // payload timestamp — verified by cross-referencing them against one
    // another rather than mocking Date globally. eventId itself is a
    // server-generated UUID (see Focal Precommit Review, eventId
    // uniqueness) — NOT derived from the timestamp or from locationRevision
    // (which is only unique per pedido, not globally).
    expect(event.occurredAt).toBe(body.repartidorLastUpdate)
    expect(event.eventId.startsWith(`${pedidoId}:`)).toBe(true)
    const uuidPart = event.eventId.slice(`${pedidoId}:`.length)
    expect(uuidPart).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    // TRACKING_VERSION_AUTHORITY=DB: payload.version is exactly the value
    // RETURNING gave back — never recomputed from Date.now/eventId/a
    // request counter.
    expect(event.payload).toEqual({
      pedidoId,
      lat: -34.6,
      lng: -58.4,
      timestamp: body.repartidorLastUpdate,
      version: 1,
    })
    expect(event.payload.version).toBe(body.locationRevision)
    expect(Object.keys(event.payload).sort()).toEqual(["lat", "lng", "pedidoId", "timestamp", "version"])
  })

  test("locationRevision strictly advances across successive accepted updates for the same pedido", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })

    const res1 = await callRoute(pedidoId, { lat: -1, lng: -1 })
    const res2 = await callRoute(pedidoId, { lat: -2, lng: -2 })
    const res3 = await callRoute(pedidoId, { lat: -3, lng: -3 })

    expect((await res1.json()).locationRevision).toBe(1)
    expect((await res2.json()).locationRevision).toBe(2)
    expect((await res3.json()).locationRevision).toBe(3)
    expect((publishCalls[0].payload as Record<string, unknown>).version).toBe(1)
    expect((publishCalls[1].payload as Record<string, unknown>).version).toBe(2)
    expect((publishCalls[2].payload as Record<string, unknown>).version).toBe(3)
  })

  test("locationRevision is per-pedido — two different pedidos both start at 1, independently", async () => {
    const { repartidorId } = nextIds()
    const pedidoA = `${repartidorId}-pedido-a`
    const pedidoB = `${repartidorId}-pedido-b`

    setActor({ repartidorId, pedidoId: pedidoA })
    const resA = await callRoute(pedidoA, { lat: -1, lng: -1 })
    expect((await resA.json()).locationRevision).toBe(1)

    setActor({ repartidorId, pedidoId: pedidoB })
    const resB = await callRoute(pedidoB, { lat: -2, lng: -2 })
    expect((await resB.json()).locationRevision).toBe(1)
  })

  test("eventId uniqueness: two concurrent accepted updates for the SAME pedido at the SAME frozen millisecond produce DISTINCT eventIds and DISTINCT locationRevisions", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })

    // Freezes both `new Date()` and `Date.now()` to a single fixed instant
    // for the duration of this test, so both concurrent requests below are
    // forced through the exact millisecond collision scenario described in
    // the Focal Precommit Review — this is the scenario that WOULD have
    // produced two identical `${pedidoId}:${now.getTime()}` eventIds under
    // the previous timestamp-based formula, and is exactly why eventId is a
    // UUID and payload.version comes from the DB, never from wall-clock time.
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
    // POSTGRES_ATOMIC_VERSION_STRUCTURAL_REVIEW: this mock cannot prove real
    // row-level locking — it only proves the ROUTE reads whatever RETURNING
    // gives it, without ever recomputing a version itself. The two
    // simulated values below happen to be distinct because the mock
    // increments a per-pedido counter synchronously per call (JS is
    // single-threaded); the REAL guarantee comes from Postgres's own
    // row-level UPDATE serialization (see CODEX_REPORT.md,
    // REAL_DB_VERSION_CONCURRENCY_RUNTIME_REQUIRED=SI).
    const [versionA, versionB] = publishCalls.map((event) => (event.payload as Record<string, unknown>).version)
    expect(versionA).not.toBe(versionB)
  })

  test("B: a publish failure never turns an already-persisted location update into an HTTP error", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })
    publishImpl = async (event) => ({ status: "failed", eventId: event.eventId, attempts: 2, httpStatus: 503 })

    const res = await callRoute(pedidoId)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.locationRevision).toBe(1)
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

  test("C: a DB write failure preserves the existing error response and skips publish entirely", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })
    queryRawThrows = new Error("simulated DB failure")

    const res = await callRoute(pedidoId)
    expect(res.status).toBe(500)
    expect(publishCalls.length).toBe(0)
  })

  test("zero returned rows: preserves the existing 403 and never publishes", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })
    queryRawRowOverride = []

    const res = await callRoute(pedidoId)
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error).toBe("No estas asignado a este pedido")
    expect(publishCalls.length).toBe(0)
  })

  test("LOCATION_WRITE_AND_REVISION_ATOMIC defensive fail-closed: more than one returned row (structurally impossible since id is the primary key) is a 500, never a publish", async () => {
    const { repartidorId, pedidoId } = nextIds()
    setActor({ repartidorId, pedidoId })
    const now = new Date()
    queryRawRowOverride = [
      { repartidorLat: -1, repartidorLng: -1, repartidorLastUpdate: now, locationRevision: 1 },
      { repartidorLat: -2, repartidorLng: -2, repartidorLastUpdate: now, locationRevision: 2 },
    ]

    const res = await callRoute(pedidoId)
    expect(res.status).toBe(500)
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
    expect(queryRawCalls.length).toBe(1)

    resolvePublish({ status: "success", eventId: (publishCalls[0] as { eventId: string }).eventId, attempts: 1, httpStatus: 200 })
    const res = await responsePromise
    expect(settled).toBe(true)
    expect(res.status).toBe(200)
  })

  describe("P2-T01 — tracking eligibility gate (section 20, gate 11)", () => {
    test("P2T01-07: snapshot false (pedido.seguimientoDeliveryHabilitado=false), negocio currently active — fail-closed 400, no DB write, no publish, no rate-limit consumption", async () => {
      const { repartidorId, pedidoId } = nextIds()
      setActor({ repartidorId, pedidoId })
      pedidoRecord = { ...pedidoRecord!, seguimientoDeliveryHabilitado: false, negocio: { seguimientoDeliveryActivo: true } }

      const res = await callRoute(pedidoId)
      expect(res.status).toBe(400)
      expect(queryRawCalls.length).toBe(0)
      expect(publishCalls.length).toBe(0)

      // Budget untouched: a subsequent request with the SAME key, once
      // eligible, still has its full 30-request window.
      pedidoRecord = { ...pedidoRecord!, seguimientoDeliveryHabilitado: true }
      for (let i = 0; i < 30; i += 1) {
        const ok = await callRoute(pedidoId, { lat: -1 - i, lng: -1 - i })
        expect(ok.status).toBe(200)
      }
    })

    test("P2T01-08: snapshot true, negocio currently disabled (live flag false) — fail-closed 400, no DB write, no publish", async () => {
      const { repartidorId, pedidoId } = nextIds()
      setActor({ repartidorId, pedidoId })
      pedidoRecord = { ...pedidoRecord!, seguimientoDeliveryHabilitado: true, negocio: { seguimientoDeliveryActivo: false } }

      const res = await callRoute(pedidoId)
      expect(res.status).toBe(400)
      expect(queryRawCalls.length).toBe(0)
      expect(publishCalls.length).toBe(0)
    })

    test("P2T01-12: snapshot true AND negocio active — positive path, 200, DB write, publish", async () => {
      const { repartidorId, pedidoId } = nextIds()
      setActor({ repartidorId, pedidoId })
      pedidoRecord = { ...pedidoRecord!, seguimientoDeliveryHabilitado: true, negocio: { seguimientoDeliveryActivo: true } }

      const res = await callRoute(pedidoId)
      expect(res.status).toBe(200)
      expect(queryRawCalls.length).toBe(1)
      expect(publishCalls.length).toBe(1)
    })

    test("null negocio relation (defensive) is treated as ineligible, never as truthy", async () => {
      const { repartidorId, pedidoId } = nextIds()
      setActor({ repartidorId, pedidoId })
      pedidoRecord = { ...pedidoRecord!, seguimientoDeliveryHabilitado: true, negocio: null }

      const res = await callRoute(pedidoId)
      expect(res.status).toBe(400)
      expect(queryRawCalls.length).toBe(0)
    })
  })

  describe("real rate limit — src/lib/rate-limit.ts's repartidorUbicacion config, not a mock", () => {
    test("REAL_TRACKING_RATE_LIMIT_FIRST_30_ALLOWED / REAL_RATE_LIMITED_REQUEST_WRITES_DB / REAL_RATE_LIMITED_REQUEST_PUBLISHES_REALTIME: exactly 30 requests are allowed per repartidor+pedido/min, each writes DB and publishes; request 31 is rejected with zero additional DB writes or publishes", async () => {
      const { repartidorId, pedidoId } = nextIds()
      setActor({ repartidorId, pedidoId })

      for (let i = 0; i < 30; i += 1) {
        const dbBefore = queryRawCalls.length
        const publishBefore = publishCalls.length
        const res = await callRoute(pedidoId, { lat: -1 - i, lng: -1 - i })
        expect(res.status).toBe(200)
        expect(queryRawCalls.length).toBe(dbBefore + 1)
        expect(publishCalls.length).toBe(publishBefore + 1)
      }

      const dbBefore31 = queryRawCalls.length
      const publishBefore31 = publishCalls.length
      const res31 = await callRoute(pedidoId, { lat: -30, lng: -30 })
      expect(res31.status).toBe(429)
      expect(queryRawCalls.length).toBe(dbBefore31)
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
      expect(queryRawCalls.length).toBe(0)
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
      expect(queryRawCalls.length).toBe(0)
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
