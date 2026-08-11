/// <reference types="bun-types" />

// ============================================
// 19-B0.2C — Preservar Denuncia al eliminar Cliente (FK SetNull + pseudonimización)
// ============================================
// Prueba el flujo HTTP real completo (DELETE /api/cliente/cuenta) y el
// listado real de Superadmin contra PostgreSQL TESTING real, con la
// migración `20260810000000_preserve_denuncia_on_client_delete` ya
// aplicada — nunca mockea Prisma. Prefijo `test-t19b02c-`, cleanup
// obligatorio. Archivo separado de `client-account-deletion.integration.test.ts`
// (ya grande) para mantener legibilidad, siguiendo el mismo patrón de
// fixtures/cleanup.

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { createSuperadminSession, SUPERADMIN_SESSION_COOKIE_NAME } from "@/lib/superadmin-auth"
import { DELETE as deleteCuenta } from "@/app/api/cliente/cuenta/route"
import { GET as getSuperadminDenuncias } from "@/app/api/superadmin/denuncias/route"
import { ANONYMIZED_REVIEW_CLIENT_NAME } from "./client-account-deletion"

setDefaultTimeout(60_000)

const prefix = "test-t19b02c-"
const clienteIds: string[] = []
const superAdminIds: string[] = []

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

async function ensureSuperAdmin(suffix: string) {
  const admin = await db.superAdmin.create({
    data: {
      email: `${prefix}${suffix}@example.test`,
      googleSub: `${prefix}googlesub-${suffix}-${randomUUID()}`,
      activo: true,
    },
  })
  superAdminIds.push(admin.id)
  return admin
}

async function ensurePedido(params: {
  clienteId: string | null
  negocioId: string
  estado: string
  metodoEntrega?: "retiro" | "domicilio" | "mesa"
  suffix?: string
}) {
  return db.pedido.create({
    data: {
      negocioId: params.negocioId,
      negocioSlug: `${prefix}negocio`,
      negocioNombre: `${prefix}negocio`,
      clienteId: params.clienteId,
      clienteNombre: `${prefix}cliente${params.suffix ?? ""}`,
      total: 100,
      totalProductos: 100,
      metodoEntrega: params.metodoEntrega ?? "retiro",
      estado: params.estado,
    },
  })
}

async function ensureDenuncia(params: {
  clienteId: string
  negocioId: string
  pedidoId?: string | null
  motivoTipo?: string
  motivo?: string
  suffix?: string
}) {
  const suffix = params.suffix ?? ""
  return db.denuncia.create({
    data: {
      clienteId: params.clienteId,
      negocioId: params.negocioId,
      pedidoId: params.pedidoId ?? null,
      negocioNombre: `${prefix}negocio${suffix}`,
      clienteNombre: `${prefix}cliente${suffix}`,
      motivoTipo: params.motivoTipo ?? "comportamiento",
      motivo: params.motivo ?? `${prefix}motivo${suffix}`,
    },
  })
}

async function cookieFor(clienteId: string) {
  const token = await createSession(clienteId, "cliente")
  return `${SESSION_COOKIE_NAME}=${token}`
}

async function cookieForSuperadmin(superAdminId: string) {
  const token = await createSuperadminSession(superAdminId)
  return `${SUPERADMIN_SESSION_COOKIE_NAME}=${token}`
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
  // Resena/Pedido/Denuncia comparten negocioId con Cascade — borrar Negocio
  // limpia lo que le pertenece. Denuncia ya no depende de Cliente (SetNull),
  // así que no hace falta borrarla por separado antes del Cliente.
  await db.resena.deleteMany({ where: { negocio: { slug: { startsWith: prefix } } } })
  await db.negocio.deleteMany({ where: { slug: { startsWith: prefix } } })
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.passwordResetToken.deleteMany({ where: { userId: { in: clienteIds } } })
  }
  await db.cliente.deleteMany({ where: { email: { startsWith: prefix } } })
  if (superAdminIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: superAdminIds } } })
  }
  await db.superAdmin.deleteMany({ where: { email: { startsWith: prefix } } })
}

beforeAll(cleanup)

afterAll(async () => {
  await cleanup()
  const remainingNegocios = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  const remainingClientes = await db.cliente.count({ where: { email: { startsWith: prefix } } })
  const remainingAdmins = await db.superAdmin.count({ where: { email: { startsWith: prefix } } })
  expect(remainingNegocios).toBe(0)
  expect(remainingClientes).toBe(0)
  expect(remainingAdmins).toBe(0)
})

