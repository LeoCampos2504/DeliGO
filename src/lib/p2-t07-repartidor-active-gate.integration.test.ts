/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as acceptOrder } from "@/app/api/repartidor/pedidos/[id]/aceptar/route"

const prefix = `test-p2-t07-repartidor-${randomUUID()}-`
const businessIds: string[] = []
const courierIds: string[] = []
const orderIds: string[] = []
let courierId = ""
let businessId = ""
let sessionToken = ""
setDefaultTimeout(120_000)

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const business = await db.negocio.create({
    data: {
      nombre: `${prefix}negocio`,
      slug: `${prefix}negocio`,
      usuario: `${prefix}usuario`,
      email: `${prefix}negocio@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
    },
  })
  businessId = business.id
  businessIds.push(business.id)

  const courier = await db.repartidor.create({
    data: {
      nombre: `${prefix}repartidor`,
      email: `${prefix}repartidor@example.test`,
      password: null,
      activo: true,
      emailVerified: new Date(),
    },
  })
  courierId = courier.id
  courierIds.push(courier.id)
  await db.repartidorNegocio.create({
    data: {
      repartidorId: courier.id,
      negocioId: business.id,
      negocioSlug: business.slug,
      negocioNombre: business.nombre,
      codigoAcceso: `${prefix}codigo`,
    },
  })
  sessionToken = await createSession(courier.id, "repartidor")
})

afterAll(async () => {
  await cleanup()
  expect(await db.repartidor.count({ where: { email: { startsWith: prefix } } })).toBe(0)
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
  await db.$disconnect()
})

async function createDelivery(suffix: string) {
  const order = await db.pedido.create({
    data: {
      negocioId: businessId,
      negocioSlug: `${prefix}negocio`,
      negocioNombre: `${prefix}negocio`,
      clienteNombre: `${prefix}cliente-${suffix}`,
      total: 100,
      totalProductos: 100,
      metodoEntrega: "domicilio",
      estado: "en_camino",
    },
  })
  orderIds.push(order.id)
  return order
}

function request(orderId: string): NextRequest {
  return new NextRequest(`http://localhost/api/repartidor/pedidos/${orderId}/aceptar`, {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` },
  })
}

async function accept(orderId: string) {
  return acceptOrder(request(orderId), { params: Promise.resolve({ id: orderId }) })
}

async function cleanup() {
  const ids = [...courierIds]
  const businesses = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const knownBusinessIds = [...new Set([...businessIds, ...businesses.map((row) => row.id)])]
  const couriers = await db.repartidor.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const knownCourierIds = [...new Set([...ids, ...couriers.map((row) => row.id)])]
  if (knownCourierIds.length) await db.sesion.deleteMany({ where: { userId: { in: knownCourierIds } } })
  if (knownBusinessIds.length) await db.pedido.deleteMany({ where: { negocioId: { in: knownBusinessIds } } })
  if (knownCourierIds.length || knownBusinessIds.length) {
    await db.repartidorNegocio.deleteMany({
      where: {
        OR: [
          ...(knownCourierIds.length ? [{ repartidorId: { in: knownCourierIds } }] : []),
          ...(knownBusinessIds.length ? [{ negocioId: { in: knownBusinessIds } }] : []),
        ],
      },
    })
  }
  if (knownCourierIds.length) await db.repartidor.deleteMany({ where: { id: { in: knownCourierIds } } })
  if (knownBusinessIds.length) await db.negocio.deleteMany({ where: { id: { in: knownBusinessIds } } })
  businessIds.length = 0
  courierIds.length = 0
  orderIds.length = 0
}

describe("P2-T07 F-T07-02 — active repartidor gate", () => {
  test("active session accepts delivery, deactivation blocks stale session, reactivation restores it", async () => {
    const accepted = await createDelivery("active")
    const activeResponse = await accept(accepted.id)
    expect(activeResponse.status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: accepted.id } })).repartidorId).toBe(courierId)

    await db.repartidor.update({ where: { id: courierId }, data: { activo: false } })
    expect(await getUserFromToken(sessionToken)).toBeNull()
    const blocked = await createDelivery("inactive")
    const blockedResponse = await accept(blocked.id)
    expect(blockedResponse.status).toBe(403)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: blocked.id } })).repartidorId).toBeNull()
    expect(await db.pedidoEvento.count({ where: { pedidoId: blocked.id } })).toBe(0)

    await db.repartidor.update({ where: { id: courierId }, data: { activo: true } })
    expect(await getUserFromToken(sessionToken)).not.toBeNull()
    const restored = await createDelivery("reactivated")
    const restoredResponse = await accept(restored.id)
    expect(restoredResponse.status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: restored.id } })).repartidorId).toBe(courierId)
  })
})
