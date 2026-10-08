// ============================================
// P2-T56-R3A-I4 — GET /api/negocios/promocionados: sin productos agotados
// ============================================
// Decisión 6: en negocio genérico se quitan de productosTop/productosGenerales
// los productos agotados; el negocio sigue visible aunque tenga alguno (o
// todos) agotados. Restaurante/Ropa sin cambios. Una sola lectura agrupada.
import { beforeEach, describe, expect, mock, test } from "bun:test"

type Producto = {
  id: string
  stock: boolean
  controlStock: boolean
  stockCantidad: number
  variantes: Array<{ id: string; activo: boolean; controlStock: boolean; stockCantidad: number }>
}

let negocios: Array<{ id: string; rubro: string; productos: Producto[] }> = []
let reservas: Array<{ productoId: string; productoVarianteId: string | null; _sum: { cantidad: number } }> = []
let groupByCalls: Array<{ where: { negocioId: { in: string[] } } }> = []

mock.module("@/lib/platform-settings", () => ({
  PLATFORM_CONFIG_KEY: "platform",
  getPlatformConfig: async () => ({ promocionadosActivos: true, tarifaServicio: 0 }),
}))
mock.module("@/lib/db", () => ({
  db: {
    negocio: {
      findMany: async ({ select }: { select: Record<string, unknown> }) => {
        if (!("productos" in select)) return [] // auto-expiración: nada vencido
        return negocios.map((n) => ({
          id: n.id,
          slug: n.id,
          nombre: n.id,
          logoUrl: null,
          bannerUrl: null,
          colorPrincipal: "#000",
          rubro: n.rubro,
          ofreceDelivery: false,
          ofreceRetiro: true,
          precioDelivery: 0,
          precioDeliveryDefault: 0,
          zonaDeliveryActiva: false,
          tiempoEntrega: 30,
          puntuacionPromedio: 0,
          totalResenas: 0,
          horarios: "{}",
          timezone: "America/Argentina/Buenos_Aires",
          horarioMode: "manual",
          abiertoManual: true,
          categorias: [],
          productos: n.productos.map((p) => ({
            ...p,
            nombre: p.id,
            precio: 100,
            imagenUrl: null,
            descuentoActivo: false,
            valorDescuento: 0,
            tipoDescuento: "porcentaje",
            categoria: "General",
          })),
        }))
      },
      updateMany: async () => ({ count: 0 }),
    },
    pedidoItem: {
      findMany: async () => [
        { productoId: "g-agotado", cantidad: 50 },
        { productoId: "g-ok", cantidad: 2 },
      ],
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

type NegocioOut = { id: string; productosTop: Array<{ id: string }>; productosGenerales: Array<{ id: string }>; totalProductos: number }

async function get(): Promise<NegocioOut[]> {
  const res = await GET()
  expect(res.status).toBe(200)
  return (await res.json()).negocios
}

const p = (id: string, overrides: Partial<Producto> = {}): Producto => ({
  id,
  stock: true,
  controlStock: true,
  stockCantidad: 5,
  variantes: [],
  ...overrides,
})

beforeEach(() => {
  groupByCalls = []
  reservas = [{ productoId: "g-reservado", productoVarianteId: null, _sum: { cantidad: 5 } }]
  negocios = [
    { id: "gen", rubro: "negocio", productos: [p("g-ok"), p("g-agotado", { stockCantidad: 0 }), p("g-reservado")] },
    { id: "gen-vacio", rubro: "negocio", productos: [p("g2-agotado", { stockCantidad: 0 })] },
    { id: "resto", rubro: "restaurante", productos: [p("r-cero", { stockCantidad: 0 })] },
  ]
})

describe("I4 — negocios promocionados", () => {
  test("quita los productos agotados (top y generales) sin ocultar el negocio", async () => {
    const out = await get()
    expect(out.map((n) => n.id)).toEqual(["gen", "gen-vacio", "resto"])
    const gen = out[0]
    expect(gen.productosTop.map((x) => x.id)).toEqual(["g-ok"])
    expect(gen.productosGenerales.map((x) => x.id)).toEqual([])
    expect(gen.totalProductos).toBe(1)
    expect(out[1].productosTop).toEqual([])
    expect(out[1].totalProductos).toBe(0)
  })

  test("Restaurante sin cambios (producto con stockCantidad 0 sigue)", async () => {
    const out = await get()
    expect(out[2].productosGenerales.map((x) => x.id)).toEqual(["r-cero"])
  })

  test("una sola lectura agrupada, limitada a los negocios genéricos", async () => {
    await get()
    expect(groupByCalls).toHaveLength(1)
    expect(groupByCalls[0].where.negocioId.in).toEqual(["gen", "gen-vacio"])
  })
})
