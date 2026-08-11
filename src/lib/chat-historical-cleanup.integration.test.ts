/// <reference types="bun-types" />

// ============================================
// CHAT-HISTORICAL-ATTACHMENT-RETRY-1 — retry durable en el cleanup histórico
// por antigüedad de adjuntos de Chat (`GET/POST /api/chat/cleanup`), contra
// PostgreSQL TESTING real.
// ============================================
// Antes de esta tarea, el cleanup histórico intentaba el borrado físico
// directamente y limpiaba `imagenUrl`/`archivoUrl` sin importar el
// resultado — si el borrado fallaba, la única referencia para reintentar se
// perdía para siempre (ver CODEX_REPORT.md de esta tarea para la
// reproducción completa). Ahora reutiliza el MISMO outbox durable
// (`ChatAttachmentDeletionJob`) que ya usa la eliminación de cuenta. Nunca
// mockea Prisma, nunca toca Cloudinary/red real — el fallo físico se fuerza
// de forma determinista apuntando el target `local` a un DIRECTORIO (falla
// con EISDIR, nunca ENOENT), exactamente el mismo patrón que ya usa
// `client-account-deletion-chat.integration.test.ts`. Prefijo
// `test-chat-historical-retry-`, cleanup obligatorio.

import { randomUUID } from "crypto"
import { mkdir, rmdir, unlink, writeFile } from "fs/promises"
import { join, sep } from "path"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getChatCleanup } from "@/app/api/chat/cleanup/route"
import { GET as getChatMensajes } from "@/app/api/chat/mensajes/[pedidoId]/route"
import { processPendingChatAttachmentDeletions } from "@/lib/chat-attachment-deletion"

setDefaultTimeout(60_000)

const prefix = "test-chat-historical-retry-"
const CLEANUP_DAYS = 10
const secret = process.env.CLEANUP_SECRET

const negocioIds: string[] = []
const pedidoIds: string[] = []
const localFixturePaths: string[] = []
const localFixtureDirs: string[] = []

function oldFecha(daysOld = CLEANUP_DAYS + 1): Date {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - daysOld)
  return fecha
}

async function ensureNegocio(suffix: string) {
  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}-${randomUUID()}`,
      usuario: `${prefix}${suffix}-${randomUUID()}`,
      email: `${prefix}${suffix}-${randomUUID()}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
    },
  })
  negocioIds.push(negocio.id)
  return negocio
}

async function ensurePedido(negocioId: string, suffix: string) {
  const pedido = await db.pedido.create({
    data: {
      negocioId,
      negocioSlug: `${prefix}negocio`,
      negocioNombre: `${prefix}negocio`,
      clienteId: null,
      clienteNombre: `${prefix}cliente-${suffix}`,
      total: 100,
      totalProductos: 100,
      metodoEntrega: "retiro",
      estado: "entregado",
    },
  })
  pedidoIds.push(pedido.id)
  return pedido
}

async function cookieForNegocio(negocioId: string) {
  const token = await createSession(negocioId, "negocio")
  return `${SESSION_COOKIE_NAME}=${token}`
}

function reqCleanup() {
  return new NextRequest("http://localhost/api/chat/cleanup", {
    headers: { "x-cleanup-secret": secret ?? "" },
  })
}

function reqGetMensajes(pedidoId: string, cookie: string) {
  return new NextRequest(`http://localhost/api/chat/mensajes/${pedidoId}`, { headers: { cookie } })
}

/** Crea un archivo local real bajo public/uploads/chat/<pedidoId>/ — nunca toca storage real de producción. */
async function writeLocalFixtureFile(pedidoId: string, filename: string): Promise<{ url: string; identifier: string }> {
  const relativeDir = join("uploads", "chat", pedidoId)
  const absoluteDir = join(process.cwd(), "public", relativeDir)
  await mkdir(absoluteDir, { recursive: true })
  const absolutePath = join(absoluteDir, filename)
  await writeFile(absolutePath, "contenido sintetico de prueba")
  localFixturePaths.push(absolutePath)
  const identifier = join(relativeDir, filename).split(sep).join("/")
  return { url: `/${identifier}`, identifier }
}

/**
 * Crea un DIRECTORIO (no un archivo) en el path donde debería estar el
 * adjunto — `unlink` sobre un directorio falla con EISDIR (nunca ENOENT),
 * lo que fuerza de forma 100% determinista el outcome "failed" del
 * processor real, sin mockear nada y sin tocar storage real.
 */
