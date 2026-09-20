// P2-T55-R1: contrato focal del filtro de fecha personalizado (día/mes/
// rango) agregado a GET /api/negocio/pedidos, reutilizando el mismo
// helper compartido que P2-T50-R1 (src/lib/date-range-filter.ts) con
// idéntica precedencia (fecha > mes > rango > periodo). No real DB —
// `db` y `@/lib/auth` mockeados, mismo patrón que
// negocio/salon/stats/route.test.ts. El quick filter "mes" de ESTE
// endpoint son 30 días fijos (no mes calendario) — divergencia
// intencional preexistente de negocio/salon/stats, documentada en
// P2_T55_A0, preservada sin cambios acá.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

const SESSION_COOKIE_NAME = "deligo_session"

interface PedidoRow {
  id: string
  negocioId: string
  estado: string
  metodoEntrega: string
  mesaNumero: number | null
  mesaId: string | null
  clienteTelefono: string | null
  clienteNombre: string | null
  empleadoNombre: string | null
  ocupacionMesaId: string | null
  ocupacionMesa: null
  fecha: Date
  total: number
  notas: string | null
  items: unknown[]
}

let pedidosRecord: PedidoRow[]
let findManyLastArgs: Record<string, unknown> | null
let authUser: { id: string; type: string } | null

const ESTADOS_ACTIVOS = ["recibido", "preparando", "en_camino", "listo_para_retirar", "aceptado", "esperando_repartidor"]

mock.module("@/lib/db", () => {
  const pedido = {
    findMany: async (args: Record<string, unknown>) => {
      findManyLastArgs = args
      const where = args.where as {
        negocioId: string
        estado?: string | { in?: string[]; notIn?: string[] }
        metodoEntrega?: string
        mesaNumero?: number
        fecha?: { gte?: Date; lt?: Date }
      }
      return pedidosRecord.filter((p) => {
        if (p.negocioId !== where.negocioId) return false
        if (where.estado) {
          if (typeof where.estado === "string") {
            if (p.estado !== where.estado) return false
          } else if (where.estado.in) {
            if (!where.estado.in.includes(p.estado)) return false
          } else if (where.estado.notIn) {
            if (where.estado.notIn.includes(p.estado)) return false
          }
        }
        if (where.metodoEntrega && p.metodoEntrega !== where.metodoEntrega) return false
        if (where.mesaNumero !== undefined && p.mesaNumero !== where.mesaNumero) return false
        if (where.fecha?.gte && p.fecha.getTime() < where.fecha.gte.getTime()) return false
        if (where.fecha?.lt && p.fecha.getTime() >= where.fecha.lt.getTime()) return false
        return true
      })
    },
    count: async (args: Record<string, unknown>) => {
      const rows = await pedido.findMany(args)
      return rows.length
    },
  }
  const mesa = { findMany: async () => [] }
  const db = { pedido, mesa }
  return { db }
})

mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME,
  getUserFromToken: async () => authUser,
}))

const { GET } = await import("./route")

