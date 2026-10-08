// ============================================
// P2-T56-R3A-I4 — GET /api/cliente/promociones: sin productos agotados
// ============================================
// Decisión 6: en negocio genérico un producto agotado (físico − ACTIVA ≤ 0,
// o todas sus variantes no disponibles) no se promociona; sólo se oculta ese
// producto. Restaurante/Ropa sin cambios. Una sola lectura agrupada.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

type Row = {
  id: string
  negocioId: string
  rubro: string
  stock: boolean
  controlStock: boolean
  stockCantidad: number
  variantes: Array<{ id: string; activo: boolean; controlStock: boolean; stockCantidad: number }>
}

let rows: Row[] = []
let reservas: Array<{ productoId: string; productoVarianteId: string | null; _sum: { cantidad: number } }> = []
let groupByCalls: Array<{ where: { negocioId: { in: string[] } } }> = []

mock.module("@/lib/platform-settings", () => ({ PLATFORM_CONFIG_KEY: "platform" }))
mock.module("@/lib/db", () => ({
  db: {
    producto: {
      findMany: async () =>
        rows.map((r) => ({
          id: r.id,
          negocioId: r.negocioId,
          nombre: r.id,
          imagenUrl: null,
          precio: 1000,
          tipoDescuento: "porcentaje",
          valorDescuento: 10,
          categoria: "General",
          stock: r.stock,
          controlStock: r.controlStock,
          stockCantidad: r.stockCantidad,
          variantes: r.variantes,
          negocio: { id: r.negocioId, nombre: r.negocioId, slug: r.negocioId, rubro: r.rubro, logoUrl: null, colorPrincipal: "#000" },
        })),
    },
    reservaStock: {
      groupBy: async (args: { where: { negocioId: { in: string[] } } }) => {
        groupByCalls.push(args)
        return reservas
      },
    },
  },
}))

const { GET } = await import("./route")

async function get() {
  const res = await GET(new NextRequest("http://localhost/api/cliente/promociones"))
  expect(res.status).toBe(200)
  const body = await res.json()
  return (body.promociones as Array<{ id: string }>).map((p) => p.id)
}

beforeEach(() => {
  groupByCalls = []
  reservas = [{ productoId: "g-reservado", productoVarianteId: null, _sum: { cantidad: 3 } }]
  rows = [
    { id: "g-ok", negocioId: "gen", rubro: "negocio", stock: true, controlStock: true, stockCantidad: 2, variantes: [] },
    { id: "g-agotado", negocioId: "gen", rubro: "negocio", stock: true, controlStock: true, stockCantidad: 0, variantes: [] },
    { id: "g-reservado", negocioId: "gen", rubro: "negocio", stock: true, controlStock: true, stockCantidad: 3, variantes: [] },
    { id: "g-libre", negocioId: "gen", rubro: "negocio", stock: true, controlStock: false, stockCantidad: 0, variantes: [] },
    {
      id: "g-var-agotadas",
      negocioId: "gen",
      rubro: "negocio",
      stock: true,
      controlStock: false,
      stockCantidad: 0,
      variantes: [{ id: "v", activo: true, controlStock: true, stockCantidad: 0 }],
    },
    { id: "r-cero", negocioId: "resto", rubro: "restaurante", stock: true, controlStock: true, stockCantidad: 0, variantes: [] },
  ]
})

describe("I4 — promociones públicas", () => {
  test("oculta sólo los productos agotados del negocio genérico; el resto del negocio sigue", async () => {
    expect(await get()).toEqual(["g-ok", "g-libre", "r-cero"])
  })

  test("una sola lectura agrupada, limitada a los negocios genéricos", async () => {
    await get()
    expect(groupByCalls).toHaveLength(1)
    expect(groupByCalls[0].where.negocioId.in).toEqual(["gen"])
  })

  test("sin productos genéricos → no lee reservas y Restaurante/Ropa quedan intactos", async () => {
    rows = rows.filter((r) => r.rubro !== "negocio")
    expect(await get()).toEqual(["r-cero"])
    expect(groupByCalls).toHaveLength(0)
  })
})