async function writeLocalFixtureFailingTarget(pedidoId: string, filename: string): Promise<{ url: string; identifier: string }> {
  const relativeDir = join("uploads", "chat", pedidoId, filename)
  const absoluteDir = join(process.cwd(), "public", relativeDir)
  await mkdir(absoluteDir, { recursive: true })
  localFixtureDirs.push(absoluteDir)
  const identifier = relativeDir.split(sep).join("/")
  return { url: `/${identifier}`, identifier }
}

/** Repara un target que antes era un directorio fallido, convirtiéndolo en un archivo real. */
async function repairFailingTarget(absoluteDirPath: string, identifier: string): Promise<void> {
  await rmdir(absoluteDirPath).catch(() => {})
  const filePath = join(process.cwd(), "public", identifier)
  await writeFile(filePath, "contenido sintetico de prueba (reparado)")
  localFixturePaths.push(filePath)
}

async function cleanup() {
  await db.chatAttachmentDeletionJob.deleteMany({ where: { identifier: { contains: prefix } } })
  if (pedidoIds.length) {
    await db.chatMensaje.deleteMany({ where: { pedidoId: { in: pedidoIds } } })
    await db.pedido.deleteMany({ where: { id: { in: pedidoIds } } })
  }
  if (negocioIds.length) {
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  for (const path of localFixturePaths) {
    await unlink(path).catch(() => {})
  }
  for (const dir of localFixtureDirs) {
    await rmdir(dir).catch(() => {})
  }
  const parentDirs = new Set(
    [...localFixturePaths, ...localFixtureDirs].map((p) => join(p, ".."))
  )
  for (const dir of parentDirs) {
    await rmdir(dir).catch(() => {})
  }
}

beforeAll(cleanup)

afterAll(async () => {
  await cleanup()
  const remainingJobs = await db.chatAttachmentDeletionJob.count({ where: { identifier: { contains: prefix } } })
  const remainingPedidos = await db.pedido.count({ where: { id: { in: pedidoIds } } })
  const remainingNegocios = await db.negocio.count({ where: { id: { in: negocioIds } } })
  expect(remainingJobs).toBe(0)
  expect(remainingPedidos).toBe(0)
  expect(remainingNegocios).toBe(0)
})

describe("CHAT-HISTORICAL-ATTACHMENT-RETRY-1 — fallo físico deja el job durable, retry posterior lo cierra", () => {
  test("A-G: attachment histórico elegible, physical delete falla, referencia lógica se sanea, job durable permanece, retry exitoso lo cierra", async () => {
    if (!secret) {
      console.warn("[test] CLEANUP_SECRET no configurado en este entorno — se omite este test puntual")
      return
    }

    const negocio = await ensureNegocio("fail-retry")
    const pedido = await ensurePedido(negocio.id, "fail-retry")
    const target = await writeLocalFixtureFailingTarget(pedido.id, "documento.jpg")

    const mensaje = await db.chatMensaje.create({
      data: {
        pedidoId: pedido.id,
        remitente: "vendedor",
        clienteId: null,
        texto: "TEST_HISTORICAL_RETRY_ATTACHMENT",
        imagenUrl: target.url,
        archivoUrl: null,
        fecha: oldFecha(),
      },
    })

    // RUN 1: el cleanup histórico corre, el borrado físico falla (target es
    // un directorio) — la referencia lógica se sanea igual (contrato
    // explícito: no bloquea el cleanup), pero el job debe quedar durable.
    const res1 = await getChatCleanup(reqCleanup())
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    expect(body1.filesFailed).toBeGreaterThanOrEqual(1)

    const mensajeAfterRun1 = await db.chatMensaje.findUnique({ where: { id: mensaje.id } })
    // C: referencia lógica sanitizada (el mensaje puede sobrevivir con
    // texto no vacío — a diferencia del caso "mensaje vacío" del Step 4).
    expect(mensajeAfterRun1?.imagenUrl).toBeNull()
    expect(mensajeAfterRun1?.texto).toBe("TEST_HISTORICAL_RETRY_ATTACHMENT")

    // D + E: el job durable existe y el identifier (target real) sigue
    // siendo el mismo que se guardó al momento de sanear — sigue siendo
    // recuperable para un reintento futuro sin depender de `ChatMensaje`.
    const jobAfterRun1 = await db.chatAttachmentDeletionJob.findUnique({
      where: {
        provider_resourceType_identifier: {
          provider: "local",
          resourceType: "file",
          identifier: target.identifier,
        },
      },
    })
    expect(jobAfterRun1).not.toBeNull()
    expect(jobAfterRun1?.attempts).toBeGreaterThanOrEqual(1)
    expect(jobAfterRun1?.lastAttemptAt).not.toBeNull()

    // Repara el target (simula que el proveedor de storage vuelve a
    // funcionar) — RETRY_DISCOVERY_SOURCE es el propio outbox, nunca
    // `ChatMensaje` (que ya perdió el puntero desde RUN 1).
    const absoluteDir = join(process.cwd(), "public", "uploads", "chat", pedido.id, "documento.jpg")
    await repairFailingTarget(absoluteDir, target.identifier)

    // F + G: RUN 2 (siguiente ciclo de este mismo cron) resuelve el job y lo cierra.
    const run2 = await processPendingChatAttachmentDeletions()
    expect(run2.deleted).toBeGreaterThanOrEqual(1)

    const jobAfterRun2 = await db.chatAttachmentDeletionJob.findUnique({
      where: {
        provider_resourceType_identifier: {
          provider: "local",
          resourceType: "file",
          identifier: target.identifier,
        },
      },
    })
    expect(jobAfterRun2).toBeNull()
  })

  test("MULTI_RETRY: fail, fail, success — el contador de intentos crece en cada fallo hasta el éxito", async () => {
    if (!secret) return

    const negocio = await ensureNegocio("multi-retry")
    const pedido = await ensurePedido(negocio.id, "multi-retry")
    const target = await writeLocalFixtureFailingTarget(pedido.id, "multi.jpg")

    await db.chatMensaje.create({
      data: {
        pedidoId: pedido.id,
        remitente: "vendedor",
        clienteId: null,
        texto: "TEST_MULTI_RETRY",
        imagenUrl: target.url,
        archivoUrl: null,
        fecha: oldFecha(),
      },
    })

    await getChatCleanup(reqCleanup()) // RUN 1: encola + falla (attempts=1)
    const run2 = await processPendingChatAttachmentDeletions() // RUN 2: falla de nuevo (attempts=2)
    expect(run2.failed).toBeGreaterThanOrEqual(1)

    const jobAfterTwoFailures = await db.chatAttachmentDeletionJob.findUnique({
      where: { provider_resourceType_identifier: { provider: "local", resourceType: "file", identifier: target.identifier } },
    })
    expect(jobAfterTwoFailures?.attempts).toBe(2)

    const absoluteDir = join(process.cwd(), "public", "uploads", "chat", pedido.id, "multi.jpg")
    await repairFailingTarget(absoluteDir, target.identifier)

    const run3 = await processPendingChatAttachmentDeletions() // RUN 3: éxito
    expect(run3.deleted).toBeGreaterThanOrEqual(1)

    const jobAfterRun3 = await db.chatAttachmentDeletionJob.findUnique({
      where: { provider_resourceType_identifier: { provider: "local", resourceType: "file", identifier: target.identifier } },
    })
    expect(jobAfterRun3).toBeNull()
  })
})

describe("CHAT-HISTORICAL-ATTACHMENT-RETRY-1 — no regresión: primer intento exitoso sigue funcionando", () => {
  test("FIRST_ATTEMPT_SUCCESS_PATH: archivo real, borrado exitoso en el primer intento — sin job remanente", async () => {
    if (!secret) return

    const negocio = await ensureNegocio("first-success")
    const pedido = await ensurePedido(negocio.id, "first-success")
    const target = await writeLocalFixtureFile(pedido.id, "exitoso.jpg")

    const mensaje = await db.chatMensaje.create({
      data: {
        pedidoId: pedido.id,
        remitente: "vendedor",
        clienteId: null,
        texto: "",
        imagenUrl: target.url,
        archivoUrl: null,
        fecha: oldFecha(),
      },
    })

    const res = await getChatCleanup(reqCleanup())
    const body = await res.json()
    expect(body.filesDeleted).toBeGreaterThanOrEqual(1)
    expect(body.filesFailed).toBe(0)

    const jobAfter = await db.chatAttachmentDeletionJob.findUnique({
      where: { provider_resourceType_identifier: { provider: "local", resourceType: "file", identifier: target.identifier } },
    })
    expect(jobAfter).toBeNull()

    // Mensaje vacío (texto="") + sin adjuntos ya -> Step 4 lo borra (comportamiento preexistente, sin cambios).
    expect(await db.chatMensaje.findUnique({ where: { id: mensaje.id } })).toBeNull()
  })
})

describe("CHAT-HISTORICAL-ATTACHMENT-RETRY-1 — idempotencia y duplicados", () => {
  test("ALREADY_DELETED_IS_IDEMPOTENT_SUCCESS: target ya inexistente (ENOENT) se trata como éxito, no como fallo", async () => {
    if (!secret) return

    const negocio = await ensureNegocio("notfound")
    const pedido = await ensurePedido(negocio.id, "notfound")
    // Nunca se crea el archivo -> ENOENT determinista, sin tocar storage real.
    const identifier = `uploads/chat/${pedido.id}/no-existe.jpg`

    await db.chatMensaje.create({
      data: {
        pedidoId: pedido.id,
        remitente: "vendedor",
        clienteId: null,
        texto: "TEST_NOTFOUND",
        imagenUrl: `/${identifier}`,
        archivoUrl: null,
        fecha: oldFecha(),
      },
    })

    const res = await getChatCleanup(reqCleanup())
    const body = await res.json()
    expect(body.filesDeleted).toBeGreaterThanOrEqual(1)
    expect(body.filesFailed).toBe(0)

    const job = await db.chatAttachmentDeletionJob.findUnique({
      where: { provider_resourceType_identifier: { provider: "local", resourceType: "file", identifier } },
    })
    expect(job).toBeNull()
  })

  test("DUPLICATE_ENQUEUE_SAFE: dos mensajes distintos con el MISMO target físico sólo generan/dejan pendiente un único job", async () => {
    if (!secret) return

    const negocio = await ensureNegocio("dup")
    const pedidoA = await ensurePedido(negocio.id, "dup-a")
    const pedidoB = await ensurePedido(negocio.id, "dup-b")

    // Mismo pedidoId embebido en el identifier -> resolveOneChatAttachmentTarget
    // sólo acepta URLs de chat/<pedidoId>/... cuyo pedidoId coincide con el
    // pedido real del mensaje, así que para forzar un identifier
    // genuinamente duplicado (mismo provider+resourceType+identifier) se usa
    // el MISMO pedidoId en ambos mensajes (dos filas de Chat legítimas del
    // mismo pedido apuntando al mismo archivo adjunto, ej. reenviado).
    const target = await writeLocalFixtureFailingTarget(pedidoA.id, "compartido.jpg")

    await db.chatMensaje.create({
      data: { pedidoId: pedidoA.id, remitente: "vendedor", clienteId: null, texto: "TEST_DUP_1", imagenUrl: target.url, archivoUrl: null, fecha: oldFecha() },
    })
    await db.chatMensaje.create({
      data: { pedidoId: pedidoA.id, remitente: "vendedor", clienteId: null, texto: "TEST_DUP_2", imagenUrl: target.url, archivoUrl: null, fecha: oldFecha() },
    })

    await getChatCleanup(reqCleanup())

    const jobCount = await db.chatAttachmentDeletionJob.count({
      where: { provider: "local", resourceType: "file", identifier: target.identifier },
    })
    expect(jobCount).toBe(1)

    // Limpieza puntual — pedidoB no se usó para nada más que reservar el slot de fixture tracking.
    void pedidoB
  })
})

describe("CHAT-HISTORICAL-ATTACHMENT-RETRY-1 — privacidad: un job pendiente no reexpone el adjunto", () => {
  test("PENDING_DELETE_REEXPOSES_ATTACHMENT=NO: tras el fallo, GET del chat ya no devuelve la URL del adjunto", async () => {
    if (!secret) return

    const negocio = await ensureNegocio("no-reexpose")
    const pedido = await ensurePedido(negocio.id, "no-reexpose")
    const target = await writeLocalFixtureFailingTarget(pedido.id, "privado.jpg")

    await db.chatMensaje.create({
      data: {
        pedidoId: pedido.id,
        remitente: "vendedor",
        clienteId: null,
        texto: "TEST_NO_REEXPOSE",
        imagenUrl: target.url,
        archivoUrl: null,
        fecha: oldFecha(),
      },
    })

    await getChatCleanup(reqCleanup()) // falla físicamente, job queda pendiente

    const jobPendiente = await db.chatAttachmentDeletionJob.findUnique({
      where: { provider_resourceType_identifier: { provider: "local", resourceType: "file", identifier: target.identifier } },
    })
    expect(jobPendiente).not.toBeNull() // precondición: hay un job pendiente

    const cookie = await cookieForNegocio(negocio.id)
    const res = await getChatMensajes(reqGetMensajes(pedido.id, cookie), { params: Promise.resolve({ pedidoId: pedido.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    const item = body.mensajes.find((m: { texto: string }) => m.texto === "TEST_NO_REEXPOSE")
    expect(item.imagenUrl).toBeNull()
    // El outbox nunca se expone por esta API — sólo cuenta la fila real de ChatMensaje.
    expect(JSON.stringify(body)).not.toContain(target.identifier)
  })
})
