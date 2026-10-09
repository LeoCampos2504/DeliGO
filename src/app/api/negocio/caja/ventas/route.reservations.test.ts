// ============================================
// P2-T56-R3A-I3 — POST /api/negocio/caja/ventas con reservas ACTIVA
// ============================================
// Route REAL contra un `@/lib/db` en memoria con rollback por snapshot en
// $transaction y registro de opciones. Las reservas se siembran en memoria
// (el modo de TESTING sigue OFF; la certificación con reservas reales es I5).
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"

const NEGOCIO = "negocio-a"

interface ProductoRow { id: string; negocioId: string; nombre: string; precio: number; controlStock: boolean; stockCantidad: number; eliminado: boolean }
interface VarianteRow { id: string; productoId: string; nombre: string; precio: number; controlStock: boolean; stockCantidad: number; activo: boolean }
interface State {
  productos: ProductoRow[]
  variantes: VarianteRow[]
  reservas: Array<{ negocioId: string; productoId: string; productoVarianteId: string | null; cantidad: number; estado: string }>
  ventas: Array<Record<string, unknown> & { items: Array<Record<string, unknown>> }>
  movimientos: Array<Record<string, unknown>>
  // F10-B0: cobros + minimal cash ledger written by the shared sale engine
  cobros: Array<Record<string, unknown>>
  operaciones: Array<Record<string, unknown>>
  cuentas: Array<{ id: string; negocioId: string; clave: string }>
}

let state: State
let txOptions: Array<Record<string, unknown> | undefined>
let failNextTransactionWith: unknown[] = []
let failMovimiento = false

function reset(overrides: Partial<State> = {}) {
  state = {
    productos: [
      { id: "p-coca", negocioId: NEGOCIO, nombre: "Coca-Cola", precio: 1000, controlStock: true, stockCantidad: 10, eliminado: false },
      { id: "p-pan", negocioId: NEGOCIO, nombre: "Pan", precio: 500, controlStock: false, stockCantidad: 0, eliminado: false },
      { id: "p-remera", negocioId: NEGOCIO, nombre: "Remera", precio: 1, controlStock: false, stockCantidad: 0, eliminado: false },
    ],
    variantes: [{ id: "v-roja", productoId: "p-remera", nombre: "Roja", precio: 2500, controlStock: true, stockCantidad: 6, activo: true }],
    reservas: [],
    ventas: [],
    movimientos: [],
    cobros: [],
    operaciones: [],
    cuentas: [],
    ...overrides,
  }
  txOptions = []
  failNextTransactionWith = []
  failMovimiento = false
}

mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME: "deligo_session",
  getUserFromToken: async () => ({ id: NEGOCIO, type: "negocio" }),
}))
mock.module("@/lib/audit", () => ({ auditLog: async () => {} }))

mock.module("@/lib/db", () => {
  const tx = {
    producto: {
      findMany: async ({ where }: { where: { id: { in: string[] }; negocioId: string } }) =>
        state.productos
          .filter((p) => where.id.in.includes(p.id) && p.negocioId === where.negocioId && !p.eliminado)
          .map((p) => ({ ...p, variantes: state.variantes.filter((v) => v.productoId === p.id).map((v) => ({ ...v })) })),
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
    venta: {
      create: async ({ data }: { data: Record<string, unknown> & { items: { create: Array<Record<string, unknown>> } } }) => {
        const venta = { id: `venta-${state.ventas.length + 1}`, ...data, items: data.items.create.map((i) => ({ ...i })) }
        state.ventas.push(venta)
        return venta
      },
    },
    movimientoInventario: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (failMovimiento) throw new Error("movimiento falló")
        state.movimientos.push({ ...data })
        return data
      },
    },
    // F10-B0 additions (shared sale engine): no Idempotency-Key in these tests,
    // so venta.findUnique is never reached; actor is always the owner.
    cobroVenta: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `cobro-${state.cobros.length + 1}`, ...data }
        state.cobros.push(row)
        return row
      },
    },
    operacionFinanciera: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `op-${state.operaciones.length + 1}`, ...data }
        state.operaciones.push(row)
        return row
      },
    },
  }
  return {
    db: {
      cuentaFinanciera: {
        createMany: async ({ data }: { data: Array<{ negocioId: string; clave: string }> }) => {
          for (const row of data) {
            if (!state.cuentas.some((c) => c.negocioId === row.negocioId && c.clave === row.clave)) {
              state.cuentas.push({ id: `cuenta-${state.cuentas.length + 1}`, negocioId: row.negocioId, clave: row.clave })
            }
          }
          return { count: data.length }
        },
        findUniqueOrThrow: async ({ where }: { where: { negocioId_clave: { negocioId: string; clave: string } } }) => {
          const c = state.cuentas.find((row) => row.negocioId === where.negocioId_clave.negocioId && row.clave === where.negocioId_clave.clave)
          if (!c) throw new Error("cuenta no encontrada")
          return { id: c.id }
        },
      },
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

function line(overrides: Record<string, unknown> = {}) {
  return { productoId: "p-coca", cantidad: 1, ...overrides }
}

async function vender(items: Array<Record<string, unknown>>) {
  const req = new NextRequest("http://localhost/api/negocio/caja/ventas", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "deligo_session=token" },
    body: JSON.stringify({ metodoPago: "EFECTIVO", items }),
  })
  const res = await POST(req)
  return { res, body: await res.json() }
}

