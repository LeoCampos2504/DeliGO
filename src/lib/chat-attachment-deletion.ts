import { unlink } from "fs/promises"
import { join, resolve, sep } from "path"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { cloudinary, extractPublicId } from "@/lib/cloudinary"
import { validateChatImageUrl, validateChatPdfUrl } from "@/lib/resource-url"

// ============================================
// 19-B0.2D1 — Sentinel centralizado de texto de Chat
// ============================================
// Único literal en todo el repo — nunca duplicar este string en otro
// archivo. Reemplaza `texto` de mensajes del Cliente al eliminar su cuenta.
// Neutral a propósito: no revela que la cuenta fue eliminada, no menciona
// denuncia/moderación, no afirma que el propio Cliente borró el mensaje.
export const DELETED_CLIENT_CHAT_MESSAGE_TEXT = "Mensaje no disponible"

// ============================================
// Defensa en profundidad de lectura (19-B0.2D1)
// ============================================
// La sanitización real ocurre en `deleteClientAccountInTransaction`, pero
// esta máscara protege además: (a) cuentas eliminadas ANTES de que este
// campo existiera (esas filas ya tienen `clienteId=null` pero conservan
// `texto`/adjuntos originales sin sanitizar — no se corrige con una
// migración de datos retroactiva, se enmascara en lectura), (b) cualquier
// inconsistencia futura entre el estado de DB y lo esperado. Nunca se
// aplica a mensajes de cuentas activas (`clienteId` real) ni a mensajes de
// `remitente !== "cliente"`.
export function sanitizeDeletedClientChatMessageForRead<
  T extends {
    remitente: string
    clienteId: string | null
    texto: string | null
    imagenUrl: string | null
    archivoUrl: string | null
    archivoNombre?: string | null
    archivoTipo?: string | null
  },
>(mensaje: T): T {
  if (mensaje.remitente !== "cliente" || mensaje.clienteId !== null) return mensaje
  return {
    ...mensaje,
    texto: DELETED_CLIENT_CHAT_MESSAGE_TEXT,
    imagenUrl: null,
    archivoUrl: null,
    ...("archivoNombre" in mensaje ? { archivoNombre: null } : {}),
    ...("archivoTipo" in mensaje ? { archivoTipo: null } : {}),
  }
}

// ============================================
// Resolución de target de borrado (Cloudinary o filesystem local)
// ============================================
// Nunca inventa un parser nuevo: revalida con los MISMOS validadores ya
// usados al guardar el adjunto (validateChatImageUrl/validateChatPdfUrl,
// src/lib/resource-url.ts) y con extractPublicId (src/lib/cloudinary.ts).
// Si el valor almacenado no puede revalidarse contra el pedidoId real, NO
// se crea job ni se intenta ningún borrado heurístico — el adjunto
// simplemente deja de exponerse (el DB pointer igual se limpia en el
// updateMany principal), pero no bloquea la eliminación de cuenta.

export type ChatAttachmentDeletionTarget = {
  provider: "cloudinary" | "local"
  resourceType: string
  identifier: string
}

const LOCAL_UPLOADS_PREFIX = "/uploads/"

function resolveOneChatAttachmentTarget(
  url: string,
  pedidoId: string,
  kind: "imagen" | "archivo"
): ChatAttachmentDeletionTarget | null {
  const validated = kind === "imagen"
    ? validateChatImageUrl(url, pedidoId)
    : validateChatPdfUrl(url, pedidoId)
  if (!validated.ok) return null

  const value = validated.value
  if (value.startsWith("/")) {
    if (!value.startsWith(LOCAL_UPLOADS_PREFIX)) return null
    // Path relativo a `public/`, sin la barra inicial — nunca la URL
    // completa ni una ruta absoluta de filesystem.
    return { provider: "local", resourceType: "file", identifier: value.slice(1) }
  }

  const publicId = extractPublicId(value)
  if (!publicId) return null
  return {
    provider: "cloudinary",
    resourceType: kind === "imagen" ? "image" : "raw",
    identifier: publicId,
  }
}

