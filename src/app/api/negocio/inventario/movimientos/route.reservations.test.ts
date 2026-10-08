// ============================================
// P2-T56-R3A-I3 — POST /api/negocio/inventario/movimientos con reservas ACTIVA
// ============================================
// Route REAL contra un `@/lib/db` en memoria (rollback por snapshot, opciones
// registradas). Cubre ENTRADA, SALIDA bloqueada por reservas y el protocolo de
// confirmación PREVIA de un AJUSTE deficitario (Decisión A): advertencia sin
// escritura → confirmación con la huella del servidor → revalidación en la tx;
// huella vencida, ajena, de otro negocio o malformada nunca escribe.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

const NEGOCIO = "negocio-a"
const OTRO = "negocio-b"

interface State {
  productos: Array<{ id: string; negocioId: string; controlStock: boolean; stockCantidad: number }>
  variantes: Array<{ id: string; productoId: string; controlStock: boolean; stockCantidad: number }>
  reservas: Array<{ negocioId: string; productoId: string; productoVarianteId: string | null; cantidad: number; estado: string }>
  movimientos: Array<Record<string, unknown>>
}

let state: State
let sessionNegocio: string
let txOptions: Array<Record<string, unknown> | undefined>
let failNextTransactionWith: unknown[] = []
let failMovimiento = false

function reset(overrides: Partial<State> = {}) {
  state = {
    productos: [
      { id: "p-coca", negocioId: NEGOCIO, controlStock: true, stockCantidad: 10 },
      { id: "p-otro", negocioId: NEGOCIO, controlStock: true, stockCantidad: 10 },
      { id: "p-remera", negocioId: NEGOCIO, controlStock: false, stockCantidad: 0 },
      { id: "p-ajeno", negocioId: OTRO, controlStock: true, stockCantidad: 10 },
    ],
    variantes: [{ id: "v-roja", productoId: "p-remera", controlStock: true, stockCantidad: 6 }],
    reservas: [
      { negocioId: NEGOCIO, productoId: "p-coca", productoVarianteId: null, cantidad: 7, estado: "ACTIVA" },
      { negocioId: NEGOCIO, productoId: "p-coca", productoVarianteId: null, cantidad: 40, estado: "CONSUMIDA" },
    ],
    movimientos: [],
    ...overrides,
  }
  sessionNegocio = NEGOCIO
  txOptions = []
  failNextTransactionWith = []
  failMovimiento = false
}

mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME: "deligo_session",
  getUserFromToken: async () => ({ id: sessionNegocio, type: "negocio" }),
}))
mock.module("@/lib/audit", () => ({ auditLog: async () => {} }))

mock.module("@/lib/db", () => {
  const tx = {
    producto: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const p = state.productos.find((row) => row.id === where.id)
        return p ? { ...p } : null
      },
      findFirst: async ({ where }: { where: { id: string; negocioId: string } }) => {
        const p = state.productos.find((row) => row.id === where.id && row.negocioId === where.negocioId)
        return p ? { controlStock: p.controlStock, stockCantidad: p.stockCantidad } : null
      },
      update: async ({ where, data }: { where: { id: string }; data: { stockCantidad: number } }) => {
        const p = state.productos.find((row) => row.id === where.id)!
        p.stockCantidad = data.stockCantidad
        return { ...p }
      },
    },
    productoVariante: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const v = state.variantes.find((row) => row.id === where.id)
        return v ? { ...v } : null
      },
      findFirst: async ({ where }: { where: { id: string; productoId: string; producto: { negocioId: string } } }) => {
        const v = state.variantes.find((row) => row.id === where.id && row.productoId === where.productoId)
        const parent = v && state.productos.find((p) => p.id === v.productoId)
        return v && parent?.negocioId === where.producto.negocioId ? { controlStock: v.controlStock, stockCantidad: v.stockCantidad } : null
      },
      update: async ({ where, data }: { where: { id: string }; data: { stockCantidad: number } }) => {
        const v = state.variantes.find((row) => row.id === where.id)!
        v.stockCantidad = data.stockCantidad
        return { ...v }
      },
    },
    reservaStock: {
      aggregate: async ({ where }: { where: Record<string, unknown> }) => {
        const rows = state.reservas.filter((r) => Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
        return { _sum: { cantidad: rows.length ? rows.reduce((s, r) => s + r.cantidad, 0) : null } }
      },
    },
    movimientoInventario: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (failMovimiento) throw new Error("movimiento falló")
        state.movimientos.push({ ...data })
        return { id: `mov-${state.movimientos.length}`, ...data }
      },
    },
  }
  return {
    db: {
      $transaction: async (fn: (t: unknown) => Promise<unknown>, options?: Record<string, unknown>) => {
        txOptions.push(options)
        const injected = failNextTransactionWith.shift()
        if (injected) throw injected
        const snapshot = structuredClone(state)
        try {
          return await fn(tx)
        } catch (error) {
          state = snapshot
          throw error
        }
      },
    },
  }
})