describe("19-B0.2C — FK directo (garantía de base de datos, sin pasar por el core de la app)", () => {
  test("borrar Cliente directamente con db.cliente.delete() preserva la Denuncia con clienteId=null, pero NO pseudonimiza clienteNombre", async () => {
    const negocio = await ensureNegocio(`fk-directo-${randomUUID()}`)
    const cliente = await ensureCliente(`fk-directo-${randomUUID()}`)
    const denuncia = await ensureDenuncia({ clienteId: cliente.id, negocioId: negocio.id, suffix: "-fkdirecto" })

    await db.cliente.delete({ where: { id: cliente.id } })

    const snapshot = await db.denuncia.findUnique({ where: { id: denuncia.id } })
    expect(snapshot).not.toBeNull()
    expect(snapshot?.clienteId).toBeNull()
    // El core de aplicación nunca corrió: el nombre real queda intacto —
    // esto demuestra que la FK por sí sola protege la fila, pero NO
    // pseudonimiza. clienteIds ya no rastrea a este cliente (fue borrado
    // directamente); el cleanup por prefijo de negocio ya cubre la denuncia.
    expect(snapshot?.clienteNombre).toBe(denuncia.clienteNombre)
    expect(snapshot?.negocioId).toBe(negocio.id)
  })
})

describe("19-B0.2C — guard B0: pedido activo bloquea, Denuncia sin cambios", () => {
  test("Cliente con Denuncia + Pedido activo: 409, Denuncia intacta (clienteId real, nombre real)", async () => {
    const negocio = await ensureNegocio(`guard-${randomUUID()}`)
    const cliente = await ensureCliente(`guard-${randomUUID()}`)
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "recibido", metodoEntrega: "retiro" })
    const denuncia = await ensureDenuncia({ clienteId: cliente.id, negocioId: negocio.id, suffix: "-guard" })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("CLIENT_HAS_ACTIVE_ORDERS")

    const snapshot = await db.denuncia.findUnique({ where: { id: denuncia.id } })
    expect(snapshot?.clienteId).toBe(cliente.id)
    expect(snapshot?.clienteNombre).toBe(denuncia.clienteNombre)
  })
})

