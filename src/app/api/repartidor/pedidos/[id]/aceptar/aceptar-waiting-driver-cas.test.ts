/// <reference types="bun-types" />

// ============================================
// P2-T29C — POST /api/repartidor/pedidos/[id]/aceptar
// ============================================
// GAP CRÍTICO cerrado por esta tarea (identificado por la auditoría P2-T29
// original, P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md
// §17: "la aceptación atómica del repartidor... no tiene NINGÚN test de
// concurrencia real"). Cubre: aceptación canónica simple, dos repartidores
// concurrentes (single-winner real vía Promise.all contra la DB de TESTING),
// compatibilidad legacy (en_camino+null), rechazo de retiro/mesa,
// ownership/rol, PedidoEvento con estadoAnterior correcto (antes hardcodeado
// a "en_camino", ahora refleja el origen real), y la carrera
// cancelación-vs-aceptación (Negocio cancela desde esperando_repartidor
// mientras un Repartidor acepta).
//
// Fixtures: prefijo único, cleanup acotado exclusivamente a lo creado por
// este archivo (disciplina F-PRE-T29-03).

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as aceptarPedido } from "./route"
import { PATCH_FOR_TESTS as cambiarEstadoNegocio } from "@/app/api/negocio/pedidos/[id]/estado/route"
import { CANONICAL_WAITING_DRIVER_STATE, LEGACY_AVAILABLE_DELIVERY_STATE } from "@/lib/order-transitions"

setDefaultTimeout(60_000)

const prefix = "test-t29c-aceptar-"

async function ensureNegocio(suffix: string, seguimientoDeliveryActivo = false) {
  return db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}`,
      usuario: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      ofreceDelivery: true,
      seguimientoDeliveryActivo,
    },
  })
}

async function ensureRepartidor(suffix: string) {
  return db.repartidor.create({
    data: {
      nombre: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      activo: true,
    },
  })
}

async function ensureAsociacion(repartidorId: string, negocioId: string, suffix: string) {
  return db.repartidorNegocio.create({
    data: {
      repartidorId,
      negocioId,
      negocioSlug: `${prefix}${suffix}`,
      negocioNombre: `${prefix}${suffix}`,
      codigoAcceso: `${prefix}codigo-${suffix}`,
    },
  })
}

async function ensureCliente(suffix: string) {
  return db.cliente.create({
    data: {
      nombre: `${prefix}cliente-${suffix}`,
      email: `${prefix}cliente-${suffix}@example.test`,
      telefono: "",
    },
  })
}

async function crearPedidoDomicilio(params: {
  negocioId: string
  estado: string
  repartidorId?: string | null
  clienteId?: string | null
  metodoEntrega?: string
}) {
  const negocio = await db.negocio.findUniqueOrThrow({
    where: { id: params.negocioId },
    select: { seguimientoDeliveryActivo: true },
  })
  const pedido = await db.pedido.create({
    data: {
      negocioId: params.negocioId,
      negocioSlug: `${prefix}slug`,
      negocioNombre: `${prefix}negocio`,
      clienteId: params.clienteId ?? null,
      clienteNombre: "Cliente Test",
      total: 1000,
      totalProductos: 1000,
      metodoEntrega: params.metodoEntrega ?? "domicilio",
      direccion: "Calle Falsa 123",
      estado: params.estado,
      repartidorId: params.repartidorId ?? null,
      seguimientoDeliveryHabilitado:
        (params.metodoEntrega ?? "domicilio") === "domicilio" && negocio.seguimientoDeliveryActivo,
      idempotencyKey: `${prefix}${randomUUID()}`,
    },
  })
  return pedido.id
}

function aceptarReq(pedidoId: string, repartidorSession: string): NextRequest {
  return new NextRequest(`http://localhost/api/repartidor/pedidos/${pedidoId}/aceptar`, {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${repartidorSession}` },
  })
}

function aceptar(pedidoId: string, repartidorSession: string) {
  return aceptarPedido(aceptarReq(pedidoId, repartidorSession), { params: Promise.resolve({ id: pedidoId }) })
}

