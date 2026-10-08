// ============================================
// P2-T56-R3A-I2 — fake Prisma en memoria para los tests del lifecycle de stock
// ============================================
// SÓLO para tests (no lo importa ningún archivo productivo). Implementa el
// subconjunto de la API de Prisma que usa src/lib/stock-lifecycle.ts, con la
// semántica relevante: filtros por negocioId/estado/ids, CAS de Pedido por
// estado, y $transaction con ROLLBACK REAL (snapshot del estado; si el callback
// lanza, se restaura). Registra el isolationLevel pedido para poder afirmar que
// el camino de stock corre Serializable. No simula SSI/concurrencia real de
// Postgres: eso queda para la integración en TESTING.

import { Prisma } from "@prisma/client"

export interface FakeProducto {
  id: string
  negocioId: string
  controlStock: boolean
  stockCantidad: number
}
export interface FakeVariante {
  id: string
  productoId: string
  controlStock: boolean
  stockCantidad: number
}
export interface FakeReserva {
  id: string
  negocioId: string
  pedidoId: string
  pedidoItemId: string
  productoId: string | null
  productoVarianteId: string | null
  cantidad: number
  estado: string
  motivoLiberacion: string | null
  consumidaEn: Date | null
  liberadaEn: Date | null
}
export interface FakePedido {
  id: string
  negocioId: string
  estado: string
  tarifaServicio: number
  deudaAcumulada: boolean
  items: Array<{ id: string }>
}
export interface FakeMovimiento {
  negocioId: string
  productoId: string
  productoVarianteId: string | null
  tipo: string
  cantidad: number
  stockAntes: number
  stockDespues: number
  motivo: string | null
  pedidoId: string | null
}
// P2-T56-R3A-I5-P0: id/updatedAt opcionales (CAS del controlador de modos).
export interface FakeConfig {
  clave: string
  stockReservaModo: unknown
  id?: string
  updatedAt?: Date
}
export interface FakeAudit {
  id: string
  userId: string
  userType: string
  accion: string
  recurso: string
  recursoId: string
  detalle: string
  ip: string
}
export interface FakeSuperAdmin {
  id: string
  activo: boolean
}
export interface FakeState {
  config: FakeConfig | null
  productos: FakeProducto[]
  variantes: FakeVariante[]
  reservas: FakeReserva[]
  movimientos: FakeMovimiento[]
  pedidos: FakePedido[]
  /** P2-T56-R3A-I5-P0 */
  audits: FakeAudit[]
  superadmins: FakeSuperAdmin[]
}

export function p2034(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Transaction failed due to a write conflict", {
    code: "P2034",
    clientVersion: "test",
  })
}

type Where = Record<string, unknown>

function matchesScalar(value: unknown, condition: unknown): boolean {
  if (condition && typeof condition === "object" && !(condition instanceof Date)) {
    const c = condition as Record<string, unknown>
    if ("in" in c) return (c.in as unknown[]).includes(value)
    if ("not" in c) return value !== c.not
  }
  return value === condition
}

function matches(row: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) return true
    return matchesScalar(row[key], condition)
  })
}

export interface FakeDb {
  state: FakeState
  isolationLevels: Array<string | undefined>
  transactionCount: number
  /** Inyecta un error en la próxima llamada a reservaStock.createMany (para probar rollback). */
  failNextReservaCreate: boolean
  /** P2-T56-R3A-I5-P0: error en el próximo auditLog.create / configPlataforma.updateMany. */
  failNextAuditCreate: boolean
  failNextConfigUpdate: boolean
  /** P2-T56-R3A-I5-P0: se ejecuta justo antes del CAS de configPlataforma.updateMany (simula un cambio concurrente). */
  beforeConfigCas: (() => void) | null
  client: Record<string, unknown> & { $transaction: (fn: (tx: unknown) => Promise<unknown>, options?: { isolationLevel?: string }) => Promise<unknown> }
}

