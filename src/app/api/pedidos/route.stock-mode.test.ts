// ============================================
// P2-T56-R3A-I2-F1 — POST /api/pedidos: lectura de modo serializada
// ============================================
// Route REAL contra un `@/lib/db` en memoria con rollback por snapshot en
// $transaction y registro del isolationLevel. El objeto `tx` que recibe la
// transacción es DISTINTO de `db`, y cada uno puede devolver un modo propio:
// así se modela la carrera OFF→ON (un valor viejo/hint leído afuera vs. el
// valor autoritativo leído adentro de la tx). Negocio genérico + línea
// controlada debe correr SIEMPRE Serializable y decidir sólo con la lectura
// interior. La concurrencia SSI real queda para la integración en TESTING.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

const NEGOCIO = "negocio-a"
const CLIENTE = "cliente-1"

interface ProductoRow {
  id: string
  negocioId: string
  nombre: string
  precio: number
  controlStock: boolean
  stockCantidad: number
}

interface State {
  rubro: string
  /** Modo que ve una lectura sobre `db` (fuera de la tx): sólo un hint, nunca autoridad. */
  outerMode: unknown
  /** Modo que ve una lectura sobre `tx` (dentro de la tx): la autoridad. */
  innerMode: unknown
  outerConfigReads: number
  innerConfigReads: number
  productos: ProductoRow[]
  pedidos: Array<Record<string, unknown> & { id: string; items: Array<Record<string, unknown>> }>
  reservas: Array<Record<string, unknown>>
}

let state: State
let isolationLevels: Array<string | undefined>

function reset(overrides: Partial<State> = {}) {
  state = {
    rubro: "negocio",
    outerMode: "OFF",
    innerMode: "OFF",
    outerConfigReads: 0,
    innerConfigReads: 0,
    productos: [
      { id: "p-base", negocioId: NEGOCIO, nombre: "Gaseosa", precio: 1000, controlStock: true, stockCantidad: 5 },
      { id: "p-libre", negocioId: NEGOCIO, nombre: "Pan", precio: 500, controlStock: false, stockCantidad: 0 },
    ],
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
    variantes: [],
  }
}

mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME: "deligo_session",
  findSesionByToken: async () => ({ userType: "cliente", userId: CLIENTE }),
  getOperationalAccountFromRequest: async () => null,
}))
mock.module("@/lib/operaciones-terminal-auth", () => ({ resolveTerminalSession: async () => null }))
mock.module("@/lib/rate-limit", () => ({
  getClientIp: () => "127.0.0.1",
  checkRateLimit: () => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 }),
  rateLimitResponse: () => new Response(null, { status: 429 }),
}))
mock.module("@/lib/client-block-security", () => ({
  applyDeviceEvasionAutoBlock: async () => {},
  ensureClienteBloqueadoRecordForDevice: async () => {},
  findForeignDeviceBlockMatch: async () => null,
}))
mock.module("@/lib/push", () => ({
  createNotification: async () => {},
  newOrderNotification: () => ({ title: "", body: "" }),
  salonNewOrderNotification: () => ({ title: "", body: "" }),
}))
mock.module("@/lib/salon-new-order-notification", () => ({
  notifySalonNewOrderForOperations: async () => ({ attemptedEndpoints: [] }),
  parseSubscriptionEndpoint: () => null,
}))
mock.module("@/lib/pyr-new-order-notification", () => ({ notifyPyrNewOrder: async () => {} }))
mock.module("@/lib/business-hours", () => ({ isBusinessOpenAt: () => true }))
mock.module("@/lib/platform-settings", () => ({ PLATFORM_CONFIG_KEY: "platform", getPlatformServiceFee: async () => 0 }))

function buildClient(scope: "outer" | "inner") {
  return {
    configPlataforma: {
      findUnique: async () => {
        if (scope === "outer") state.outerConfigReads++
        else state.innerConfigReads++
        return { stockReservaModo: scope === "outer" ? state.outerMode : state.innerMode }
      },
    },
    negocio: {
      findUnique: async () => ({
        id: NEGOCIO,
        slug: "negocio-a",
        nombre: "Negocio A",
        rubro: state.rubro,
        aprobado: true,
        suspendido: false,
        ofreceRetiro: true,
        ofreceDelivery: false,
        lat: null,
        lng: null,
        seguimientoDeliveryActivo: false,
        horarios: "{}",
        horarioMode: "simple",
        abiertoManual: true,
        timezone: "America/Argentina/Buenos_Aires",
        pushSubscription: null,
        pushSubscriptionSalon: null,
      }),
    },
    cliente: {
      findUnique: async () => ({ id: CLIENTE, nombre: "Cliente", telefono: "123", bloqueado: false }),
      update: async () => ({}),
    },
    opcionesCompartidas: { findMany: async () => [] },
    producto: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        state.productos.filter((p) => where.id.in.includes(p.id)).map(productoView),
      findFirst: async ({ where }: { where: { id: string; negocioId: string } }) => {
        const p = state.productos.find((row) => row.id === where.id && row.negocioId === where.negocioId)
        return p ? { controlStock: p.controlStock, stockCantidad: p.stockCantidad } : null
      },
    },
    productoVariante: { findFirst: async () => null },
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
  }
}

