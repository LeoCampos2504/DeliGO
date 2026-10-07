// ============================================
// P2-T56-R3A-I2-F3 — cancelación de pedido de mesa: política explícita de la tx
// ============================================
// cancelarPedidoMesa REAL contra un `@/lib/db` en memoria con rollback real
// (snapshot en $transaction) y registro de las opciones de cada $transaction.
// La verificación real-DB de I2 en TESTING mostró esta transacción Serializable
// expirando a ~5361 ms con los defaults de Prisma (2000/5000 ms). F3 sólo agrega
// maxWait/timeout explícitos (mismas constantes que runStockSerializable); la
// isolation, el CAS, la reversión de deuda, la liberación de reservas y el
// PedidoEvento no cambian, y no se agrega ningún retry.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { Prisma } from "@prisma/client"

const NEGOCIO = "negocio-a"

interface PedidoRow {
  id: string
  negocioId: string
  metodoEntrega: string
  estado: string
  mesaId: string | null
  ocupacionMesaId: string | null
  ocupacionActiva: boolean
  tarifaServicio: number
  deudaAcumulada: boolean
  canceladoFecha?: Date
}
interface ReservaRow {
  pedidoId: string
  negocioId: string
  estado: string
  motivoLiberacion: string | null
}
interface State {
  pedidos: PedidoRow[]
  deudaTarifa: number
  reservas: ReservaRow[]
  eventos: Array<Record<string, unknown>>
}

let state: State
let transactionOptions: Array<Record<string, unknown> | undefined>
let transactionCalls: number

function reset(overrides: Partial<State> = {}) {
  state = {
    pedidos: [
      {
        id: "pedido-1",
        negocioId: NEGOCIO,
        metodoEntrega: "mesa",
        estado: "recibido",
        mesaId: "mesa-1",
        ocupacionMesaId: "ocupacion-1",
        ocupacionActiva: true,
        tarifaServicio: 100,
        deudaAcumulada: true,
      },
    ],
    deudaTarifa: 500,
    reservas: [],
    eventos: [],
    ...overrides,
  }
  transactionOptions = []
  transactionCalls = 0
}

function matches(row: PedidoRow, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "ocupacionMesa") return row.ocupacionActiva === ((value as { estado: string }).estado === "activa")
    return (row as unknown as Record<string, unknown>)[key] === value
  })
}

mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME: "deligo_session",
  findSesionByToken: async () => null,
  getOperationalAccountFromRequest: async () => null,
}))
mock.module("@/lib/area-operativa", () => ({ resolveAreaOperativaEfectiva: () => null }))
mock.module("@/lib/operaciones-terminal-access", () => ({ requireOperacionesArea: () => null }))

