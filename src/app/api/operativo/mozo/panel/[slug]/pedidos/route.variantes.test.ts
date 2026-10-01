// ============================================
// P2-T56-R3A-P0 — paridad de variantes en pedidos manuales de Mozo
// ============================================
// Ejercita el route REAL (GET + POST) contra un `@/lib/db` en memoria que
// reproduce la semántica relevante de Prisma: `producto.findMany` filtra por
// `where.negocioId` / `where.id.in` / `eliminado` / `stock`, y
// `producto.variantes` se resuelve SÓLO por la relación productoId (como el
// include real). El dataset es multi-tenant (negocio A y negocio B) para
// probar que una variante ajena nunca puede usarse. Mismo patrón de mocks de
// módulo que route.test.ts (auth/ocupación/push). El tx mock no expone
// productoVariante.update ni movimientoInventario: cualquier intento de
// mutar stock rompería el test (P0 no reserva ni descuenta).
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

const NEGOCIO_A = "negocio-a"
const NEGOCIO_B = "negocio-b"
const EMPLEADO_ID = "empleado-1"
const CUENTA_ID = "cuenta-1"
const MESA_ID = "mesa-1"
const OCUPACION_ID = "ocupacion-1"

type Variante = {
  id: string
  productoId: string
  nombre: string
  precio: number
  costo: number | null
  sku: string | null
  codigoBarras: string | null
  controlStock: boolean
  stockCantidad: number
  stockMinimo: number
  activo: boolean
}

type ProductoRow = {
  id: string
  negocioId: string
  nombre: string
  descripcion: string | null
  categoria: string
  orden: number
  imagenUrl: string | null
  precio: number
  eliminado: boolean
  stock: boolean
  secciones: string
  talles: string
  colores: string
  opcionesCompartidasIds: string
  descuentoActivo: boolean
  tipoDescuento: string
  valorDescuento: number
  agregados: unknown[]
  ingredientes: unknown[]
}

function producto(overrides: Partial<ProductoRow> & { id: string; negocioId: string }): ProductoRow {
  return {
    nombre: overrides.id,
    descripcion: null,
    categoria: "General",
    orden: 0,
    imagenUrl: null,
    precio: 1000,
    eliminado: false,
    stock: true,
    secciones: "[]",
    talles: "[]",
    colores: "[]",
    opcionesCompartidasIds: "[]",
    descuentoActivo: false,
    tipoDescuento: "porcentaje",
    valorDescuento: 0,
    agregados: [],
    ingredientes: [],
    ...overrides,
  }
}

function variante(overrides: Partial<Variante> & { id: string; productoId: string }): Variante {
  return {
    nombre: overrides.id,
    precio: 1000,
    costo: 400,
    sku: `SKU-${overrides.id}`,
    codigoBarras: `779${overrides.id}`,
    controlStock: false,
    stockCantidad: 0,
    stockMinimo: 1,
    activo: true,
    ...overrides,
  }
}

const SECCION_TAMANO = JSON.stringify([
  { nombre: "Tamano", opciones: [{ nombre: "Grande", precio: 200 }, { nombre: "Chico", precio: 0 }], obligatorio: false, maximo: 1 },
])

let productos: ProductoRow[]
let variantes: Variante[]
let pedidos: Array<Record<string, unknown> & { items: Array<Record<string, unknown>> }>