const activa = (cantidad: number, productoId = "p-coca", productoVarianteId: string | null = null) =>
  ({ negocioId: NEGOCIO, productoId, productoVarianteId, cantidad, estado: "ACTIVA" })

beforeEach(() => reset())

describe("P2-T56-R3A-I3 — Caja respeta reservas ACTIVA", () => {
  test("stock suficiente sin reservas: 201, descuenta, 1 movimiento VENTA, tx Serializable con política explícita", async () => {
    const { res } = await vender([line({ cantidad: 3 })])
    expect(res.status).toBe(201)
    expect(state.productos[0].stockCantidad).toBe(7)
    expect(state.movimientos).toEqual([expect.objectContaining({ tipo: "VENTA", cantidad: 3, stockAntes: 10, stockDespues: 7, ventaId: "venta-1" })])
    expect(txOptions).toEqual([{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 }])
  })

  test("físico insuficiente sin reservas: 409 con el mensaje de siempre, nada creado", async () => {
    const { res, body } = await vender([line({ cantidad: 11 })])
    expect(res.status).toBe(409)
    expect(body).toEqual(expect.objectContaining({ code: "STOCK_INSUFFICIENT", error: '"Coca-Cola" no tiene stock suficiente' }))
    expect(state.ventas).toHaveLength(0)
    expect(state.movimientos).toHaveLength(0)
  })

  test("físico 10, reservadas 7: vender 5 → 409 STOCK_RESERVED_FOR_ORDERS (quedan 3), sin venta parcial ni movimientos", async () => {
    reset({ reservas: [activa(4), activa(3)] })
    const { res, body } = await vender([line({ cantidad: 5 })])
    expect(res.status).toBe(409)
    expect(body.code).toBe("STOCK_RESERVED_FOR_ORDERS")
    expect(body.error).toContain("sólo quedan 3 disponibles")
    expect(body.details).toEqual(expect.objectContaining({ solicitado: 5, stockFisico: 10, reservasActivas: 7, disponible: 3 }))
    expect(state.productos[0].stockCantidad).toBe(10)
    expect(state.ventas).toHaveLength(0)
    expect(state.movimientos).toHaveLength(0)
  })

  test("físico 10, reservadas 7: vender 2 → 201, físico 8, reservas intactas", async () => {
    reset({ reservas: [activa(7)] })
    const { res } = await vender([line({ cantidad: 2 })])
    expect(res.status).toBe(201)
    expect(state.productos[0].stockCantidad).toBe(8)
    expect(state.reservas).toEqual([activa(7)])
  })

  test("Coca-Cola x2 + x3: 5 descontadas una vez, 2 VentaItem conservados, 1 movimiento de 5", async () => {
    const { res, body } = await vender([line({ cantidad: 2 }), line({ cantidad: 3 })])
    expect(res.status).toBe(201)
    expect(body.items).toHaveLength(2)
    expect(body.items.map((i: { cantidad: number }) => i.cantidad)).toEqual([2, 3])
    expect(state.productos[0].stockCantidad).toBe(5)
    expect(state.movimientos).toEqual([expect.objectContaining({ productoId: "p-coca", cantidad: 5, stockAntes: 10, stockDespues: 5 })])
  })

  test("variante repetida: suma por variante, descuenta sólo la variante, 1 movimiento", async () => {
    const { res } = await vender([line({ productoId: "p-remera", varianteId: "v-roja", cantidad: 2 }), line({ productoId: "p-remera", varianteId: "v-roja", cantidad: 1 })])
    expect(res.status).toBe(201)
    expect(state.variantes[0].stockCantidad).toBe(3)
    expect(state.productos.find((p) => p.id === "p-remera")!.stockCantidad).toBe(0)
    expect(state.movimientos).toEqual([expect.objectContaining({ productoVarianteId: "v-roja", cantidad: 3 })])
  })

  test("variante con reservas: superar el disponible de la variante → 409 con etiqueta Producto — Variante", async () => {
    reset({ reservas: [activa(5, "p-remera", "v-roja")] })
    const { res, body } = await vender([line({ productoId: "p-remera", varianteId: "v-roja", cantidad: 2 })])
    expect(res.status).toBe(409)
    expect(body.code).toBe("STOCK_RESERVED_FOR_ORDERS")
    expect(body.error).toContain('"Remera — Roja"')
  })

  test("sin controlStock: se vende sin validar ni descontar", async () => {
    const { res } = await vender([line({ productoId: "p-pan", cantidad: 50 })])
    expect(res.status).toBe(201)
    expect(state.movimientos).toHaveLength(0)
  })

  test("rollback completo: si falla el movimiento no queda venta ni descuento", async () => {
    failMovimiento = true
    const { res } = await vender([line({ cantidad: 2 })])
    expect(res.status).toBe(500)
    expect(state.ventas).toHaveLength(0)
    expect(state.productos[0].stockCantidad).toBe(10)
  })

  test("P2034 se reintenta (retry acotado) y la venta confirma en el segundo intento", async () => {
    failNextTransactionWith = [new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" })]
    const { res } = await vender([line({ cantidad: 1 })])
    expect(res.status).toBe(201)
    expect(txOptions).toHaveLength(2)
  })

  test("P2034 agotado (3 intentos) → 409 con el mensaje de siempre de Caja", async () => {
    const p2034 = () => new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" })
    failNextTransactionWith = [p2034(), p2034(), p2034()]
    const { res, body } = await vender([line({ cantidad: 1 })])
    expect(res.status).toBe(409)
    expect(body.error).toBe("El stock cambió mientras se procesaba la venta. Volvé a intentar.")
    expect(txOptions).toHaveLength(3)
  })

  test("P2028 (timeout) NO se reintenta → 500, un solo intento", async () => {
    failNextTransactionWith = [new Prisma.PrismaClientKnownRequestError("Transaction already closed", { code: "P2028", clientVersion: "test" })]
    const { res } = await vender([line({ cantidad: 1 })])
    expect(res.status).toBe(500)
    expect(txOptions).toHaveLength(1)
  })

  test("venta contra venta (secuencial post-commit): la segunda ve el físico ya descontado", async () => {
    reset({ reservas: [activa(7)] })
    expect((await vender([line({ cantidad: 3 })])).res.status).toBe(201)
    const second = await vender([line({ cantidad: 1 })])
    expect(second.res.status).toBe(409)
    expect(second.body.details).toEqual(expect.objectContaining({ stockFisico: 7, disponible: 0 }))
    expect(state.productos[0].stockCantidad).toBe(7)
  })

  test("Restaurante/Ropa (sin reservas por construcción): comportamiento previo intacto", async () => {
    // Fuera del negocio genérico nunca se crean reservas (gate de I2); la ruta
    // es compartida y resta 0 → mismo resultado de antes de I3.
    const ok = await vender([line({ cantidad: 10 })])
    expect(ok.res.status).toBe(201)
    reset()
    const over = await vender([line({ cantidad: 11 })])
    expect(over.res.status).toBe(409)
    expect(over.body.code).toBe("STOCK_INSUFFICIENT")
  })
})