mock.module("@/lib/db", () => {
  const tx = {
    pedido: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = state.pedidos.find((p) => matches(p, where))
        return row ? { ...row } : null
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = state.pedidos.filter((p) => matches(p, where))
        for (const row of rows) Object.assign(row, data)
        return { count: rows.length }
      },
    },
    mesa: { findFirst: async () => ({ id: "mesa-1" }) },
    negocio: {
      updateMany: async ({ data }: { data: { deudaTarifa: { decrement: number } } }) => {
        if (state.deudaTarifa < data.deudaTarifa.decrement) return { count: 0 }
        state.deudaTarifa -= data.deudaTarifa.decrement
        return { count: 1 }
      },
    },
    reservaStock: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const rows = state.reservas.filter((r) => Object.entries(where).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v))
        for (const row of rows) Object.assign(row, { estado: data.estado, motivoLiberacion: data.motivoLiberacion })
        return { count: rows.length }
      },
    },
    pedidoEvento: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.eventos.push(data)
        return data
      },
    },
  }
  return {
    db: {
      ...tx,
      $transaction: async (fn: (t: unknown) => Promise<unknown>, options?: Record<string, unknown>) => {
        transactionCalls++
        transactionOptions.push(options)
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

const { cancelarPedidoMesa } = await import("./mesa-pedido-cancelacion")
const { STOCK_SERIALIZABLE_MAX_WAIT_MS, STOCK_SERIALIZABLE_TIMEOUT_MS } = await import("./stock-lifecycle")

const actor = { type: "negocio_admin" as const, negocioId: NEGOCIO, actorId: NEGOCIO, nombre: "Admin" }
const cancelar = (internals = {}) => cancelarPedidoMesa({ pedidoId: "pedido-1", motivo: "cliente se fue", actor }, internals)

beforeEach(() => reset())

describe("P2-T56-R3A-I2-F3 — política explícita de la transacción de cancelación de mesa", () => {
  test("F3-A / F3-B / F3-C: la tx conserva Serializable y recibe maxWait/timeout explícitos (constantes de la autoridad)", async () => {
    const result = await cancelar()
    expect(result.kind).toBe("ok")
    expect(transactionOptions).toEqual([
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: STOCK_SERIALIZABLE_MAX_WAIT_MS,
        timeout: STOCK_SERIALIZABLE_TIMEOUT_MS,
      },
    ])
    expect(STOCK_SERIALIZABLE_MAX_WAIT_MS).toBe(5_000)
    expect(STOCK_SERIALIZABLE_TIMEOUT_MS).toBe(15_000)
  })

  test("F3-D: deuda revertida + liberación + PedidoEvento en la MISMA transacción (una sola $transaction)", async () => {
    state.reservas = [{ pedidoId: "pedido-1", negocioId: NEGOCIO, estado: "ACTIVA", motivoLiberacion: null }]
    await cancelar()
    expect(transactionCalls).toBe(1)
    expect(state.deudaTarifa).toBe(400)
    expect(state.pedidos[0]).toEqual(expect.objectContaining({ estado: "cancelado", deudaAcumulada: false }))
    expect(state.reservas[0].estado).toBe("LIBERADA")
    expect(state.eventos).toHaveLength(1)
  })

  test("F3-E: reserva ACTIVA → LIBERADA con motivo CANCELADO_MESA", async () => {
    state.reservas = [{ pedidoId: "pedido-1", negocioId: NEGOCIO, estado: "ACTIVA", motivoLiberacion: null }]
    await cancelar()
    expect(state.reservas).toEqual([{ pedidoId: "pedido-1", negocioId: NEGOCIO, estado: "LIBERADA", motivoLiberacion: "CANCELADO_MESA" }])
  })

  test("F3-F: reserva CONSUMIDA no se toca (sin restock automático)", async () => {
    state.reservas = [{ pedidoId: "pedido-1", negocioId: NEGOCIO, estado: "CONSUMIDA", motivoLiberacion: null }]
    await cancelar()
    expect(state.reservas[0]).toEqual({ pedidoId: "pedido-1", negocioId: NEGOCIO, estado: "CONSUMIDA", motivoLiberacion: null })
  })

  test("F3-G: si falla un efecto posterior (PedidoEvento) → rollback completo: estado, deuda y reserva intactos", async () => {
    state.reservas = [{ pedidoId: "pedido-1", negocioId: NEGOCIO, estado: "ACTIVA", motivoLiberacion: null }]
    const failing = { crearPedidoEvento: async () => { throw new Error("evento falló") } }
    const result = await cancelar(failing)
    expect(result.kind).toBe("server_error")
    expect(state.pedidos[0]).toEqual(expect.objectContaining({ estado: "recibido", deudaAcumulada: true }))
    expect(state.deudaTarifa).toBe(500)
    expect(state.reservas[0].estado).toBe("ACTIVA")
    expect(state.eventos).toHaveLength(0)
  })

  test("F3-H: CAS perdido (ocupación ya no activa) → conflict, sin efectos ni evento", async () => {
    state.pedidos[0].ocupacionActiva = false
    state.reservas = [{ pedidoId: "pedido-1", negocioId: NEGOCIO, estado: "ACTIVA", motivoLiberacion: null }]
    const result = await cancelar()
    expect(result.kind).toBe("conflict")
    expect(state.deudaTarifa).toBe(500)
    expect(state.reservas[0].estado).toBe("ACTIVA")
    expect(state.eventos).toHaveLength(0)
  })

  test("F3-I: sin retry nuevo — un P2034 sigue siendo conflict tras UN solo intento, con rollback", async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError("write conflict", { code: "P2034", clientVersion: "test" })
    const result = await cancelar({ crearPedidoEvento: async () => { throw p2034 } })
    expect(result.kind).toBe("conflict")
    expect(transactionCalls).toBe(1)
    expect(state.pedidos[0].estado).toBe("recibido")
  })

  test("F3-I: un timeout de la tx (P2028) es server_error tras UN solo intento, nunca conflict ni retry", async () => {
    const p2028 = new Prisma.PrismaClientKnownRequestError("Transaction API error: Transaction already closed", { code: "P2028", clientVersion: "test" })
    const result = await cancelar({ crearPedidoEvento: async () => { throw p2028 } })
    expect(result.kind).toBe("server_error")
    expect(transactionCalls).toBe(1)
    expect(state.deudaTarifa).toBe(500)
  })
})
