// P2-T50-R1: contrato focal del filtro de fecha personalizado de
// estadísticas de Salón (día/mes/rango) sumado a los quick filters
// existentes (hoy/semana/mes/todo). No real DB — `db` y `@/lib/auth`
// mockeados, mismo patrón que pyr/panel/route.test.ts. Cubre los casos
// A-V pedidos por la tarea.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

const SESSION_COOKIE_NAME = "deligo_session"

interface PedidoRow {
  id: string
  total: number
  metodoEntrega: string
  empleadoId: string | null
  empleadoNombre: string | null
  negocioId: string
  estado: string
  fecha: Date
}

let pedidosRecord: PedidoRow[]
let findManyLastArgs: Record<string, unknown> | null
let mesaGroupByLastArgs: Record<string, unknown> | null
let authUser: { id: string; type: string } | null

mock.module("@/lib/db", () => {
  const pedido = {
    findMany: async (args: Record<string, unknown>) => {
      findManyLastArgs = args
      const where = args.where as { negocioId: string; estado: string; fecha?: { gte?: Date; lt?: Date } }
      return pedidosRecord.filter((p) => {
        if (p.negocioId !== where.negocioId) return false
        if (p.estado !== where.estado) return false
        if (where.fecha?.gte && p.fecha.getTime() < where.fecha.gte.getTime()) return false
        if (where.fecha?.lt && p.fecha.getTime() >= where.fecha.lt.getTime()) return false
        return true
      })
    },
  }
  const empleado = { findMany: async () => [] }
  const mesa = {
    groupBy: async (args: Record<string, unknown>) => {
      mesaGroupByLastArgs = args
      return []
    },
  }
  const db = { pedido, empleado, mesa }
  return { db }
})

mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME,
  getUserFromToken: async () => authUser,
}))

const { GET } = await import("./route")

