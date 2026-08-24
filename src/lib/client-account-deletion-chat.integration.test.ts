/// <reference types="bun-types" />

// ============================================
// 19-B0.2D1 — Chat + Pedido.notas + outbox de adjuntos, contra PostgreSQL
// TESTING real.
// ============================================
// Prueba el flujo HTTP real completo (DELETE /api/cliente/cuenta), la tabla
// outbox real (`chatAttachmentDeletionJob`), y el processor real
// (`processPendingChatAttachmentDeletions`) — nunca mockea Prisma. Prefijo
// `test-t19b02d1-`, cleanup obligatorio. Archivo separado (siguiendo el
// mismo patrón que `-denuncia.integration.test.ts`) para no seguir
// engordando el archivo principal de B0/B1.

import { randomUUID } from "crypto"
import { mkdir, rmdir, unlink, writeFile } from "fs/promises"
import { join } from "path"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { DELETE as deleteCuenta } from "@/app/api/cliente/cuenta/route"
import { GET as getChatMensajes, POST as postChatMensaje } from "@/app/api/chat/mensajes/[pedidoId]/route"
import { GET as getChatCleanup } from "@/app/api/chat/cleanup/route"
import {
  DELETED_CLIENT_CHAT_MESSAGE_TEXT,
  processPendingChatAttachmentDeletions,
} from "@/lib/chat-attachment-deletion"
import { deleteClientAccount } from "@/lib/client-account-deletion"

setDefaultTimeout(60_000)

const prefix = "test-t19b02d1-"
const clienteIds: string[] = []
const localFixturePaths: string[] = []

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
  clienteId: string | null
  negocioId: string
  estado: string
  metodoEntrega?: "retiro" | "domicilio" | "mesa"
  notas?: string | null
  canceladoPor?: string
  canceladoMotivo?: string
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
      notas: params.notas ?? null,
      canceladoPor: params.canceladoPor,
      canceladoMotivo: params.canceladoMotivo,
    },
  })
}

