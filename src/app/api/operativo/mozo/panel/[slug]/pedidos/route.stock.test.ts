// ============================================
// P2-T56-R3A-I2 — creación de pedido manual de Mozo + lifecycle de stock
// ============================================
// Route REAL contra un `@/lib/db` en memoria con rollback real (snapshot en
// $transaction) y registro del isolationLevel. Prueba el wiring de uno de los
// dos creadores: scope por rubro, modos OFF/ON/DRAINING/inválido, reserva por
// PedidoItem pre-generado, rollback ante stock insuficiente. Mismo patrón de
// mocks de módulo que route.variantes.test.ts. La concurrencia SSI real queda
// para la integración en TESTING.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

const NEGOCIO = "negocio-a"
const EMPLEADO_ID = "empleado-1"
const CUENTA_ID = "cuenta-1"
const MESA_ID = "mesa-1"
const OCUPACION_ID = "ocupacion-1"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

interface ProductoRow {
  id: string
  negocioId: string
  nombre: string
  precio: number
  controlStock: boolean
  stockCantidad: number
}
interface VarianteRow {
  id: string
  productoId: string
  nombre: string
  precio: number
  controlStock: boolean
  stockCantidad: number
  activo: boolean
}

interface State {
  rubro: string
  mode: unknown
  configReads: number
  productos: ProductoRow[]
  variantes: VarianteRow[]
  pedidos: Array<Record<string, unknown> & { id: string; items: Array<Record<string, unknown>> }>
  reservas: Array<Record<string, unknown>>
}

let state: State
let isolationLevels: Array<string | undefined>

function reset(overrides: Partial<State> = {}) {
  state = {
    rubro: "negocio",
    mode: "ON",
    configReads: 0,
    productos: [
      { id: "p-base", negocioId: NEGOCIO, nombre: "Gaseosa", precio: 1000, controlStock: true, stockCantidad: 5 },
      { id: "p-libre", negocioId: NEGOCIO, nombre: "Pan", precio: 500, controlStock: false, stockCantidad: 0 },
      { id: "p-remera", negocioId: NEGOCIO, nombre: "Remera", precio: 1, controlStock: false, stockCantidad: 0 },
    ],
    variantes: [{ id: "v-rojo", productoId: "p-remera", nombre: "Rojo", precio: 2500, controlStock: true, stockCantidad: 3, activo: true }],
    pedidos: [],
    reservas: [],
    ...overrides,
  }
  isolationLevels = []
}

function productoView(p: ProductoRow) {
  return {
    ...p,
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
    variantes: state.variantes.filter((v) => v.productoId === p.id).map((v) => ({ ...v })),
  }
}

mock.module("@/lib/operativo-mozo", () => ({
  noStore: <T,>(response: T) => response,
  resolveOperativoMozoForSlug: async () => ({
    ok: true,
    cuenta: { id: CUENTA_ID, nombre: "Cuenta" },
    empleado: { id: EMPLEADO_ID, nombre: "Mozo", codigo: "M1", rol: "mozo", activo: true, negocioId: NEGOCIO },
    areaOperativa: "mozo",
    areaOperativaEfectiva: "mozo",
    negocio: { id: NEGOCIO, nombre: "Negocio A", slug: "negocio-a", colorPrincipal: "#000", logoUrl: null, salonActivo: true, empleadosActivos: true },
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
mock.module("@/lib/rate-limit", () => ({ getClientIp: () => "127.0.0.1" }))

mock.module("@/lib/db", () => {
  const tx = {
    cuentaOperativa: { findFirst: async () => ({ id: CUENTA_ID }) },
    empleado: { findFirst: async () => ({ id: EMPLEADO_ID, nombre: "Mozo" }) },
    mesa: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({ id: MESA_ID, numero: 5, empleadoId: EMPLEADO_ID }),
    },
    negocio: {
      findFirst: async () => ({
        id: NEGOCIO, slug: "negocio-a", nombre: "Negocio A", lat: null, lng: null, horarios: "{}",
        timezone: "America/Argentina/Buenos_Aires", horarioMode: "simple", abiertoManual: true, rubro: state.rubro,
      }),
      findUnique: async () => ({ rubro: state.rubro, categorias: "[]", pushSubscription: null, pushSubscriptionSalon: null }),
    },
    configPlataforma: {
      findUnique: async () => {
        state.configReads++
        return { stockReservaModo: state.mode }
      },
    },
    producto: {
      findMany: async ({ where }: { where: { id: { in: string[] }; negocioId: string } }) =>
        state.productos.filter((p) => where.id.in.includes(p.id) && p.negocioId === where.negocioId).map(productoView),
      findFirst: async ({ where }: { where: { id: string; negocioId: string } }) => {
        const p = state.productos.find((row) => row.id === where.id && row.negocioId === where.negocioId)
        return p ? { controlStock: p.controlStock, stockCantidad: p.stockCantidad } : null
      },
    },
    productoVariante: {
      findFirst: async ({ where }: { where: { id: string; productoId: string; producto: { negocioId: string } } }) => {
        const v = state.variantes.find((row) => row.id === where.id && row.productoId === where.productoId)
        const parent = v && state.productos.find((p) => p.id === v.productoId)
        return v && parent?.negocioId === where.producto.negocioId ? { controlStock: v.controlStock, stockCantidad: v.stockCantidad } : null
      },
    },
    reservaStock: {
      aggregate: async ({ where }: { where: Record<string, unknown> }) => {
        const rows = state.reservas.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v))
        return { _sum: { cantidad: rows.length ? rows.reduce((s, r) => s + (r.cantidad as number), 0) : null } }
      },
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        state.reservas.push(...data.map((row) => ({ ...row })))
        return { count: data.length }
      },
    },
    opcionesCompartidas: { findMany: async () => [] },
    pedido: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        state.pedidos.find((p) => p.negocioId === where.negocioId && p.idempotencyKey === where.idempotencyKey) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const items = (data.items as { create: Array<Record<string, unknown>> }).create.map((item) => ({ ...item }))
        const pedido = { id: `pedido-${state.pedidos.length + 1}`, ...data, items }
        state.pedidos.push(pedido)
        return pedido
      },
    },
    auditLog: { create: async () => ({}) },
  }
  return {
    db: {
      ...tx,
      $transaction: async (fn: (t: unknown) => Promise<unknown>, options?: { isolationLevel?: string }) => {
        isolationLevels.push(options?.isolationLevel)
        const snapshot = structuredClone({ pedidos: state.pedidos, reservas: state.reservas })
        try {
          return await fn(tx)
        } catch (error) {
          state.pedidos = snapshot.pedidos
          state.reservas = snapshot.reservas
          throw error
        }
      },
    },
  }
})

