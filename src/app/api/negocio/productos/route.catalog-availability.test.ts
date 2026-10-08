// ============================================
// F9 (D5) — GET /api/negocio/productos: read-only R3A availability for Caja
// ============================================
// Route REAL against an in-memory `@/lib/db`:
//  - generic business with controlled stock: stockDisponible = físico −
//    reservas ACTIVA (same authority as the public catalog), per base
//    product and per active controlled variant; ONE grouped read per request;
//  - uncontrolled rows get no stockDisponible;
//  - Restaurante (or a generic business without controlled stock): no
//    reservation read at all, response unchanged;
//  - the reservation read is scoped to the session's business only.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

interface Row {
  id: string
  nombre: string
  controlStock: boolean
  stockCantidad: number
  stock: boolean
  variantes: Array<{ id: string; nombre: string; activo: boolean; controlStock: boolean; stockCantidad: number }>
}

let rubro = "negocio"
let productos: Row[] = []
let reservas: Array<{ negocioId: string; productoId: string; productoVarianteId: string | null; cantidad: number }> = []
let groupByCalls: Array<{ where: { negocioId: { in: string[] } } }> = []
let negocioReads = 0

mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME: "session",
  getUserFromToken: async () => ({ id: "neg-1", type: "negocio" }),
}))
mock.module("@/lib/platform-settings", () => ({ PLATFORM_CONFIG_KEY: "platform", getPlatformServiceFee: async () => 0 }))
mock.module("@/lib/db", () => ({
  db: {
    producto: {
      findMany: async () =>
        productos.map((p) => ({
          ...p,
          precio: 1000,
          categoria: "General",
          eliminado: false,
          talles: "[]",
          colores: "[]",
          secciones: "[]",
          recomendados: "[]",
          imagenesExtra: "[]",
          opcionesCompartidasIds: "[]",
          agregados: [],
          ingredientes: [],
        })),
    },
    negocio: {
      findUnique: async () => {
        negocioReads++
        return { rubro }
      },
    },
    reservaStock: {
      groupBy: async (args: { where: { negocioId: { in: string[] } } }) => {
        groupByCalls.push(args)
        const ids = args.where.negocioId.in
        const sums = new Map<string, { productoId: string; productoVarianteId: string | null; _sum: { cantidad: number } }>()
        for (const r of reservas.filter((x) => ids.includes(x.negocioId))) {
          const k = `${r.productoId}|${r.productoVarianteId ?? ""}`
          const cur = sums.get(k) ?? { productoId: r.productoId, productoVarianteId: r.productoVarianteId, _sum: { cantidad: 0 } }
          cur._sum.cantidad += r.cantidad
          sums.set(k, cur)
        }
        return [...sums.values()]
      },
    },
  },
}))

const { GET } = await import("./route")

function request() {
  return new NextRequest("http://localhost/api/negocio/productos", { headers: { cookie: "session=tok" } })
}

beforeEach(() => {
  rubro = "negocio"
  groupByCalls = []
  negocioReads = 0
  reservas = []
  productos = [
    { id: "p-simple", nombre: "Sopa", controlStock: true, stockCantidad: 5, stock: true, variantes: [] },
    { id: "p-libre", nombre: "Bolsa", controlStock: false, stockCantidad: 0, stock: true, variantes: [] },
    {
      id: "p-var",
      nombre: "Gaseosa",
      controlStock: false,
      stockCantidad: 0,
      stock: false, // manual toggle off must NOT zero Caja's number
      variantes: [
        { id: "v-ok", nombre: "500 ml", activo: true, controlStock: true, stockCantidad: 4 },
        { id: "v-agotada", nombre: "1 L", activo: true, controlStock: true, stockCantidad: 2 },
        { id: "v-libre", nombre: "2 L", activo: true, controlStock: false, stockCantidad: 0 },
      ],
    },
  ]
})

describe("F9 — Caja catalog availability (read-only, R3A authority)", () => {
  test("generic business: stockDisponible = físico − reservas ACTIVA with ONE grouped read for the session business", async () => {
    reservas = [
      { negocioId: "neg-1", productoId: "p-simple", productoVarianteId: null, cantidad: 3 },
      { negocioId: "neg-1", productoId: "p-var", productoVarianteId: "v-agotada", cantidad: 2 },
      { negocioId: "neg-OTRO", productoId: "p-simple", productoVarianteId: null, cantidad: 99 },
    ]
    const res = await GET(request())
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<Record<string, unknown> & { variantes: Array<Record<string, unknown>> }>
    const byId = new Map(body.map((p) => [p.id, p]))
    expect(byId.get("p-simple")?.stockDisponible).toBe(2)
    expect(byId.get("p-simple")?.stockCantidad).toBe(5) // physical stays as-is
    expect("stockDisponible" in byId.get("p-libre")!).toBe(false)
    const variantes = new Map(byId.get("p-var")!.variantes.map((v) => [v.id, v]))
    expect(variantes.get("v-ok")?.stockDisponible).toBe(4)
    expect(variantes.get("v-agotada")?.stockDisponible).toBe(0)
    expect("stockDisponible" in variantes.get("v-libre")!).toBe(false)
    expect(groupByCalls).toHaveLength(1)
    expect(groupByCalls[0].where.negocioId.in).toEqual(["neg-1"])
  })

  test("Restaurante: no reservation read, no stockDisponible", async () => {
    rubro = "restaurante"
    const res = await GET(request())
    const body = (await res.json()) as Array<Record<string, unknown>>
    expect(groupByCalls).toHaveLength(0)
    expect(body.every((p) => !("stockDisponible" in p))).toBe(true)
  })

  test("generic business without any controlled row: no extra reads at all", async () => {
    productos = productos.map((p) => ({ ...p, controlStock: false, variantes: p.variantes.map((v) => ({ ...v, controlStock: false })) }))
    await GET(request())
    expect(negocioReads).toBe(0)
    expect(groupByCalls).toHaveLength(0)
  })
})
