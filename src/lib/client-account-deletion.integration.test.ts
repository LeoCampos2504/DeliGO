/// <reference types="bun-types" />

// ============================================
// 19-B0.2B0 — Guard server-side: no eliminar cuenta con pedidos activos
// ============================================
// Prueba el flujo HTTP real completo (DELETE /api/cliente/cuenta) contra
// PostgreSQL TESTING real — nunca mockea Prisma. Prefijo `test-t19b02b0-`,
// cleanup obligatorio. Complementa los tests unitarios (mocks de tx) en
// client-account-deletion.test.ts, que cubren la secuencia interna aislada
// con un `tx` simulado; este archivo cubre la política real de terminalidad
// contra datos reales para cada método de entrega, además de aislamiento
// entre clientes, integridad ante rechazo (rollback) y regresiones HTTP
// (confirmación incorrecta, sin sesión).

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { DELETE as deleteCuenta } from "@/app/api/cliente/cuenta/route"
import { GET as getNegocioPedidos } from "@/app/api/negocio/pedidos/route"
import { ANONYMIZED_REVIEW_CLIENT_NAME } from "./client-account-deletion"

setDefaultTimeout(60_000)

const prefix = "test-t19b02b0-"
const clienteIds: string[] = []

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

async function ensureCliente(suffix: string) {
  const cliente = await db.cliente.create({
    data: { nombre: `${prefix}${suffix}`, email: `${prefix}${suffix}@example.test`, telefono: "" },
  })
  clienteIds.push(cliente.id)
  return cliente
}

async function ensurePedido(params: {
  clienteId: string
  negocioId: string
  estado: string
  metodoEntrega?: "retiro" | "domicilio" | "mesa"
}) {
  return db.pedido.create({
    data: {
      negocioId: params.negocioId,
      negocioSlug: `${prefix}negocio`,
      negocioNombre: `${prefix}negocio`,
      clienteId: params.clienteId,
      clienteNombre: `${prefix}cliente`,
      total: 100,
      totalProductos: 100,
      metodoEntrega: params.metodoEntrega ?? "retiro",
      estado: params.estado,
    },
  })
}

async function cookieFor(clienteId: string) {
  const token = await createSession(clienteId, "cliente")
  return `${SESSION_COOKIE_NAME}=${token}`
}

async function cookieForNegocio(negocioId: string) {
  const token = await createSession(negocioId, "negocio")
  return `${SESSION_COOKIE_NAME}=${token}`
}

// ============================================
// 19-B0.2B1 — anonimización estructurada de Pedido + cleanup de
// PasswordResetToken. Prefijo propio `test-t19b02b1-` (además del
// `test-t19b02b0-` de arriba), marcadores sintéticos únicos para PII
// estructurada, mismo `clienteIds` compartido para el cleanup.
// ============================================
const prefixB1 = "test-t19b02b1-"

const TEST_T19B02B1_NAME = "TEST_T19B02B1_NAME"
const TEST_T19B02B1_PHONE = "TEST_T19B02B1_PHONE"
const TEST_T19B02B1_ADDRESS = "TEST_T19B02B1_ADDRESS"
const TEST_T19B02B1_REFERENCE = "TEST_T19B02B1_REFERENCE"
const TEST_T19B02B1_LAT = -24.7859
const TEST_T19B02B1_LNG = -65.4117

