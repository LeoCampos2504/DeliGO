/// <reference types="bun-types" />

// ============================================
// P2-T29C — newDeliveryNotification: boundary movido a esperando_repartidor
// ============================================
// Antes de T29C, el aviso a Repartidores de "hay un nuevo delivery
// disponible" se disparaba en `estado==="en_camino"` — que en el modelo
// viejo significaba exactamente "negocio empezó a buscar repartidor, aún
// sin asignar". T29C separa ese significado en dos estados reales:
// `esperando_repartidor` (disponible, sin asignar) y `en_camino` (ya
// asignado por Repartidor, vía un endpoint DISTINTO —
// repartidor/pedidos/[id]/aceptar/route.ts — que nunca pasa por acá). Este
// archivo prueba que el aviso ahora se dispara en la transición canónica
// (preparando->esperando_repartidor), se preserva para la arista legacy
// directa (preparando->en_camino, todavía aceptada durante el rollout de
// T29B), y NUNCA se duplica ni se dispara para transiciones no relacionadas.
//
// Fixtures: prefijo único, cleanup acotado exclusivamente a lo creado por
// este archivo (disciplina F-PRE-T29-03).

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST_FOR_TESTS as crearPedido } from "@/app/api/pedidos/route"
import { PATCH_FOR_TESTS as cambiarEstado } from "@/app/api/negocio/pedidos/[id]/estado/route"

setDefaultTimeout(60_000)

const prefix = "test-t29c-newdelivery-"

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
    },
  })
}

async function ensureProducto(negocioId: string) {
  const producto = await db.producto.create({ data: { nombre: `${prefix}producto`, precio: 100, negocioId } })
  return producto.id
}