/** Resuelve los targets de borrado (0, 1 o 2) de un ChatMensaje ya leído de DB. */
export function resolveChatAttachmentDeletionTargets(mensaje: {
  pedidoId: string
  imagenUrl: string | null
  archivoUrl: string | null
}): ChatAttachmentDeletionTarget[] {
  const targets: ChatAttachmentDeletionTarget[] = []
  if (mensaje.imagenUrl) {
    const target = resolveOneChatAttachmentTarget(mensaje.imagenUrl, mensaje.pedidoId, "imagen")
    if (target) targets.push(target)
  }
  if (mensaje.archivoUrl) {
    const target = resolveOneChatAttachmentTarget(mensaje.archivoUrl, mensaje.pedidoId, "archivo")
    if (target) targets.push(target)
  }
  return targets
}

/**
 * Encola jobs de borrado durable dentro de la MISMA transacción que sanitiza
 * el Chat — si la transacción de eliminación de cuenta hace rollback, los
 * jobs tampoco quedan creados. `skipDuplicates` evita filas duplicadas para
 * el mismo asset físico (dedupe por provider+resourceType+identifier).
 */
export async function queueChatAttachmentDeletionJobs(
  tx: Prisma.TransactionClient,
  targets: ChatAttachmentDeletionTarget[]
): Promise<void> {
  if (targets.length === 0) return
  await tx.chatAttachmentDeletionJob.createMany({
    data: targets,
    skipDuplicates: true,
  })
}

// ============================================
// Borrado físico (best-effort, nunca bloqueante)
// ============================================

type DeleteOutcome = "deleted" | "not_found" | "failed"

async function destroyCloudinaryTarget(resourceType: string, identifier: string): Promise<DeleteOutcome> {
  try {
    const response = await cloudinary.uploader.destroy(identifier, { resource_type: resourceType })
    if (response?.result === "ok") return "deleted"
    if (response?.result === "not found") return "not_found"
    return "failed"
  } catch {
    return "failed"
  }
}

// Root permitido: exclusivamente `<repo>/public/uploads/chat`. `path.resolve`
// + comprobación de contención evita cualquier path traversal, incluso si
// `identifier` llegara corrompido — nunca confía únicamente en el prefijo
// de string.
async function destroyLocalTarget(identifier: string): Promise<DeleteOutcome> {
  const allowedRoot = resolve(join(process.cwd(), "public", "uploads", "chat"))
  const resolvedPath = resolve(join(process.cwd(), "public", identifier))
  const withinRoot = resolvedPath === allowedRoot || resolvedPath.startsWith(allowedRoot + sep)
  if (!withinRoot) return "failed"

  try {
    await unlink(resolvedPath)
    return "deleted"
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return "not_found"
    return "failed"
  }
}

async function destroyTarget(target: { provider: string; resourceType: string; identifier: string }): Promise<DeleteOutcome> {
  if (target.provider === "cloudinary") return destroyCloudinaryTarget(target.resourceType, target.identifier)
  if (target.provider === "local") return destroyLocalTarget(target.identifier)
  return "failed"
}

export interface ChatAttachmentDeletionProcessResult {
  processed: number
  deleted: number
  failed: number
  pending: number
}

/**
 * Procesa jobs pendientes del outbox: éxito o "not found" (idempotente) →
 * borra el job; fallo transitorio → incrementa `attempts`/`lastAttemptAt` y
 * el job permanece para el próximo ciclo. Nunca lanza información sensible
 * (identifier/publicId/URL) — sólo conteos agregados. Seguro ante
 * ejecuciones concurrentes: `destroy` es idempotente y borrar un job ya
 * borrado por otra ejecución simplemente afecta 0 filas, sin error.
 */
export async function processPendingChatAttachmentDeletions(
  limit = 200
): Promise<ChatAttachmentDeletionProcessResult> {
  const jobs = await db.chatAttachmentDeletionJob.findMany({
    orderBy: { createdAt: "asc" },
    take: limit,
  })

  let deleted = 0
  let failed = 0

  for (const job of jobs) {
    const outcome = await destroyTarget(job)
    if (outcome === "deleted" || outcome === "not_found") {
      await db.chatAttachmentDeletionJob.deleteMany({ where: { id: job.id } })
      deleted++
    } else {
      await db.chatAttachmentDeletionJob.updateMany({
        where: { id: job.id },
        data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
      })
      failed++
    }
  }

  const pending = await db.chatAttachmentDeletionJob.count()

  return { processed: jobs.length, deleted, failed, pending }
}