function estadoReq(pedidoId: string, body: unknown, negocioSession: string): NextRequest {
  return new NextRequest(`http://localhost/api/negocio/pedidos/${pedidoId}/estado`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${negocioSession}` },
  })
}

function cancelarComoNegocio(pedidoId: string, negocioSession: string) {
  return cambiarEstadoNegocio(
    estadoReq(pedidoId, { estado: "cancelado", motivo: "sin stock" }, negocioSession),
    { params: Promise.resolve({ id: pedidoId }) },
    {}
  )
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const repartidores = await db.repartidor.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const repartidorIds = repartidores.map((r) => r.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)

  if (negocioIds.length) {
    await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: negocioIds } } } }).catch(() => {})
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.repartidorNegocio.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (repartidorIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: repartidorIds } } })
    await db.repartidor.deleteMany({ where: { id: { in: repartidorIds } } })
  }
  if (clienteIds.length) {
    await db.notificacion.deleteMany({ where: { userId: { in: clienteIds } } }).catch(() => {})
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

describe("P2-T29C — aceptación canónica (esperando_repartidor -> en_camino)", () => {
  test("single request: 200, en_camino + repartidorId asignado, PedidoEvento.estadoAnterior=esperando_repartidor (no hardcodeado)", async () => {
    const negocio = await ensureNegocio("single-canon")
    const repartidor = await ensureRepartidor("single-canon")
    await ensureAsociacion(repartidor.id, negocio.id, "single-canon")
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE })

    const res = await aceptar(pedidoId, repartidorSession)
    expect(res.status).toBe(200)

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("en_camino")
    expect(fresh.repartidorId).toBe(repartidor.id)

    const eventos = await db.pedidoEvento.findMany({ where: { pedidoId } })
    expect(eventos).toHaveLength(1)
    expect(eventos[0].estado).toBe("en_camino")
    expect(eventos[0].estadoAnterior).toBe(CANONICAL_WAITING_DRIVER_STATE)
  })

  test("compatibilidad legacy: en_camino+repartidorId=null también es aceptable, PedidoEvento.estadoAnterior=en_camino", async () => {
    const negocio = await ensureNegocio("single-legacy")
    const repartidor = await ensureRepartidor("single-legacy")
    await ensureAsociacion(repartidor.id, negocio.id, "single-legacy")
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: LEGACY_AVAILABLE_DELIVERY_STATE })

    const res = await aceptar(pedidoId, repartidorSession)
    expect(res.status).toBe(200)

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("en_camino")
    expect(fresh.repartidorId).toBe(repartidor.id)

    const eventos = await db.pedidoEvento.findMany({ where: { pedidoId } })
    expect(eventos).toHaveLength(1)
    expect(eventos[0].estadoAnterior).toBe(LEGACY_AVAILABLE_DELIVERY_STATE)
  })

  test("side effect single-winner: notificación Cliente 'Repartidor asignado' exactamente 1", async () => {
    const negocio = await ensureNegocio("side-effect")
    const repartidor = await ensureRepartidor("side-effect")
    await ensureAsociacion(repartidor.id, negocio.id, "side-effect")
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const cliente = await ensureCliente("side-effect")
    const pedidoId = await crearPedidoDomicilio({
      negocioId: negocio.id,
      estado: CANONICAL_WAITING_DRIVER_STATE,
      clienteId: cliente.id,
    })

    const res = await aceptar(pedidoId, repartidorSession)
    expect(res.status).toBe(200)

    const notifs = await db.notificacion.findMany({ where: { pedidoId, userId: cliente.id, userType: "cliente" } })
    expect(notifs).toHaveLength(1)
    expect(notifs[0].titulo).toBe("Repartidor asignado 🛵")
  })
})

describe("P2-T02-R4 — snapshot final de tracking en aceptación", () => {
  test("Caso A: delivery creado con tracking OFF, negocio ON antes de aceptar -> snapshot true y pedido elegible", async () => {
    const negocio = await ensureNegocio("r4-off-then-on", false)
    const repartidor = await ensureRepartidor("r4-off-then-on")
    await ensureAsociacion(repartidor.id, negocio.id, "r4-off-then-on")
    const session = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE })

    const before = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(before.seguimientoDeliveryHabilitado).toBe(false)
    await db.negocio.update({ where: { id: negocio.id }, data: { seguimientoDeliveryActivo: true } })

    const res = await aceptar(pedidoId, session)
    expect(res.status).toBe(200)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("en_camino")
    expect(fresh.repartidorId).toBe(repartidor.id)
    expect(fresh.seguimientoDeliveryHabilitado).toBe(true)
  })

  test("Caso B: delivery creado y aceptado con tracking OFF -> snapshot false", async () => {
    const negocio = await ensureNegocio("r4-off-at-accept", false)
    const repartidor = await ensureRepartidor("r4-off-at-accept")
    await ensureAsociacion(repartidor.id, negocio.id, "r4-off-at-accept")
    const session = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE })

    const res = await aceptar(pedidoId, session)
    expect(res.status).toBe(200)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("en_camino")
    expect(fresh.repartidorId).toBe(repartidor.id)
    expect(fresh.seguimientoDeliveryHabilitado).toBe(false)
  })

  test("Caso C: delivery creado y aceptado con tracking ON -> snapshot true", async () => {
    const negocio = await ensureNegocio("r4-on-at-accept", true)
    const repartidor = await ensureRepartidor("r4-on-at-accept")
    await ensureAsociacion(repartidor.id, negocio.id, "r4-on-at-accept")
    const session = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE })

    const res = await aceptar(pedidoId, session)
    expect(res.status).toBe(200)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("en_camino")
    expect(fresh.repartidorId).toBe(repartidor.id)
    expect(fresh.seguimientoDeliveryHabilitado).toBe(true)
  })

  test("Caso D: retiro nunca activa el snapshot de tracking", async () => {
    const negocio = await ensureNegocio("r4-retiro", true)
    const repartidor = await ensureRepartidor("r4-retiro")
    await ensureAsociacion(repartidor.id, negocio.id, "r4-retiro")
    const session = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({
      negocioId: negocio.id,
      estado: CANONICAL_WAITING_DRIVER_STATE,
      metodoEntrega: "retiro",
    })

    const res = await aceptar(pedidoId, session)
    expect(res.status).toBe(400)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.repartidorId).toBeNull()
    expect(fresh.seguimientoDeliveryHabilitado).toBe(false)
  })

  test("Caso E: driver inválido/no asociado rechaza sin mutar el snapshot", async () => {
    const negocio = await ensureNegocio("r4-invalid-driver", true)
    const repartidor = await ensureRepartidor("r4-invalid-driver")
    const session = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE })

    const before = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(before.seguimientoDeliveryHabilitado).toBe(true)
    const res = await aceptar(pedidoId, session)
    expect(res.status).toBe(403)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe(CANONICAL_WAITING_DRIVER_STATE)
    expect(fresh.repartidorId).toBeNull()
    expect(fresh.seguimientoDeliveryHabilitado).toBe(true)
  })
})

describe("P2-T29C — rechazos explícitos", () => {
  test("pedido en estado no disponible (preparando) -> 400, nunca asigna repartidor", async () => {
    const negocio = await ensureNegocio("reject-preparando")
    const repartidor = await ensureRepartidor("reject-preparando")
    await ensureAsociacion(repartidor.id, negocio.id, "reject-preparando")
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: "preparando" })

    const res = await aceptar(pedidoId, repartidorSession)
    expect(res.status).toBe(400)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.repartidorId).toBeNull()
  })

  test("pedido ya asignado a otro repartidor (stale) -> 409, no se reasigna", async () => {
    const negocio = await ensureNegocio("reject-stale")
    const repartidorA = await ensureRepartidor("reject-stale-a")
    const repartidorB = await ensureRepartidor("reject-stale-b")
    await ensureAsociacion(repartidorA.id, negocio.id, "reject-stale-a")
    await ensureAsociacion(repartidorB.id, negocio.id, "reject-stale-b")
    const sessionB = await createSession(repartidorB.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({
      negocioId: negocio.id,
      estado: "en_camino",
      repartidorId: repartidorA.id,
    })

    const res = await aceptar(pedidoId, sessionB)
    expect(res.status).toBe(409)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.repartidorId).toBe(repartidorA.id)
  })

  test("retiro nunca es aceptable por Repartidor, incluso si alguien fuerza el estado esperando_repartidor en la fila", async () => {
    const negocio = await ensureNegocio("reject-retiro")
    const repartidor = await ensureRepartidor("reject-retiro")
    await ensureAsociacion(repartidor.id, negocio.id, "reject-retiro")
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({
      negocioId: negocio.id,
      estado: CANONICAL_WAITING_DRIVER_STATE,
      metodoEntrega: "retiro",
    })

    const res = await aceptar(pedidoId, repartidorSession)
    expect(res.status).toBe(400)
  })

  test("mesa nunca es aceptable por Repartidor", async () => {
    const negocio = await ensureNegocio("reject-mesa")
    const repartidor = await ensureRepartidor("reject-mesa")
    await ensureAsociacion(repartidor.id, negocio.id, "reject-mesa")
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({
      negocioId: negocio.id,
      estado: LEGACY_AVAILABLE_DELIVERY_STATE,
      metodoEntrega: "mesa",
    })

    const res = await aceptar(pedidoId, repartidorSession)
    expect(res.status).toBe(400)
  })

  test("repartidor no asociado al negocio -> 403, nunca llega al CAS", async () => {
    const negocio = await ensureNegocio("reject-noasoc")
    const repartidor = await ensureRepartidor("reject-noasoc")
    // Deliberadamente SIN ensureAsociacion
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE })

    const res = await aceptar(pedidoId, repartidorSession)
    expect(res.status).toBe(403)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.repartidorId).toBeNull()
  })

  test("sin sesión -> 401", async () => {
    const negocio = await ensureNegocio("reject-nosession")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE })
    const req = new NextRequest(`http://localhost/api/repartidor/pedidos/${pedidoId}/aceptar`, { method: "POST" })
    const res = await aceptarPedido(req, { params: Promise.resolve({ id: pedidoId }) })
    expect(res.status).toBe(401)
  })
})