async function ensureRepartidorActivo(suffix: string, negocioId: string) {
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

function pedidoBody(negocioId: string, productoId: string) {
  return {
    negocioId,
    items: [{ productoId, cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "" }],
    metodoEntrega: "domicilio",
    metodoPago: "efectivo",
    notas: null,
    direccion: "Calle Falsa 123",
    referencia: null,
    lat: -34.6,
    lng: -58.4,
    mesaId: null,
    mesaNumero: null,
    empleadoCodigo: null,
    fingerprint: null,
    mesaGeolocation: null,
  }
}

function pedidoReq(body: unknown, ip: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": ip }
  if (cookie) headers["cookie"] = `${SESSION_COOKIE_NAME}=${cookie}`
  return new NextRequest("http://localhost/api/pedidos", { method: "POST", body: JSON.stringify(body), headers })
}

function estadoReq(pedidoId: string, body: unknown, negocioSession: string): NextRequest {
  return new NextRequest(`http://localhost/api/negocio/pedidos/${pedidoId}/estado`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${negocioSession}` },
  })
}

function cambiar(pedidoId: string, body: unknown, negocioSession: string) {
  return cambiarEstado(estadoReq(pedidoId, body, negocioSession), { params: Promise.resolve({ id: pedidoId }) }, {})
}

async function ensureClienteUnico(suffix: string) {
  return db.cliente.create({
    data: { nombre: `${prefix}cliente-${suffix}`, email: `${prefix}cliente-${suffix.replace(/\./g, "-")}@example.test`, telefono: "" },
  })
}

async function crearYObtenerPedido(negocioId: string, productoId: string, ip: string) {
  const clienteSession = await createSession((await ensureClienteUnico(ip)).id, "cliente")
  const res = await crearPedido(pedidoReq(pedidoBody(negocioId, productoId), ip, clienteSession), {})
  expect(res.status).toBe(201)
  return res.json()
}

async function newDeliveryNotifsFor(pedidoId: string, repartidorId: string) {
  return db.notificacion.findMany({
    where: { pedidoId, userId: repartidorId, userType: "repartidor", tipo: "new_delivery" },
  })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)
  const repartidores = await db.repartidor.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const repartidorIds = repartidores.map((r) => r.id)

  if (negocioIds.length) {
    await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: negocioIds } } } }).catch(() => {})
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.producto.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.repartidorNegocio.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (repartidorIds.length) {
    await db.notificacion.deleteMany({ where: { userId: { in: repartidorIds } } }).catch(() => {})
    await db.repartidor.deleteMany({ where: { id: { in: repartidorIds } } })
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

describe("P2-T29C — newDeliveryNotification se dispara en preparando->esperando_repartidor (canónico)", () => {
  test("recibido->aceptado->preparando->esperando_repartidor: exactamente 1 aviso a Repartidor activo, ninguno antes", async () => {
    const negocio = await ensureNegocio("canon-flow")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const repartidor = await ensureRepartidorActivo("canon-flow", negocio.id)
    const pedido = await crearYObtenerPedido(negocio.id, productoId, `198.51.100.${randomUUID().slice(0, 8)}`)

    await cambiar(pedido.id, { estado: "aceptado" }, negocioSession)
    expect(await newDeliveryNotifsFor(pedido.id, repartidor.id)).toHaveLength(0)

    await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    expect(await newDeliveryNotifsFor(pedido.id, repartidor.id)).toHaveLength(0)

    const res = await cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession)
    expect(res.status).toBe(200)
    const notifs = await newDeliveryNotifsFor(pedido.id, repartidor.id)
    expect(notifs).toHaveLength(1)
    expect(notifs[0].titulo).toBe("¡Nueva entrega! 🛵")
  })

  test("repartidor inactivo no recibe el aviso", async () => {
    const negocio = await ensureNegocio("inactive-driver")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const repartidor = await ensureRepartidorActivo("inactive-driver", negocio.id)
    await db.repartidor.update({ where: { id: repartidor.id }, data: { activo: false } })
    const pedido = await crearYObtenerPedido(negocio.id, productoId, `198.51.100.${randomUUID().slice(0, 8)}`)
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "preparando" } })

    await cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession)
    expect(await newDeliveryNotifsFor(pedido.id, repartidor.id)).toHaveLength(0)
  })
})

describe("P2-T29C — legacy directo preparando->en_camino preserva el aviso (compatibilidad de rollout)", () => {
  test("preparando->en_camino directo (sin pasar por esperando_repartidor): sigue avisando a Repartidor", async () => {
    const negocio = await ensureNegocio("legacy-flow")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const repartidor = await ensureRepartidorActivo("legacy-flow", negocio.id)
    const pedido = await crearYObtenerPedido(negocio.id, productoId, `198.51.100.${randomUUID().slice(0, 8)}`)
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "preparando" } })

    const res = await cambiar(pedido.id, { estado: "en_camino" }, negocioSession)
    expect(res.status).toBe(200)
    const notifs = await newDeliveryNotifsFor(pedido.id, repartidor.id)
    expect(notifs).toHaveLength(1)
  })
})

describe("P2-T29C — nunca se duplica: la aceptación de Repartidor no pasa por este endpoint", () => {
  test("un pedido que llega a esperando_repartidor y luego (fuera de este endpoint) a en_camino recibe UN SOLO aviso total", async () => {
    const negocio = await ensureNegocio("no-duplicate")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const repartidor = await ensureRepartidorActivo("no-duplicate", negocio.id)
    const pedido = await crearYObtenerPedido(negocio.id, productoId, `198.51.100.${randomUUID().slice(0, 8)}`)
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "preparando" } })

    await cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession)
    expect(await newDeliveryNotifsFor(pedido.id, repartidor.id)).toHaveLength(1)

    // Simula la aceptación real de Repartidor (endpoint distinto, no
    // ejercitado acá) avanzando directamente el estado — este endpoint de
    // Negocio nunca vuelve a tocar este pedido después, así que no hay
    // ninguna oportunidad de reenviar el aviso.
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "en_camino", repartidorId: repartidor.id } })

    expect(await newDeliveryNotifsFor(pedido.id, repartidor.id)).toHaveLength(1)
  })
})
