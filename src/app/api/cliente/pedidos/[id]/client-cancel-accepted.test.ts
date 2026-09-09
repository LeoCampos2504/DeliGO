/// <reference types="bun-types" />

// ============================================
// P2-T29B — Cliente puede cancelar desde `aceptado`
// ============================================
// CLIENTE_PUEDE_CANCELAR_EN_ACEPTADO ya estaba decidido como autoridad
// pura desde T29A (order-transitions.ts) — T29B lo activa como
// comportamiento real: `aceptado` pasa a ser alcanzable para domicilio/
// retiro, así que el endpoint de cancelación de Cliente
// (PUT /api/cliente/pedidos/[id], action="cancelar") debe aceptarlo.
//
// Fixtures: prefijo único, cleanup acotado exclusivamente a lo creado por
// este archivo.

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { PUT as accionPedidoCliente } from "@/app/api/cliente/pedidos/[id]/route"

setDefaultTimeout(60_000)

const prefix = "test-t29b-clientcancel-"

async function ensureNegocio(suffix: string) {
  return db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}`,
      usuario: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      horarioMode: "simple",
      abiertoManual: true,
      ofreceRetiro: true,
      ofreceDelivery: true,
      toleranciaCancelacion: 5,
    },
  })
}

async function crearPedidoEnEstado(negocioId: string, estado: string, metodoEntrega: string, clienteId: string) {
  return db.pedido.create({
    data: {
      negocioId,
      clienteId,
      negocioSlug: `${prefix}slug`,
      negocioNombre: `${prefix}negocio`,
      clienteNombre: "Cliente Test",
      total: 1000,
      totalProductos: 1000,
      metodoEntrega,
      direccion: metodoEntrega === "domicilio" ? "Calle Falsa 123" : null,
      estado,
      fecha: new Date(),
      idempotencyKey: `${prefix}${randomUUID()}`,
    },
  })
}

function accionReq(pedidoId: string, action: string, clienteSession: string): NextRequest {
  return new NextRequest(`http://localhost/api/cliente/pedidos/${pedidoId}`, {
    method: "PUT",
    body: JSON.stringify({ action }),
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${clienteSession}` },
  })
}

function accionar(pedidoId: string, action: string, clienteSession: string) {
  return accionPedidoCliente(accionReq(pedidoId, action, clienteSession), { params: Promise.resolve({ id: pedidoId }) })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)

  if (negocioIds.length) {
    await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: negocioIds } } } }).catch(() => {})
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  }
}

beforeAll(async () => {
  await cleanup()
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  const remaining = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  expect(remaining).toBe(0)
})

describe("P2-T29B — cancelación de Cliente desde aceptado", () => {
  test("domicilio en aceptado: cliente propietario puede cancelar", async () => {
    const negocio = await ensureNegocio("dom")
    const cliente = await db.cliente.create({ data: { nombre: `${prefix}cliente-dom`, email: `${prefix}cliente-dom@example.test`, telefono: "" } })
    const clienteSession = await createSession(cliente.id, "cliente")
    const pedido = await crearPedidoEnEstado(negocio.id, "aceptado", "domicilio", cliente.id)

    const res = await accionar(pedido.id, "cancelar", clienteSession)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.pedido.estado).toBe("cancelado")

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("cancelado")
    expect(fresh.canceladoPor).toBe("cliente")
  })

  test("retiro en aceptado: cliente propietario puede cancelar", async () => {
    const negocio = await ensureNegocio("ret")
    const cliente = await db.cliente.create({ data: { nombre: `${prefix}cliente-ret`, email: `${prefix}cliente-ret@example.test`, telefono: "" } })
    const clienteSession = await createSession(cliente.id, "cliente")
    const pedido = await crearPedidoEnEstado(negocio.id, "aceptado", "retiro", cliente.id)

    const res = await accionar(pedido.id, "cancelar", clienteSession)
    expect(res.status).toBe(200)
  })

  test("preparando sigue NO cancelable por Cliente (sin cambio de política más allá de aceptado)", async () => {
    const negocio = await ensureNegocio("preparando")
    const cliente = await db.cliente.create({ data: { nombre: `${prefix}cliente-prep`, email: `${prefix}cliente-prep@example.test`, telefono: "" } })
    const clienteSession = await createSession(cliente.id, "cliente")
    const pedido = await crearPedidoEnEstado(negocio.id, "preparando", "domicilio", cliente.id)

    const res = await accionar(pedido.id, "cancelar", clienteSession)
    expect(res.status).toBe(400)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("preparando")
  })

  test("dos requests concurrentes cancelando desde aceptado: un solo ganador, sin doble reversión", async () => {
    const negocio = await ensureNegocio("race")
    const cliente = await db.cliente.create({ data: { nombre: `${prefix}cliente-race`, email: `${prefix}cliente-race@example.test`, telefono: "" } })
    const clienteSession = await createSession(cliente.id, "cliente")
    const pedido = await crearPedidoEnEstado(negocio.id, "aceptado", "domicilio", cliente.id)

    const [resA, resB] = await Promise.all([
      accionar(pedido.id, "cancelar", clienteSession),
      accionar(pedido.id, "cancelar", clienteSession),
    ])
    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([200, 400])

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("cancelado")
  })
})