async function ensureNegocioB1(suffix: string) {
  return db.negocio.create({
    data: {
      nombre: `${prefixB1}${suffix}`,
      slug: `${prefixB1}${suffix}`,
      usuario: `${prefixB1}${suffix}`,
      email: `${prefixB1}${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
    },
  })
}

async function ensureClienteB1(suffix: string) {
  const cliente = await db.cliente.create({
    data: { nombre: `${prefixB1}${suffix}`, email: `${prefixB1}${suffix}@example.test`, telefono: "" },
  })
  clienteIds.push(cliente.id)
  return cliente
}

async function ensurePedidoB1(params: {
  clienteId: string
  negocioId: string
  estado: string
  metodoEntrega?: "retiro" | "domicilio" | "mesa"
  suffix?: string
}) {
  const suffix = params.suffix ?? ""
  const pedido = await db.pedido.create({
    data: {
      negocioId: params.negocioId,
      negocioSlug: `${prefixB1}negocio`,
      negocioNombre: `${prefixB1}negocio`,
      clienteId: params.clienteId,
      clienteNombre: `${TEST_T19B02B1_NAME}${suffix}`,
      clienteTelefono: `${TEST_T19B02B1_PHONE}${suffix}`,
      direccion: `${TEST_T19B02B1_ADDRESS}${suffix}`,
      referencia: `${TEST_T19B02B1_REFERENCE}${suffix}`,
      lat: TEST_T19B02B1_LAT,
      lng: TEST_T19B02B1_LNG,
      total: 150,
      totalProductos: 130,
      tarifaServicio: 12,
      precioDelivery: 20,
      metodoEntrega: params.metodoEntrega ?? "retiro",
      metodoPago: "efectivo",
      estado: params.estado,
      deudaAcumulada: false,
    },
  })
  await db.pedidoItem.create({
    data: {
      pedidoId: pedido.id,
      nombre: `${prefixB1}producto${suffix}`,
      precio: 130,
      cantidad: 1,
    },
  })
  return pedido
}

async function ensurePasswordResetTokenB1(userId: string, userType: string) {
  return db.passwordResetToken.create({
    data: {
      userId,
      userType,
      tokenHash: `${prefixB1}tokenhash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })
}

function reqDelete(cookie?: string, body: unknown = { confirmacion: "ELIMINAR" }) {
  return new NextRequest("http://localhost/api/cliente/cuenta", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

async function cleanup() {
  // Resena.negocioId/pedidoId son ON DELETE RESTRICT: hay que borrar la
  // reseña antes del negocio/pedido que referencia, o la cascada de abajo
  // falla con violación de FK.
  await db.resena.deleteMany({ where: { negocio: { slug: { startsWith: prefix } } } })
  await db.resena.deleteMany({ where: { negocio: { slug: { startsWith: prefixB1 } } } })
  // Pedido.negocioId -> onDelete: Cascade: borrar el Negocio limpia sus
  // pedidos (y PedidoItem via Cascade de Pedido).
  await db.negocio.deleteMany({ where: { slug: { startsWith: prefix } } })
  await db.negocio.deleteMany({ where: { slug: { startsWith: prefixB1 } } })
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    // PasswordResetToken.userId no es FK — no se limpia por cascada de
    // ninguna otra tabla, hay que borrarlo explícitamente por prefijo de
    // fixture (tokenHash) o por los clienteIds rastreados en este archivo.
    await db.passwordResetToken.deleteMany({ where: { userId: { in: clienteIds } } })
  }
  await db.passwordResetToken.deleteMany({ where: { tokenHash: { startsWith: prefixB1 } } })
  await db.cliente.deleteMany({ where: { email: { startsWith: prefix } } })
  await db.cliente.deleteMany({ where: { email: { startsWith: prefixB1 } } })
}

beforeAll(cleanup)

afterAll(async () => {
  await cleanup()
  const remainingNegociosB0 = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  const remainingClientesB0 = await db.cliente.count({ where: { email: { startsWith: prefix } } })
  const remainingNegociosB1 = await db.negocio.count({ where: { slug: { startsWith: prefixB1 } } })
  const remainingClientesB1 = await db.cliente.count({ where: { email: { startsWith: prefixB1 } } })
  const remainingTokensB1 = await db.passwordResetToken.count({ where: { tokenHash: { startsWith: prefixB1 } } })
  expect(remainingNegociosB0).toBe(0)
  expect(remainingClientesB0).toBe(0)
  expect(remainingNegociosB1).toBe(0)
  expect(remainingClientesB1).toBe(0)
  expect(remainingTokensB1).toBe(0)
})

describe("19-B0.2B0 — sin pedidos: la eliminación funciona exactamente como antes", () => {
  test("cliente sin ningún pedido elimina su cuenta normalmente (200)", async () => {
    const cliente = await ensureCliente(`sin-pedidos-${randomUUID()}`)
    const cookie = await cookieFor(cliente.id)

    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    const found = await db.cliente.findUnique({ where: { id: cliente.id } })
    expect(found).toBeNull()
  })
})

describe("19-B0.2B0 — sólo pedidos terminales: la eliminación se permite", () => {
  test("único pedido entregado no bloquea", async () => {
    const negocio = await ensureNegocio(`term-entregado-${randomUUID()}`)
    const cliente = await ensureCliente(`term-entregado-${randomUUID()}`)
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "domicilio" })
    const cookie = await cookieFor(cliente.id)

    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(200)
    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).toBeNull()
  })

  test("único pedido cancelado no bloquea", async () => {
    const negocio = await ensureNegocio(`term-cancelado-${randomUUID()}`)
    const cliente = await ensureCliente(`term-cancelado-${randomUUID()}`)
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "cancelado", metodoEntrega: "retiro" })
    const cookie = await cookieFor(cliente.id)

    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(200)
    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).toBeNull()
  })

  test("múltiples pedidos, todos terminales (entregado + cancelado, retiro/domicilio/mesa mezclados) -> permite eliminar", async () => {
    const negocio = await ensureNegocio(`term-multi-${randomUUID()}`)
    const cliente = await ensureCliente(`term-multi-${randomUUID()}`)
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "retiro" })
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "cancelado", metodoEntrega: "domicilio" })
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "mesa" })
    const cookie = await cookieFor(cliente.id)

    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(200)
    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).toBeNull()
    // Los 3 pedidos sobreviven anonimizados (clienteId -> null), no se borran.
    const pedidos = await db.pedido.findMany({ where: { negocioId: negocio.id } })
    expect(pedidos).toHaveLength(3)
    expect(pedidos.every((p) => p.clienteId === null)).toBe(true)
  })
})