async function ensureChatMensaje(params: {
  pedidoId: string
  remitente: "cliente" | "vendedor"
  clienteId: string | null
  texto?: string
  imagenUrl?: string | null
  archivoUrl?: string | null
  archivoNombre?: string | null
  archivoTipo?: string | null
  leido?: boolean
}) {
  return db.chatMensaje.create({
    data: {
      pedidoId: params.pedidoId,
      remitente: params.remitente,
      clienteId: params.clienteId,
      texto: params.texto ?? "",
      imagenUrl: params.imagenUrl ?? null,
      archivoUrl: params.archivoUrl ?? null,
      archivoNombre: params.archivoNombre ?? null,
      archivoTipo: params.archivoTipo ?? null,
      leido: params.leido ?? false,
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

function reqGetMensajes(pedidoId: string, cookie: string) {
  return new NextRequest(`http://localhost/api/chat/mensajes/${pedidoId}`, {
    headers: { cookie },
  })
}

function reqPostMensaje(pedidoId: string, cookie: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/chat/mensajes/${pedidoId}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
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

// Crea un archivo local real bajo public/uploads/chat/<pedidoId>/ para
// probar el delete local end-to-end sin tocar datos reales.
async function writeLocalFixtureFile(pedidoId: string, filename: string): Promise<string> {
  const relativeDir = join("uploads", "chat", pedidoId)
  const absoluteDir = join(process.cwd(), "public", relativeDir)
  await mkdir(absoluteDir, { recursive: true })
  const absolutePath = join(absoluteDir, filename)
  await writeFile(absolutePath, "contenido sintetico de prueba")
  localFixturePaths.push(absolutePath)
  return `/uploads/chat/${pedidoId}/${filename}`
}

async function cleanupLocalFixtures() {
  for (const path of localFixturePaths) {
    await unlink(path).catch(() => {})
  }
  // Best-effort: intenta limpiar los directorios de pedido creados (fallan
  // silenciosamente si no están vacíos o ya no existen).
  const dirs = new Set(localFixturePaths.map((p) => join(p, "..")))
  for (const dir of dirs) {
    await rmdir(dir).catch(() => {})
  }
}

async function cleanup() {
  await db.resena.deleteMany({ where: { negocio: { slug: { startsWith: prefix } } } })
  // ChatAttachmentDeletionJob no tiene FK a nada — se limpia por separado,
  // acotado a los identifiers sintéticos de este archivo (prefijo en el
  // pedidoId embebido dentro del identifier).
  await db.chatAttachmentDeletionJob.deleteMany({ where: { identifier: { contains: prefix } } })
  await db.negocio.deleteMany({ where: { slug: { startsWith: prefix } } })
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.passwordResetToken.deleteMany({ where: { userId: { in: clienteIds } } })
  }
  await db.cliente.deleteMany({ where: { email: { startsWith: prefix } } })
  await cleanupLocalFixtures()
}

beforeAll(cleanup)

afterAll(async () => {
  await cleanup()
  const remainingNegocios = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  const remainingClientes = await db.cliente.count({ where: { email: { startsWith: prefix } } })
  const remainingJobs = await db.chatAttachmentDeletionJob.count({ where: { identifier: { contains: prefix } } })
  expect(remainingNegocios).toBe(0)
  expect(remainingClientes).toBe(0)
  expect(remainingJobs).toBe(0)
})

describe("19-B0.2D1 — Chat mixto: sólo el Cliente se sanitiza, vendedor byte-identical", () => {
  test("C1 texto, V1 texto, C2 imagen local, V2 imagen local, C3 archivo local — todas las filas permanecen", async () => {
    const negocio = await ensureNegocio(`mixto-${randomUUID()}`)
    const cliente = await ensureCliente(`mixto-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", metodoEntrega: "domicilio" })

    const imgCliente = await writeLocalFixtureFile(pedido.id, "c2.jpg")
    const imgVendedor = await writeLocalFixtureFile(pedido.id, "v2.jpg")
    const pdfCliente = await writeLocalFixtureFile(pedido.id, "c3.pdf")

    const c1 = await ensureChatMensaje({ pedidoId: pedido.id, remitente: "cliente", clienteId: cliente.id, texto: "TEST_T19B02D1_C1" })
    const v1 = await ensureChatMensaje({ pedidoId: pedido.id, remitente: "vendedor", clienteId: null, texto: "TEST_T19B02D1_V1" })
    const c2 = await ensureChatMensaje({ pedidoId: pedido.id, remitente: "cliente", clienteId: cliente.id, imagenUrl: imgCliente, archivoTipo: "image/jpeg" })
    const v2 = await ensureChatMensaje({ pedidoId: pedido.id, remitente: "vendedor", clienteId: null, imagenUrl: imgVendedor, archivoTipo: "image/jpeg" })
    const c3 = await ensureChatMensaje({
      pedidoId: pedido.id, remitente: "cliente", clienteId: cliente.id,
      archivoUrl: pdfCliente, archivoNombre: "TEST_T19B02D1_FILENAME.pdf", archivoTipo: "application/pdf",
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const rows = await db.chatMensaje.findMany({ where: { pedidoId: pedido.id }, orderBy: { fecha: "asc" } })
    expect(rows).toHaveLength(5)

    const c1After = rows.find((r) => r.id === c1.id)!
    expect(c1After.clienteId).toBeNull()
    expect(c1After.texto).toBe(DELETED_CLIENT_CHAT_MESSAGE_TEXT)

    const v1After = rows.find((r) => r.id === v1.id)!
    expect(v1After.clienteId).toBeNull() // ya era null desde la creación (vendedor)
    expect(v1After.texto).toBe("TEST_T19B02D1_V1") // byte-identical

    const c2After = rows.find((r) => r.id === c2.id)!
    expect(c2After.clienteId).toBeNull()
    expect(c2After.imagenUrl).toBeNull()

    const v2After = rows.find((r) => r.id === v2.id)!
    expect(v2After.imagenUrl).toBe(imgVendedor) // byte-identical, nunca tocado
    expect(v2After.archivoTipo).toBe("image/jpeg")

    const c3After = rows.find((r) => r.id === c3.id)!
    expect(c3After.archivoUrl).toBeNull()
    expect(c3After.archivoNombre).toBeNull()
    expect(c3After.archivoTipo).toBeNull()

    // El archivo de vendedor sigue existiendo físicamente (nunca se encoló
    // para borrado); los del Cliente fueron encolados y ya deberían haberse
    // procesado (best-effort post-commit dentro de deleteClientAccount).
    const jobsRestantes = await db.chatAttachmentDeletionJob.count({
      where: { identifier: { contains: pedido.id } },
    })
    expect(jobsRestantes).toBe(0)
  })
})

describe("19-B0.2D1 — cronología preservada", () => {
  test("id/pedidoId/remitente/leido/fecha idénticos antes y después", async () => {
    const negocio = await ensureNegocio(`cronologia-${randomUUID()}`)
    const cliente = await ensureCliente(`cronologia-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "cancelado" })
    const mensaje = await ensureChatMensaje({ pedidoId: pedido.id, remitente: "cliente", clienteId: cliente.id, texto: "TEST_T19B02D1_CRONO", leido: true })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.chatMensaje.findUnique({ where: { id: mensaje.id } })
    expect(after?.id).toBe(mensaje.id)
    expect(after?.pedidoId).toBe(mensaje.pedidoId)
    expect(after?.remitente).toBe("cliente")
    expect(after?.leido).toBe(true)
    expect(after?.fecha.getTime()).toBe(mensaje.fecha.getTime())
  })
})

describe("19-B0.2D1 — Pedido.notas", () => {
  test("notas del Cliente se limpian a null", async () => {
    const negocio = await ensureNegocio(`notas-${randomUUID()}`)
    const cliente = await ensureCliente(`notas-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado", notas: "TEST_T19B02D1_NOTES" })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.pedido.findUnique({ where: { id: pedido.id } })
    expect(after?.notas).toBeNull()
    // Resto de B1 sigue intacto.
    expect(after?.clienteId).toBeNull()
    expect(after?.clienteTelefono).toBe("")
  })
})

describe("19-B0.2D1 — canceladoMotivo del Negocio: sin cambios", () => {
  test("motivo escrito por vendedor permanece byte-identical", async () => {
    const negocio = await ensureNegocio(`cancel-${randomUUID()}`)
    const cliente = await ensureCliente(`cancel-${randomUUID()}`)
    const pedido = await ensurePedido({
      clienteId: cliente.id, negocioId: negocio.id, estado: "cancelado",
      canceladoPor: "vendedor", canceladoMotivo: "TEST_T19B02D1_BUSINESS_REASON",
    })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const after = await db.pedido.findUnique({ where: { id: pedido.id } })
    expect(after?.canceladoPor).toBe("vendedor")
    expect(after?.canceladoMotivo).toBe("TEST_T19B02D1_BUSINESS_REASON")
  })
})

describe("19-B0.2D1 — Denuncia + Chat: sin excepción de retención", () => {
  test("Denuncia preservada pseudonimizada Y Chat del Cliente igual sanitizado", async () => {
    const negocio = await ensureNegocio(`denuncia-${randomUUID()}`)
    const cliente = await ensureCliente(`denuncia-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado" })
    const denuncia = await db.denuncia.create({
      data: {
        clienteId: cliente.id, negocioId: negocio.id, pedidoId: pedido.id,
        negocioNombre: `${prefix}negocio`, clienteNombre: `${prefix}cliente`,
        motivoTipo: "comportamiento", motivo: "TEST_T19B02D1_DENUNCIA_MOTIVO",
      },
    })
    const mensaje = await ensureChatMensaje({ pedidoId: pedido.id, remitente: "cliente", clienteId: cliente.id, texto: "TEST_T19B02D1_DENUNCIADO" })

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(200)

    const denunciaAfter = await db.denuncia.findUnique({ where: { id: denuncia.id } })
    expect(denunciaAfter?.clienteId).toBeNull()
    expect(denunciaAfter?.motivo).toBe("TEST_T19B02D1_DENUNCIA_MOTIVO")

    const mensajeAfter = await db.chatMensaje.findUnique({ where: { id: mensaje.id } })
    expect(mensajeAfter?.texto).toBe(DELETED_CLIENT_CHAT_MESSAGE_TEXT)
    expect(mensajeAfter?.clienteId).toBeNull()
  })
})

describe("19-B0.2D1 — regresión B0: pedido activo bloquea, cero mutaciones nuevas", () => {
  test("Chat, notas y adjunto quedan intactos; 0 jobs nuevos en la outbox", async () => {
    const negocio = await ensureNegocio(`activo-${randomUUID()}`)
    const cliente = await ensureCliente(`activo-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "recibido", notas: "TEST_T19B02D1_ACTIVE_NOTES" })
    const img = await writeLocalFixtureFile(pedido.id, "activo.jpg")
    const mensaje = await ensureChatMensaje({ pedidoId: pedido.id, remitente: "cliente", clienteId: cliente.id, texto: "TEST_T19B02D1_ACTIVE_MSG", imagenUrl: img })

    const jobsAntes = await db.chatAttachmentDeletionJob.count()

    const res = await deleteCuenta(reqDelete(await cookieFor(cliente.id)))
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("CLIENT_HAS_ACTIVE_ORDERS")

    const mensajeAfter = await db.chatMensaje.findUnique({ where: { id: mensaje.id } })
    expect(mensajeAfter?.texto).toBe("TEST_T19B02D1_ACTIVE_MSG")
    expect(mensajeAfter?.imagenUrl).toBe(img)
    expect(mensajeAfter?.clienteId).toBe(cliente.id)

    const pedidoAfter = await db.pedido.findUnique({ where: { id: pedido.id } })
    expect(pedidoAfter?.notas).toBe("TEST_T19B02D1_ACTIVE_NOTES")

    const jobsDespues = await db.chatAttachmentDeletionJob.count()
    expect(jobsDespues).toBe(jobsAntes)

    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).not.toBeNull()
  })
})

describe("19-B0.2D1 — outbox: borrado local real (éxito, not-found, fallo+retry)", () => {
  test("job local apuntando a un archivo real: processPendingChatAttachmentDeletions lo borra y el job desaparece", async () => {
    const pedidoId = `${prefix}outbox-success-${randomUUID()}`
    const relativeUrl = await writeLocalFixtureFile(pedidoId, "success.jpg")
    const identifier = relativeUrl.slice(1) // sin la barra inicial, como lo guarda el resolver real

    const job = await db.chatAttachmentDeletionJob.create({
      data: { provider: "local", resourceType: "file", identifier },
    })

    const result = await processPendingChatAttachmentDeletions()
    expect(result.deleted).toBeGreaterThanOrEqual(1)

    expect(await db.chatAttachmentDeletionJob.findUnique({ where: { id: job.id } })).toBeNull()
  })

  test("job local apuntando a un archivo YA inexistente: se trata como éxito idempotente (ENOENT)", async () => {
    const pedidoId = `${prefix}outbox-notfound-${randomUUID()}`
    const identifier = `uploads/chat/${pedidoId}/no-existe.jpg`

    const job = await db.chatAttachmentDeletionJob.create({
      data: { provider: "local", resourceType: "file", identifier },
    })

    await processPendingChatAttachmentDeletions()

    expect(await db.chatAttachmentDeletionJob.findUnique({ where: { id: job.id } })).toBeNull()
  })

  test("job que falla (target es un directorio, no un archivo) permanece con attempts incrementado; retry posterior lo resuelve", async () => {
    const pedidoId = `${prefix}outbox-fail-${randomUUID()}`
    const dirRelative = join("uploads", "chat", pedidoId, "un-directorio")
    const dirAbsolute = join(process.cwd(), "public", dirRelative)
    await mkdir(dirAbsolute, { recursive: true })

    const job = await db.chatAttachmentDeletionJob.create({
      data: { provider: "local", resourceType: "file", identifier: dirRelative.replace(/\\/g, "/") },
    })

    const firstRun = await processPendingChatAttachmentDeletions()
    expect(firstRun.failed).toBeGreaterThanOrEqual(1)

    const afterFirstRun = await db.chatAttachmentDeletionJob.findUnique({ where: { id: job.id } })
    expect(afterFirstRun).not.toBeNull()
    expect(afterFirstRun?.attempts).toBe(1)
    expect(afterFirstRun?.lastAttemptAt).not.toBeNull()

    // Reintento: se "repara" el target apuntándolo a un archivo real (mismo
    // identifier, actualizado) para demostrar que un job fallido sigue
    // siendo procesable en la próxima corrida hasta tener éxito.
    const fixedRelative = await writeLocalFixtureFile(pedidoId, "reparado.jpg")
    await db.chatAttachmentDeletionJob.update({
      where: { id: job.id },
      data: { identifier: fixedRelative.slice(1) },
    })
    await rmdir(dirAbsolute).catch(() => {})

    const secondRun = await processPendingChatAttachmentDeletions()
    expect(secondRun.deleted).toBeGreaterThanOrEqual(1)
    expect(await db.chatAttachmentDeletionJob.findUnique({ where: { id: job.id } })).toBeNull()
  })

  test("dedupe: dos targets idénticos encolados no producen dos jobs (unique provider+resourceType+identifier)", async () => {
    const identifier = `chat/${prefix}dedupe-${randomUUID()}/foto`
    const data = { provider: "cloudinary", resourceType: "image", identifier }

    await db.chatAttachmentDeletionJob.createMany({ data: [data, data], skipDuplicates: true })

    const count = await db.chatAttachmentDeletionJob.count({ where: data })
    expect(count).toBe(1)

    await db.chatAttachmentDeletionJob.deleteMany({ where: data })
  })
})

describe("19-B0.2D1 — defensa en profundidad de lectura: GET /api/chat/mensajes/[pedidoId]", () => {
  test("fila legacy sin sanitizar (clienteId=null, remitente=cliente, contenido original) se enmascara en la respuesta", async () => {
    const negocio = await ensureNegocio(`mask-legacy-${randomUUID()}`)
    // Pedido sin clienteId real desde el inicio — simula el estado que
    // quedaría si el propio Cliente hubiera sido eliminado (B1 ya deja
    // Pedido.clienteId=null en pedidos terminales).
    const pedido = await ensurePedido({ clienteId: null, negocioId: negocio.id, estado: "entregado" })
    const legacy = await ensureChatMensaje({
      pedidoId: pedido.id,
      remitente: "cliente",
      clienteId: null, // ya eliminado, pero NUNCA pasó por la sanitización de B0.2D1
      texto: "PII_SENTINEL_SHOULD_NOT_LEAK",
      imagenUrl: "/uploads/chat/legacy/no-existe.jpg",
      archivoNombre: "documento_original_legacy.pdf",
    })

    const res = await getChatMensajes(reqGetMensajes(pedido.id, await cookieForNegocio(negocio.id)), {
      params: Promise.resolve({ pedidoId: pedido.id }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const item = body.mensajes.find((m: { id: string }) => m.id === legacy.id)
    expect(item).toBeDefined()
    expect(item.texto).toBe(DELETED_CLIENT_CHAT_MESSAGE_TEXT)
    expect(item.imagenUrl).toBeNull()
    expect(item.archivoNombre).toBeNull()

    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain("PII_SENTINEL_SHOULD_NOT_LEAK")
    expect(serialized).not.toContain("documento_original_legacy.pdf")
  })

  test("mensaje de Cliente ACTIVO no se enmascara", async () => {
    const negocio = await ensureNegocio(`mask-active-${randomUUID()}`)
    const cliente = await ensureCliente(`mask-active-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "recibido" })
    const mensaje = await ensureChatMensaje({
      pedidoId: pedido.id, remitente: "cliente", clienteId: cliente.id, texto: "TEST_T19B02D1_ACTIVE_UNMASKED",
    })

    const res = await getChatMensajes(reqGetMensajes(pedido.id, await cookieForNegocio(negocio.id)), {
      params: Promise.resolve({ pedidoId: pedido.id }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const item = body.mensajes.find((m: { id: string }) => m.id === mensaje.id)
    expect(item.texto).toBe("TEST_T19B02D1_ACTIVE_UNMASKED")
  })

  test("mensaje de vendedor con clienteId=null no se enmascara (nunca es 'cliente')", async () => {
    const negocio = await ensureNegocio(`mask-vendedor-${randomUUID()}`)
    const cliente = await ensureCliente(`mask-vendedor-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "recibido" })
    const mensaje = await ensureChatMensaje({
      pedidoId: pedido.id, remitente: "vendedor", clienteId: null, texto: "TEST_T19B02D1_VENDOR_UNMASKED",
    })

    const res = await getChatMensajes(reqGetMensajes(pedido.id, await cookieForNegocio(negocio.id)), {
      params: Promise.resolve({ pedidoId: pedido.id }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    const item = body.mensajes.find((m: { id: string }) => m.id === mensaje.id)
    expect(item.texto).toBe("TEST_T19B02D1_VENDOR_UNMASKED")
  })
})

describe("19-B0.2D1 — /api/chat/cleanup procesa también la outbox (mismo secreto, mismo endpoint)", () => {
  test("un job pendiente real se procesa y desaparece; la respuesta reporta conteos de outbox sin identifiers", async () => {
    const secret = process.env.CLEANUP_SECRET
    if (!secret) {
      // No se imprime nada — sólo se documenta la razón del skip.
      console.warn("[test] CLEANUP_SECRET no configurado en este entorno — se omite este test puntual")
      return
    }

    const pedidoId = `${prefix}cleanup-endpoint-${randomUUID()}`
    const relativeUrl = await writeLocalFixtureFile(pedidoId, "endpoint.jpg")
    const job = await db.chatAttachmentDeletionJob.create({
      data: { provider: "local", resourceType: "file", identifier: relativeUrl.slice(1) },
    })

    const req = new NextRequest("http://localhost/api/chat/cleanup", {
      headers: { "x-cleanup-secret": secret },
    })
    const res = await getChatCleanup(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.outbox).toBeDefined()
    expect(typeof body.outbox.processed).toBe("number")
    expect(typeof body.outbox.deleted).toBe("number")
    expect(typeof body.outbox.failed).toBe("number")
    expect(typeof body.outbox.pending).toBe("number")
    // Nunca expone identifiers/URLs/nombres de archivo en la respuesta.
    expect(JSON.stringify(body)).not.toContain(job.identifier)

    expect(await db.chatAttachmentDeletionJob.findUnique({ where: { id: job.id } })).toBeNull()
  })

  test("secreto incorrecto -> 403, no procesa nada", async () => {
    const req = new NextRequest("http://localhost/api/chat/cleanup", {
      headers: { "x-cleanup-secret": "claramente-incorrecto" },
    })
    const res = await getChatCleanup(req)
    expect([403, 404]).toContain(res.status)
  })
})

// ============================================
// P2-T04 STAGE 2 — MODEL_S1 product-level PostgreSQL proof. Stage 1E
// proved the model against a throwaway reproduction script outside the
// repo; this exercises the REAL `deleteClientAccount` from
// src/lib/client-account-deletion.ts (no reproduction, no test hooks in
// product code) against real PostgreSQL TESTING.
// ============================================
describe("P2-T04 MODEL_S1 — deleteClientAccount product-level concurrency proof (real PostgreSQL)", () => {
  test("a Chat message created concurrently with account deletion always ends sanitized, zero real text, chatRevision bumped", async () => {
    const negocio = await ensureNegocio(`s1-${randomUUID()}`)
    const cliente = await ensureCliente(`s1-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "entregado" })

    const sentinel = "TEST_P2T04E_REAL_TEXT_MUST_NOT_SURVIVE"
    let createdMessageId = ""
    let releasePost!: () => void
    const postBarrier = new Promise<void>((resolve) => {
      releasePost = resolve
    })

    // T_POST: a real interactive transaction that creates the Cliente's own
    // message and stays deliberately uncommitted until released — the same
    // "held open" shape Stage 1E used, but here running concurrently
    // against the REAL product deletion below (not a hand-rolled model).
    const postTxPromise = db.$transaction(
      async (tx) => {
        const created = await tx.chatMensaje.create({
          data: { pedidoId: pedido.id, remitente: "cliente", clienteId: cliente.id, texto: sentinel },
        })
        createdMessageId = created.id
        await postBarrier
      },
      { timeout: 30_000, maxWait: 30_000 },
    )

    const createDeadline = Date.now() + 5000
    while (!createdMessageId && Date.now() < createDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    expect(createdMessageId).not.toBe("")

    const pedidoBefore = await db.pedido.findUnique({ where: { id: pedido.id }, select: { chatRevision: true } })

    // T_DELETE: the REAL product function, started concurrently — it will
    // block on its own early Cliente `FOR UPDATE` lock until T_POST above
    // releases. The 300ms pause is a bounded scheduling courtesy, not a
    // correctness dependency: every assertion below holds regardless of
    // the exact interleaving or of which retry attempt finally sanitizes.
    const deletePromise = deleteClientAccount(cliente.id)
    await new Promise((resolve) => setTimeout(resolve, 300))
    releasePost()
    await postTxPromise
    await deletePromise

    const messageAfter = await db.chatMensaje.findUnique({ where: { id: createdMessageId } })
    expect(messageAfter).not.toBeNull()
    expect(messageAfter?.clienteId).toBeNull()
    expect(messageAfter?.texto).toBe(DELETED_CLIENT_CHAT_MESSAGE_TEXT)
    expect(messageAfter?.texto).not.toBe(sentinel)

    const pedidoAfter = await db.pedido.findUnique({ where: { id: pedido.id }, select: { chatRevision: true } })
    expect(pedidoAfter?.chatRevision ?? 0).toBeGreaterThan(pedidoBefore?.chatRevision ?? 0)

    expect(await db.cliente.findUnique({ where: { id: cliente.id } })).toBeNull()
  })
})

// ============================================
// P2-T04 STAGE 2 — MODEL_R, real PostgreSQL. No test hooks added to
// route.ts/client-account-deletion.ts — both tests below exercise the
// exact same two-statement (create + increment, in one transaction) shape
// the product code uses, either via the real POST route handler or via an
// equivalent raw transaction proving the general atomicity guarantee.
// ============================================
describe("P2-T04 MODEL_R — real PostgreSQL: concurrent creates never lose a chatRevision increment", () => {
  test("REAL_POSTGRES_CONCURRENT_CHAT_CREATE: two concurrent POSTs to the same pedido -> both messages persist, finalRevision = startingRevision + 2", async () => {
    const negocio = await ensureNegocio(`concurrent-${randomUUID()}`)
    const cliente = await ensureCliente(`concurrent-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: cliente.id, negocioId: negocio.id, estado: "recibido" })

    const before = await db.pedido.findUnique({ where: { id: pedido.id }, select: { chatRevision: true } })
    const cookie = await cookieFor(cliente.id)

    const [res1, res2] = await Promise.all([
      postChatMensaje(reqPostMensaje(pedido.id, cookie, { texto: "TEST_CONCURRENT_A" }), {
        params: Promise.resolve({ pedidoId: pedido.id }),
      }),
      postChatMensaje(reqPostMensaje(pedido.id, cookie, { texto: "TEST_CONCURRENT_B" }), {
        params: Promise.resolve({ pedidoId: pedido.id }),
      }),
    ])
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)

    const after = await db.pedido.findUnique({ where: { id: pedido.id }, select: { chatRevision: true } })
    expect((after?.chatRevision ?? 0) - (before?.chatRevision ?? 0)).toBe(2)

    const messages = await db.chatMensaje.findMany({
      where: { pedidoId: pedido.id, texto: { startsWith: "TEST_CONCURRENT_" } },
    })
    expect(messages).toHaveLength(2)

    // The POST route's push-notification side effect writes a real
    // Notificacion row for the negocio (never cleaned up by `cleanup()`,
    // which never creates any) — scoped and removed here explicitly.
    await db.notificacion.deleteMany({ where: { pedidoId: pedido.id } })
  })

  test("REAL_POSTGRES_CHAT_CREATE_ROLLBACK: a failure in the SAME transaction after create() leaves the message absent and the revision unchanged", async () => {
    const negocio = await ensureNegocio(`rollback-${randomUUID()}`)
    const pedido = await ensurePedido({ clienteId: null, negocioId: negocio.id, estado: "recibido" })
    const before = await db.pedido.findUnique({ where: { id: pedido.id }, select: { chatRevision: true } })

    let thrown: unknown = null
    try {
      await db.$transaction(async (tx) => {
        await tx.chatMensaje.create({
          data: { pedidoId: pedido.id, remitente: "vendedor", clienteId: null, texto: "TEST_ROLLBACK_SENTINEL" },
        })
        // Same two-statement shape as the real POST route (create + revision
        // increment, one transaction) — forces the SECOND statement to fail
        // against a pedidoId that cannot exist, to prove the whole
        // transaction (including the already-executed create) rolls back.
        await tx.pedido.update({
          where: { id: "does-not-exist-force-rollback" },
          data: { chatRevision: { increment: 1 } },
        })
      })
    } catch (error) {
      thrown = error
    }
    expect(thrown).not.toBeNull()

    const messages = await db.chatMensaje.findMany({
      where: { pedidoId: pedido.id, texto: "TEST_ROLLBACK_SENTINEL" },
    })
    expect(messages).toHaveLength(0)

    const after = await db.pedido.findUnique({ where: { id: pedido.id }, select: { chatRevision: true } })
    expect(after?.chatRevision).toBe(before?.chatRevision ?? 0)
  })
})
