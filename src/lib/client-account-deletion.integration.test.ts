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
  // Pedido.negocioId -> onDelete: Cascade: borrar el Negocio limpia sus pedidos.
  await db.negocio.deleteMany({ where: { slug: { startsWith: prefix } } })
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
  }
  await db.cliente.deleteMany({ where: { email: { startsWith: prefix } } })
}

beforeAll(cleanup)

afterAll(async () => {
  await cleanup()
  const remainingNegocios = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  const remainingClientes = await db.cliente.count({ where: { email: { startsWith: prefix } } })
  expect(remainingNegocios).toBe(0)
  expect(remainingClientes).toBe(0)
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
