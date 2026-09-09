// P2-T29A — operaciones/pyr/pedidos/[id]/estado ahora consume la autoridad
// compartida (order-transitions.ts) en vez de su propia tabla local
// `TRANSICIONES` (duplicada respecto de negocio/pedidos/[id]/estado). Estos
// tests, con DB/auth mockeados (mismo estilo que
// src/app/api/operaciones/pyr/mensajes/[pedidoId]/route.test.ts), prueban
// que la migración no cambió ningún resultado observable: transiciones
// válidas siguen aceptadas, cross-modalidad inválida sigue rechazada, y el
// CAS (ya existente, sin cambios) sigue devolviendo 409 en conflicto.

import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"

const DEFAULT_CONTEXT = {
  terminal: { id: "terminal-1", nombre: "Terminal Test" },
  negocio: { id: "negocio-1", nombre: "Negocio Test" },
}

let authResult: { ok: true; context: typeof DEFAULT_CONTEXT } | { ok: false; response: NextResponse }
let hasScopeResult: boolean
let pedidoRecord: {
  estado: string
  metodoEntrega: string
  clienteId: string | null
  negocioNombre: string
  direccion: string | null
  clienteConfirmaRecibido?: boolean
} | null
let updateManyCount: number
let updateManyLastArgs: Record<string, unknown> | null

mock.module("@/lib/db", () => {
  const pedido = {
    findFirst: async () => pedidoRecord,
    updateMany: async (args: Record<string, unknown>) => {
      updateManyLastArgs = args
      return { count: updateManyCount }
    },
  }
  const pedidoEvento = { create: async () => ({}) }
  const auditLog = { create: async () => ({}) }
  const db = {
    pedido,
    pedidoEvento,
    auditLog,
    cliente: { findUnique: async () => ({ pushSubscription: null }) },
    repartidorNegocio: { findMany: async () => [] },
    $transaction: async (fn: (tx: { pedido: typeof pedido }) => Promise<unknown>) => fn({ pedido }),
  }
  return { db }
})

// `mock.module` es global al proceso, no por archivo (bun:test) — se
// exportan AMBAS funciones (scope y area) para que este mock siga siendo
// compatible si operaciones/salon/pedidos/[id]/estado/order-transitions-authority.test.ts
// corre en el mismo proceso (mismo patrón ya documentado en
// operaciones/pyr/mensajes/[pedidoId]/route.test.ts para rate-limit).
mock.module("@/lib/operaciones-terminal-access", () => ({
  requireOperacionesScope: async () => authResult,
  requireOperacionesArea: async () => authResult,
  hasTerminalScope: () => hasScopeResult,
}))

mock.module("@/lib/audit", () => ({
  logPedidoEstadoChange: async () => {},
}))

mock.module("@/lib/push", () => ({
  createNotification: async () => {},
  orderUpdateNotification: () => ({ title: "t", body: "b" }),
  newDeliveryNotification: () => ({ title: "t2", body: "b2" }),
}))

mock.module("@/lib/pedido-cancelacion-financiera", () => ({
  revertirTarifaSiCorresponde: async () => {},
  DeudaReversionError: class DeudaReversionError extends Error {},
}))

mock.module("@/lib/operations-cancellation-notification", () => ({
  notifyOperationsOrderCancelled: async () => {},
}))

const { PATCH } = await import("./route")

function callPatch(id: string, body: Record<string, unknown>) {
  const req = new NextRequest(`http://localhost/api/operaciones/pyr/pedidos/${id}/estado`, {
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
  updateManyLastArgs = null
  pedidoRecord = {
    estado: "recibido",
    metodoEntrega: "domicilio",
    clienteId: null,
    negocioNombre: "Negocio Test",
    direccion: "Calle Falsa 123",
  }
})

describe("P2-T29A — operaciones/pyr/estado usa la autoridad compartida", () => {
  test("domicilio: recibido→preparando sigue aceptado (200)", async () => {
    const res = await callPatch("p1", { estado: "preparando" })
    expect(res.status).toBe(200)
    expect(updateManyLastArgs).toMatchObject({ where: { id: "p1", negocioId: "negocio-1", metodoEntrega: { not: "mesa" }, estado: "recibido" } })
  })

  test("domicilio: preparando→en_camino sigue aceptado (200)", async () => {
    pedidoRecord!.estado = "preparando"
    const res = await callPatch("p1", { estado: "en_camino" })
    expect(res.status).toBe(200)
  })

  test("retiro: preparando→en_camino sigue rechazado (400) — cross-modalidad inválida preservada", async () => {
    pedidoRecord = { ...pedidoRecord!, metodoEntrega: "retiro", estado: "preparando" }
    const res = await callPatch("p1", { estado: "en_camino" })
    expect(res.status).toBe(400)
  })

  test("retiro: preparando→listo_para_retirar sigue aceptado (200)", async () => {
    pedidoRecord = { ...pedidoRecord!, metodoEntrega: "retiro", estado: "preparando" }
    const res = await callPatch("p1", { estado: "listo_para_retirar" })
    expect(res.status).toBe(200)
  })

  test("cancelado desde recibido sigue aceptado con motivo (200)", async () => {
    const res = await callPatch("p1", { estado: "cancelado", motivo: "no hay stock" })
    expect(res.status).toBe(200)
  })

  test("CAS conflict (count=0) sigue devolviendo 409, sin cambio de contrato", async () => {
    updateManyCount = 0
    const res = await callPatch("p1", { estado: "preparando" })
    expect(res.status).toBe(409)
  })
})
