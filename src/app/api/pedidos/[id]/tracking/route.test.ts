// GET /api/pedidos/[id]/tracking — fully isolated unit tests. No real DB
// (Prisma), no real network: db/auth are replaced via mock.module before the
// route is imported (same pattern as the Tracking producer's
// src/app/api/repartidor/ubicacion/route.test.ts).
//
// Focal Realtime Ordering Implementation: this route now echoes
// Pedido.locationRevision as `version` — the same DB-backed ordering
// authority the realtime `tracking.location.updated` payload carries (see
// tracking-freshness.ts). These tests exist specifically to prove that
// field is populated correctly (including the `0` default for a pedido
// that has never received a location update) without weakening any
// existing authorization/access check.
import { describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

let sessionUser: { id: string; type: string } | null
let pedidoRecord: {
  id: string
  clienteId: string | null
  estado: string
  metodoEntrega: string
  repartidorLat: number | null
  repartidorLng: number | null
  negocioId: string
  lat: number | null
  lng: number | null
  direccion: string | null
  negocioNombre: string | null
  negocioLat: number | null
  negocioLng: number | null
  locationRevision: number
  seguimientoDeliveryHabilitado: boolean
} | null
let negocioRecord: {
  lat: number | null
  lng: number | null
  logoUrl: string | null
  colorPrincipal: string | null
  seguimientoDeliveryActivo: boolean
} | null

mock.module("@/lib/db", () => ({
  db: {
    pedido: {
      findUnique: async () => pedidoRecord,
    },
    negocio: {
      findUnique: async () => negocioRecord,
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

const { GET } = await import("./route")

function setAuthorizedScene(overrides: Partial<NonNullable<typeof pedidoRecord>> = {}) {
  sessionUser = { id: "cliente-1", type: "cliente" }
  pedidoRecord = {
    id: "pedido-1",
    clienteId: "cliente-1",
    estado: "en_camino",
    metodoEntrega: "domicilio",
    repartidorLat: -34.6,
    repartidorLng: -58.4,
    negocioId: "negocio-1",
    lat: -34.5,
    lng: -58.3,
    direccion: "Calle Falsa 123",
    negocioNombre: "La Esquina",
    negocioLat: null,
    negocioLng: null,
    locationRevision: 0,
    seguimientoDeliveryHabilitado: true,
    ...overrides,
  }
  negocioRecord = {
    lat: -34.55,
    lng: -58.35,
    logoUrl: null,
    colorPrincipal: null,
    seguimientoDeliveryActivo: true,
  }
}

function callRoute(id: string, cookie = "deligo_session=fake-session-token") {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  const req = new NextRequest(`http://localhost/api/pedidos/${id}/tracking`, { headers })
  return GET(req, { params: Promise.resolve({ id }) })
}

describe("GET /api/pedidos/[id]/tracking — server version authority", () => {
  test("authorized trackable response contains the exact numeric locationRevision as version", async () => {
    setAuthorizedScene({ locationRevision: 7 })
    const res = await callRoute("pedido-1")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.trackable).toBe(true)
    expect(body.version).toBe(7)
    expect(typeof body.version).toBe("number")
  })

  test("version=0 is preserved exactly — never omitted or coerced to falsy/undefined", async () => {
    setAuthorizedScene({ locationRevision: 0 })
    const res = await callRoute("pedido-1")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.trackable).toBe(true)
    expect("version" in body).toBe(true)
    expect(body.version).toBe(0)
  })

  test("existing authorization: no session cookie returns 401", async () => {
    setAuthorizedScene()
    const res = await callRoute("pedido-1", "")
    expect(res.status).toBe(401)
  })

  test("existing authorization: non-cliente actor returns 403", async () => {
    setAuthorizedScene()
    sessionUser = { id: "cliente-1", type: "repartidor" }
    const res = await callRoute("pedido-1")
    expect(res.status).toBe(403)
  })

  test("existing authorization: pedido not found returns 404", async () => {
    setAuthorizedScene()
    pedidoRecord = null
    const res = await callRoute("pedido-1")
    expect(res.status).toBe(404)
  })

  test("existing authorization: pedido belonging to a different cliente returns 404 (not leaked as 403)", async () => {
    setAuthorizedScene({ clienteId: "someone-else" })
    const res = await callRoute("pedido-1")
    expect(res.status).toBe(404)
  })

  test("existing behavior: pedido not en_camino returns trackable:false without a version field", async () => {
    setAuthorizedScene({ estado: "entregado" })
    const res = await callRoute("pedido-1")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.trackable).toBe(false)
    expect("version" in body).toBe(false)
  })

  test("existing behavior: missing repartidor location returns trackable:false without a version field", async () => {
    setAuthorizedScene({ repartidorLat: null, repartidorLng: null })
    const res = await callRoute("pedido-1")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.trackable).toBe(false)
    expect("version" in body).toBe(false)
  })

  test("existing behavior: negocio with tracking disabled returns trackable:false + trackingDisabled, no version field", async () => {
    setAuthorizedScene()
    negocioRecord = { ...negocioRecord!, seguimientoDeliveryActivo: false }
    const res = await callRoute("pedido-1")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.trackable).toBe(false)
    expect(body.trackingDisabled).toBe(true)
    expect("version" in body).toBe(false)
  })

  test("P2T01-04: pedido snapshot false, negocio currently active — same fail-closed shape as a live-disabled negocio (isTrackingCoreEligible via realtime-policy)", async () => {
    setAuthorizedScene({ seguimientoDeliveryHabilitado: false })
    negocioRecord = { ...negocioRecord!, seguimientoDeliveryActivo: true }
    const res = await callRoute("pedido-1")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.trackable).toBe(false)
    expect(body.trackingDisabled).toBe(true)
    expect("version" in body).toBe(false)
  })

  test("P2T01-12 positive path: snapshot true AND negocio active — trackable", async () => {
    setAuthorizedScene({ seguimientoDeliveryHabilitado: true })
    negocioRecord = { ...negocioRecord!, seguimientoDeliveryActivo: true }
    const res = await callRoute("pedido-1")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.trackable).toBe(true)
  })

  test("P2T01-20: non-domicilio pedido never trackable even with both flags true (defensive — this route is only ever reached for domicilio orders in practice)", async () => {
    setAuthorizedScene({ seguimientoDeliveryHabilitado: false, metodoEntrega: "retiro" })
    negocioRecord = { ...negocioRecord!, seguimientoDeliveryActivo: true }
    const res = await callRoute("pedido-1")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.trackable).toBe(false)
    expect(body.trackingDisabled).toBe(true)
  })
})
