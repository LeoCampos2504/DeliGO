// P2-T29A — operaciones/salon/pedidos/[id]/estado ahora deriva
// `REQUIRED_CURRENT_BY_TARGET` de la autoridad compartida
// (ACTIVE_FORWARD_TRANSITIONS.mesa) en vez de mantener su propia tabla
// manual (duplicada respecto de negocio/pedidos/[id]/estado y
// operaciones/pyr/pedidos/[id]/estado). Estos tests, con DB/auth
// mockeados, prueban que la migración no cambió ningún resultado
// observable: el grafo de mesa (recibido→preparando→listo_para_retirar→
// entregado) sigue aceptado exactamente igual, y el CAS (ya existente,
// sin cambios) sigue devolviendo conflict en count=0.

import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"

const DEFAULT_CONTEXT = {
  terminal: { id: "terminal-1", nombre: "Terminal Test" },
  negocio: { id: "negocio-1", nombre: "Negocio Test" },
}

let authResult: { ok: true; context: typeof DEFAULT_CONTEXT } | { ok: false; response: NextResponse }
let hasScopeResult: boolean
let pedidoRecord: {
  id: string
  estado: string
  negocioSlug: string
  mesaId: string | null
  mesaNumero: number | null
  empleadoId: string | null
} | null
let updateManyCount: number

mock.module("@/lib/db", () => {
  const pedido = {
    findFirst: async () => pedidoRecord,
    updateMany: async () => ({ count: updateManyCount }),
  }
  const db = { pedido }
  return { db }
})

// `mock.module` es global al proceso, no por archivo (bun:test) — se
// exportan AMBAS funciones (scope y area) para que este mock siga siendo
// compatible si operaciones/pyr/pedidos/[id]/estado/order-transitions-authority.test.ts
// corre en el mismo proceso.
mock.module("@/lib/operaciones-terminal-access", () => ({
  requireOperacionesScope: async () => authResult,
  requireOperacionesArea: async () => authResult,
  hasTerminalScope: () => hasScopeResult,
}))

mock.module("@/lib/audit", () => ({
  logPedidoEstadoChange: async () => {},
}))

mock.module("@/lib/mesa-order-ready-notification", () => ({
  notifyMesaOrderReadyForMozo: async () => {},
}))

const { PATCH } = await import("./route")

function callPatch(id: string, body: Record<string, unknown>) {
  const req = new NextRequest(`http://localhost/api/operaciones/salon/pedidos/${id}/estado`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return PATCH(req, { params: Promise.resolve({ id }) })
}

beforeEach(() => {
  authResult = { ok: true, context: DEFAULT_CONTEXT }
  hasScopeResult = true
  updateManyCount = 1
  pedidoRecord = { id: "p1", estado: "recibido", negocioSlug: "negocio-test", mesaId: "m1", mesaNumero: 5, empleadoId: null }
})

describe("P2-T29A — operaciones/salon/estado usa la autoridad compartida (grafo mesa)", () => {
  test("recibido→preparando sigue aceptado (200)", async () => {
    const res = await callPatch("p1", { estado: "preparando" })
    expect(res.status).toBe(200)
  })

  test("preparando→listo_para_retirar sigue aceptado (200)", async () => {
    pedidoRecord!.estado = "preparando"
    const res = await callPatch("p1", { estado: "listo_para_retirar" })
    expect(res.status).toBe(200)
  })

  test("listo_para_retirar→entregado sigue aceptado (200)", async () => {
    pedidoRecord!.estado = "listo_para_retirar"
    const res = await callPatch("p1", { estado: "entregado" })
    expect(res.status).toBe(200)
  })

  test("recibido→aceptado sigue rechazado (409 conflict genérico) — mesa nunca recibe aceptado", async () => {
    const res = await callPatch("p1", { estado: "aceptado" })
    expect(res.status).toBe(409)
  })

  test("transición fuera de orden (recibido→listo_para_retirar) sigue rechazada", async () => {
    const res = await callPatch("p1", { estado: "listo_para_retirar" })
    expect(res.status).toBe(409)
  })

  test("CAS conflict (count=0) sigue devolviendo 409, sin cambio de contrato", async () => {
    updateManyCount = 0
    const res = await callPatch("p1", { estado: "preparando" })
    expect(res.status).toBe(409)
  })
})