describe("P2-T29C — dos repartidores concurrentes (single-winner real, CAS de DB)", () => {
  test("race: A y B aceptan el mismo pedido simultáneamente — exactamente 1 winner (200), 1 loser (409), 1 sólo asignado, 1 solo PedidoEvento", async () => {
    const negocio = await ensureNegocio("cas-race", true)
    const repartidorA = await ensureRepartidor("cas-race-a")
    const repartidorB = await ensureRepartidor("cas-race-b")
    await ensureAsociacion(repartidorA.id, negocio.id, "cas-race-a")
    await ensureAsociacion(repartidorB.id, negocio.id, "cas-race-b")
    const sessionA = await createSession(repartidorA.id, "repartidor")
    const sessionB = await createSession(repartidorB.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE })

    const [resA, resB] = await Promise.all([aceptar(pedidoId, sessionA), aceptar(pedidoId, sessionB)])
    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([200, 409])

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("en_camino")
    // Nunca ambos, nunca null — exactamente uno de los dos.
    expect(fresh.repartidorId === repartidorA.id || fresh.repartidorId === repartidorB.id).toBe(true)
    expect(fresh.seguimientoDeliveryHabilitado).toBe(true)

    const eventos = await db.pedidoEvento.findMany({ where: { pedidoId } })
    expect(eventos).toHaveLength(1)
    expect(eventos[0].userId).toBe(fresh.repartidorId)
  })

  test("race legacy: A y B aceptan el mismo pedido en_camino+null simultáneamente — mismo invariante single-winner", async () => {
    const negocio = await ensureNegocio("cas-race-legacy", true)
    const repartidorA = await ensureRepartidor("cas-race-legacy-a")
    const repartidorB = await ensureRepartidor("cas-race-legacy-b")
    await ensureAsociacion(repartidorA.id, negocio.id, "cas-race-legacy-a")
    await ensureAsociacion(repartidorB.id, negocio.id, "cas-race-legacy-b")
    const sessionA = await createSession(repartidorA.id, "repartidor")
    const sessionB = await createSession(repartidorB.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: LEGACY_AVAILABLE_DELIVERY_STATE })

    const [resA, resB] = await Promise.all([aceptar(pedidoId, sessionA), aceptar(pedidoId, sessionB)])
    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([200, 409])

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(fresh.estado).toBe("en_camino")
    expect(fresh.repartidorId === repartidorA.id || fresh.repartidorId === repartidorB.id).toBe(true)
    expect(fresh.seguimientoDeliveryHabilitado).toBe(true)
  })
})

