import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  processPendingChatAttachmentDeletions,
  queueChatAttachmentDeletionJobs,
  resolveChatAttachmentDeletionTargets,
} from "@/lib/chat-attachment-deletion"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// GET/POST /api/chat/cleanup
// Deletes chat files (images & PDFs) from Cloudinary
// for messages older than 10 days.
// Called by cron job — requires a secret API key.
//
// Auth options:
//   Header: x-cleanup-secret <value>
//   Query:  ?secret=<value>
//
// Fails closed outside development: if CLEANUP_SECRET isn't configured,
// the endpoint is unavailable rather than silently open.
//
// 19-B0.2D1: además del cleanup histórico por antigüedad de abajo (sin
// cambios en su lógica/cadencia/umbral/selección), este endpoint ahora
// también reintenta el outbox durable de eliminación de cuenta
// (`ChatAttachmentDeletionJob`) — mismo secreto, mismo endpoint, para no
// crear un segundo cron. Un job que falla acá simplemente permanece para el
// próximo ciclo; nunca aborta el cleanup histórico ni viceversa.
//
// CHAT-HISTORICAL-ATTACHMENT-RETRY-1: el cleanup histórico de abajo ahora
// enruta el borrado físico por el MISMO outbox durable (nunca una segunda
// arquitectura) — antes intentaba `cloudinary.uploader.destroy(...)`
// directamente y limpiaba `imagenUrl`/`archivoUrl` sin importar si ese
// intento había fallado, perdiendo para siempre la única referencia
// necesaria para reintentar. Ahora, dentro de una transacción DB corta, se
// encola el job durable ANTES de limpiar los punteros — si el borrado físico
// falla, el job sigue disponible para el próximo ciclo de este mismo cron
// (o cualquier corrida futura de `processPendingChatAttachmentDeletions`),
// exactamente igual que ya garantiza la eliminación de cuenta.
// ============================================

const CLEANUP_DAYS = 10

// Shared cleanup logic — works with both GET and POST
async function runCleanup(req: NextRequest) {
  // Simple auth: require a secret to prevent unauthorized calls
  // Supports both header (x-cleanup-secret) and query param (?secret=)
  const headerSecret = req.headers.get("x-cleanup-secret")
  const querySecret = req.nextUrl.searchParams.get("secret")
  const providedSecret = headerSecret || querySecret

  const isDev = process.env.NODE_ENV === "development"
  const cleanupSecret = process.env.CLEANUP_SECRET

  if (!isDev && !cleanupSecret) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 })
  }

  if (!isDev && providedSecret !== cleanupSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    // ─────────────────────────────────────────────
    // Step 0: Retry pending outbox jobs (19-B0.2D1 — account deletion
    // attachments). Independiente del cleanup histórico de abajo: un fallo
    // acá no afecta al Step 1-4, y viceversa.
    // ─────────────────────────────────────────────
    const outboxResult = await processPendingChatAttachmentDeletions()
    console.log(
      `[Chat Cleanup] Outbox: processed=${outboxResult.processed} deleted=${outboxResult.deleted} failed=${outboxResult.failed}`
    )

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - CLEANUP_DAYS)
    console.log(`[Chat Cleanup] Cutoff: ${cutoff.toISOString()}`)

    // ─────────────────────────────────────────────
    // Step 1: Find messages older than cutoff that still have files
    // ─────────────────────────────────────────────
    // `pedidoId` es indispensable acá (no sólo un campo más): es el mismo
    // dato que `resolveChatAttachmentDeletionTargets` necesita para
    // revalidar cada URL contra su pedido real (misma regla que ya usa la
    // eliminación de cuenta) antes de encolar cualquier job de borrado.
    const oldMessages = await db.chatMensaje.findMany({
      where: {
        fecha: { lt: cutoff },
        OR: [
          { imagenUrl: { not: null } },
          { archivoUrl: { not: null } },
        ],
      },
      select: {
        id: true,
        pedidoId: true,
        imagenUrl: true,
        archivoUrl: true,
      },
    })
    console.log(`[Chat Cleanup] Found ${oldMessages.length} old messages with files`)

    // ─────────────────────────────────────────────
    // Step 2: Encolar los jobs de borrado físico durable y limpiar los
    // punteros de la DB, atómicamente en una transacción corta — MISMO
    // orden y mismo mecanismo que ya usa `deleteClientAccountInTransaction`
    // (src/lib/client-account-deletion.ts): el job se persiste ANTES de que
    // `imagenUrl`/`archivoUrl` (la única fuente para reconstruir el
    // identifier) deje de existir. Nunca se llama a Cloudinary/filesystem
    // dentro de esta transacción — sólo operaciones DB.
    // ─────────────────────────────────────────────
    let queuedTargets = 0
    if (oldMessages.length > 0) {
      await db.$transaction(async (tx) => {
        const targets = oldMessages.flatMap(resolveChatAttachmentDeletionTargets)
        queuedTargets = targets.length
        await queueChatAttachmentDeletionJobs(tx, targets)
        await tx.chatMensaje.updateMany({
          where: { id: { in: oldMessages.map((msg) => msg.id) } },
          data: {
            imagenUrl: null,
            archivoUrl: null,
            archivoNombre: null,
            archivoTipo: null,
          },
        })
      })
      console.log(`[Chat Cleanup] Cleared URLs for ${oldMessages.length} messages`)
    }

    // ─────────────────────────────────────────────
    // Step 3: Intentar el borrado físico ahora (best-effort, fuera de la
    // transacción DB) para los jobs recién encolados — si falla, quedan
    // durables para el próximo ciclo de este mismo cron (Step 0 de arriba),
    // exactamente el mismo patrón best-effort-post-commit que ya usa
    // `deleteClientAccount` (src/lib/client-account-deletion.ts).
    // ─────────────────────────────────────────────
    const historicalOutboxResult =
      queuedTargets > 0 ? await processPendingChatAttachmentDeletions() : null
    const deletedFiles = historicalOutboxResult?.deleted ?? 0
    const failedFiles = historicalOutboxResult?.failed ?? 0

    // ─────────────────────────────────────────────
    // Step 4: Delete messages with no content at all (text + files all null) older than cutoff
    // NOTE: texto is NOT nullable (has @default("")), so we only check for empty string ""
    // ─────────────────────────────────────────────
    const deletedEmpty = await db.chatMensaje.deleteMany({
      where: {
        fecha: { lt: cutoff },
        texto: "",
        imagenUrl: null,
        archivoUrl: null,
      },
    })
    console.log(`[Chat Cleanup] Deleted ${deletedEmpty.count} empty messages`)

    return NextResponse.json({
      success: true,
      outbox: outboxResult,
      cutoff: cutoff.toISOString(),
      messagesProcessed: oldMessages.length,
      filesDeleted: deletedFiles,
      filesFailed: failedFiles,
      emptyMessagesDeleted: deletedEmpty.count,
    })
  } catch (error) {
    // Log the full error so it shows up in Railway logs
    console.error("[Chat Cleanup] Error:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

// Support both GET and POST so cron-job.org works with its default (GET)
export async function GET(req: NextRequest) {
  return runCleanup(req)
}

export async function POST(req: NextRequest) {
  return runCleanup(req)
}
