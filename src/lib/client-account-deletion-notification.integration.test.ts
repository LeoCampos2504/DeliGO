/// <reference types="bun-types" />

// ============================================
// 19-B0.2E1 — Notificacion (propias + terceros con provenance determinista) +
// ClienteBloqueado (pseudonimización) + AuditLog (KEEP), contra PostgreSQL
// TESTING real.
// ============================================
// Prueba el flujo HTTP real completo (DELETE /api/cliente/cuenta). Nunca
// mockea Prisma. Prefijo `test-t19b02e1-`, cleanup obligatorio. Archivo
// separado del principal de B0/B1/C/D1, siguiendo el mismo patrón.

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { DELETE as deleteCuenta } from "@/app/api/cliente/cuenta/route"
import { ANONYMIZED_REVIEW_CLIENT_NAME } from "@/lib/client-account-deletion"

setDefaultTimeout(60_000)

const prefix = "test-t19b02e1-"
const clienteIds: string[] = []
const negocioIds: string[] = []
const repartidorIds: string[] = []

async function ensureNegocio(suffix: string) {
  const negocio = await db.negocio.create({
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
  negocioIds.push(negocio.id)
  return negocio
}

async function ensureRepartidor(suffix: string) {
  const repartidor = await db.repartidor.create({
    data: { nombre: `${prefix}${suffix}`, email: `${prefix}${suffix}@example.test`, password: "fixture" },
  })
  repartidorIds.push(repartidor.id)
  return repartidor
}

async function ensureCliente(suffix: string) {
  const cliente = await db.cliente.create({
    data: { nombre: `${prefix}${suffix}`, email: `${prefix}${suffix}@example.test`, telefono: "" },
  })
  clienteIds.push(cliente.id)
  return cliente
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

async function ensureNotificacion(params: {
  userId: string
  userType: string
  tipo: string
  titulo: string
  cuerpo: string
  pedidoId?: string | null
  negocioId?: string | null
  sourceClienteId?: string | null
  datos?: string
}) {
  return db.notificacion.create({
    data: {
      userId: params.userId,
      userType: params.userType,
      tipo: params.tipo,
      titulo: params.titulo,
      cuerpo: params.cuerpo,
      pedidoId: params.pedidoId ?? null,
      negocioId: params.negocioId ?? null,
      sourceClienteId: params.sourceClienteId ?? null,
      datos: params.datos ?? "{}",
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
  await db.notificacion.deleteMany({ where: { userId: { in: [...clienteIds, ...negocioIds, ...repartidorIds] } } })
  await db.clienteBloqueado.deleteMany({ where: { clienteId: { in: clienteIds } } })
  await db.auditLog.deleteMany({ where: { userId: { in: clienteIds } } })
  await db.resena.deleteMany({ where: { negocio: { slug: { startsWith: prefix } } } })
  await db.denuncia.deleteMany({ where: { negocio: { slug: { startsWith: prefix } } } })
  await db.negocio.deleteMany({ where: { slug: { startsWith: prefix } } })
  await db.repartidor.deleteMany({ where: { email: { startsWith: prefix } } })
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.passwordResetToken.deleteMany({ where: { userId: { in: clienteIds } } })
  }
  await db.cliente.deleteMany({ where: { email: { startsWith: prefix } } })
}

beforeAll(cleanup)

afterAll(async () => {
  await cleanup()
  const remainingNotif = await db.notificacion.count({ where: { titulo: { contains: "TEST_T19B02E1" } } })
  const remainingClientes = await db.cliente.count({ where: { email: { startsWith: prefix } } })
  const remainingNegocios = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  expect(remainingNotif).toBe(0)
  expect(remainingClientes).toBe(0)
  expect(remainingNegocios).toBe(0)
})

describe("19-B0.2E1 — Notificaciones propias del Cliente: DELETE_ROWS", () => {
  test("varias Notificacion propias de distintos tipos se borran por completo", async () => {
    const negocio = await ensureNegocio(`propias-${randomUUID()}`)
    const cliente = await ensureCliente(`propias-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado" })

    await ensureNotificacion({ userId: cliente.id, userType: "cliente", tipo: "order_update", titulo: "TEST_T19B02E1 pedido", cuerpo: "actualizado", pedidoId: pedido.id })
    await ensureNotificacion({ userId: cliente.id, userType: "cliente", tipo: "review_request", titulo: "TEST_T19B02E1 review", cuerpo: "dejá tu reseña", pedidoId: pedido.id })
    await ensureNotificacion({ userId: cliente.id, userType: "cliente", tipo: "chat", titulo: "TEST_T19B02E1 chat", cuerpo: "mensaje del negocio", pedidoId: pedido.id })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const remaining = await db.notificacion.count({ where: { userId: cliente.id, userType: "cliente" } })
    expect(remaining).toBe(0)
  })
})

describe("19-B0.2E1 — Notificacion legacy new_order (Negocio): sanitización determinista por pedidoId", () => {
  test("titulo/cuerpo se neutralizan, sourceClienteId queda null, pedidoId y userId (Negocio) se preservan", async () => {
    const negocio = await ensureNegocio(`newold-${randomUUID()}`)
    const cliente = await ensureCliente(`newold-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado" })

    const notif = await ensureNotificacion({
      userId: negocio.id,
      userType: "negocio",
      tipo: "new_order",
      titulo: "¡Nuevo pedido! 📩",
      cuerpo: "TEST_T19B02E1_CLIENT_NAME_MARKER hizo un pedido de $100",
      pedidoId: pedido.id,
      negocioId: negocio.id,
      sourceClienteId: null,
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.notificacion.findUnique({ where: { id: notif.id } })
    expect(after).not.toBeNull()
    expect(after?.titulo).toBe("Pedido recibido")
    expect(after?.cuerpo).toBe("Los datos del cliente ya no están disponibles.")
    expect(after?.cuerpo).not.toContain("TEST_T19B02E1_CLIENT_NAME_MARKER")
    expect(after?.sourceClienteId).toBeNull()
    expect(after?.pedidoId).toBe(pedido.id)
    expect(after?.userId).toBe(negocio.id)
    expect(after?.userType).toBe("negocio")
  })
})

describe("19-B0.2E1 — Notificacion legacy new_delivery (Repartidor): la dirección desaparece, la fila permanece", () => {
  test("cuerpo con dirección sintética se neutraliza sin borrar la fila", async () => {
    const negocio = await ensureNegocio(`deliv-${randomUUID()}`)
    const repartidor = await ensureRepartidor(`deliv-${randomUUID()}`)
    const cliente = await ensureCliente(`deliv-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "domicilio" })

    const notif = await ensureNotificacion({
      userId: repartidor.id,
      userType: "repartidor",
      tipo: "new_delivery",
      titulo: "¡Nueva entrega! 🛵",
      cuerpo: "Pedido de Negocio - TEST_T19B02E1_ADDRESS_MARKER 1234",
      pedidoId: pedido.id,
      sourceClienteId: null,
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.notificacion.findUnique({ where: { id: notif.id } })
    expect(after).not.toBeNull()
    expect(after?.titulo).toBe("Entrega")
    expect(after?.cuerpo).toBe("Los datos de entrega del cliente ya no están disponibles.")
    expect(after?.cuerpo).not.toContain("TEST_T19B02E1_ADDRESS_MARKER")
    expect(after?.userId).toBe(repartidor.id)
  })
})

describe("19-B0.2E1 — Notificacion legacy chat (Negocio): sentinel exacto", () => {
  test("titulo/cuerpo se reemplazan por el sentinel de Chat, marker original ausente", async () => {
    const negocio = await ensureNegocio(`chatold-${randomUUID()}`)
    const cliente = await ensureCliente(`chatold-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado" })

    const notif = await ensureNotificacion({
      userId: negocio.id,
      userType: "negocio",
      tipo: "chat",
      titulo: "Mensaje de Cliente",
      cuerpo: "TEST_T19B02E1_CHAT_PII contenido real del mensaje",
      pedidoId: pedido.id,
      negocioId: negocio.id,
      sourceClienteId: null,
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.notificacion.findUnique({ where: { id: notif.id } })
    expect(after?.titulo).toBe("Mensaje no disponible")
    expect(after?.cuerpo).toBe("El contenido del mensaje ya no está disponible.")
    expect(after?.cuerpo).not.toContain("TEST_T19B02E1_CHAT_PII")
  })
})

describe("19-B0.2E1 — Notificacion sourceClienteId review: provenance estructurada sin pedidoId", () => {
  test("review sin pedidoId pero con sourceClienteId se sanitiza y sourceClienteId queda null", async () => {
    const negocio = await ensureNegocio(`revsrc-${randomUUID()}`)
    const cliente = await ensureCliente(`revsrc-${randomUUID()}`)
    // Guard B0 exige que el Cliente no tenga pedidos activos — pero esta
    // Notificacion deliberadamente NO tiene pedidoId (simula el caso legacy
    // sin pedidoId que motivó agregar sourceClienteId).
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "cancelado" })

    const notif = await ensureNotificacion({
      userId: negocio.id,
      userType: "negocio",
      tipo: "review",
      titulo: "Nueva reseña ⭐",
      cuerpo: "TEST_T19B02E1_REVIEWER_NAME dejó ⭐⭐⭐⭐⭐ en Negocio",
      pedidoId: null,
      negocioId: negocio.id,
      sourceClienteId: cliente.id,
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.notificacion.findUnique({ where: { id: notif.id } })
    expect(after).not.toBeNull()
    expect(after?.titulo).toBe("Reseña")
    expect(after?.cuerpo).toBe("Los datos del cliente ya no están disponibles.")
    expect(after?.cuerpo).not.toContain("TEST_T19B02E1_REVIEWER_NAME")
    expect(after?.sourceClienteId).toBeNull()
  })
})

describe("19-B0.2E1 — Notificacion legacy ambigua (sin pedidoId ni sourceClienteId): NUNCA se toca", () => {
  test("review legacy sin provenance estructurada permanece byte-idéntica", async () => {
    const negocio = await ensureNegocio(`ambig-${randomUUID()}`)
    const cliente = await ensureCliente(`ambig-${randomUUID()}`)
    await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "cancelado" })

    const cuerpoOriginal = "TEST_T19B02E1_AMBIGUOUS_LEGACY cliente sintético dejó una reseña"
    const notif = await ensureNotificacion({
      userId: negocio.id,
      userType: "negocio",
      tipo: "review",
      titulo: "Nueva reseña ⭐",
      cuerpo: cuerpoOriginal,
      pedidoId: null,
      negocioId: negocio.id,
      sourceClienteId: null,
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.notificacion.findUnique({ where: { id: notif.id } })
    expect(after?.titulo).toBe("Nueva reseña ⭐")
    expect(after?.cuerpo).toBe(cuerpoOriginal)
    expect(after?.sourceClienteId).toBeNull()
  })
})

describe("19-B0.2E1 — Notificacion de otro Cliente/Pedido: sin cambios", () => {
  test("una Notificacion legacy new_order de un Pedido de OTRO cliente no se toca", async () => {
    const negocio = await ensureNegocio(`otro-${randomUUID()}`)
    const clienteObjetivo = await ensureCliente(`otro-objetivo-${randomUUID()}`)
    const clienteAjeno = await ensureCliente(`otro-ajeno-${randomUUID()}`)
    await ensurePedido({ clienteId: clienteObjetivo.id, negocioId: negocio.id, estado: "entregado" })
    const pedidoAjeno = await ensurePedido({ clienteId: clienteAjeno.id, negocioId: negocio.id, estado: "entregado" })

    const cuerpoOriginal = "TEST_T19B02E1_OTHER_CLIENT hizo un pedido de $50"
    const notifAjena = await ensureNotificacion({
      userId: negocio.id,
      userType: "negocio",
      tipo: "new_order",
      titulo: "¡Nuevo pedido! 📩",
      cuerpo: cuerpoOriginal,
      pedidoId: pedidoAjeno.id,
      negocioId: negocio.id,
      sourceClienteId: null,
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(clienteObjetivo.id)))
    expect(res.status).toBe(200)

    const after = await db.notificacion.findUnique({ where: { id: notifAjena.id } })
    expect(after?.titulo).toBe("¡Nuevo pedido! 📩")
    expect(after?.cuerpo).toBe(cuerpoOriginal)
  })
})

describe("19-B0.2E1 — Tipos sin PII: no se modifican", () => {
  test("account_update y mesa_order_ready permanecen sin cambios", async () => {
    const negocio = await ensureNegocio(`sinpii-${randomUUID()}`)
    const cliente = await ensureCliente(`sinpii-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado" })

    const accountUpdate = await ensureNotificacion({
      userId: negocio.id,
      userType: "negocio",
      tipo: "account_update",
      titulo: "TEST_T19B02E1 tu local fue aprobado",
      cuerpo: "Ya está activo en DeliGO.",
      sourceClienteId: null,
    })
    const mesaReady = await ensureNotificacion({
      userId: negocio.id,
      userType: "empleado",
      tipo: "mesa_order_ready",
      titulo: "TEST_T19B02E1 pedido listo",
      cuerpo: "Mesa 4 lista para entregar",
      pedidoId: pedido.id,
      sourceClienteId: null,
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const accountAfter = await db.notificacion.findUnique({ where: { id: accountUpdate.id } })
    const mesaAfter = await db.notificacion.findUnique({ where: { id: mesaReady.id } })
    expect(accountAfter?.titulo).toBe("TEST_T19B02E1 tu local fue aprobado")
    expect(accountAfter?.cuerpo).toBe("Ya está activo en DeliGO.")
    expect(mesaAfter?.titulo).toBe("TEST_T19B02E1 pedido listo")
    expect(mesaAfter?.cuerpo).toBe("Mesa 4 lista para entregar")
  })
})

describe("19-B0.2E1 — datos (JSON de navegación): preservado byte-idéntico cuando no hay PII", () => {
  test("datos sin PII se conserva exactamente igual tras sanitizar titulo/cuerpo", async () => {
    const negocio = await ensureNegocio(`datos-${randomUUID()}`)
    const cliente = await ensureCliente(`datos-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado" })

    const datosOriginal = JSON.stringify({ navigateTo: { negocio: "pedidos" } })
    const notif = await ensureNotificacion({
      userId: negocio.id,
      userType: "negocio",
      tipo: "new_order",
      titulo: "¡Nuevo pedido! 📩",
      cuerpo: "TEST_T19B02E1_DATOS_CASE cliente hizo un pedido",
      pedidoId: pedido.id,
      negocioId: negocio.id,
      sourceClienteId: null,
      datos: datosOriginal,
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.notificacion.findUnique({ where: { id: notif.id } })
    expect(after?.titulo).toBe("Pedido recibido")
    expect(after?.datos).toBe(datosOriginal)
  })
})

describe("19-B0.2E1 — ClienteBloqueado: pseudonimización exacta", () => {
  test("clienteNombre pasa a 'Usuario eliminado'; ip/fingerprint/clienteId/fecha idénticos", async () => {
    const cliente = await ensureCliente(`bloqueado-${randomUUID()}`)
    const bloqueo = await db.clienteBloqueado.create({
      data: {
        ip: "203.0.113.77",
        fingerprint: `${prefix}fingerprint-${randomUUID()}`,
        clienteId: cliente.id,
        clienteNombre: "TEST_T19B02E1_NAME",
      },
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.clienteBloqueado.findUnique({ where: { id: bloqueo.id } })
    expect(after).not.toBeNull()
    expect(after?.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
    expect(after?.ip).toBe("203.0.113.77")
    expect(after?.fingerprint).toBe(bloqueo.fingerprint)
    expect(after?.clienteId).toBe(cliente.id)
    expect(after?.fecha.getTime()).toBe(bloqueo.fecha.getTime())
  })
})

describe("19-B0.2E1 — Regresión B0: pedido activo bloquea TODO, incluyendo Notificacion y ClienteBloqueado", () => {
  test("409 y cero cambios en notificaciones propias, notificaciones con PII y ClienteBloqueado", async () => {
    const negocio = await ensureNegocio(`b0-${randomUUID()}`)
    const cliente = await ensureCliente(`b0-${randomUUID()}`)
    const pedidoActivo = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "preparando" })

    const propia = await ensureNotificacion({ userId: cliente.id, userType: "cliente", tipo: "order_update", titulo: "TEST_T19B02E1 propia", cuerpo: "cuerpo", pedidoId: pedidoActivo.id })
    const ajena = await ensureNotificacion({
      userId: negocio.id, userType: "negocio", tipo: "new_order",
      titulo: "¡Nuevo pedido! 📩", cuerpo: "TEST_T19B02E1_B0_MARKER hizo un pedido",
      pedidoId: pedidoActivo.id, negocioId: negocio.id, sourceClienteId: null,
    })
    const bloqueo = await db.clienteBloqueado.create({
      data: { ip: "198.51.100.5", fingerprint: `${prefix}fp-${randomUUID()}`, clienteId: cliente.id, clienteNombre: "TEST_T19B02E1_B0_NAME" },
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(409)

    const propiaAfter = await db.notificacion.findUnique({ where: { id: propia.id } })
    const ajenaAfter = await db.notificacion.findUnique({ where: { id: ajena.id } })
    const bloqueoAfter = await db.clienteBloqueado.findUnique({ where: { id: bloqueo.id } })
    expect(propiaAfter).not.toBeNull()
    expect(ajenaAfter?.cuerpo).toContain("TEST_T19B02E1_B0_MARKER")
    expect(bloqueoAfter?.clienteNombre).toBe("TEST_T19B02E1_B0_NAME")
  })
})

describe("19-B0.2E1 — Regresión B1: sanitización estructurada de Pedido + PasswordResetToken", () => {
  test("Pedido terminal sanitizado, PasswordResetToken eliminado, Pedido.notas null", async () => {
    const negocio = await ensureNegocio(`b1-${randomUUID()}`)
    const cliente = await ensureCliente(`b1-${randomUUID()}`)
    const pedido = await db.pedido.create({
      data: {
        negocioId: negocio.id, negocioSlug: `${prefix}negocio`, negocioNombre: `${prefix}negocio`,
        clienteId: cliente.id, clienteNombre: `${prefix}cliente`, total: 100, totalProductos: 100,
        metodoEntrega: "retiro", estado: "entregado", notas: "TEST_T19B02E1_NOTAS",
      },
    })
    await db.passwordResetToken.create({
      data: { userId: cliente.id, userType: "cliente", tokenHash: `${prefix}hash-${randomUUID()}`, expiresAt: new Date(Date.now() + 3600_000) },
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const pedidoAfter = await db.pedido.findUnique({ where: { id: pedido.id } })
    expect(pedidoAfter?.clienteId).toBeNull()
    expect(pedidoAfter?.notas).toBeNull()

    const tokens = await db.passwordResetToken.count({ where: { userId: cliente.id } })
    expect(tokens).toBe(0)
  })
})

describe("19-B0.2E1 — Regresión C: Denuncia permanece pseudonimizada", () => {
  test("Denuncia.clienteId null, clienteNombre pseudonimizado", async () => {
    const negocio = await ensureNegocio(`c-${randomUUID()}`)
    const cliente = await ensureCliente(`c-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado" })
    const denuncia = await db.denuncia.create({
      data: {
        clienteId: cliente.id, negocioId: negocio.id, pedidoId: pedido.id,
        negocioNombre: `${prefix}negocio`, clienteNombre: "TEST_T19B02E1_DENUNCIA_NAME",
        motivoTipo: "otro", motivo: "TEST_T19B02E1_DENUNCIA_MOTIVO",
      },
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.denuncia.findUnique({ where: { id: denuncia.id } })
    expect(after?.clienteId).toBeNull()
    expect(after?.clienteNombre).toBe(ANONYMIZED_REVIEW_CLIENT_NAME)
    expect(after?.motivo).toBe("TEST_T19B02E1_DENUNCIA_MOTIVO")
  })
})

describe("19-B0.2E1 — Regresión D1: Chat sanitizado, mensajes de vendedor preservados", () => {
  test("ChatMensaje del Cliente sanitizado con el sentinel; mensaje del vendedor byte-idéntico", async () => {
    const negocio = await ensureNegocio(`d1-${randomUUID()}`)
    const cliente = await ensureCliente(`d1-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado" })

    const mensajeCliente = await db.chatMensaje.create({
      data: { pedidoId: pedido.id, remitente: "cliente", clienteId: cliente.id, texto: "TEST_T19B02E1_CHAT_CLIENTE" },
    })
    const mensajeVendedor = await db.chatMensaje.create({
      data: { pedidoId: pedido.id, remitente: "vendedor", clienteId: null, texto: "TEST_T19B02E1_CHAT_VENDEDOR" },
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const clienteAfter = await db.chatMensaje.findUnique({ where: { id: mensajeCliente.id } })
    const vendedorAfter = await db.chatMensaje.findUnique({ where: { id: mensajeVendedor.id } })
    expect(clienteAfter?.clienteId).toBeNull()
    expect(clienteAfter?.texto).toBe("Mensaje no disponible")
    expect(vendedorAfter?.texto).toBe("TEST_T19B02E1_CHAT_VENDEDOR")
  })
})

describe("19-B0.2E1 — AuditLog: KEEP, cero cambios", () => {
  test("una fila de AuditLog asociada al Cliente permanece byte-idéntica tras el borrado", async () => {
    const cliente = await ensureCliente(`audit-${randomUUID()}`)
    const original = await db.auditLog.create({
      data: {
        userId: cliente.id,
        userType: "cliente",
        accion: "password.reset_solicitado",
        recurso: "password_reset",
        recursoId: `${prefix}reset-${randomUUID()}`,
        detalle: JSON.stringify({ encontrada: true }),
        // Sintético, nunca una IP real.
        ip: "203.0.113.9",
      },
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.auditLog.findUnique({ where: { id: original.id } })
    expect(after).not.toBeNull()
    expect(after?.userId).toBe(cliente.id)
    expect(after?.userType).toBe("cliente")
    expect(after?.accion).toBe("password.reset_solicitado")
    expect(after?.detalle).toBe(original.detalle)
    expect(after?.ip).toBe("203.0.113.9")
    expect(after?.fecha.getTime()).toBe(original.fecha.getTime())
  })
})