mock.module("@/lib/db", () => {
  const tx = buildClient("inner")
  return {
    db: {
      ...buildClient("outer"),
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
  return { productoId: "p-base", cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], ...overrides }
}

async function callPost(items: Array<Record<string, unknown>>, idempotencyKey?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json", cookie: "deligo_session=token" }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey
  const req = new NextRequest("http://localhost/api/pedidos", {
    method: "POST",
    headers,
    body: JSON.stringify({
      negocioId: NEGOCIO,
      items,
      metodoEntrega: "retiro",
      metodoPago: "efectivo",
      notas: "",
      direccion: "",
      referencia: "",
      lat: null,
      lng: null,
    }),
  })
  const res = await POST(req)
  return { res, body: await res.json() }
}

beforeEach(() => reset())

describe("P2-T56-R3A-I2-F1 — negocio genérico + línea controlada: SIEMPRE Serializable, modo leído dentro de la tx", () => {
  test("F1-A: modo OFF → igual usa runStockSerializable (isolationLevel Serializable)", async () => {
    const { res } = await callPost([item()])
    expect(res.status).toBe(201)
    expect(isolationLevels).toEqual(["Serializable"])
  })

  // P2-T56-R3A-I4 (decisión 1 del operador): F1-B cambia a propósito. Antes
  // (I2) el modo OFF creaba el Pedido sin validar disponible; desde I4 un
  // pedido individual de Cliente/Mesa de negocio genérico nunca supera el
  // disponible, también en OFF (sin crear reservas). Ver el bloque I4 abajo.
  test("F1-B (I4): modo OFF con cantidad > disponible → 409 STOCK_INSUFFICIENT, sin Pedido, sin reservas, sin tocar stock", async () => {
    const { res, body } = await callPost([item({ cantidad: 99 })])
    expect(res.status).toBe(409)
    expect(body.code).toBe("STOCK_INSUFFICIENT")
    expect(state.pedidos).toHaveLength(0)
    expect(state.reservas).toHaveLength(0)
    expect(state.productos.find((p) => p.id === "p-base")!.stockCantidad).toBe(5)
  })

  test("F1-C: el modo autoritativo se lee DENTRO de la tx; ninguna lectura del modo sobre db afuera", async () => {
    await callPost([item()])
    expect(state.innerConfigReads).toBe(1)
    expect(state.outerConfigReads).toBe(0)
  })

  test("F1-E: hint OFF afuera vs. ON autoritativo adentro → gana ON y se reserva (nunca un pedido sin reserva por el OFF viejo)", async () => {
    reset({ outerMode: "OFF", innerMode: "ON" })
    const { res } = await callPost([item({ cantidad: 2 })])
    expect(res.status).toBe(201)
    expect(isolationLevels).toEqual(["Serializable"])
    const [pedido] = state.pedidos
    expect(state.reservas).toEqual([
      expect.objectContaining({ pedidoId: pedido.id, pedidoItemId: pedido.items[0].id, productoId: "p-base", cantidad: 2, estado: "ACTIVA" }),
    ])
  })

  test("F1-E (inverso): ON autoritativo adentro sin disponible → 409 STOCK_INSUFFICIENT aunque el hint externo diga OFF", async () => {
    reset({ outerMode: "OFF", innerMode: "ON" })
    const { res, body } = await callPost([item({ cantidad: 6 })])
    expect(res.status).toBe(409)
    expect(body.code).toBe("STOCK_INSUFFICIENT")
    expect(state.pedidos).toHaveLength(0)
    expect(state.reservas).toHaveLength(0)
  })

  test("F1-F: DRAINING interior → 409 STOCK_RESERVATIONS_DRAINING, cero Pedido", async () => {
    reset({ outerMode: "OFF", innerMode: "DRAINING" })
    const { res, body } = await callPost([item()])
    expect(res.status).toBe(409)
    expect(body.code).toBe("STOCK_RESERVATIONS_DRAINING")
    expect(state.pedidos).toHaveLength(0)
  })

  test("F1-G: modo interior inválido → 503 STOCK_RESERVATION_MODE_INVALID (fail-closed), cero Pedido", async () => {
    reset({ outerMode: "OFF", innerMode: "garbage" })
    const { res, body } = await callPost([item()])
    expect(res.status).toBe(503)
    expect(body.code).toBe("STOCK_RESERVATION_MODE_INVALID")
    expect(state.pedidos).toHaveLength(0)
  })

  test("idempotencia preservada: replay válido con modo ON devuelve el Pedido existente sin duplicar la ReservaStock", async () => {
    reset({ innerMode: "ON" })
    const key = crypto.randomUUID()
    const first = await callPost([item({ cantidad: 2 })], key)
    expect(first.res.status).toBe(201)
    const replay = await callPost([item({ cantidad: 2 })], key)
    expect(replay.res.status).toBe(200)
    expect(replay.body.id).toBe(first.body.id)
    expect(state.pedidos).toHaveLength(1)
    expect(state.reservas).toHaveLength(1)
  })
})

describe("P2-T56-R3A-I4 — validación de disponible en modo OFF (POST /api/pedidos, negocio genérico)", () => {
  test("I4-OFF-A: el 409 identifica la clave con solicitado/disponible (sin datos de reservas)", async () => {
    const { res, body } = await callPost([item({ cantidad: 7 })])
    expect(res.status).toBe(409)
    expect(body.code).toBe("STOCK_INSUFFICIENT")
    expect(body.details).toEqual({
      lineas: [{ productoId: "p-base", productoVarianteId: null, solicitado: 7, disponible: 5 }],
    })
  })

  test("I4-OFF-B: cantidad exactamente igual al disponible → 201, cero ReservaStock y stock físico intacto (OFF nunca descuenta)", async () => {
    const { res } = await callPost([item({ cantidad: 5 })])
    expect(res.status).toBe(201)
    expect(state.pedidos).toHaveLength(1)
    expect(state.reservas).toHaveLength(0)
    expect(state.productos.find((p) => p.id === "p-base")!.stockCantidad).toBe(5)
    expect(isolationLevels).toEqual(["Serializable"])
  })

  test("I4-OFF-C: las líneas de la misma clave se suman (3 + 3 > 5) → 409", async () => {
    const { res, body } = await callPost([item({ cantidad: 3 }), item({ cantidad: 3, notas: "otra" })])
    expect(res.status).toBe(409)
    expect(body.details.lineas).toEqual([{ productoId: "p-base", productoVarianteId: null, solicitado: 6, disponible: 5 }])
    expect(state.pedidos).toHaveLength(0)
  })

  test("I4-OFF-D: reservas ACTIVA residuales descuentan del disponible (5 − 3 = 2)", async () => {
    reset({
      reservas: [{ negocioId: NEGOCIO, productoId: "p-base", productoVarianteId: null, cantidad: 3, estado: "ACTIVA" }],
    })
    const rejected = await callPost([item({ cantidad: 3 })])
    expect(rejected.res.status).toBe(409)
    expect(rejected.body.details.lineas[0]).toMatchObject({ solicitado: 3, disponible: 2 })
    const accepted = await callPost([item({ cantidad: 2 })])
    expect(accepted.res.status).toBe(201)
    expect(state.reservas).toHaveLength(1) // OFF no crea reservas nuevas
  })

  test("I4-OFF-E: línea sin control de stock no se limita (junto a una controlada dentro del disponible)", async () => {
    const { res } = await callPost([item({ productoId: "p-libre", cantidad: 40 }), item({ cantidad: 1 })])
    expect(res.status).toBe(201)
  })

  test("I4-OFF-F: el replay idempotente sigue PRIMERO — devuelve el Pedido existente aunque hoy ya no haya disponible", async () => {
    const key = crypto.randomUUID()
    const first = await callPost([item({ cantidad: 5 })], key)
    expect(first.res.status).toBe(201)
    state.productos.find((p) => p.id === "p-base")!.stockCantidad = 0
    const replay = await callPost([item({ cantidad: 5 })], key)
    expect(replay.res.status).toBe(200)
    expect(replay.body.id).toBe(first.body.id)
    expect(state.pedidos).toHaveLength(1)
  })
})

describe("P2-T56-R3A-I2-F1 — fuera del scope de stock el runner legacy queda intacto", () => {
  for (const [id, rubro] of [["F1-H", "restaurante"], ["F1-I", "ropa"]] as const) {
    test(`${id}: ${rubro} con controlStock → db.$transaction legacy (sin isolationLevel), sin leer modo ni reservar`, async () => {
      reset({ rubro, innerMode: "garbage", outerMode: "garbage" })
      const { res } = await callPost([item({ cantidad: 99 })])
      expect(res.status).toBe(201)
      expect(isolationLevels).toEqual([undefined])
      expect(state.innerConfigReads + state.outerConfigReads).toBe(0)
      expect(state.reservas).toHaveLength(0)
    })
  }

  test("F1-J: negocio genérico sin líneas controladas → runner legacy, sin leer modo", async () => {
    reset({ innerMode: "garbage", outerMode: "garbage" })
    const { res } = await callPost([item({ productoId: "p-libre" })])
    expect(res.status).toBe(201)
    expect(isolationLevels).toEqual([undefined])
    expect(state.innerConfigReads + state.outerConfigReads).toBe(0)
  })
})