const { POST } = await import("./route")

async function mover(body: Record<string, unknown>) {
  const req = new NextRequest("http://localhost/api/negocio/inventario/movimientos", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "deligo_session=token" },
    body: JSON.stringify({ productoId: "p-coca", ...body }),
  })
  const res = await POST(req)
  return { res, body: await res.json() }
}

const coca = () => state.productos.find((p) => p.id === "p-coca")!.stockCantidad

beforeEach(() => reset())

describe("P2-T56-R3A-I3 — ENTRADA y SALIDA", () => {
  test("ENTRADA normal: 201, suma, reservas intactas, política Serializable explícita", async () => {
    const { res } = await mover({ tipo: "ENTRADA", cantidad: 5 })
    expect(res.status).toBe(201)
    expect(coca()).toBe(15)
    expect(state.reservas.filter((r) => r.estado === "ACTIVA")).toHaveLength(1)
    expect(txOptions).toEqual([{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 }])
  })

  test("SALIDA de 3 (disponible 3): permitida → físico 7", async () => {
    const { res } = await mover({ tipo: "SALIDA", cantidad: 3 })
    expect(res.status).toBe(201)
    expect(coca()).toBe(7)
  })

  test("SALIDA de 4 (disponible 3): 409 STOCK_RESERVED_FOR_ORDERS, nada escrito", async () => {
    const { res, body } = await mover({ tipo: "SALIDA", cantidad: 4 })
    expect(res.status).toBe(409)
    expect(body.code).toBe("STOCK_RESERVED_FOR_ORDERS")
    expect(body.details).toEqual(expect.objectContaining({ stockFisico: 10, reservasActivas: 7, disponible: 3 }))
    expect(coca()).toBe(10)
    expect(state.movimientos).toHaveLength(0)
  })

  test("sin reservas: SALIDA que deja negativo sigue siendo 400 como antes", async () => {
    reset({ reservas: [] })
    const { res, body } = await mover({ tipo: "SALIDA", cantidad: 11 })
    expect(res.status).toBe(400)
    expect(body.error).toBe("El movimiento dejaría el stock en negativo")
  })

  test("producto sin controlStock: 400 como antes", async () => {
    const { res } = await mover({ productoId: "p-remera", tipo: "ENTRADA", cantidad: 1 })
    expect(res.status).toBe(400)
  })

  test("producto de OTRO negocio: 404 (la confirmación nunca permite escribir en otro tenant)", async () => {
    const { res } = await mover({ productoId: "p-ajeno", tipo: "AJUSTE", cantidad: 1 })
    expect(res.status).toBe(404)
    expect(state.productos.find((p) => p.id === "p-ajeno")!.stockCantidad).toBe(10)
  })
})

