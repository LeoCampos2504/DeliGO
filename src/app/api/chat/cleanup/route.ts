import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cloudinary, extractPublicId } from "@/lib/cloudinary"

// ============================================
// GET/POST /api/chat/cleanup
// Deletes chat files (images & PDFs) from Cloudinary
// for messages older than 10 days.
// Called by cron job — requires a secret API key.
//
// Auth options:
//   Header: x-cleanup-secret <value>
//   Query:  ?secret=<value>
// ============================================

const CLEANUP_DAYS = 10

// Shared cleanup logic — works with both GET and POST
async function runCleanup(req: NextRequest) {
  // Simple auth: require a secret to prevent unauthorized calls
  // Supports both header (x-cleanup-secret) and query param (?secret=)
  const headerSecret = req.headers.get("x-cleanup-secret")
  const querySecret = req.nextUrl.searchParams.get("secret")
  const providedSecret = headerSecret || querySecret

  if (process.env.CLEANUP_SECRET && providedSecret !== process.env.CLEANUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - CLEANUP_DAYS)
    console.log(`[Chat Cleanup] Cutoff: ${cutoff.toISOString()}`)

    // ─────────────────────────────────────────────
    // Step 1: Find messages older than cutoff that still have files
    // ─────────────────────────────────────────────
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
        imagenUrl: true,
        archivoUrl: true,
      },
    })
    console.log(`[Chat Cleanup] Found ${oldMessages.length} old messages with files`)

    let deletedFiles = 0
    let failedFiles = 0
    const updatedMessageIds: string[] = []

    // ─────────────────────────────────────────────
    // Step 2: Delete each file from Cloudinary
    // ─────────────────────────────────────────────
    for (const msg of oldMessages) {
      // Delete image from Cloudinary
      if (msg.imagenUrl) {
        const publicId = extractPublicId(msg.imagenUrl)
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId)
            deletedFiles++
          } catch (err) {
            console.error(`[Chat Cleanup] Failed to delete image ${publicId}:`, err)
            failedFiles++
          }
        }
      }

      // Delete file (PDF) from Cloudinary
      if (msg.archivoUrl) {
        const publicId = extractPublicId(msg.archivoUrl)
        if (publicId) {
          try {
            // PDFs uploaded as "raw" need resource_type: "raw" for deletion
            await cloudinary.uploader.destroy(publicId, { resource_type: "raw" })
            deletedFiles++
          } catch {
            // Try as image in case it was uploaded that way
            try {
              await cloudinary.uploader.destroy(publicId, { resource_type: "image" })
              deletedFiles++
            } catch (err) {
              console.error(`[Chat Cleanup] Failed to delete file ${publicId}:`, err)
              failedFiles++
            }
          }
        }
      }

      updatedMessageIds.push(msg.id)
    }

    // ─────────────────────────────────────────────
    // Step 3: Clear the URLs from the DB so we don't try to delete them again
    // ─────────────────────────────────────────────
    if (updatedMessageIds.length > 0) {
      await db.chatMensaje.updateMany({
        where: { id: { in: updatedMessageIds } },
        data: {
          imagenUrl: null,
          archivoUrl: null,
          archivoNombre: null,
          archivoTipo: null,
        },
      })
      console.log(`[Chat Cleanup] Cleared URLs for ${updatedMessageIds.length} messages`)
    }

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
      cutoff: cutoff.toISOString(),
      messagesProcessed: oldMessages.length,
      filesDeleted: deletedFiles,
      filesFailed: failedFiles,
      emptyMessagesDeleted: deletedEmpty.count,
    })
  } catch (error) {
    // Log the full error so it shows up in Railway logs
    console.error("[Chat Cleanup] Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Error interno", details: errorMessage },
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