function seed() {
  productos = [
    producto({ id: "p-simple", negocioId: NEGOCIO_A, nombre: "Café", precio: 1000 }),
    producto({
      id: "p-promo",
      negocioId: NEGOCIO_A,
      nombre: "Medialuna",
      precio: 1000,
      descuentoActivo: true,
      tipoDescuento: "porcentaje",
      valorDescuento: 10,
    }),
    // Precio base "dormido" (1) + descuento activo: nunca deben usarse para
    // un producto con variantes.
    producto({
      id: "p-remera",
      negocioId: NEGOCIO_A,
      nombre: "Remera",
      precio: 1,
      descuentoActivo: true,
      tipoDescuento: "porcentaje",
      valorDescuento: 50,
      secciones: SECCION_TAMANO,
    }),
    producto({ id: "p-buzo", negocioId: NEGOCIO_A, nombre: "Buzo", precio: 1 }),
    producto({ id: "p-sin-activas", negocioId: NEGOCIO_A, nombre: "Gorra", precio: 1 }),
    producto({ id: "p-ajeno", negocioId: NEGOCIO_B, nombre: "Producto ajeno", precio: 1 }),
  ]
  variantes = [
    variante({ id: "v-rojo", productoId: "p-remera", nombre: "Rojo", precio: 2500, controlStock: true, stockCantidad: 3 }),
    variante({ id: "v-azul", productoId: "p-remera", nombre: "Azul", precio: 3100, controlStock: false, stockCantidad: 0 }),
    variante({ id: "v-verde-inactiva", productoId: "p-remera", nombre: "Verde", precio: 2000, activo: false }),
    variante({ id: "v-negro-agotada", productoId: "p-remera", nombre: "Negro", precio: 2200, controlStock: true, stockCantidad: 0 }),
    variante({ id: "v-buzo-gris", productoId: "p-buzo", nombre: "Gris", precio: 1800 }),
    variante({ id: "v-gorra-inactiva", productoId: "p-sin-activas", nombre: "Única", precio: 900, activo: false }),
    variante({ id: "v-ajena", productoId: "p-ajeno", nombre: "Ajena", precio: 999 }),
  ]
  pedidos = []
}

function variantesDe(productoId: string) {
  return variantes.filter((v) => v.productoId === productoId).map((v) => ({ ...v }))
}

function findProductos(args: { where: Record<string, unknown> }) {
  const where = args.where
  const ids = (where.id as { in?: string[] } | undefined)?.in
  return productos
    .filter((p) => (where.negocioId === undefined ? true : p.negocioId === where.negocioId))
    .filter((p) => (ids ? ids.includes(p.id) : true))
    .filter((p) => (where.eliminado === undefined ? true : p.eliminado === where.eliminado))
    .filter((p) => (where.stock === undefined ? true : p.stock === where.stock))
    .map((p) => ({ ...p, variantes: variantesDe(p.id) }))
}

mock.module("@/lib/operativo-mozo", () => ({
  noStore: <T,>(response: T) => response,
  resolveOperativoMozoForSlug: async () => ({
    ok: true,
    cuenta: { id: CUENTA_ID, nombre: "Cuenta Test" },
    empleado: { id: EMPLEADO_ID, nombre: "Mozo Test", codigo: "M1", rol: "mozo", activo: true, negocioId: NEGOCIO_A },
    areaOperativa: "mozo",
    areaOperativaEfectiva: "mozo",
    negocio: {
      id: NEGOCIO_A,
      nombre: "Negocio A",
      slug: "negocio-a",
      colorPrincipal: "#000000",
      logoUrl: null,
      salonActivo: true,
      empleadosActivos: true,
    },
  }),
}))

mock.module("@/lib/mesa-occupancy", () => ({
  openOrReuseMesaOccupancyForStaff: async () => ({ ocupacionId: OCUPACION_ID, occupancyCreated: false, pointerRepaired: false }),
  heartbeatOcupacionForStaffOrder: async () => ({ status: "linked", ocupacionId: OCUPACION_ID }),
}))

mock.module("@/lib/push", () => ({
  createNotification: async () => {},
  newOrderNotification: () => ({}),
  salonNewOrderNotification: () => ({}),
}))

mock.module("@/lib/salon-new-order-notification", () => ({
  notifySalonNewOrderForOperations: async () => ({ attemptedEndpoints: [] }),
  parseSubscriptionEndpoint: () => null,
}))

mock.module("@/lib/rate-limit", () => ({
  getClientIp: () => "127.0.0.1",
}))

