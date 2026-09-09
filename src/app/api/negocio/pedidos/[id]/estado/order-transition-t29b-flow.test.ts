/// <reference types="bun-types" />

// ============================================
// P2-T29B — Negocio: flujo aceptado/preparando/esperando_repartidor
// ============================================
// Cubre el flujo NUEVO end-to-end por modalidad (DOMICILIO/RETIRO), el
// rechazo de `aceptado` para MESA, la compatibilidad legacy
// (recibido->preparando y preparando->en_camino directos, todavía
// aceptados durante el rollout), y una carrera de concurrencia real para
// las dos transiciones nuevas más sensibles (recibido->aceptado y
// preparando->esperando_repartidor). No repite lo ya cubierto por
// order-transition-cas-concurrency.test.ts (T29A) — se enfoca en lo nuevo
// de T29B.
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

const prefix = "test-t29b-flow-"

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

function pedidoBody(negocioId: string, productoId: string, metodoEntrega: string) {
  return {
    negocioId,
    items: [{ productoId, cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "" }],
    metodoEntrega,
    metodoPago: "efectivo",
    notas: null,
    direccion: metodoEntrega === "domicilio" ? "Calle Falsa 123" : null,
    referencia: null,
    lat: metodoEntrega === "domicilio" ? -34.6 : null,
    lng: metodoEntrega === "domicilio" ? -58.4 : null,
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

async function crearYObtenerPedido(negocioId: string, productoId: string, metodoEntrega: string, ip: string) {
  const clienteSession = await createSession((await ensureClienteUnico(ip)).id, "cliente")
  const res = await crearPedido(pedidoReq(pedidoBody(negocioId, productoId, metodoEntrega), ip, clienteSession), {})
  expect(res.status).toBe(201)
  return res.json()
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)

  if (negocioIds.length) {
    await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: negocioIds } } } }).catch(() => {})
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.producto.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (clienteIds.length) {
    await db.notificacion.deleteMany({ where: { userId: { in: clienteIds } } }).catch(() => {})
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  }
}

async function clienteNotifications(pedidoId: string, clienteId: string) {
  return db.notificacion.findMany({
    where: { pedidoId, userId: clienteId, userType: "cliente" },
    orderBy: { createdAt: "asc" },
  })
}

beforeAll(async () => {
  await cleanup()
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  const remaining = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  expect(remaining).toBe(0)
})

describe("P2-T29B — DOMICILIO: flujo completo nuevo", () => {
  test("recibido→aceptado→preparando→esperando_repartidor, todos 2xx, 3 PedidoEvento", async () => {
    const negocio = await ensureNegocio("dom-flow")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "domicilio", `198.51.100.${randomUUID().slice(0, 2)}`)
    expect(pedido.estado).toBe("recibido")

    const toAceptado = await cambiar(pedido.id, { estado: "aceptado" }, negocioSession)
    expect(toAceptado.status).toBe(200)
    expect((await toAceptado.json()).estado).toBe("aceptado")

    const toPreparando = await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    expect(toPreparando.status).toBe(200)
    expect((await toPreparando.json()).estado).toBe("preparando")

    const toEsperando = await cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession)
    expect(toEsperando.status).toBe(200)
    expect((await toEsperando.json()).estado).toBe("esperando_repartidor")

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("esperando_repartidor")
    const eventCount = await db.pedidoEvento.count({ where: { pedidoId: pedido.id } })
    expect(eventCount).toBe(3)
  })

  test("esperando_repartidor no ofrece ninguna acción de avance a en_camino vía Negocio (boundary T29C)", async () => {
    const negocio = await ensureNegocio("dom-boundary")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "domicilio", `198.51.100.${randomUUID().slice(0, 2)}`)
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "esperando_repartidor" } })

    const res = await cambiar(pedido.id, { estado: "en_camino" }, negocioSession)
    expect(res.status).toBe(400)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("esperando_repartidor")
  })

  test("legacy compat: recibido→preparando directo y preparando→en_camino directo siguen aceptados", async () => {
    const negocio = await ensureNegocio("dom-legacy")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "domicilio", `198.51.100.${randomUUID().slice(0, 2)}`)

    const toPreparando = await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    expect(toPreparando.status).toBe(200)
    const toEnCamino = await cambiar(pedido.id, { estado: "en_camino" }, negocioSession)
    expect(toEnCamino.status).toBe(200)
    expect((await toEnCamino.json()).estado).toBe("en_camino")
  })
})