export function createFakeDb(initial: Partial<FakeState> = {}): FakeDb {
  const fake: FakeDb = {
    state: {
      config: initial.config === undefined ? { clave: "platform", stockReservaModo: "OFF" } : initial.config,
      productos: initial.productos ?? [],
      variantes: initial.variantes ?? [],
      reservas: initial.reservas ?? [],
      movimientos: initial.movimientos ?? [],
      pedidos: initial.pedidos ?? [],
      audits: initial.audits ?? [],
      superadmins: initial.superadmins ?? [],
    },
    isolationLevels: [],
    transactionCount: 0,
    failNextReservaCreate: false,
    failNextAuditCreate: false,
    failNextConfigUpdate: false,
    beforeConfigCas: null,
    client: null as unknown as FakeDb["client"],
  }
  let seq = 0

  const tx = {
    configPlataforma: {
      findUnique: async ({ where }: { where: { clave: string } }) =>
        fake.state.config && fake.state.config.clave === where.clave
          ? {
              stockReservaModo: fake.state.config.stockReservaModo,
              id: fake.state.config.id ?? "config-platform",
              updatedAt: fake.state.config.updatedAt ?? new Date(0),
            }
          : null,
      updateMany: async ({ where, data }: { where: { id: string; stockReservaModo: unknown; updatedAt: Date }; data: { stockReservaModo: unknown } }) => {
        if (fake.failNextConfigUpdate) {
          fake.failNextConfigUpdate = false
          throw new Error("SIMULATED_CONFIG_UPDATE_FAILURE")
        }
        fake.beforeConfigCas?.()
        const c = fake.state.config
        const id = c?.id ?? "config-platform"
        const updatedAt = c?.updatedAt ?? new Date(0)
        if (!c || id !== where.id || c.stockReservaModo !== where.stockReservaModo || updatedAt.getTime() !== where.updatedAt.getTime()) {
          return { count: 0 }
        }
        c.stockReservaModo = data.stockReservaModo
        c.id = id
        c.updatedAt = new Date(updatedAt.getTime() + 1)
        return { count: 1 }
      },
    },
    superAdmin: {
      findFirst: async ({ where }: { where: { id: string; activo: boolean } }) => {
        const a = fake.state.superadmins.find((row) => row.id === where.id && row.activo === where.activo)
        return a ? { id: a.id } : null
      },
    },
    auditLog: {
      create: async ({ data }: { data: Omit<FakeAudit, "id"> }) => {
        if (fake.failNextAuditCreate) {
          fake.failNextAuditCreate = false
          throw new Error("SIMULATED_AUDIT_FAILURE")
        }
        const row = { ...data, id: `audit-${++seq}` }
        fake.state.audits.push(row)
        return { id: row.id }
      },
    },
    producto: {
      findFirst: async ({ where }: { where: Where }) => {
        const p = fake.state.productos.find((row) => matches(row as unknown as Record<string, unknown>, where))
        return p ? { controlStock: p.controlStock, stockCantidad: p.stockCantidad } : null
      },
      update: async ({ where, data }: { where: { id: string }; data: { stockCantidad: number } }) => {
        const p = fake.state.productos.find((row) => row.id === where.id)
        if (!p) throw new Error("producto not found")
        p.stockCantidad = data.stockCantidad
        return p
      },
    },
    productoVariante: {
      findFirst: async ({ where }: { where: Where & { producto?: { negocioId: string } } }) => {
        const { producto: productoWhere, ...rest } = where
        const v = fake.state.variantes.find((row) => {
          if (!matches(row as unknown as Record<string, unknown>, rest)) return false
          if (productoWhere) {
            const parent = fake.state.productos.find((p) => p.id === row.productoId)
            if (!parent || parent.negocioId !== productoWhere.negocioId) return false
          }
          return true
        })
        return v ? { controlStock: v.controlStock, stockCantidad: v.stockCantidad } : null
      },
      update: async ({ where, data }: { where: { id: string }; data: { stockCantidad: number } }) => {
        const v = fake.state.variantes.find((row) => row.id === where.id)
        if (!v) throw new Error("variante not found")
        v.stockCantidad = data.stockCantidad
        return v
      },
    },
    reservaStock: {
      aggregate: async ({ where }: { where: Where }) => {
        const rows = fake.state.reservas.filter((r) => matches(r as unknown as Record<string, unknown>, where))
        return { _sum: { cantidad: rows.length ? rows.reduce((sum, r) => sum + r.cantidad, 0) : null } }
      },
      createMany: async ({ data }: { data: Array<Omit<FakeReserva, "id" | "motivoLiberacion" | "consumidaEn" | "liberadaEn">> }) => {
        if (fake.failNextReservaCreate) {
          fake.failNextReservaCreate = false
          throw new Error("SIMULATED_RESERVA_CREATE_FAILURE")
        }
        for (const row of data) {
          if (fake.state.reservas.some((r) => r.pedidoItemId === row.pedidoItemId)) {
            throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed on pedidoItemId", { code: "P2002", clientVersion: "test" })
          }
          fake.state.reservas.push({ ...row, id: `reserva-${++seq}`, motivoLiberacion: null, consumidaEn: null, liberadaEn: null })
        }
        return { count: data.length }
      },
      findMany: async ({ where }: { where: Where }) =>
        fake.state.reservas.filter((r) => matches(r as unknown as Record<string, unknown>, where)).map((r) => ({ ...r })),
      updateMany: async ({ where, data }: { where: Where; data: Partial<FakeReserva> }) => {
        const rows = fake.state.reservas.filter((r) => matches(r as unknown as Record<string, unknown>, where))
        for (const r of rows) Object.assign(r, data)
        return { count: rows.length }
      },
      count: async ({ where }: { where: Where }) =>
        fake.state.reservas.filter((r) => matches(r as unknown as Record<string, unknown>, where)).length,
    },
    movimientoInventario: {
      create: async ({ data }: { data: FakeMovimiento }) => {
        fake.state.movimientos.push({ ...data, motivo: data.motivo ?? null, pedidoId: data.pedidoId ?? null })
        return data
      },
    },
    pedido: {
      updateMany: async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
        const rows = fake.state.pedidos.filter((p) => matches(p as unknown as Record<string, unknown>, where))
        for (const p of rows) Object.assign(p, data)
        return { count: rows.length }
      },
      findFirst: async ({ where }: { where: Where }) => {
        const p = fake.state.pedidos.find((row) => matches(row as unknown as Record<string, unknown>, where))
        return p ? { tarifaServicio: p.tarifaServicio, deudaAcumulada: p.deudaAcumulada } : null
      },
      // P2-T56-R3A-I5-P0
      findMany: async ({ where }: { where: Where }) =>
        fake.state.pedidos
          .filter((row) => matches(row as unknown as Record<string, unknown>, where))
          .map((p) => ({ id: p.id, negocioId: p.negocioId, estado: p.estado })),
      create: async ({ data }: { data: { id?: string; negocioId: string; estado: string; items: { create: Array<{ id: string }> } } }) => {
        const pedido: FakePedido = {
          id: data.id ?? `pedido-${++seq}`,
          negocioId: data.negocioId,
          estado: data.estado,
          tarifaServicio: 0,
          deudaAcumulada: false,
          items: data.items.create.map((item) => ({ id: item.id })),
        }
        fake.state.pedidos.push(pedido)
        return pedido
      },
    },
  }

  fake.client = {
    ...tx,
    $transaction: async (fn: (t: unknown) => Promise<unknown>, options?: { isolationLevel?: string }) => {
      fake.transactionCount++
      fake.isolationLevels.push(options?.isolationLevel)
      const snapshot = structuredClone(fake.state)
      try {
        return await fn(tx)
      } catch (error) {
        fake.state = snapshot
        throw error
      }
    },
  }
  return fake
}