describe("19-B0.2B0 — pedido activo por método de entrega: bloquea con 409 CLIENT_HAS_ACTIVE_ORDERS", () => {
  test("retiro activo (recibido)", async () => {
    const negocio = await ensureNegocio(`activo-retiro-${randomUUID()}`)
    const cliente = await ensureCliente(`activo-retiro-${randomUUID()}`)
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "recibido", metodoEntrega: "retiro" })
    const cookie = await cookieFor(cliente.id)

    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe("CLIENT_HAS_ACTIVE_ORDERS")
    expect(body.error).toBe("Tenés un pedido en curso. Podrás eliminar tu cuenta cuando finalice.")

    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).not.toBeNull()
  })

  test("domicilio activo (en_camino)", async () => {
    const negocio = await ensureNegocio(`activo-domicilio-${randomUUID()}`)
    const cliente = await ensureCliente(`activo-domicilio-${randomUUID()}`)
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "en_camino", metodoEntrega: "domicilio" })
    const cookie = await cookieFor(cliente.id)

    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("CLIENT_HAS_ACTIVE_ORDERS")
    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).not.toBeNull()
  })

  test("mesa activo (preparando)", async () => {
    const negocio = await ensureNegocio(`activo-mesa-${randomUUID()}`)
    const cliente = await ensureCliente(`activo-mesa-${randomUUID()}`)
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "preparando", metodoEntrega: "mesa" })
    const cookie = await cookieFor(cliente.id)

    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("CLIENT_HAS_ACTIVE_ORDERS")
    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).not.toBeNull()
  })

  test("listo_para_retirar es activo independientemente del método (retiro y domicilio)", async () => {
    const negocio = await ensureNegocio(`activo-listo-${randomUUID()}`)

    const clienteRetiro = await ensureCliente(`activo-listo-retiro-${randomUUID()}`)
    await ensurePedido({ clienteId: clienteRetiro.id, negocioId: negocio.id, estado: "listo_para_retirar", metodoEntrega: "retiro" })
    const resRetiro = await deleteCuenta(reqDelete(await cookieFor(clienteRetiro.id)))
    expect(resRetiro.status).toBe(409)

    const clienteDomicilio = await ensureCliente(`activo-listo-domicilio-${randomUUID()}`)
    await ensurePedido({ clienteId: clienteDomicilio.id, negocioId: negocio.id, estado: "listo_para_retirar", metodoEntrega: "domicilio" })
    const resDomicilio = await deleteCuenta(reqDelete(await cookieFor(clienteDomicilio.id)))
    expect(resDomicilio.status).toBe(409)
  })

  test("mezcla: un pedido terminal + un pedido activo -> bloquea igual", async () => {
    const negocio = await ensureNegocio(`activo-mezcla-${randomUUID()}`)
    const cliente = await ensureCliente(`activo-mezcla-${randomUUID()}`)
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "retiro" })
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "preparando", metodoEntrega: "domicilio" })
    const cookie = await cookieFor(cliente.id)

    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(409)
    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).not.toBeNull()
  })
})

