// P2-T46-R2: confirma que un pedido de mesa (metodoEntrega="mesa",
// el único tipo de pedido que crea este endpoint) puede crearse sin
// `metodoPago` en el body — la regla canónica de T46 es que el método
// de pago de una mesa se decide al CIERRE DE CUENTA
// (SesionOcupacionMesa), nunca al tomar un pedido individual. Mockea
// `@/lib/db` y todos los colaboradores de módulo (auth/ocupación/push),
// dejando correr sin mockear los helpers puros definidos en el propio
// route.ts (validateIncomingItems, calculateEffectiveProductPrice,
// etc.) contra datos de un producto simple, mismo patrón ya usado en
// pyr/panel/route.test.ts y negocio/salon/stats/route.test.ts.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

const NEGOCIO_ID = "negocio-1"
const EMPLEADO_ID = "empleado-1"
const CUENTA_ID = "cuenta-1"
const MESA_ID = "mesa-1"
const PRODUCTO_ID = "producto-1"
const OCUPACION_ID = "ocupacion-1"

let pedidoCreateCalls: Array<Record<string, unknown>>
let existingPedido: Record<string, unknown> | null

function simpleProducto() {
  return {
    id: PRODUCTO_ID,
    negocioId: NEGOCIO_ID,
    nombre: "Producto simple",
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
  }
}

mock.module("@/lib/operativo-mozo", () => ({
  noStore: <T,>(response: T) => response,
  resolveOperativoMozoForSlug: async () => ({
    ok: true,
    cuenta: { id: CUENTA_ID, nombre: "Cuenta Test" },
    empleado: {
      id: EMPLEADO_ID,
      nombre: "Mozo Test",
      codigo: "M1",
      rol: "mozo",
      activo: true,
      negocioId: NEGOCIO_ID,
    },
    areaOperativa: "mozo",
    areaOperativaEfectiva: "mozo",
    negocio: {
      id: NEGOCIO_ID,
      nombre: "Negocio Test",
      slug: "negocio-test",
      colorPrincipal: "#000000",
      logoUrl: null,
      salonActivo: true,
      empleadosActivos: true,
    },
  }),
}))

mock.module("@/lib/mesa-occupancy", () => ({
  openOrReuseMesaOccupancyForStaff: async () => ({
    ocupacionId: OCUPACION_ID,
    occupancyCreated: false,
    pointerRepaired: false,
  }),
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
    cuentaOperativa: {
      findFirst: async () => ({ id: CUENTA_ID }),
    },
    empleado: {
      findFirst: async () => ({ id: EMPLEADO_ID, nombre: "Mozo Test" }),
    },
    pedido: {
      findFirst: async () => existingPedido,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        pedidoCreateCalls.push(data)
        return { id: "pedido-nuevo-1", ...data, items: [] }
      },
    },
    mesa: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({ id: MESA_ID, numero: 5, empleadoId: EMPLEADO_ID }),
    },
    negocio: {
      findFirst: async () => ({
        id: NEGOCIO_ID,
        slug: "negocio-test",
        nombre: "Negocio Test",
        lat: null,
        lng: null,
        horarios: "{}",
        timezone: "America/Argentina/Buenos_Aires",
        horarioMode: "simple",
        abiertoManual: true,
      }),
      // Sólo consultado por los intentos de notificación push best-effort
      // posteriores a la creación — nunca por la creación del pedido en sí.
      findUnique: async () => ({ pushSubscription: null, pushSubscriptionSalon: null }),
    },
    producto: {
      findMany: async () => [simpleProducto()],
    },
    opcionesCompartidas: {
      findMany: async () => [],
    },
    sesionOcupacionMesa: {
      updateMany: async () => ({ count: 1 }),
    },
    auditLog: {
      create: async () => ({}),
    },
  }

  const db = {
    ...tx,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
  }

  return { db }
})

const { POST } = await import("./route")

function callPost(body: Record<string, unknown>) {
  const req = new NextRequest("http://localhost/api/operativo/mozo/panel/negocio-test/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return POST(req, { params: Promise.resolve({ slug: "negocio-test" }) })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: crypto.randomUUID(),
    mesaId: MESA_ID,
    notas: "",
    items: [
      {
        productoId: PRODUCTO_ID,
        cantidad: 1,
        agregados: [],
        secciones: {},
        ingredientesQuitados: [],
        talle: "",
        color: "",
      },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  pedidoCreateCalls = []
  existingPedido = null
})

describe("P2-T46-R2 — POST /api/operativo/mozo/panel/[slug]/pedidos: pedido de mesa sin metodoPago", () => {
  test("un pedido de mesa válido se crea SIN metodoPago en el body (201/200, sin 400)", async () => {
    const res = await callPost(validBody())
    const data = await res.json()
    expect(res.status).toBeLessThan(300)
    expect(data.error).toBeUndefined()
  })

  test("MOZO_POST_CAN_OMIT_METODO_PAGO: la creación nunca falla por falta de metodoPago", async () => {
    const res = await callPost(validBody())
    expect(res.status).not.toBe(400)
  })

  test("el body de Pedido.create NUNCA incluye la key metodoPago (la columna toma su default de schema)", async () => {
    await callPost(validBody())
    expect(pedidoCreateCalls).toHaveLength(1)
    expect(Object.prototype.hasOwnProperty.call(pedidoCreateCalls[0], "metodoPago")).toBe(false)
  })

  test("metodoEntrega sigue siendo 'mesa' sin cambios", async () => {
    await callPost(validBody())
    expect(pedidoCreateCalls[0].metodoEntrega).toBe("mesa")
  })

  test("un cliente legacy que todavía envía metodoPago='efectivo' no rompe la creación (se ignora)", async () => {
    const res = await callPost(validBody({ metodoPago: "efectivo" }))
    expect(res.status).toBeLessThan(300)
    expect(pedidoCreateCalls).toHaveLength(1)
    expect(Object.prototype.hasOwnProperty.call(pedidoCreateCalls[0], "metodoPago")).toBe(false)
  })

  test("un cliente legacy que envía metodoPago='transferencia' tampoco es exigido/usado como autoridad", async () => {
    const res = await callPost(validBody({ metodoPago: "transferencia" }))
    expect(res.status).toBeLessThan(300)
    expect(Object.prototype.hasOwnProperty.call(pedidoCreateCalls[0], "metodoPago")).toBe(false)
  })

  test("un metodoPago inválido/basura en el body tampoco bloquea la creación (nunca se valida)", async () => {
    const res = await callPost(validBody({ metodoPago: "bitcoin" }))
    expect(res.status).toBeLessThan(300)
  })

  test("notas se sigue enviando y persistiendo sin cambios", async () => {
    await callPost(validBody({ notas: "Sin cebolla por favor" }))
    expect(pedidoCreateCalls[0].notas).toBe("Sin cebolla por favor")
  })
})