function callGet(query: string) {
  const req = new NextRequest(`http://localhost/api/negocio/salon/stats${query}`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=faketoken` },
  })
  return GET(req)
}

function pedido(overrides: Partial<PedidoRow>): PedidoRow {
  return {
    id: "pedido-1",
    total: 1000,
    metodoEntrega: "mesa",
    empleadoId: null,
    empleadoNombre: null,
    negocioId: "negocio-1",
    estado: "entregado",
    fecha: new Date(2026, 8, 20, 12, 0, 0),
    ...overrides,
  }
}

beforeEach(() => {
  authUser = { id: "negocio-1", type: "negocio" }
  pedidosRecord = []
  findManyLastArgs = null
  mesaGroupByLastArgs = null
})

describe("P2-T50-R1 — GET /api/negocio/salon/stats — filtro de fecha personalizado", () => {
  describe("Quick filters preservados (sin regresión)", () => {
    test("A. periodo=hoy responde 200 y ecoa periodo", async () => {
      const res = await callGet("?periodo=hoy")
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.periodo).toBe("hoy")
    })

    test("B. periodo=semana responde 200 y ecoa periodo", async () => {
      const res = await callGet("?periodo=semana")
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.periodo).toBe("semana")
    })

    test("C. periodo=mes responde 200 y ecoa periodo", async () => {
      const res = await callGet("?periodo=mes")
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.periodo).toBe("mes")
    })

    test("D. periodo=todo responde 200, sin filtro de fecha (gte/lt ausentes)", async () => {
      const res = await callGet("?periodo=todo")
      expect(res.status).toBe(200)
      const where = findManyLastArgs!.where as { fecha?: unknown }
      expect(where.fecha).toBeUndefined()
    })
  })

  describe("Día específico", () => {
    test("E. fecha=2026-09-20 válida => 200, rango [20/09 00:00, 21/09 00:00)", async () => {
      pedidosRecord = [pedido({ fecha: new Date(2026, 8, 20, 23, 59, 0) })]
      const res = await callGet("?fecha=2026-09-20")
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.periodo).toBe("fecha")
      expect(data.resumen.totalAllOrders).toBe(1)
      const where = findManyLastArgs!.where as { fecha: { gte: Date; lt: Date } }
      expect(where.fecha.gte.getTime()).toBe(new Date(2026, 8, 20, 0, 0, 0, 0).getTime())
      expect(where.fecha.lt.getTime()).toBe(new Date(2026, 8, 21, 0, 0, 0, 0).getTime())
    })

    test("F. fecha inválida (31 de febrero, mes 13, texto libre) => 400", async () => {
      for (const bad of ["2026-02-31", "2026-13-01", "abc", "2026-00-05", "2026-9-1"]) {
        const res = await callGet(`?fecha=${bad}`)
        expect(res.status).toBe(400)
      }
    })
  })

  describe("Mes específico", () => {
    test("G. mes=2026-08 válido => 200, rango [01/08 00:00, 01/09 00:00)", async () => {
      const res = await callGet("?mes=2026-08")
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.periodo).toBe("mes_especifico")
      const where = findManyLastArgs!.where as { fecha: { gte: Date; lt: Date } }
      expect(where.fecha.gte.getTime()).toBe(new Date(2026, 7, 1, 0, 0, 0, 0).getTime())
      expect(where.fecha.lt.getTime()).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime())
    })

    test("H. mes inválido (13, texto, un solo dígito) => 400", async () => {
      for (const bad of ["2026-13", "abc", "2026-9", "2026-00"]) {
        const res = await callGet(`?mes=${bad}`)
        expect(res.status).toBe(400)
      }
    })
  })

  describe("Rango personalizado", () => {
    test("I. desde=hasta (mismo día) => válido, equivalente a un día", async () => {
      const res = await callGet("?desde=2026-09-10&hasta=2026-09-10")
      expect(res.status).toBe(200)
      const where = findManyLastArgs!.where as { fecha: { gte: Date; lt: Date } }
      expect(where.fecha.gte.getTime()).toBe(new Date(2026, 8, 10, 0, 0, 0, 0).getTime())
      expect(where.fecha.lt.getTime()).toBe(new Date(2026, 8, 11, 0, 0, 0, 0).getTime())
    })

    test("J. desde=01/09 hasta=15/09 => rango [01/09 00:00, 16/09 00:00), último día incluido", async () => {
      const res = await callGet("?desde=2026-09-01&hasta=2026-09-15")
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.periodo).toBe("rango")
      const where = findManyLastArgs!.where as { fecha: { gte: Date; lt: Date } }
      expect(where.fecha.gte.getTime()).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime())
      expect(where.fecha.lt.getTime()).toBe(new Date(2026, 8, 16, 0, 0, 0, 0).getTime())
    })

    test("K. desde > hasta => 400", async () => {
      const res = await callGet("?desde=2026-09-15&hasta=2026-09-01")
      expect(res.status).toBe(400)
    })

    test("L. sólo desde (sin hasta) => 400", async () => {
      const res = await callGet("?desde=2026-09-01")
      expect(res.status).toBe(400)
    })

    test("M. sólo hasta (sin desde) => 400", async () => {
      const res = await callGet("?hasta=2026-09-15")
      expect(res.status).toBe(400)
    })
  })

  describe("Boundary exacto", () => {
    test("N. pedido exactamente a las 00:00:00.000 del día de inicio => incluido", async () => {
      pedidosRecord = [pedido({ fecha: new Date(2026, 8, 20, 0, 0, 0, 0) })]
      const res = await callGet("?fecha=2026-09-20")
      const data = await res.json()
      expect(data.resumen.totalAllOrders).toBe(1)
    })

    test("O. pedido exactamente a las 00:00:00.000 del día siguiente al 'hasta' => excluido", async () => {
      pedidosRecord = [pedido({ fecha: new Date(2026, 8, 21, 0, 0, 0, 0) })]
      const res = await callGet("?fecha=2026-09-20")
      const data = await res.json()
      expect(data.resumen.totalAllOrders).toBe(0)
    })
  })

  describe("Cambio de mes / año", () => {
    test("P. mes=2026-08 no confunde pedidos de septiembre", async () => {
      pedidosRecord = [
        pedido({ id: "ago", fecha: new Date(2026, 7, 15) }),
        pedido({ id: "sep", fecha: new Date(2026, 8, 15) }),
      ]
      const res = await callGet("?mes=2026-08")
      const data = await res.json()
      expect(data.resumen.totalAllOrders).toBe(1)
    })

    test("Q. mes=2025-12 no confunde con 2026-12", async () => {
      pedidosRecord = [
        pedido({ id: "d25", fecha: new Date(2025, 11, 15) }),
        pedido({ id: "d26", fecha: new Date(2026, 11, 15) }),
      ]
      const res = await callGet("?mes=2025-12")
      const data = await res.json()
      expect(data.resumen.totalAllOrders).toBe(1)
    })
  })

  test("R. cross-business: pedido de otro negocio nunca aparece pese a cualquier rango", async () => {
    pedidosRecord = [
      pedido({ id: "propio", negocioId: "negocio-1", fecha: new Date(2026, 8, 20) }),
      pedido({ id: "ajeno", negocioId: "negocio-2", fecha: new Date(2026, 8, 20) }),
    ]
    const res = await callGet("?fecha=2026-09-20")
    const data = await res.json()
    expect(data.resumen.totalAllOrders).toBe(1)
    expect((findManyLastArgs!.where as { negocioId: string }).negocioId).toBe("negocio-1")
  })

  test("S. sólo estado entregado cuenta en cualquier modo de filtro", async () => {
    pedidosRecord = [
      pedido({ id: "entregado", estado: "entregado", fecha: new Date(2026, 8, 20) }),
      pedido({ id: "cancelado", estado: "cancelado", fecha: new Date(2026, 8, 20) }),
    ]
    const res = await callGet("?fecha=2026-09-20")
    const data = await res.json()
    expect(data.resumen.totalAllOrders).toBe(1)
  })

  test("T. Salón + Negocio usan el mismo conjunto temporal (mismo dataset filtrado una sola vez)", async () => {
    pedidosRecord = [
      pedido({ id: "mesa", metodoEntrega: "mesa", total: 500, fecha: new Date(2026, 8, 20) }),
      pedido({ id: "retiro", metodoEntrega: "retiro", total: 300, fecha: new Date(2026, 8, 20) }),
    ]
    const res = await callGet("?fecha=2026-09-20")
    const data = await res.json()
    expect(data.resumen.totalMesaOrders).toBe(1)
    expect(data.resumen.totalAllOrders).toBe(2)
    expect(data.resumen.totalMesaRevenue).toBe(500)
    expect(data.resumen.totalAllRevenue).toBe(800)
  })

  test("U. mesasAsignadas no depende del filtro de fecha aplicado (snapshot en vivo, sin cambios)", async () => {
    const res = await callGet("?fecha=2026-01-01")
    expect(res.status).toBe(200)
    const mesaWhere = mesaGroupByLastArgs!.where as Record<string, unknown>
    expect(Object.keys(mesaWhere)).not.toContain("fecha")
    expect(mesaWhere).toEqual({ negocioId: "negocio-1", empleadoId: { not: null }, activa: true })
  })

  describe("Combinaciones ambiguas", () => {
    test("V. fecha + mes simultáneos => 400 genérico", async () => {
      const res = await callGet("?fecha=2026-09-20&mes=2026-09")
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(typeof data.error).toBe("string")
    })

    test("V. fecha + desde simultáneos => 400 genérico", async () => {
      const res = await callGet("?fecha=2026-09-20&desde=2026-09-01&hasta=2026-09-15")
      expect(res.status).toBe(400)
    })

    test("V. mes + hasta simultáneos => 400 genérico", async () => {
      const res = await callGet("?mes=2026-09&hasta=2026-09-15")
      expect(res.status).toBe(400)
    })

    test("fecha futura => válido, puede devolver ceros", async () => {
      const res = await callGet("?fecha=2099-01-01")
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.resumen.totalAllOrders).toBe(0)
    })

    test("mes futuro => válido, puede devolver ceros", async () => {
      const res = await callGet("?mes=2099-01")
      expect(res.status).toBe(200)
    })

    test("rango futuro => válido, puede devolver ceros", async () => {
      const res = await callGet("?desde=2099-01-01&hasta=2099-01-31")
      expect(res.status).toBe(200)
    })

    test("filtro custom válido tiene prioridad sobre periodo enviado simultáneamente", async () => {
      pedidosRecord = [pedido({ fecha: new Date(2026, 8, 20) })]
      const res = await callGet("?periodo=todo&fecha=2026-09-20")
      const data = await res.json()
      expect(data.periodo).toBe("fecha")
    })
  })

  test("sin sesión => 401, nunca ejecuta la query", async () => {
    const req = new NextRequest("http://localhost/api/negocio/salon/stats?periodo=hoy")
    const res = await GET(req)
    expect(res.status).toBe(401)
    expect(findManyLastArgs).toBeNull()
  })

  test("sesión de tipo distinto a negocio => 403", async () => {
    authUser = { id: "otro-1", type: "cliente" }
    const res = await callGet("?periodo=hoy")
    expect(res.status).toBe(403)
  })
})
