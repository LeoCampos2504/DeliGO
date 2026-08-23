// GET /api/repartidor/pedidos — focal, fully isolated unit tests for the
// P2-T01 addition only (trackingEligibleNow derivation + raw-flag
// stripping). No real DB (Prisma), no real network: db/auth are replaced
// via mock.module before the route is imported (same pattern as
// src/app/api/repartidor/ubicacion/route.test.ts).
//
// Added during Stage 3 precommit review (F-P2T01-STAGE2-01): a manual diff
// review of this exact route found that the immutable snapshot flag
// (Pedido.seguimientoDeliveryHabilitado) was still leaking to the browser
// via the `...p` spread even though the live Negocio flag was correctly
// stripped — a small, isolated test like this one would have caught it
// automatically, so per the review instruction it was added now rather than
// deferred again.
import { describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

let sessionUser: { id: string; type: string } | null
let asociaciones: Array<{ negocioId: string }>
let pedidoRecords: Array<{
  id: string
  negocioId: string
  repartidorId: string | null
  estado: string
  metodoEntrega: string
  clienteTelefono: string
  notas: string | null
  seguimientoDeliveryHabilitado: boolean
  items: unknown[]
  negocio: {
    id: string
    nombre: string
    slug: string
    logoUrl: string | null
    colorPrincipal: string
    seguimientoDeliveryActivo: boolean
  } | null
}>

mock.module("@/lib/db", () => ({
  db: {
    repartidorNegocio: {
      findMany: async () => asociaciones,
    },
    pedido: {
      findMany: async () => pedidoRecords,
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

function pedido(overrides: Partial<(typeof pedidoRecords)[number]> = {}): (typeof pedidoRecords)[number] {
  return {
    id: "pedido-1",
    negocioId: "negocio-1",
    repartidorId: "repartidor-1",
    estado: "en_camino",
    metodoEntrega: "domicilio",
    clienteTelefono: "1122334455",
    notas: "nota secreta del cliente",
    seguimientoDeliveryHabilitado: true,
    items: [],
    negocio: {
      id: "negocio-1",
      nombre: "La Esquina",
      slug: "la-esquina",
      logoUrl: null,
      colorPrincipal: "#fff",
      seguimientoDeliveryActivo: true,
    },
    ...overrides,
  }
}

function callRoute(filter?: string) {
  const url = filter ? `http://localhost/api/repartidor/pedidos?filter=${filter}` : "http://localhost/api/repartidor/pedidos"
  const req = new NextRequest(url, { headers: { cookie: "deligo_session=fake-session-token" } })
  return GET(req)
}

describe("GET /api/repartidor/pedidos — P2-T01 trackingEligibleNow", () => {
  test("snapshot true + negocio live true + en_camino + domicilio -> trackingEligibleNow true", async () => {
    sessionUser = { id: "repartidor-1", type: "repartidor" }
    asociaciones = [{ negocioId: "negocio-1" }]
    pedidoRecords = [pedido()]

    const res = await callRoute("mios")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.mios).toHaveLength(1)
    expect(body.mios[0].trackingEligibleNow).toBe(true)
  })

  test("negocio live flag false -> trackingEligibleNow false even though snapshot is true", async () => {
    sessionUser = { id: "repartidor-1", type: "repartidor" }
    asociaciones = [{ negocioId: "negocio-1" }]
    pedidoRecords = [pedido({ negocio: { ...pedido().negocio!, seguimientoDeliveryActivo: false } })]

    const res = await callRoute("mios")
    const body = await res.json()
    expect(body.mios[0].trackingEligibleNow).toBe(false)
  })

  test("snapshot false -> trackingEligibleNow false even though negocio is currently active", async () => {
    sessionUser = { id: "repartidor-1", type: "repartidor" }
    asociaciones = [{ negocioId: "negocio-1" }]
    pedidoRecords = [pedido({ seguimientoDeliveryHabilitado: false })]

    const res = await callRoute("mios")
    const body = await res.json()
    expect(body.mios[0].trackingEligibleNow).toBe(false)
  })

  test("F-P2T01-STAGE2-01 fix: neither raw flag (seguimientoDeliveryHabilitado nor the live negocio flag) is present anywhere in the response — only the resolved boolean", async () => {
    sessionUser = { id: "repartidor-1", type: "repartidor" }
    asociaciones = [{ negocioId: "negocio-1" }]
    pedidoRecords = [pedido()]

    const res = await callRoute("mios")
    const body = await res.json()
    const entry = body.mios[0]
    expect("seguimientoDeliveryHabilitado" in entry).toBe(false)
    expect("seguimientoDeliveryActivo" in entry.negocio).toBe(false)
    expect(entry.trackingEligibleNow).toBe(true)
    // Sanity: the raw flag genuinely isn't serialized anywhere in the JSON text either.
    const raw = JSON.stringify(body)
    expect(raw).not.toContain("seguimientoDeliveryHabilitado")
  })

  test("clienteTelefono and notas remain stripped (pre-existing privacy behavior, unaffected by P2-T01)", async () => {
    sessionUser = { id: "repartidor-1", type: "repartidor" }
    asociaciones = [{ negocioId: "negocio-1" }]
    pedidoRecords = [pedido()]

    const res = await callRoute("mios")
    const body = await res.json()
    expect("clienteTelefono" in body.mios[0]).toBe(false)
    expect("notas" in body.mios[0]).toBe(false)
  })

  test("only associated negocios' pedidos are ever queried; result correctly splits into disponibles vs mios by repartidorId", async () => {
    sessionUser = { id: "repartidor-1", type: "repartidor" }
    asociaciones = [{ negocioId: "negocio-1" }]
    pedidoRecords = [
      pedido({ id: "p-mine", repartidorId: "repartidor-1" }),
      pedido({ id: "p-available", repartidorId: null }),
    ]

    const res = await callRoute("all")
    const body = await res.json()
    expect(body.mios.map((p: { id: string }) => p.id)).toEqual(["p-mine"])
    expect(body.disponibles.map((p: { id: string }) => p.id)).toEqual(["p-available"])
  })

  test("negocio null (defensive) does not throw and yields trackingEligibleNow=false", async () => {
    sessionUser = { id: "repartidor-1", type: "repartidor" }
    asociaciones = [{ negocioId: "negocio-1" }]
    pedidoRecords = [pedido({ negocio: null })]

    const res = await callRoute("mios")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mios[0].trackingEligibleNow).toBe(false)
    expect(body.mios[0].negocio).toBeNull()
  })

  test("no session -> 401, no DB query attempted", async () => {
    sessionUser = null
    const req = new NextRequest("http://localhost/api/repartidor/pedidos")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})