mock.module("@/lib/db", () => {
  const tx = {
    cuentaOperativa: { findFirst: async () => ({ id: CUENTA_ID }) },
    empleado: { findFirst: async () => ({ id: EMPLEADO_ID, nombre: "Mozo Test" }) },
    pedido: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        pedidos.find((p) => p.negocioId === where.negocioId && p.idempotencyKey === where.idempotencyKey) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const itemsCreate = (data.items as { create: Array<Record<string, unknown>> }).create
        const pedido = {
          id: `pedido-${pedidos.length + 1}`,
          ...data,
          items: itemsCreate.map((item, index) => ({ id: `item-${pedidos.length + 1}-${index}`, ...item })),
        }
        pedidos.push(pedido)
        return pedido
      },
    },
    mesa: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({ id: MESA_ID, numero: 5, empleadoId: EMPLEADO_ID }),
    },
    negocio: {
      findFirst: async () => ({
        id: NEGOCIO_A,
        slug: "negocio-a",
        nombre: "Negocio A",
        lat: null,
        lng: null,
        horarios: "{}",
        timezone: "America/Argentina/Buenos_Aires",
        horarioMode: "simple",
        abiertoManual: true,
      }),
      findUnique: async () => ({ rubro: "negocio", categorias: "[]", pushSubscription: null, pushSubscriptionSalon: null }),
    },
    producto: { findMany: async (args: { where: Record<string, unknown> }) => findProductos(args) },
    opcionesCompartidas: { findMany: async () => [] },
    auditLog: { create: async () => ({}) },
  }
  return { db: { ...tx, $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx) } }
})

const { GET, POST } = await import("./route")

function item(overrides: Record<string, unknown> = {}) {
  return {
    productoId: "p-simple",
    cantidad: 1,
    agregados: [],
    secciones: {},
    ingredientesQuitados: [],
    talle: "",
    color: "",
    ...overrides,
  }
}

function callPost(items: Array<Record<string, unknown>>, idempotencyKey: string = crypto.randomUUID()) {
  const req = new NextRequest("http://localhost/api/operativo/mozo/panel/negocio-a/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey, mesaId: MESA_ID, notas: "", items }),
  })
  return POST(req, { params: Promise.resolve({ slug: "negocio-a" }) })
}

function callGet() {
  const req = new NextRequest("http://localhost/api/operativo/mozo/panel/negocio-a/pedidos", { method: "GET" })
  return GET(req, { params: Promise.resolve({ slug: "negocio-a" }) })
}

async function expectRejected(items: Array<Record<string, unknown>>, message: string) {
  const res = await callPost(items)
  const data = await res.json()
  expect(res.status).toBe(400)
  expect(data.error).toBe(message)
  expect(pedidos).toHaveLength(0)
}

beforeEach(() => {
  seed()
})

