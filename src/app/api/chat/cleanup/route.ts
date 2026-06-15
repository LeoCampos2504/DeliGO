import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { cloudinary, extractPublicId } from "@/lib/cloudinary"

// ============================================
// POST /api/chat/cleanup
// Deletes chat files (images & PDFs) from Cloudinary
// for messages older than 10 days.
// Called by cron job — requires a secret API key.
// ============================================

const CLEANUP_DAYS = 10

export async function POST(req: NextRequest) {
  // Simple auth: require a secret header to prevent unauthorized calls
  const secret = req.headers.get("x-cleanup-secret")
  if (secret !== process.env.CLEANUP_SECRET && process.env.CLEANUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - CLEANUP_DAYS)

    // Find messages older than cutoff that still have files
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

    let deletedFiles = 0
    let failedFiles = 0
    const updatedMessageIds: string[] = []

    for (const msg of oldMessages) {
      // Delete image from Cloudinary
      if (msg.imagenUrl) {
        const publicId = extractPublicId(msg.imagenUrl)
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId)
            deletedFiles++
          } catch {
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
            } catch {
              failedFiles++
            }
          }
        }
      }

      updatedMessageIds.push(msg.id)
    }

    // Clear the URLs from the DB so we don't try to delete them again
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
    }

    // Also delete messages with no content at all (text + files all null) older than cutoff
    const deletedEmpty = await db.chatMensaje.deleteMany({
      where: {
        fecha: { lt: cutoff },
        texto: { or: [{ equals: "" }, { equals: null }] },
        imagenUrl: null,
        archivoUrl: null,
      },
    })

    return NextResponse.json({
      success: true,
      cutoff: cutoff.toISOString(),
      messagesProcessed: oldMessages.length,
      filesDeleted: deletedFiles,
      filesFailed: failedFiles,
      emptyMessagesDeleted: deletedEmpty.count,
    })
  } catch (error) {
    console.error("[Chat Cleanup] Error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
