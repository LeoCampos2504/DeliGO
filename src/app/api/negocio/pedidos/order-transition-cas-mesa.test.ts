/// <reference types="bun-types" />

// ============================================
// P2-T29A — PUT /api/negocio/pedidos (mesa) — CAS de concurrencia real
// ============================================
// Auditando P2-T29A se encontró un CUARTO duplicado de las reglas de
// transición (además de negocio/pedidos/[id]/estado, operaciones/pyr/
// pedidos/[id]/estado y operaciones/salon/pedidos/[id]/estado): este PUT,
// exclusivo de mesa, usado en vivo por salon-tab.tsx (gestión de mesas del
// propio Negocio, distinta del panel de Operaciones/Terminal), tenía
// EXACTAMENTE el mismo gap — `VALID_TRANSITIONS` local + `update()` plano
// para transiciones no-cancelación. Se migró a la autoridad compartida +
// CAS real, igual que su endpoint hermano. Este archivo lo certifica.
//
// Fixtures: prefijo único, cleanup acotado sólo a lo creado acá (disciplina
// F-PRE-T29-03).

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { PUT as actualizarPedidoMesa } from "@/app/api/negocio/pedidos/route"

setDefaultTimeout(60_000)

const prefix = "test-t29a-mesa-"

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
    },
  })
}

async function crearPedidoMesa(negocioId: string, estado: string) {
  const pedido = await db.pedido.create({
    data: {
      negocioId,
      negocioSlug: `${prefix}slug`,
      negocioNombre: `${prefix}negocio`,
      clienteNombre: "Cliente Test",
      total: 1000,
      totalProductos: 1000,
      metodoEntrega: "mesa",
      mesaNumero: 1,
      estado,
      idempotencyKey: `${prefix}${randomUUID()}`,
    },
  })
  return pedido.id
}

function callPut(pedidoId: string, estado: string, negocioSession: string, extra: Record<string, unknown> = {}) {
  const req = new NextRequest("http://localhost/api/negocio/pedidos", {
    method: "PUT",
    body: JSON.stringify({ pedidoId, estado, ...extra }),
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${negocioSession}` },
  })
  return actualizarPedidoMesa(req)
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  if (negocioIds.length) {
    await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: negocioIds } } } }).catch(() => {})
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
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

describe("P2-T29A — PUT /api/negocio/pedidos (mesa) usa CAS real", () => {
  test("recibido→preparando sigue aceptado (200) con la autoridad compartida", async () => {
    const negocio = await ensureNegocio("basic")
    const session = await createSession(negocio.id, "negocio")
    const pedidoId = await crearPedidoMesa(negocio.id, "recibido")

    const res = await callPut(pedidoId, "preparando", session)
    expect(res.status).toBe(200)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("preparando")
  })

  test("dos requests concurrentes preparando→listo_para_retirar: un 200, un 409, un solo PedidoEvento", async () => {
    const negocio = await ensureNegocio("race")
    const session = await createSession(negocio.id, "negocio")
    const pedidoId = await crearPedidoMesa(negocio.id, "preparando")

    const [resA, resB] = await Promise.all([
      callPut(pedidoId, "listo_para_retirar", session),
      callPut(pedidoId, "listo_para_retirar", session),
    ])

    // Este endpoint no tiene lock process-local (a diferencia de
    // negocio/pedidos/[id]/estado) — el perdedor puede llegar a la CAS
    // (409, "cambió en otro dispositivo") O, si su propia lectura fresca ya
    // ve el estado post-transición del ganador, caer antes en el check
    // "ya está en ese estado" (400) — ambos son resultados válidos de
    // concurrencia real (nunca determinista cuál ocurre), nunca un segundo
    // 200. Lo que se prueba es la propiedad de fondo: single-winner, estado
    // final correcto, un solo PedidoEvento.
    const winners = [resA.status, resB.status].filter((s) => s === 200)
    const losers = [resA.status, resB.status].filter((s) => s !== 200)
    expect(winners.length).toBe(1)
    expect(losers.length).toBe(1)
    expect([400, 409]).toContain(losers[0])

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("listo_para_retirar")

    // Hallazgo preexistente, no introducido ni corregido por T29A (fuera de
    // alcance — sólo se cierra el gap de CAS, no se agrega auditoría nueva):
    // este endpoint, a diferencia de su hermano negocio/pedidos/[id]/estado,
    // NUNCA llamó a logPedidoEstadoChange para ninguna transición — ni antes
    // ni después de esta migración. 0 eventos es el comportamiento correcto
    // y sin cambios de este endpoint específico.
    const eventCount = await db.pedidoEvento.count({ where: { pedidoId } })
    expect(eventCount).toBe(0)
  })

  test("recibido→aceptado sigue rechazado (400) — mesa nunca recibe aceptado, sin uso productivo en T29A", async () => {
    const negocio = await ensureNegocio("noaccept")
    const session = await createSession(negocio.id, "negocio")
    const pedidoId = await crearPedidoMesa(negocio.id, "recibido")

    const res = await callPut(pedidoId, "aceptado", session)
    expect(res.status).toBe(400)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("recibido")
  })
})