describe("P2-T29C — carrera cancelación (Negocio) vs aceptación (Repartidor)", () => {
  test("Negocio cancela esperando_repartidor mientras Repartidor acepta — resultado final coherente, nunca ambos ganan", async () => {
    const negocio = await ensureNegocio("cancel-accept-race")
    const negocioSession = await createSession(negocio.id, "negocio")
    const repartidor = await ensureRepartidor("cancel-accept-race")
    await ensureAsociacion(repartidor.id, negocio.id, "cancel-accept-race")
    const repartidorSession = await createSession(repartidor.id, "repartidor")
    const pedidoId = await crearPedidoDomicilio({ negocioId: negocio.id, estado: CANONICAL_WAITING_DRIVER_STATE })

    const [resAceptar, resCancelar] = await Promise.all([
      aceptar(pedidoId, repartidorSession),
      cancelarComoNegocio(pedidoId, negocioSession),
    ])

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    // Exactamente uno de los dos ganó — nunca un estado híbrido/corrupto.
    if (resAceptar.status === 200) {
      expect(resCancelar.status).not.toBe(200)
      expect(fresh.estado).toBe("en_camino")
      expect(fresh.repartidorId).toBe(repartidor.id)
    } else {
      expect(resCancelar.status).toBe(200)
      expect(fresh.estado).toBe("cancelado")
      expect(fresh.repartidorId).toBeNull()
    }
  })
})