describe("P2-T56-R3A-I3 — AJUSTE con confirmación previa", () => {
  test("AJUSTE sin déficit (10 → 8): 201 directo", async () => {
    const { res } = await mover({ tipo: "AJUSTE", cantidad: 8 })
    expect(res.status).toBe(201)
    expect(coca()).toBe(8)
  })

  test("AJUSTE deficitario (10 → 5, reservadas 7): advertencia 409 con los 4 valores, SIN escribir", async () => {
    const { res, body } = await mover({ tipo: "AJUSTE", cantidad: 5 })
    expect(res.status).toBe(409)
    expect(body.code).toBe("STOCK_ADJUSTMENT_CONFIRMATION_REQUIRED")
    expect(body.confirmacionVencida).toBe(false)
    expect(body.confirmacion).toEqual({ stockActual: 10, stockPropuesto: 5, reservasActivas: 7, deficitResultante: 2, huella: expect.stringMatching(/^[0-9a-f]{64}$/) })
    expect(body.error).toBe("Hay 7 unidades reservadas para pedidos pendientes. Si cambiás el stock a 5, van a faltar 2 unidades para cubrir esos pedidos.")
    expect(coca()).toBe(10)
    expect(state.movimientos).toHaveLength(0)
  })

  test("confirmar con la huella devuelta: 201, físico 5, movimiento AJUSTE, reservas ACTIVA intactas", async () => {
    const warn = await mover({ tipo: "AJUSTE", cantidad: 5 })
    const { res, body } = await mover({ tipo: "AJUSTE", cantidad: 5, confirmacionAjuste: { huella: warn.body.confirmacion.huella } })
    expect(res.status).toBe(201)
    expect(body.movimiento).toEqual(expect.objectContaining({ tipo: "AJUSTE", cantidad: 5, stockAntes: 10, stockDespues: 5 }))
    expect(coca()).toBe(5)
    expect(state.reservas.find((r) => r.estado === "ACTIVA")).toEqual(expect.objectContaining({ cantidad: 7 }))
  })

  test("reservas cambian entre advertencia y confirmación: NO guarda, nueva advertencia vencida con valores nuevos", async () => {
    const warn = await mover({ tipo: "AJUSTE", cantidad: 5 })
    state.reservas.push({ negocioId: NEGOCIO, productoId: "p-coca", productoVarianteId: null, cantidad: 2, estado: "ACTIVA" })
    const { res, body } = await mover({ tipo: "AJUSTE", cantidad: 5, confirmacionAjuste: { huella: warn.body.confirmacion.huella } })
    expect(res.status).toBe(409)
    expect(body.confirmacionVencida).toBe(true)
    expect(body.confirmacion).toEqual(expect.objectContaining({ reservasActivas: 9, deficitResultante: 4 }))
    expect(coca()).toBe(10)
    expect(state.movimientos).toHaveLength(0)
  })

  test("stock físico cambia entre advertencia y confirmación: NO guarda, advertencia vencida", async () => {
    const warn = await mover({ tipo: "AJUSTE", cantidad: 5 })
    state.productos.find((p) => p.id === "p-coca")!.stockCantidad = 12
    const { res, body } = await mover({ tipo: "AJUSTE", cantidad: 5, confirmacionAjuste: { huella: warn.body.confirmacion.huella } })
    expect(res.status).toBe(409)
    expect(body.confirmacionVencida).toBe(true)
    expect(body.confirmacion.stockActual).toBe(12)
    expect(coca()).toBe(12)
  })

  test("huella de OTRO producto no confirma este ajuste", async () => {
    state.reservas.push({ negocioId: NEGOCIO, productoId: "p-otro", productoVarianteId: null, cantidad: 7, estado: "ACTIVA" })
    const warnOtro = await mover({ productoId: "p-otro", tipo: "AJUSTE", cantidad: 5 })
    const { res, body } = await mover({ tipo: "AJUSTE", cantidad: 5, confirmacionAjuste: { huella: warnOtro.body.confirmacion.huella } })
    expect(res.status).toBe(409)
    expect(body.confirmacionVencida).toBe(true)
    expect(coca()).toBe(10)
  })

  test("huella emitida para OTRO negocio no confirma (la huella incluye el negocio de la sesión)", async () => {
    // El negocio B ve una advertencia sobre SU producto; esa huella reenviada
    // por el negocio A sobre el producto de A nunca coincide.
    state.reservas.push({ negocioId: OTRO, productoId: "p-ajeno", productoVarianteId: null, cantidad: 7, estado: "ACTIVA" })
    sessionNegocio = OTRO
    const warnB = await mover({ productoId: "p-ajeno", tipo: "AJUSTE", cantidad: 5 })
    expect(warnB.body.code).toBe("STOCK_ADJUSTMENT_CONFIRMATION_REQUIRED")
    sessionNegocio = NEGOCIO
    const { res, body } = await mover({ tipo: "AJUSTE", cantidad: 5, confirmacionAjuste: { huella: warnB.body.confirmacion.huella } })
    expect(res.status).toBe(409)
    expect(body.confirmacionVencida).toBe(true)
    expect(coca()).toBe(10)
  })

  test("confirmación malformada (no es una huella del servidor) → 400 sin tocar nada", async () => {
    for (const confirmacionAjuste of [{ huella: "true" }, { confirmado: true }, { huella: 123 }]) {
      const { res } = await mover({ tipo: "AJUSTE", cantidad: 5, confirmacionAjuste })
      expect(res.status).toBe(400)
    }
    expect(coca()).toBe(10)
    expect(state.movimientos).toHaveLength(0)
  })

  test("AJUSTE en variante con reservas de esa variante: déficit de la variante", async () => {
    state.reservas.push({ negocioId: NEGOCIO, productoId: "p-remera", productoVarianteId: "v-roja", cantidad: 4, estado: "ACTIVA" })
    const { res, body } = await mover({ productoId: "p-remera", productoVarianteId: "v-roja", tipo: "AJUSTE", cantidad: 1 })
    expect(res.status).toBe(409)
    expect(body.confirmacion).toEqual(expect.objectContaining({ stockActual: 6, reservasActivas: 4, deficitResultante: 3 }))
  })

  test("rollback: si falla el movimiento confirmado, el stock no queda escrito", async () => {
    const warn = await mover({ tipo: "AJUSTE", cantidad: 5 })
    failMovimiento = true
    const { res } = await mover({ tipo: "AJUSTE", cantidad: 5, confirmacionAjuste: { huella: warn.body.confirmacion.huella } })
    expect(res.status).toBe(500)
    expect(coca()).toBe(10)
  })

  test("P2034 durante la confirmación: se reintenta y revalida (sigue vigente → guarda)", async () => {
    const warn = await mover({ tipo: "AJUSTE", cantidad: 5 })
    failNextTransactionWith = [new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" })]
    txOptions = []
    const { res } = await mover({ tipo: "AJUSTE", cantidad: 5, confirmacionAjuste: { huella: warn.body.confirmacion.huella } })
    expect(res.status).toBe(201)
    expect(txOptions).toHaveLength(2)
  })

  test("P2028 (timeout) no se reintenta → 500, un intento", async () => {
    failNextTransactionWith = [new Prisma.PrismaClientKnownRequestError("Transaction already closed", { code: "P2028", clientVersion: "test" })]
    const { res } = await mover({ tipo: "ENTRADA", cantidad: 1 })
    expect(res.status).toBe(500)
    expect(txOptions).toHaveLength(1)
  })

  test("modo OFF / sin reservas: AJUSTE a la baja se aplica directo como antes", async () => {
    reset({ reservas: [] })
    const { res } = await mover({ tipo: "AJUSTE", cantidad: 0 })
    expect(res.status).toBe(201)
    expect(coca()).toBe(0)
  })
})