function callGet(query: string) {
  const req = new NextRequest(`http://localhost/api/negocio/pedidos${query}`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=faketoken` },
  })
  return GET(req)
}

function pedido(overrides: Partial<PedidoRow>): PedidoRow {
  return {
    id: "pedido-1",
    negocioId: "negocio-1",
    estado: "entregado",
    metodoEntrega: "mesa",
    mesaNumero: 5,
    mesaId: "mesa-1",
    clienteTelefono: null,
    clienteNombre: "Cliente Test",
    empleadoNombre: null,
    ocupacionMesaId: null,
    ocupacionMesa: null,
    fecha: new Date(2026, 8, 20, 12, 0, 0),
    total: 1000,
    notas: null,
    items: [],
    ...overrides,
  }
}

beforeEach(() => {
  authUser = { id: "negocio-1", type: "negocio" }
  pedidosRecord = []
  findManyLastArgs = null
})

describe("P2-T55-R1 — GET /api/negocio/pedidos — filtro de fecha personalizado", () => {
  describe("Quick filters preservados (sin regresión — 'mes' acá es 30 días fijos)", () => {
    test("periodo=hoy => gte medianoche local de hoy, sin lt", async () => {
      const res = await callGet("?periodo=hoy")
      expect(res.status).toBe(200)
      const where = findManyLastArgs!.where as { fecha?: { gte?: Date; lt?: Date } }
      expect(where.fecha?.lt).toBeUndefined()
      expect(where.fecha?.gte).toBeInstanceOf(Date)
    })

    test("sin periodo y sin filtro custom => sin filtro de fecha en absoluto", async () => {
      const res = await callGet("?estado=historial&metodoEntrega=mesa&mesaNumero=5")
      expect(res.status).toBe(200)
      const where = findManyLastArgs!.where as { fecha?: unknown }
      expect(where.fecha).toBeUndefined()
    })
  })

  describe("Día específico (fecha)", () => {
    test("fecha=2026-09-20 válida => 200, rango [20/09 00:00, 21/09 00:00)", async () => {
      pedidosRecord = [pedido({ fecha: new Date(2026, 8, 20, 23, 59, 0) })]
      const res = await callGet("?estado=historial&metodoEntrega=mesa&mesaNumero=5&fecha=2026-09-20")
      expect(res.status).toBe(200)
      const where = findManyLastArgs!.where as { fecha: { gte: Date; lt: Date } }
      expect(where.fecha.gte.getTime()).toBe(new Date(2026, 8, 20, 0, 0, 0, 0).getTime())
      expect(where.fecha.lt.getTime()).toBe(new Date(2026, 8, 21, 0, 0, 0, 0).getTime())
      const data = await res.json()
      expect(data.cuentas).toHaveLength(1)
    })

    test("fecha inválida (31 de febrero, mes 13, texto libre) => 400", async () => {
      for (const bad of ["2026-02-31", "2026-13-01", "abc", "2026-00-05", "2026-9-1"]) {
        const res = await callGet(`?fecha=${bad}`)
        expect(res.status).toBe(400)
      }
    })
  })

  describe("Mes específico (mes) — mes calendario exacto, no confundir con quick 'mes'=30 días", () => {
    test("mes=2026-08 válido => 200, rango [01/08 00:00, 01/09 00:00)", async () => {
      const res = await callGet("?mes=2026-08")
      expect(res.status).toBe(200)
      const where = findManyLastArgs!.where as { fecha: { gte: Date; lt: Date } }
      expect(where.fecha.gte.getTime()).toBe(new Date(2026, 7, 1, 0, 0, 0, 0).getTime())
      expect(where.fecha.lt.getTime()).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime())
    })

    test("mes inválido (13, texto, un solo dígito) => 400", async () => {
      for (const bad of ["2026-13", "abc", "2026-9", "2026-00"]) {
        const res = await callGet(`?mes=${bad}`)
        expect(res.status).toBe(400)
      }
    })
  })

  describe("Rango personalizado (desde/hasta)", () => {
    test("desde=01/09 hasta=15/09 => rango [01/09 00:00, 16/09 00:00), último día incluido", async () => {
      const res = await callGet("?desde=2026-09-01&hasta=2026-09-15")
      expect(res.status).toBe(200)
      const where = findManyLastArgs!.where as { fecha: { gte: Date; lt: Date } }
      expect(where.fecha.gte.getTime()).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime())
      expect(where.fecha.lt.getTime()).toBe(new Date(2026, 8, 16, 0, 0, 0, 0).getTime())
    })

    test("desde > hasta => 400", async () => {
      const res = await callGet("?desde=2026-09-15&hasta=2026-09-01")
      expect(res.status).toBe(400)
    })

    test("sólo desde (sin hasta) => 400", async () => {
      const res = await callGet("?desde=2026-09-01")
      expect(res.status).toBe(400)
    })
  })

  describe("Combinaciones ambiguas", () => {
    test("fecha + mes simultáneos => 400 genérico", async () => {
      const res = await callGet("?fecha=2026-09-20&mes=2026-09")
      expect(res.status).toBe(400)
    })

    test("mes + desde/hasta simultáneos => 400 genérico", async () => {
      const res = await callGet("?mes=2026-09&desde=2026-09-01&hasta=2026-09-15")
      expect(res.status).toBe(400)
    })

    test("filtro custom válido tiene prioridad sobre periodo enviado simultáneamente", async () => {
      pedidosRecord = [pedido({ fecha: new Date(2026, 8, 20) })]
      const res = await callGet("?periodo=hoy&fecha=2026-09-20")
      const where = findManyLastArgs!.where as { fecha: { gte: Date; lt: Date } }
      expect(where.fecha.gte.getTime()).toBe(new Date(2026, 8, 20, 0, 0, 0, 0).getTime())
      expect(where.fecha.lt.getTime()).toBe(new Date(2026, 8, 21, 0, 0, 0, 0).getTime())
    })
  })

  test("cross-business: pedido de otro negocio nunca aparece pese a cualquier rango", async () => {
    pedidosRecord = [
      pedido({ id: "propio", negocioId: "negocio-1", fecha: new Date(2026, 8, 20) }),
      pedido({ id: "ajeno", negocioId: "negocio-2", fecha: new Date(2026, 8, 20) }),
    ]
    const res = await callGet("?estado=historial&metodoEntrega=mesa&mesaNumero=5&fecha=2026-09-20")
    const data = await res.json()
    expect(data.cuentas).toHaveLength(1)
  })

  test("Historial incluye cancelado (sin cambios de T55) incluso con filtro custom activo", async () => {
    pedidosRecord = [
      pedido({ id: "entregado", estado: "entregado", fecha: new Date(2026, 8, 20) }),
      pedido({ id: "cancelado", estado: "cancelado", fecha: new Date(2026, 8, 20) }),
    ]
    const res = await callGet("?estado=historial&metodoEntrega=mesa&mesaNumero=5&fecha=2026-09-20")
    const data = await res.json()
    const totalPedidos = data.cuentas.reduce((sum: number, c: { pedidos: unknown[] }) => sum + c.pedidos.length, 0)
    expect(totalPedidos).toBe(2)
  })

  test("otro llamador (activos, sin params custom) no se ve afectado por el nuevo filtro", async () => {
    pedidosRecord = [pedido({ estado: "recibido", fecha: new Date(2026, 8, 20) })]
    const res = await callGet("?estado=activos&metodoEntrega=mesa")
    expect(res.status).toBe(200)
    const where = findManyLastArgs!.where as { fecha?: unknown }
    expect(where.fecha).toBeUndefined()
  })

  test("sin sesión => 401, nunca ejecuta la query", async () => {
    const req = new NextRequest("http://localhost/api/negocio/pedidos?fecha=2026-09-20")
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(findManyLastArgs).toBeNull()
  })

  test("sesión de tipo distinto a negocio => 403", async () => {
    authUser = { id: "otro-1", type: "cliente" }
    const res = await callGet("?fecha=2026-09-20")
    expect(res.status).toBe(403)
  })
})