describe("P2-T56-R3A-P0 — POST Mozo: paridad de variantes", () => {
  test("P0-A: producto simple sigue funcionando igual (sin variante, precio base)", async () => {
    const res = await callPost([item({ productoId: "p-simple", cantidad: 2 })])
    expect(res.status).toBe(201)
    expect(pedidos).toHaveLength(1)
    const [linea] = pedidos[0].items
    expect(linea.precio).toBe(1000)
    expect(linea.productoVarianteId).toBeNull()
    expect(linea.varianteNombre).toBeNull()
    expect(pedidos[0].totalProductos).toBe(2000)
  })

  test("P0-M: producto base conserva su precio efectivo con descuento (comportamiento actual)", async () => {
    const res = await callPost([item({ productoId: "p-promo" })])
    expect(res.status).toBe(201)
    expect(pedidos[0].items[0].precio).toBe(900)
  })

  test("P0-B + P0-N: seleccionar variante A crea PedidoItem con A (id + snapshot de nombre)", async () => {
    const res = await callPost([item({ productoId: "p-remera", varianteId: "v-rojo" })])
    expect(res.status).toBe(201)
    const [linea] = pedidos[0].items
    expect(linea.productoId).toBe("p-remera")
    expect(linea.productoVarianteId).toBe("v-rojo")
    expect(linea.varianteNombre).toBe("Rojo")
    expect(linea.nombre).toBe("Remera")
    expect(linea.precio).toBe(2500)
  })

  test("P0-C: seleccionar variante B crea PedidoItem con B", async () => {
    const res = await callPost([item({ productoId: "p-remera", varianteId: "v-azul" })])
    expect(res.status).toBe(201)
    expect(pedidos[0].items[0].productoVarianteId).toBe("v-azul")
    expect(pedidos[0].items[0].varianteNombre).toBe("Azul")
    expect(pedidos[0].items[0].precio).toBe(3100)
  })

  test("P0-D (servidor): A y B del mismo producto en un pedido quedan como dos PedidoItem independientes", async () => {
    const res = await callPost([
      item({ productoId: "p-remera", varianteId: "v-rojo", cantidad: 1 }),
      item({ productoId: "p-remera", varianteId: "v-azul", cantidad: 2 }),
    ])
    expect(res.status).toBe(201)
    const lineas = pedidos[0].items
    expect(lineas).toHaveLength(2)
    expect(lineas.map((l) => l.productoVarianteId)).toEqual(["v-rojo", "v-azul"])
    expect(pedidos[0].totalProductos).toBe(2500 + 3100 * 2)
  })

  test("P0-E: un precio manipulado en el body nunca gana — el servidor usa ProductoVariante.precio (sin descuento base)", async () => {
    const res = await callPost([item({ productoId: "p-remera", varianteId: "v-rojo", precio: 1, precioUnitario: 1, total: 1 })])
    expect(res.status).toBe(201)
    expect(pedidos[0].items[0].precio).toBe(2500)
    expect(pedidos[0].total).toBe(2500)
  })

  test("P0-F: producto con variantes sin variante seleccionada → rechazo", async () => {
    await expectRejected([item({ productoId: "p-remera" })], "Debe seleccionar una variante")
  })

  test("P0-G: variante que pertenece a otro producto del mismo negocio → rechazo", async () => {
    await expectRejected([item({ productoId: "p-remera", varianteId: "v-buzo-gris" })], "Variante invalida")
  })

  test("P0-H / tenant: producto del negocio A + variante del negocio B → rechazo, sin pedido", async () => {
    await expectRejected([item({ productoId: "p-remera", varianteId: "v-ajena" })], "Variante invalida")
  })

  test("tenant: producto del negocio B (con su propia variante) nunca es visible para el Mozo de A", async () => {
    const res = await callPost([item({ productoId: "p-ajeno", varianteId: "v-ajena" })])
    expect(res.status).toBe(400)
    expect(pedidos).toHaveLength(0)
  })

  test("variante inexistente → rechazo", async () => {
    await expectRejected([item({ productoId: "p-remera", varianteId: "no-existe" })], "Variante invalida")
  })

  test("P0-I: variante inactiva → rechazo", async () => {
    await expectRejected([item({ productoId: "p-remera", varianteId: "v-verde-inactiva" })], "Variante invalida")
  })

  test("NO_ACTIVE_VARIANTS: producto con variantes pero ninguna activa → nunca cae al precio base", async () => {
    await expectRejected([item({ productoId: "p-sin-activas" })], "Debe seleccionar una variante")
    await expectRejected([item({ productoId: "p-sin-activas", varianteId: "v-gorra-inactiva" })], "Variante invalida")
  })

  test("P0-J: variante controlada con stockCantidad <= 0 → rechazo", async () => {
    await expectRejected([item({ productoId: "p-remera", varianteId: "v-negro-agotada" })], "Variante sin stock")
  })

  test("P0-K: variante disponible (controlada con stock, o sin control) → pedido creado", async () => {
    expect((await callPost([item({ productoId: "p-remera", varianteId: "v-rojo" })])).status).toBe(201)
    expect((await callPost([item({ productoId: "p-remera", varianteId: "v-azul" })])).status).toBe(201)
    expect(pedidos).toHaveLength(2)
  })

  test("P0-L: producto sin variantes + varianteId → rechazo", async () => {
    await expectRejected([item({ productoId: "p-simple", varianteId: "v-rojo" })], "Este producto no tiene variantes")
  })

  test("P0-O: secciones propias con precio se siguen validando/cobrando sobre el precio de la variante", async () => {
    const res = await callPost([item({ productoId: "p-remera", varianteId: "v-rojo", secciones: { Tamano: "Grande" } })])
    expect(res.status).toBe(201)
    const [linea] = pedidos[0].items
    expect(linea.precio).toBe(2500)
    expect(JSON.parse(linea.secciones as string)).toEqual({ Tamano: "Grande" })
    expect(JSON.parse(linea.seccionesPrecios as string)).toEqual({ "Tamano::Grande": 200 })
    expect(pedidos[0].totalProductos).toBe(2700)
  })

  test("P0 stock: el pedido nunca reserva ni descuenta stock de la variante", async () => {
    await callPost([item({ productoId: "p-remera", varianteId: "v-rojo", cantidad: 2 })])
    expect(variantes.find((v) => v.id === "v-rojo")?.stockCantidad).toBe(3)
  })

  test("P0-N: el snapshot no depende de que la variante siga igual después", async () => {
    await callPost([item({ productoId: "p-remera", varianteId: "v-rojo" })])
    const rojo = variantes.find((v) => v.id === "v-rojo")!
    rojo.nombre = "Rojo renombrado"
    rojo.precio = 9999
    expect(pedidos[0].items[0].varianteNombre).toBe("Rojo")
    expect(pedidos[0].items[0].precio).toBe(2500)
  })

  test("idempotencia: misma key + misma variante → mismo pedido; misma key + otra variante → 409", async () => {
    const key = crypto.randomUUID()
    expect((await callPost([item({ productoId: "p-remera", varianteId: "v-rojo" })], key)).status).toBe(201)
    const replay = await callPost([item({ productoId: "p-remera", varianteId: "v-rojo" })], key)
    expect(replay.status).toBe(200)
    expect((await replay.json()).idempotent).toBe(true)
    const conflict = await callPost([item({ productoId: "p-remera", varianteId: "v-azul" })], key)
    expect(conflict.status).toBe(409)
    expect(pedidos).toHaveLength(1)
  })

  test("varianteId no-string → 400 de validación de payload", async () => {
    const res = await callPost([item({ productoId: "p-remera", varianteId: 123 })])
    expect(res.status).toBe(400)
    expect(pedidos).toHaveLength(0)
  })
})