describe("19-B0.2B0 — aislamiento entre clientes", () => {
  test("un pedido activo de OTRO cliente no bloquea la eliminación de este cliente", async () => {
    const negocio = await ensureNegocio(`aislamiento-${randomUUID()}`)
    const clienteConPedidoActivo = await ensureCliente(`aislamiento-otro-${randomUUID()}`)
    await ensurePedido({ clienteId: clienteConPedidoActivo.id, negocioId: negocio.id, estado: "recibido", metodoEntrega: "retiro" })

    const clienteSinPedidos = await ensureCliente(`aislamiento-propio-${randomUUID()}`)
    const cookie = await cookieFor(clienteSinPedidos.id)

    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(200)
    expect(await db.cliente.findUnique({ where: { id: clienteSinPedidos.id } })).toBeNull()
    // El otro cliente y su pedido activo permanecen intactos.
    expect(await db.cliente.findUnique({ where: { id: clienteConPedidoActivo.id } })).not.toBeNull()
  })
})

describe("19-B0.2B0 — integridad ante rechazo (rollback-completeness)", () => {
  test("al bloquear por pedido activo, ninguna mutación de la secuencia de borrado se aplicó", async () => {
    const negocio = await ensureNegocio(`rollback-${randomUUID()}`)
    const cliente = await ensureCliente(`rollback-${randomUUID()}`)
    const direccion = await db.direccion.create({
      data: { clienteId: cliente.id, alias: "Casa", direccion: "Calle falsa 123", lat: 1, lng: 1 },
    })
    const favorito = await db.favorito.create({ data: { clienteId: cliente.id, negocioId: negocio.id } })
    const pedidoTerminal = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "retiro" })
    const pedidoActivo = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "recibido", metodoEntrega: "retiro" })
    const resena = await db.resena.create({
      data: {
        pedidoId: pedidoTerminal.id,
        negocioId: negocio.id,
        clienteId: cliente.id,
        clienteNombre: `${prefix}cliente`,
        puntuacion: 5,
        comentario: "ok",
      },
    })

    const cookie = await cookieFor(cliente.id)
    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(409)

    const clienteSnapshot = await db.cliente.findUnique({ where: { id: cliente.id } })
    expect(clienteSnapshot).not.toBeNull()
    const direccionSnapshot = await db.direccion.findUnique({ where: { id: direccion.id } })
    expect(direccionSnapshot).not.toBeNull()
    const favoritoSnapshot = await db.favorito.findUnique({ where: { id: favorito.id } })
    expect(favoritoSnapshot).not.toBeNull()
    const resenaSnapshot = await db.resena.findUnique({ where: { id: resena.id } })
    expect(resenaSnapshot?.clienteId).toBe(cliente.id)
    expect(resenaSnapshot?.clienteNombre).toBe(`${prefix}cliente`)
    const pedidoActivoSnapshot = await db.pedido.findUnique({ where: { id: pedidoActivo.id } })
    expect(pedidoActivoSnapshot?.clienteId).toBe(cliente.id)
    const pedidoTerminalSnapshot = await db.pedido.findUnique({ where: { id: pedidoTerminal.id } })
    expect(pedidoTerminalSnapshot?.clienteId).toBe(cliente.id)
  })
})

describe("19-B0.2B0 — regresiones HTTP no relacionadas al guard", () => {
  test("confirmación incorrecta sigue devolviendo 400 antes de evaluar pedidos activos", async () => {
    const cliente = await ensureCliente(`regresion-confirm-${randomUUID()}`)
    const cookie = await cookieFor(cliente.id)

    const res = await deleteCuenta(reqDelete(cookie, { confirmacion: "borrar" }))
    expect(res.status).toBe(400)
    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).not.toBeNull()
  })

  test("sin sesión sigue devolviendo 401, sin revelar si hay pedidos activos", async () => {
    const res = await deleteCuenta(reqDelete(undefined))
    expect(res.status).toBe(401)
  })
})