const { POST } = await import("./route")

function item(overrides: Record<string, unknown> = {}) {
  return { productoId: "p-base", cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "", ...overrides }
}

async function callPost(items: Array<Record<string, unknown>>) {
  const req = new NextRequest("http://localhost/api/operativo/mozo/panel/negocio-a/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), mesaId: MESA_ID, notas: "", items }),
  })
  const res = await POST(req, { params: Promise.resolve({ slug: "negocio-a" }) })
  return { res, body: await res.json() }
}

beforeEach(() => reset())

describe("P2-T56-R3A-I2 — POST Mozo + lifecycle de stock", () => {
  test("I2-G (modo OFF): pedido creado sin reserva ni validación nueva; PedidoItem con id UUID pre-generado", async () => {
    reset({ mode: "OFF" })
    const { res } = await callPost([item({ cantidad: 99 })])
    expect(res.status).toBe(201)
    expect(state.reservas).toHaveLength(0)
    expect(state.pedidos[0].items[0].id).toMatch(UUID)
    expect(isolationLevels).toEqual(["Serializable"])
  })

  test("I2-I (modo ON): reserva ACTIVA mapeada al PedidoItem.id real de la línea, físico intacto", async () => {
    const { res } = await callPost([item({ cantidad: 2 }), item({ productoId: "p-libre", cantidad: 3 })])
    expect(res.status).toBe(201)
    const [pedido] = state.pedidos
    const lineaControlada = pedido.items.find((i) => i.productoId === "p-base")!
    expect(state.reservas).toEqual([
      expect.objectContaining({ negocioId: NEGOCIO, pedidoId: pedido.id, pedidoItemId: lineaControlada.id, productoId: "p-base", productoVarianteId: null, cantidad: 2, estado: "ACTIVA" }),
    ])
    expect(state.productos.find((p) => p.id === "p-base")!.stockCantidad).toBe(5)
  })

  test("I2-K (modo ON): variante controlada → reserva con productoVarianteId", async () => {
    const { res } = await callPost([item({ productoId: "p-remera", varianteId: "v-rojo", cantidad: 2 })])
    expect(res.status).toBe(201)
    expect(state.reservas[0]).toEqual(expect.objectContaining({ productoId: "p-remera", productoVarianteId: "v-rojo", cantidad: 2 }))
  })

  test("I2-M / I2-O (modo ON): total agregado supera el disponible → 409 STOCK_INSUFFICIENT, cero Pedido y cero reserva", async () => {
    const { res, body } = await callPost([item({ cantidad: 3 }), item({ cantidad: 3 })])
    expect(res.status).toBe(409)
    expect(body.code).toBe("STOCK_INSUFFICIENT")
    expect(state.pedidos).toHaveLength(0)
    expect(state.reservas).toHaveLength(0)
  })

  test("I2-H (modo DRAINING): línea controlada → 409; pedido sólo con líneas sin control → 201", async () => {
    reset({ mode: "DRAINING" })
    const drained = await callPost([item()])
    expect(drained.res.status).toBe(409)
    expect(drained.body.code).toBe("STOCK_RESERVATIONS_DRAINING")
    expect(state.pedidos).toHaveLength(0)
    const libre = await callPost([item({ productoId: "p-libre" })])
    expect(libre.res.status).toBe(201)
  })

  test("I2-AF: modo inválido + línea controlada → fail-closed 503, nunca se trata como OFF", async () => {
    reset({ mode: "garbage" })
    const { res, body } = await callPost([item()])
    expect(res.status).toBe(503)
    expect(body.code).toBe("STOCK_RESERVATION_MODE_INVALID")
    expect(state.pedidos).toHaveLength(0)
  })

  test("I2-E / I2-F: restaurante (y cualquier rubro ≠ negocio) → flujo actual intacto: ni lee el modo ni reserva", async () => {
    for (const rubro of ["restaurante", "ropa"]) {
      reset({ rubro, mode: "garbage" })
      const { res } = await callPost([item({ cantidad: 99 })])
      expect(res.status).toBe(201)
      expect(state.configReads).toBe(0)
      expect(state.reservas).toHaveLength(0)
    }
  })

  test("pedido de negocio genérico sin líneas controladas → no lee el modo ni reserva", async () => {
    reset({ mode: "garbage" })
    const { res } = await callPost([item({ productoId: "p-libre" })])
    expect(res.status).toBe(201)
    expect(state.configReads).toBe(0)
  })
})