describe("P2-T56-R3A-P0 — GET Mozo: contrato de variantes", () => {
  test("producto con variantes: tieneVariantes=true y SÓLO variantes activas con campos mínimos", async () => {
    const res = await callGet()
    const data = await res.json()
    const remera = data.productos.find((p: { id: string }) => p.id === "p-remera")
    expect(remera.tieneVariantes).toBe(true)
    expect(remera.variantes).toEqual([
      { id: "v-rojo", nombre: "Rojo", precio: 2500, controlStock: true, stockCantidad: 3 },
      { id: "v-azul", nombre: "Azul", precio: 3100, controlStock: false, stockCantidad: 0 },
      { id: "v-negro-agotada", nombre: "Negro", precio: 2200, controlStock: true, stockCantidad: 0 },
    ])
  })

  test("nunca expone costo/sku/codigoBarras/stockMinimo/activo de una variante", async () => {
    const data = await (await callGet()).json()
    for (const p of data.productos) {
      for (const v of p.variantes) {
        expect(Object.keys(v).sort()).toEqual(["controlStock", "id", "nombre", "precio", "stockCantidad"])
      }
    }
  })

  test("producto sin variantes: tieneVariantes=false y variantes=[] (forma previa preservada)", async () => {
    const data = await (await callGet()).json()
    const cafe = data.productos.find((p: { id: string }) => p.id === "p-simple")
    expect(cafe.tieneVariantes).toBe(false)
    expect(cafe.variantes).toEqual([])
    expect(cafe.precio).toBe(1000)
  })

  test("producto con variantes todas inactivas: tieneVariantes=true, variantes=[]", async () => {
    const data = await (await callGet()).json()
    const gorra = data.productos.find((p: { id: string }) => p.id === "p-sin-activas")
    expect(gorra.tieneVariantes).toBe(true)
    expect(gorra.variantes).toEqual([])
  })

  test("tenant: el menú del Mozo de A nunca incluye productos ni variantes del negocio B", async () => {
    const data = await (await callGet()).json()
    const ids = data.productos.map((p: { id: string }) => p.id)
    expect(ids).not.toContain("p-ajeno")
    const varianteIds = data.productos.flatMap((p: { variantes: Array<{ id: string }> }) => p.variantes.map((v) => v.id))
    expect(varianteIds).not.toContain("v-ajena")
  })
})
