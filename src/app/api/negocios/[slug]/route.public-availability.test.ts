// ============================================
// P2-T56-R3A-I4 — GET /api/negocios/[slug]: disponibilidad pública
// ============================================
// Route REAL contra un `@/lib/db` en memoria. Negocio genérico:
//  - `stockDisponible` = físico − reservas ACTIVA (null = sin límite) por
//    producto base y por variante;
//  - se ocultan productos agotados o deshabilitados (stock=false) y variantes
//    agotadas/inactivas, en `productos`, `productosSinSeccion` y `secciones`;
//  - UNA sola lectura agrupada de reservas por request (sin N+1);
//  - nunca se expone el stockCantidad del producto base.
// Restaurante/Ropa: sin cambios de visibilidad y sin leer reservas.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

interface VarianteRow { id: string; nombre: string; precio: number; activo: boolean; controlStock: boolean; stockCantidad: number }
interface ProductoRow { id: string; nombre: string; stock: boolean; controlStock: boolean; stockCantidad: number; variantes: VarianteRow[] }

let rubro = "negocio"
let productos: ProductoRow[] = []
let reservas: Array<{ productoId: string | null; productoVarianteId: string | null; cantidad: number }> = []
let groupByCalls: unknown[] = []

function productoRecord(p: ProductoRow) {
  return {
    ...p,
    precio: 1000,
    categoria: "General",
    imagenUrl: null,
    imagenesExtra: [],
    descuentoActivo: false,
    tipoDescuento: "porcentaje",
    valorDescuento: 0,
    descripcion: null,
    secciones: [],
    recomendados: [],
    opcionesCompartidasIds: [],
    talles: [],
    colores: [],
    material: "",
    genero: "",
    agregados: [],
    ingredientes: [],
  }
}

mock.module("@/lib/platform-settings", () => ({ PLATFORM_CONFIG_KEY: "platform", getPlatformServiceFee: async () => 0 }))
mock.module("@/lib/db", () => ({
  db: {
    negocio: {
      findUnique: async () => ({
        id: "neg-1",
        slug: "neg",
        nombre: "Negocio",
        rubro,
        aprobado: true,
        suspendido: false,
        colorPrincipal: "#000",
        mensajeBienvenida: "",
        categorias: [],
        horarios: "{}",
        timezone: "America/Argentina/Buenos_Aires",
        horarioMode: "manual",
        abiertoManual: true,
        whatsapp: "",
        instagram: "",
        facebook: "",
        logoUrl: null,
        bannerUrl: null,
        ofreceDelivery: false,
        ofreceRetiro: true,
        precioDelivery: 0,
        deliveryMode: "fijo",
        tiempoEntrega: 30,
        lat: null,
        lng: null,
        salonActivo: false,
        ubicacionCalibradaEn: null,
        mostrarVentas: false,
        aceptaTransferencia: false,
        aliasBancario: "",
        puntuacionPromedio: 0,
        totalResenas: 0,
        productos: productos.map(productoRecord),
        opcionesCompartidas: [],
        secciones: [
          {
            id: "sec-1",
            nombre: "Destacados",
            orientacion: "horizontal",
            orden: 0,
            color: null,
            productos: productos.map((p) => ({ producto: productoRecord(p) })),
          },
        ],
        resenas: [],
        _count: { pedidos: 0 },
      }),
    },
    reservaStock: {
      groupBy: async (args: { where: { estado: string } }) => {
        groupByCalls.push(args)
        const totals = new Map<string, { productoId: string | null; productoVarianteId: string | null; _sum: { cantidad: number } }>()
        for (const r of reservas) {
          const key = `${r.productoId}|${r.productoVarianteId}`
          const row = totals.get(key) ?? { productoId: r.productoId, productoVarianteId: r.productoVarianteId, _sum: { cantidad: 0 } }
          row._sum.cantidad += r.cantidad
          totals.set(key, row)
        }
        return [...totals.values()]
      },
    },
  },
}))

const { GET } = await import("./route")

async function get() {
  const res = await GET(new NextRequest("http://localhost/api/negocios/neg"), { params: Promise.resolve({ slug: "neg" }) })
  expect(res.status).toBe(200)
  return res.json()
}

const ids = (list: Array<{ id: string }>) => list.map((p) => p.id)