// ============================================
// 19-B0.2B1 — anonimización estructurada de Pedido + cleanup de
// PasswordResetToken, contra PostgreSQL TESTING real.
// ============================================

describe("19-B0.2B1 — Pedido terminal: PII estructurada sanitizada", () => {
  test("entregado: clienteId null, clienteNombre sentinel, teléfono/dirección/referencia/lat/lng limpios", async () => {
    const negocio = await ensureNegocioB1(`entregado-${randomUUID()}`)
    const cliente = await ensureClienteB1(`entregado-${randomUUID()}`)
    const pedido = await ensurePedidoB1({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "domicilio" })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const sanitized = await db.pedido.findUnique({ where: { id: pedido.id } })
    expect(sanitized).not.toBeNull()
    expect(sanitized?.clienteId).toBeNull()
    expect(sanitized?.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
    expect(sanitized?.clienteTelefono).toBe("")
    expect(sanitized?.direccion).toBeNull()
    expect(sanitized?.referencia).toBeNull()
    expect(sanitized?.lat).toBeNull()
    expect(sanitized?.lng).toBeNull()

    const serialized = JSON.stringify(sanitized)
    expect(serialized).not.toContain(TEST_T19B02B1_NAME)
    expect(serialized).not.toContain(TEST_T19B02B1_PHONE)
    expect(serialized).not.toContain(TEST_T19B02B1_ADDRESS)
    expect(serialized).not.toContain(TEST_T19B02B1_REFERENCE)
  })

  test("cancelado: se anonimiza igual que entregado — no se conserva PII sólo porque el pedido fue cancelado", async () => {
    const negocio = await ensureNegocioB1(`cancelado-${randomUUID()}`)
    const cliente = await ensureClienteB1(`cancelado-${randomUUID()}`)
    const pedido = await ensurePedidoB1({ clienteId: cliente.id, negocioId: negocio.id, estado: "cancelado", metodoEntrega: "retiro" })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const sanitized = await db.pedido.findUnique({ where: { id: pedido.id } })
    expect(sanitized?.clienteId).toBeNull()
    expect(sanitized?.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
    expect(sanitized?.clienteTelefono).toBe("")
    expect(sanitized?.direccion).toBeNull()
    expect(sanitized?.referencia).toBeNull()
    expect(sanitized?.lat).toBeNull()
    expect(sanitized?.lng).toBeNull()
  })

  test("múltiples pedidos terminales: TODOS quedan sanitizados, no sólo el primero", async () => {
    const negocio = await ensureNegocioB1(`multi-${randomUUID()}`)
    const cliente = await ensureClienteB1(`multi-${randomUUID()}`)
    const pedidoRetiro = await ensurePedidoB1({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "retiro", suffix: "-retiro" })
    const pedidoDomicilio = await ensurePedidoB1({ clienteId: cliente.id, negocioId: negocio.id, estado: "cancelado", metodoEntrega: "domicilio", suffix: "-domicilio" })
    const pedidoMesa = await ensurePedidoB1({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "mesa", suffix: "-mesa" })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    for (const pedido of [pedidoRetiro, pedidoDomicilio, pedidoMesa]) {
      const sanitized = await db.pedido.findUnique({ where: { id: pedido.id } })
      expect(sanitized?.clienteId).toBeNull()
      expect(sanitized?.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
      expect(sanitized?.clienteTelefono).toBe("")
      expect(sanitized?.direccion).toBeNull()
      expect(sanitized?.referencia).toBeNull()
      expect(sanitized?.lat).toBeNull()
      expect(sanitized?.lng).toBeNull()
    }
  })
})

describe("19-B0.2B1 — datos históricos operativos/financieros preservados", () => {
  test("estado, montos, método, timestamps e items no cambian tras la sanitización", async () => {
    const negocio = await ensureNegocioB1(`historia-${randomUUID()}`)
    const cliente = await ensureClienteB1(`historia-${randomUUID()}`)
    const pedido = await ensurePedidoB1({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "domicilio" })
    const itemsAntes = await db.pedidoItem.findMany({ where: { pedidoId: pedido.id } })

    const antes = {
      negocioId: pedido.negocioId,
      estado: pedido.estado,
      metodoEntrega: pedido.metodoEntrega,
      metodoPago: pedido.metodoPago,
      total: pedido.total,
      totalProductos: pedido.totalProductos,
      tarifaServicio: pedido.tarifaServicio,
      precioDelivery: pedido.precioDelivery,
      deudaAcumulada: pedido.deudaAcumulada,
      createdAt: pedido.createdAt.toISOString(),
      fecha: pedido.fecha.toISOString(),
    }

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const despues = await db.pedido.findUnique({ where: { id: pedido.id } })
    expect(despues).not.toBeNull()
    expect({
      negocioId: despues?.negocioId,
      estado: despues?.estado,
      metodoEntrega: despues?.metodoEntrega,
      metodoPago: despues?.metodoPago,
      total: despues?.total,
      totalProductos: despues?.totalProductos,
      tarifaServicio: despues?.tarifaServicio,
      precioDelivery: despues?.precioDelivery,
      deudaAcumulada: despues?.deudaAcumulada,
      createdAt: despues?.createdAt.toISOString(),
      fecha: despues?.fecha.toISOString(),
    }).toEqual(antes)

    const itemsDespues = await db.pedidoItem.findMany({ where: { pedidoId: pedido.id } })
    expect(itemsDespues).toEqual(itemsAntes)
  })
})

describe("19-B0.2B1 — regresión B0: pedido activo bloquea sin cambiar NADA (ni PII ni tokens)", () => {
  test("pedido activo con PII completa: 409, PII intacta, token intacto, cliente/sesión siguen existiendo", async () => {
    const negocio = await ensureNegocioB1(`activo-b1-${randomUUID()}`)
    const cliente = await ensureClienteB1(`activo-b1-${randomUUID()}`)
    const pedido = await ensurePedidoB1({ clienteId: cliente.id, negocioId: negocio.id, estado: "recibido", metodoEntrega: "domicilio" })
    const token = await ensurePasswordResetTokenB1(cliente.id, "cliente")
    const cookie = await cookieFor(cliente.id)

    const res = await deleteCuenta(reqDelete(cookie))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("CLIENT_HAS_ACTIVE_ORDERS")

    const pedidoSnapshot = await db.pedido.findUnique({ where: { id: pedido.id } })
    expect(pedidoSnapshot?.clienteId).toBe(cliente.id)
    expect(pedidoSnapshot?.clienteNombre).toBe(pedido.clienteNombre)
    expect(pedidoSnapshot?.clienteTelefono).toBe(pedido.clienteTelefono)
    expect(pedidoSnapshot?.direccion).toBe(pedido.direccion)
    expect(pedidoSnapshot?.referencia).toBe(pedido.referencia)
    expect(pedidoSnapshot?.lat).toBe(pedido.lat)
    expect(pedidoSnapshot?.lng).toBe(pedido.lng)

    const tokenSnapshot = await db.passwordResetToken.findUnique({ where: { id: token.id } })
    expect(tokenSnapshot).not.toBeNull()

    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).not.toBeNull()
  })

  test("activo + terminal: el pedido terminal TAMPOCO se anonimiza — la transacción nunca empieza a mutar", async () => {
    const negocio = await ensureNegocioB1(`activo-terminal-b1-${randomUUID()}`)
    const cliente = await ensureClienteB1(`activo-terminal-b1-${randomUUID()}`)
    const pedidoTerminal = await ensurePedidoB1({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "retiro", suffix: "-terminal" })
    const pedidoActivo = await ensurePedidoB1({ clienteId: cliente.id, negocioId: negocio.id, estado: "preparando", metodoEntrega: "retiro", suffix: "-activo" })
    const token = await ensurePasswordResetTokenB1(cliente.id, "cliente")

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(409)

    const terminalSnapshot = await db.pedido.findUnique({ where: { id: pedidoTerminal.id } })
    expect(terminalSnapshot?.clienteId).toBe(cliente.id)
    expect(terminalSnapshot?.clienteNombre).toBe(pedidoTerminal.clienteNombre)
    expect(terminalSnapshot?.direccion).toBe(pedidoTerminal.direccion)
    expect(terminalSnapshot?.lat).toBe(pedidoTerminal.lat)

    const activoSnapshot = await db.pedido.findUnique({ where: { id: pedidoActivo.id } })
    expect(activoSnapshot?.clienteId).toBe(cliente.id)

    const tokenSnapshot = await db.passwordResetToken.findUnique({ where: { id: token.id } })
    expect(tokenSnapshot).not.toBeNull()
  })
})

describe("19-B0.2B1 — PasswordResetToken: cleanup acotado", () => {
  test("token del cliente eliminado se borra", async () => {
    const cliente = await ensureClienteB1(`token-propio-${randomUUID()}`)
    const token = await ensurePasswordResetTokenB1(cliente.id, "cliente")

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    expect(await db.passwordResetToken.findUnique({ where: { id: token.id } })).toBeNull()
  })

  test("token de otro Cliente no se toca", async () => {
    const clienteA = await ensureClienteB1(`token-a-${randomUUID()}`)
    const clienteB = await ensureClienteB1(`token-b-${randomUUID()}`)
    const tokenB = await ensurePasswordResetTokenB1(clienteB.id, "cliente")

    const res = await deleteCuenta(reqDelete(await cookieFor(clienteA.id)))
    expect(res.status).toBe(200)

    expect(await db.passwordResetToken.findUnique({ where: { id: tokenB.id } })).not.toBeNull()
  })

  test("mismo userId con userType distinto de cliente: sólo se borra el de userType=cliente", async () => {
    // PasswordResetToken.userId no es una FK real (String simple) — es seguro
    // fabricar una fila con el mismo id que el Cliente pero userType="negocio"
    // sin violar ninguna relación, exactamente para aislar el filtro por tipo.
    const cliente = await ensureClienteB1(`token-crosstype-${randomUUID()}`)
    const tokenCliente = await ensurePasswordResetTokenB1(cliente.id, "cliente")
    const tokenOtroTipo = await ensurePasswordResetTokenB1(cliente.id, "negocio")

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    expect(await db.passwordResetToken.findUnique({ where: { id: tokenCliente.id } })).toBeNull()
    const otroTipoSnapshot = await db.passwordResetToken.findUnique({ where: { id: tokenOtroTipo.id } })
    expect(otroTipoSnapshot).not.toBeNull()
    // Limpieza manual: este token "negocio" fabricado no pertenece a ningún
    // Negocio real y no lo cubre el cleanup por prefijo de cliente.
    await db.passwordResetToken.delete({ where: { id: tokenOtroTipo.id } })
  })

  test("cero tokens: el delete funciona igual (deleteMany con 0 coincidencias no es error)", async () => {
    const cliente = await ensureClienteB1(`token-cero-${randomUUID()}`)
    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)
  })
})

describe("19-B0.2B1 — API histórica representativa (Negocio) tolera PII sanitizada", () => {
  test("GET /api/negocio/pedidos sigue devolviendo 200 con el pedido presente, sin los valores sintéticos originales", async () => {
    const negocio = await ensureNegocioB1(`api-negocio-${randomUUID()}`)
    const cliente = await ensureClienteB1(`api-negocio-${randomUUID()}`)
    const pedido = await ensurePedidoB1({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "domicilio" })

    const deleteRes = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(deleteRes.status).toBe(200)

    const negocioCookie = await cookieForNegocio(negocio.id)
    const listRes = await getNegocioPedidos(
      new NextRequest("http://localhost/api/negocio/pedidos", { headers: { cookie: negocioCookie } }),
    )
    expect(listRes.status).toBe(200)
    const body = await listRes.json()
    const item = body.pedidos.find((p: { id: string }) => p.id === pedido.id)
    expect(item).toBeDefined()
    expect(item.direccion).toBeNull()
    expect(item.lat).toBeNull()
    expect(item.lng).toBeNull()

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain(TEST_T19B02B1_NAME)
    expect(serialized).not.toContain(TEST_T19B02B1_PHONE)
    expect(serialized).not.toContain(TEST_T19B02B1_ADDRESS)
    expect(serialized).not.toContain(TEST_T19B02B1_REFERENCE)
  })
})