describe("P2-T29B — RETIRO: flujo completo nuevo", () => {
  test("recibido→aceptado→preparando→listo_para_retirar, todos 2xx", async () => {
    const negocio = await ensureNegocio("ret-flow")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "retiro", `198.51.100.${randomUUID().slice(0, 2)}`)

    const toAceptado = await cambiar(pedido.id, { estado: "aceptado" }, negocioSession)
    expect(toAceptado.status).toBe(200)
    const toPreparando = await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    expect(toPreparando.status).toBe(200)
    const toListo = await cambiar(pedido.id, { estado: "listo_para_retirar" }, negocioSession)
    expect(toListo.status).toBe(200)
    expect((await toListo.json()).estado).toBe("listo_para_retirar")
  })

  test("retiro nunca alcanza esperando_repartidor", async () => {
    const negocio = await ensureNegocio("ret-noaccept")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "retiro", `198.51.100.${randomUUID().slice(0, 2)}`)
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "preparando" } })

    const res = await cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession)
    expect(res.status).toBe(400)
  })

  test("legacy compat: recibido→preparando directo sigue aceptado", async () => {
    const negocio = await ensureNegocio("ret-legacy")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "retiro", `198.51.100.${randomUUID().slice(0, 2)}`)

    const res = await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    expect(res.status).toBe(200)
  })
})

describe("P2-T29B — MESA: sin aceptado, sin cambio de flujo", () => {
  test("recibido→aceptado es RECHAZADO (400) para mesa", async () => {
    const negocio = await ensureNegocio("mesa-noaccept")
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await db.pedido.create({
      data: {
        negocioId: negocio.id,
        negocioSlug: `${prefix}slug`,
        negocioNombre: `${prefix}negocio`,
        clienteNombre: "Cliente Test",
        total: 1000,
        totalProductos: 1000,
        metodoEntrega: "mesa",
        mesaNumero: 1,
        estado: "recibido",
        idempotencyKey: `${prefix}${randomUUID()}`,
      },
    })

    const res = await cambiar(pedido.id, { estado: "aceptado" }, negocioSession)
    expect(res.status).toBe(400)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("recibido")
  })

  test("recibido→preparando sigue funcionando sin cambios para mesa", async () => {
    const negocio = await ensureNegocio("mesa-flow")
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await db.pedido.create({
      data: {
        negocioId: negocio.id,
        negocioSlug: `${prefix}slug`,
        negocioNombre: `${prefix}negocio`,
        clienteNombre: "Cliente Test",
        total: 1000,
        totalProductos: 1000,
        metodoEntrega: "mesa",
        mesaNumero: 1,
        estado: "recibido",
        idempotencyKey: `${prefix}${randomUUID()}`,
      },
    })

    const res = await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    expect(res.status).toBe(200)
  })
})

describe("P2-T29B — CAS de concurrencia real para las 2 transiciones nuevas más sensibles", () => {
  test("race: dos requests concurrentes recibido→aceptado — un 200, un 409, un solo PedidoEvento", async () => {
    const negocio = await ensureNegocio("cas-aceptado")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "domicilio", `198.51.100.${randomUUID().slice(0, 2)}`)

    const [resA, resB] = await Promise.all([
      cambiar(pedido.id, { estado: "aceptado" }, negocioSession),
      cambiar(pedido.id, { estado: "aceptado" }, negocioSession),
    ])
    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([200, 409])

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("aceptado")
    const eventCount = await db.pedidoEvento.count({ where: { pedidoId: pedido.id } })
    expect(eventCount).toBe(1)
  })

  test("race: dos requests concurrentes preparando→esperando_repartidor — un 200, un 409, un solo PedidoEvento", async () => {
    const negocio = await ensureNegocio("cas-esperando")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "domicilio", `198.51.100.${randomUUID().slice(0, 2)}`)
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "preparando" } })

    const [resA, resB] = await Promise.all([
      cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession),
      cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession),
    ])
    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([200, 409])

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("esperando_repartidor")
    const eventCount = await db.pedidoEvento.count({ where: { pedidoId: pedido.id } })
    expect(eventCount).toBe(1)
  })
})