describe("19-B0.2C — eliminación permitida: Denuncia se preserva pseudonimizada", () => {
  test("Denuncia sin pedidoId (sin Pedido vinculado): permanece pseudonimizada", async () => {
    const negocio = await ensureNegocio(`sin-pedido-${randomUUID()}`)
    const cliente = await ensureCliente(`sin-pedido-${randomUUID()}`)
    const denuncia = await ensureDenuncia({
      clienteId: cliente.id,
      negocioId: negocio.id,
      pedidoId: null,
      motivoTipo: "direccion_falsa",
      motivo: "motivo original sintético",
      suffix: "-sinpedido",
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const snapshot = await db.denuncia.findUnique({ where: { id: denuncia.id } })
    expect(snapshot).not.toBeNull()
    expect(snapshot?.clienteId).toBeNull()
    expect(snapshot?.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
    expect(snapshot?.pedidoId).toBeNull()
    expect(snapshot?.motivoTipo).toBe("direccion_falsa")
    expect(snapshot?.motivo).toBe("motivo original sintético")
    expect(snapshot?.negocioId).toBe(negocio.id)
    expect(snapshot?.negocioNombre).toBe(denuncia.negocioNombre)
    expect(snapshot?.fecha.getTime()).toBe(denuncia.fecha.getTime())
  })

  test("Denuncia con Pedido terminal vinculado: Pedido sanitizado por B1, Denuncia pseudonimizada, pedidoId sigue apuntando", async () => {
    const negocio = await ensureNegocio(`con-pedido-${randomUUID()}`)
    const cliente = await ensureCliente(`con-pedido-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "retiro" })
    const denuncia = await ensureDenuncia({ clienteId: cliente.id, negocioId: negocio.id, pedidoId: pedido.id, suffix: "-conpedido" })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const denunciaSnapshot = await db.denuncia.findUnique({ where: { id: denuncia.id } })
    expect(denunciaSnapshot?.clienteId).toBeNull()
    expect(denunciaSnapshot?.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
    expect(denunciaSnapshot?.pedidoId).toBe(pedido.id)

    const pedidoSnapshot = await db.pedido.findUnique({ where: { id: pedido.id } })
    expect(pedidoSnapshot).not.toBeNull()
    expect(pedidoSnapshot?.clienteId).toBeNull()
  })

  test("múltiples Denuncias del mismo Cliente: TODAS quedan pseudonimizadas, no sólo la primera", async () => {
    const negocioA = await ensureNegocio(`multi-a-${randomUUID()}`)
    const negocioB = await ensureNegocio(`multi-b-${randomUUID()}`)
    const cliente = await ensureCliente(`multi-${randomUUID()}`)
    const denuncia1 = await ensureDenuncia({ clienteId: cliente.id, negocioId: negocioA.id, suffix: "-multi1" })
    const denuncia2 = await ensureDenuncia({ clienteId: cliente.id, negocioId: negocioA.id, suffix: "-multi2" })
    const denuncia3 = await ensureDenuncia({ clienteId: cliente.id, negocioId: negocioB.id, suffix: "-multi3" })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    for (const d of [denuncia1, denuncia2, denuncia3]) {
      const snapshot = await db.denuncia.findUnique({ where: { id: d.id } })
      expect(snapshot?.clienteId).toBeNull()
      expect(snapshot?.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
    }
    // negocioB.id no comparte prefijo de negocioA — confirma que el filtro
    // de la pseudonimización es únicamente por clienteId, nunca por negocio.
    expect(denuncia3.negocioId).not.toBe(denuncia1.negocioId)
  })
})

describe("19-B0.2C — aislamiento entre clientes", () => {
  test("Denuncia de OTRO Cliente no se ve afectada", async () => {
    const negocio = await ensureNegocio(`aislamiento-${randomUUID()}`)
    const clienteA = await ensureCliente(`aislamiento-a-${randomUUID()}`)
    const clienteB = await ensureCliente(`aislamiento-b-${randomUUID()}`)
    const denunciaB = await ensureDenuncia({ clienteId: clienteB.id, negocioId: negocio.id, suffix: "-b" })

    const res = await deleteCuenta(reqDelete(await cookieFor(clienteA.id)))
    expect(res.status).toBe(200)

    const snapshot = await db.denuncia.findUnique({ where: { id: denunciaB.id } })
    expect(snapshot?.clienteId).toBe(clienteB.id)
    expect(snapshot?.clienteNombre).toBe(denunciaB.clienteNombre)
  })
})

describe("19-B0.2C — activo + terminal: ni Pedido ni Denuncia se tocan si el guard bloquea", () => {
  test("Denuncia y Pedido terminal permanecen sin cambios cuando hay un Pedido activo distinto", async () => {
    const negocio = await ensureNegocio(`activo-terminal-${randomUUID()}`)
    const cliente = await ensureCliente(`activo-terminal-${randomUUID()}`)
    const pedidoTerminal = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "retiro", suffix: "-terminal" })
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "preparando", metodoEntrega: "retiro", suffix: "-activo" })
    const denuncia = await ensureDenuncia({ clienteId: cliente.id, negocioId: negocio.id, pedidoId: pedidoTerminal.id, suffix: "-activoterminal" })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(409)

    const denunciaSnapshot = await db.denuncia.findUnique({ where: { id: denuncia.id } })
    expect(denunciaSnapshot?.clienteId).toBe(cliente.id)
    expect(denunciaSnapshot?.clienteNombre).toBe(denuncia.clienteNombre)

    const pedidoSnapshot = await db.pedido.findUnique({ where: { id: pedidoTerminal.id } })
    expect(pedidoSnapshot?.clienteId).toBe(cliente.id)
  })
})

describe("19-B0.2C/E1 — ClienteBloqueado preexistente: fila preservada, sólo el nombre se pseudonimiza (política E1)", () => {
  test("ip/fingerprint/clienteId/fecha quedan intactos; clienteNombre pasa a ANONYMIZED_REVIEW_CLIENT_NAME", async () => {
    const cliente = await ensureCliente(`bloqueado-${randomUUID()}`)
    const bloqueo = await db.clienteBloqueado.create({
      data: {
        ip: "203.0.113.10",
        fingerprint: `${prefix}fingerprint-${randomUUID()}`,
        clienteId: cliente.id,
        clienteNombre: `${prefix}cliente-bloqueado`,
      },
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const snapshot = await db.clienteBloqueado.findUnique({ where: { id: bloqueo.id } })
    expect(snapshot).not.toBeNull()
    // 19-B0.2E1: la fila nunca se borra; ip/fingerprint/clienteId/fecha son el
    // dato de seguridad anti-evasión y se preservan exactamente. Sólo el
    // nombre de display se pseudonimiza (no participa en ningún enforcement).
    expect(snapshot?.ip).toBe(bloqueo.ip)
    expect(snapshot?.fingerprint).toBe(bloqueo.fingerprint)
    expect(snapshot?.clienteId).toBe(cliente.id)
    expect(snapshot?.fecha.getTime()).toBe(bloqueo.fecha.getTime())
    expect(snapshot?.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)

    await db.clienteBloqueado.deleteMany({ where: { id: bloqueo.id } })
  })
})

describe("19-B0.2C — API representativa de Superadmin tolera Denuncia pseudonimizada", () => {
  test("GET /api/superadmin/denuncias sigue devolviendo 200 con la denuncia presente y nombre sentinel", async () => {
    const negocio = await ensureNegocio(`api-superadmin-${randomUUID()}`)
    const cliente = await ensureCliente(`api-superadmin-${randomUUID()}`)
    const admin = await ensureSuperAdmin(`api-superadmin-${randomUUID()}`)
    const denuncia = await ensureDenuncia({ clienteId: cliente.id, negocioId: negocio.id, suffix: "-apisuperadmin" })

    const deleteRes = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(deleteRes.status).toBe(200)

    const adminCookie = await cookieForSuperadmin(admin.id)
    const listRes = await getSuperadminDenuncias(
      new NextRequest(`http://localhost/api/superadmin/denuncias?limit=100`, { headers: { cookie: adminCookie } }),
    )
    expect(listRes.status).toBe(200)
    const body = await listRes.json()
    const item = body.denuncias.find((d: { id: string }) => d.id === denuncia.id)
    expect(item).toBeDefined()
    expect(item.clienteId).toBeNull()
    expect(item.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
    // clienteMap no debe tener entrada para un clienteId nulo — el nombre se
    // lee directamente de la denuncia pseudonimizada, no de un Cliente real.
    expect(body.clienteMap[String(item.clienteId)]).toBeUndefined()
  })
})