beforeEach(() => {
  rubro = "negocio"
  groupByCalls = []
  reservas = [
    { productoId: "p-reservado", productoVarianteId: null, cantidad: 2 },
    { productoId: "p-agotado-res", productoVarianteId: null, cantidad: 4 },
    { productoId: "p-var", productoVarianteId: "v-reservada", cantidad: 3 },
  ]
  productos = [
    { id: "p-ok", nombre: "Ok", stock: true, controlStock: true, stockCantidad: 5, variantes: [] },
    { id: "p-reservado", nombre: "Reservado", stock: true, controlStock: true, stockCantidad: 5, variantes: [] },
    { id: "p-agotado", nombre: "Agotado", stock: true, controlStock: true, stockCantidad: 0, variantes: [] },
    { id: "p-agotado-res", nombre: "Agotado por reservas", stock: true, controlStock: true, stockCantidad: 4, variantes: [] },
    { id: "p-deshabilitado", nombre: "Deshabilitado", stock: false, controlStock: false, stockCantidad: 0, variantes: [] },
    { id: "p-libre", nombre: "Sin control", stock: true, controlStock: false, stockCantidad: 0, variantes: [] },
    {
      id: "p-var",
      nombre: "Con variantes",
      stock: true,
      controlStock: true,
      stockCantidad: 0, // padre dormido: no debe ocultar ni limitar
      variantes: [
        { id: "v-ok", nombre: "M", precio: 10, activo: true, controlStock: true, stockCantidad: 2 },
        { id: "v-reservada", nombre: "L", precio: 10, activo: true, controlStock: true, stockCantidad: 3 },
        { id: "v-inactiva", nombre: "XL", precio: 10, activo: false, controlStock: true, stockCantidad: 9 },
      ],
    },
    {
      id: "p-var-agotado",
      nombre: "Variantes agotadas",
      stock: true,
      controlStock: false,
      stockCantidad: 0,
      variantes: [{ id: "v-cero", nombre: "Única", precio: 10, activo: true, controlStock: true, stockCantidad: 0 }],
    },
  ]
})

describe("I4 — negocio genérico", () => {
  test("oculta agotados (por físico o por reservas ACTIVA), deshabilitados y productos sin variantes disponibles", async () => {
    const body = await get()
    expect(ids(body.productos)).toEqual(["p-ok", "p-reservado", "p-libre", "p-var"])
    expect(ids(body.secciones[0].productos)).toEqual(["p-ok", "p-reservado", "p-libre", "p-var"])
    expect(body.productosSinSeccion).toEqual([])
  })

  test("stockDisponible por producto base (físico − ACTIVA; null sin control) y nunca el stockCantidad base", async () => {
    const body = await get()
    const byId = new Map(body.productos.map((p: { id: string }) => [p.id, p]))
    expect((byId.get("p-ok") as { stockDisponible: number }).stockDisponible).toBe(5)
    expect((byId.get("p-reservado") as { stockDisponible: number }).stockDisponible).toBe(3)
    expect((byId.get("p-libre") as { stockDisponible: number | null }).stockDisponible).toBeNull()
    for (const p of body.productos) {
      expect(p).not.toHaveProperty("stockCantidad")
      expect(p).not.toHaveProperty("controlStock")
    }
  })

  test("variantes: sólo activas con disponible > 0, con su stockDisponible; nunca se mezcla el stock del padre", async () => {
    const body = await get()
    const conVariantes = body.productos.find((p: { id: string }) => p.id === "p-var")
    expect(conVariantes.stockDisponible).toBeNull()
    expect(conVariantes.tieneVariantes).toBe(true)
    expect(conVariantes.variantes).toEqual([
      { id: "v-ok", nombre: "M", precio: 10, controlStock: true, stockCantidad: 2, stockDisponible: 2 },
    ])
  })

  test("una sola lectura agrupada de reservas ACTIVA por request (sin N+1)", async () => {
    await get()
    expect(groupByCalls).toEqual([
      {
        by: ["productoId", "productoVarianteId"],
        where: { negocioId: { in: ["neg-1"] }, estado: "ACTIVA", productoId: { not: null } },
        _sum: { cantidad: true },
      },
    ])
  })
})

describe("I4 — Restaurante / Ropa sin cambios", () => {
  for (const r of ["restaurante", "ropa"]) {
    test(`${r}: no lee reservas, no oculta productos y stockDisponible null`, async () => {
      rubro = r
      const body = await get()
      expect(groupByCalls).toHaveLength(0)
      expect(ids(body.productos)).toEqual(productos.map((p) => p.id))
      for (const p of body.productos) expect(p.stockDisponible).toBeNull()
      const conVariantes = body.productos.find((p: { id: string }) => p.id === "p-var")
      expect(ids(conVariantes.variantes)).toEqual(["v-ok", "v-reservada"])
    })
  }
})