describe("P2-T29B — cancelación desde aceptado (Negocio)", () => {
  test("Negocio puede cancelar un pedido domicilio/retiro en aceptado", async () => {
    const negocio = await ensureNegocio("cancel-aceptado")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "domicilio", `198.51.100.${randomUUID().slice(0, 2)}`)
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "aceptado" } })

    const res = await cambiar(pedido.id, { estado: "cancelado", motivo: "sin stock" }, negocioSession)
    expect(res.status).toBe(200)
    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(fresh.estado).toBe("cancelado")
  })
})

// P2-T29B-R1: feedback físico del operador — preparando->esperando_repartidor
// (domicilio) ahora envía UNA notificación dedicada al Cliente
// ("Buscando delivery" / "El local está esperando un delivery para tu
// pedido."), nunca el fallback genérico con el estado crudo. `aceptado`
// sigue sin notificación propia (diferida a T29D, sin cambios en este task).
describe("P2-T29B-R1 — notificación Cliente 'Buscando delivery' (preparando→esperando_repartidor)", () => {
  test("domicilio: aceptado no genera notificación nueva; preparando conserva su copy existente sin cambios; esperando_repartidor genera exactamente 1 con el copy dedicado", async () => {
    const negocio = await ensureNegocio("notif-dom-flow")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "domicilio", `198.51.100.${randomUUID().slice(0, 8)}`)
    expect(pedido.clienteId).toBeTruthy()

    const toAceptado = await cambiar(pedido.id, { estado: "aceptado" }, negocioSession)
    expect(toAceptado.status).toBe(200)
    expect(await clienteNotifications(pedido.id, pedido.clienteId)).toHaveLength(0)

    const toPreparando = await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    expect(toPreparando.status).toBe(200)
    // "preparando" ya tenía copy propio antes de T29B-R1 (sin cambios, fuera
    // de alcance de esta tarea) — sólo se verifica que no sea el copy nuevo.
    const afterPreparando = await clienteNotifications(pedido.id, pedido.clienteId)
    expect(afterPreparando.filter((n) => n.titulo === "Buscando delivery")).toHaveLength(0)

    const toEsperando = await cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession)
    expect(toEsperando.status).toBe(200)
    const notifs = await clienteNotifications(pedido.id, pedido.clienteId)
    const waitingDriverNotifs = notifs.filter((n) => n.titulo === "Buscando delivery")
    expect(waitingDriverNotifs).toHaveLength(1)
    expect(waitingDriverNotifs[0].cuerpo).toBe("El local está esperando un delivery para tu pedido.")
    expect(waitingDriverNotifs[0].cuerpo).not.toContain("esperando_repartidor")
  })

  test("retiro: la transición a esperando_repartidor es rechazada (400) y nunca genera la notificación de 'Buscando delivery'", async () => {
    const negocio = await ensureNegocio("notif-ret-noaccept")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "retiro", `198.51.100.${randomUUID().slice(0, 8)}`)
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "preparando" } })

    const res = await cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession)
    expect(res.status).toBe(400)
    const notifs = await clienteNotifications(pedido.id, pedido.clienteId)
    expect(notifs.filter((n) => n.titulo === "Buscando delivery")).toHaveLength(0)
  })

  test("race: dos requests concurrentes preparando→esperando_repartidor — 1 sola notificación 'Buscando delivery', 0 duplicados", async () => {
    const negocio = await ensureNegocio("notif-cas-esperando")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const pedido = await crearYObtenerPedido(negocio.id, productoId, "domicilio", `198.51.100.${randomUUID().slice(0, 8)}`)
    await db.pedido.update({ where: { id: pedido.id }, data: { estado: "preparando" } })

    const [resA, resB] = await Promise.all([
      cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession),
      cambiar(pedido.id, { estado: "esperando_repartidor" }, negocioSession),
    ])
    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([200, 409])

    const notifs = await clienteNotifications(pedido.id, pedido.clienteId)
    const waitingDriverNotifs = notifs.filter((n) => n.titulo === "Buscando delivery")
    expect(waitingDriverNotifs).toHaveLength(1)
  })
})
