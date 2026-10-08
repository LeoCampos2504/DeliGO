// ============================================
// P2-T56-R3A-I4 — PUT /api/cliente/pedidos/[id]/repetir: misma disponibilidad
// ============================================
// Repetir usa la MISMA disponibilidad pública que el catálogo (físico −
// reservas ACTIVA): un producto/variante agotado queda "Sin stock" y cada ítem
// disponible informa `stockDisponible` (null = sin límite) para que el
// carrito limite y advierta. El historial del pedido no se modifica.
// Restaurante/Ropa sin cambios (sin leer reservas, stockDisponible null).
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

let rubro = "negocio"
let groupByCalls = 0
let reservas: Array<{ productoId: string; productoVarianteId: string | null; _sum: { cantidad: number } }> = []

const items = [
  { productoId: "p-ok", productoVarianteId: null },
  { productoId: "p-agotado-res", productoVarianteId: null },
  { productoId: "p-libre", productoVarianteId: null },
  { productoId: "p-var", productoVarianteId: "v-ok" },
  { productoId: "p-var", productoVarianteId: "v-agotada-res" },
].map((i, idx) => ({
  id: `item-${idx}`,
  ...i,
  nombre: i.productoId,
  precio: 100,
  cantidad: 2,
  agregados: "[]",
  secciones: "{}",
  seccionesPrecios: "{}",
  ingredientesQuitados: "[]",
  talle: "",
  color: "",
}))

const productos = [
  { id: "p-ok", stock: true, controlStock: true, stockCantidad: 4, variantes: [] },
  { id: "p-agotado-res", stock: true, controlStock: true, stockCantidad: 2, variantes: [] },
  { id: "p-libre", stock: true, controlStock: false, stockCantidad: 0, variantes: [] },
  {
    id: "p-var",
    stock: true,
    controlStock: true,
    stockCantidad: 0,
    variantes: [
      { id: "v-ok", nombre: "M", precio: 50, activo: true, controlStock: true, stockCantidad: 3 },
      { id: "v-agotada-res", nombre: "L", precio: 50, activo: true, controlStock: true, stockCantidad: 1 },
    ],
  },
].map((p) => ({ ...p, nombre: p.id, precio: 100, imagenUrl: null, descuentoActivo: false, tipoDescuento: "porcentaje", valorDescuento: 0 }))

mock.module("@/lib/platform-settings", () => ({ PLATFORM_CONFIG_KEY: "platform" }))
mock.module("@/lib/cliente-auth", () => ({ getAuthenticatedCliente: async () => ({ id: "cli-1" }) }))
mock.module("@/lib/db", () => ({
  db: {
    pedido: {
      findUnique: async () => ({
        id: "ped-1",
        clienteId: "cli-1",
        totalProductos: 1000,
        items,
        negocio: { id: "neg-1", slug: "neg", nombre: "Negocio", rubro, suspendido: false, aprobado: true, logoUrl: null, precioDelivery: 0, ofreceDelivery: false },
      }),
    },
    producto: { findMany: async () => productos },
    reservaStock: {
      groupBy: async () => {
        groupByCalls++
        return reservas
      },
    },
  },
}))

const { PUT } = await import("./route")

type ItemOut = { productoId: string; varianteId: string | null; disponible: boolean; motivoIndisponibilidad: string | null; stockDisponible: number | null; cantidad: number }

async function put(): Promise<ItemOut[]> {
  const res = await PUT(new NextRequest("http://localhost/api/cliente/pedidos/ped-1/repetir", { method: "PUT" }), {
    params: Promise.resolve({ id: "ped-1" }),
  })
  expect(res.status).toBe(200)
  expect(res.headers.get("Cache-Control")).toBe("private, no-store")
  return (await res.json()).items
}

beforeEach(() => {
  rubro = "negocio"
  groupByCalls = 0
  reservas = [
    { productoId: "p-ok", productoVarianteId: null, _sum: { cantidad: 1 } },
    { productoId: "p-agotado-res", productoVarianteId: null, _sum: { cantidad: 2 } },
    { productoId: "p-var", productoVarianteId: "v-agotada-res", _sum: { cantidad: 1 } },
  ]
})

describe("I4 — repetir en negocio genérico", () => {
  test("agotado por reservas → 'Sin stock'; disponibles con stockDisponible (físico − ACTIVA, null sin control)", async () => {
    const out = await put()
    expect(out.map((i) => [i.productoId, i.varianteId, i.disponible, i.motivoIndisponibilidad, i.stockDisponible])).toEqual([
      ["p-ok", null, true, null, 3],
      ["p-agotado-res", null, false, "Sin stock", null],
      ["p-libre", null, true, null, null],
      ["p-var", "v-ok", true, null, 3],
      ["p-var", null, false, "Sin stock", null],
    ])
    // Historial intacto: la cantidad original se informa tal cual.
    expect(out.every((i) => i.cantidad === 2)).toBe(true)
    expect(groupByCalls).toBe(1)
  })
})

describe("I4 — repetir en Restaurante/Ropa sin cambios", () => {
  for (const r of ["restaurante", "ropa"]) {
    test(`${r}: no lee reservas y stockDisponible null`, async () => {
      rubro = r
      const out = await put()
      expect(groupByCalls).toBe(0)
      expect(out.map((i) => i.disponible)).toEqual([true, true, true, true, true])
      expect(out.every((i) => i.stockDisponible === null)).toBe(true)
    })
  }
})
