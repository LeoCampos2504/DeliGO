/// <reference types="bun-types" />

// ============================================
// P2-T29C — POST /api/repartidor/pedidos/auto-cancel
// ============================================
// Antes de esta tarea, CERO tests (P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_
// REDESIGN_AUDIT_AND_DESIGN.md §17). Cubre que auto-cancel ahora reconoce
// AMBOS estados de "esperando conductor" (esperando_repartidor canónico +
// en_camino legacy compat), preserva el umbral de tiempo existente sin
// rediseñar la política temporal, y nunca cancela un pedido ya asignado o
// uno reciente.
//
// Fixtures: prefijo único, cleanup acotado exclusivamente a lo creado por
// este archivo (disciplina F-PRE-T29-03).

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as autoCancelar } from "./route"
import { CANONICAL_WAITING_DRIVER_STATE, LEGACY_AVAILABLE_DELIVERY_STATE } from "@/lib/order-transitions"

setDefaultTimeout(60_000)

const prefix = "test-t29c-autocancel-"
const OLD_FECHA = new Date(Date.now() - 60 * 60 * 1000) // 60 min ago, older than any allowed threshold ceiling test here
const RECENT_FECHA = new Date(Date.now() - 60 * 1000) // 1 min ago

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
    },
  })
}

async function ensureRepartidor(suffix: string, negocioId: string) {
  const repartidor = await db.repartidor.create({
    data: {
      nombre: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      activo: true,
    },
  })
  await db.repartidorNegocio.create({
    data: {
      repartidorId: repartidor.id,
      negocioId,
      negocioSlug: `${prefix}${suffix}`,
      negocioNombre: `${prefix}${suffix}`,
      codigoAcceso: `${prefix}codigo-${suffix}`,
    },
  })
  return repartidor
}

async function crearPedido(params: {
  negocioId: string
  estado: string
  fecha: Date
  repartidorId?: string | null
  metodoEntrega?: string
}) {
  const pedido = await db.pedido.create({
    data: {
      negocioId: params.negocioId,
      negocioSlug: `${prefix}slug`,
      negocioNombre: `${prefix}negocio`,
      clienteNombre: "Cliente Test",
      total: 1000,
      totalProductos: 1000,
      metodoEntrega: params.metodoEntrega ?? "domicilio",
      direccion: "Calle Falsa 123",
      estado: params.estado,
      fecha: params.fecha,
      repartidorId: params.repartidorId ?? null,
      idempotencyKey: `${prefix}${randomUUID()}`,
    },
  })
  return pedido.id
}

function autoCancelReq(repartidorSession: string, maxMinutes = 30): NextRequest {
  return new NextRequest("http://localhost/api/repartidor/pedidos/auto-cancel", {
    method: "POST",
    body: JSON.stringify({ maxMinutes }),
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${repartidorSession}` },
  })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const repartidores = await db.repartidor.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const repartidorIds = repartidores.map((r) => r.id)

  if (negocioIds.length) {
    await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: negocioIds } } } }).catch(() => {})
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.repartidorNegocio.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (repartidorIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: repartidorIds } } })
    await db.repartidor.deleteMany({ where: { id: { in: repartidorIds } } })
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

describe("P2-T29C — auto-cancel reconoce esperando_repartidor (canónico) y en_camino (legacy compat)", () => {
  test("pedido viejo en esperando_repartidor+null se cancela, estadoAnterior=esperando_repartidor (no hardcodeado)", async () => {
    const negocio = await ensureNegocio("canon-old")
    const repartidor = await ensureRepartidor("canon-old", negocio.id)
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedido({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE, fecha: OLD_FECHA })

    const res = await autoCancelar(autoCancelReq(repartidorSession))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cancelled).toBe(1)

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("cancelado")

    const evento = await db.pedidoEvento.findFirstOrThrow({ where: { pedidoId } })
    expect(evento.estadoAnterior).toBe(CANONICAL_WAITING_DRIVER_STATE)
  })

  test("pedido viejo legacy en_camino+null también se cancela, estadoAnterior=en_camino", async () => {
    const negocio = await ensureNegocio("legacy-old")
    const repartidor = await ensureRepartidor("legacy-old", negocio.id)
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedido({ negocioId: negocio.id, estado: LEGACY_AVAILABLE_DELIVERY_STATE, fecha: OLD_FECHA })

    const res = await autoCancelar(autoCancelReq(repartidorSession))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cancelled).toBe(1)

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("cancelado")

    const evento = await db.pedidoEvento.findFirstOrThrow({ where: { pedidoId } })
    expect(evento.estadoAnterior).toBe(LEGACY_AVAILABLE_DELIVERY_STATE)
  })

  test("pedido reciente (dentro del umbral) NO se cancela", async () => {
    const negocio = await ensureNegocio("recent")
    const repartidor = await ensureRepartidor("recent", negocio.id)
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedido({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE, fecha: RECENT_FECHA })

    const res = await autoCancelar(autoCancelReq(repartidorSession))
    expect(res.status).toBe(200)

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe(CANONICAL_WAITING_DRIVER_STATE)
  })

  test("pedido viejo pero ya asignado (repartidorId != null) NUNCA se trata como 'esperando conductor'", async () => {
    const negocio = await ensureNegocio("assigned-old")
    const repartidorAsignado = await ensureRepartidor("assigned-old-owner", negocio.id)
    const repartidorSession = await createSession(repartidorAsignado.id, "repartidor")
    const pedidoId = await crearPedido({
      negocioId: negocio.id,
      estado: "en_camino",
      fecha: OLD_FECHA,
      repartidorId: repartidorAsignado.id,
    })

    const res = await autoCancelar(autoCancelReq(repartidorSession))
    expect(res.status).toBe(200)

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("en_camino")
    expect(fresh.repartidorId).toBe(repartidorAsignado.id)
  })
})
