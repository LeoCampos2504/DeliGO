import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { copyFile, mkdir, readdir, stat, unlink } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function POST(request: NextRequest) {
  try {
    // Verify superadmin
    const token = request.cookies.get("deligo_session")?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const session = await db.sesion.findUnique({ where: { token } })
    if (!session || session.userType !== "superadmin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") || "./db/custom.db"
    const BACKUP_DIR = join(process.cwd(), "backups")
    const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)

    if (!existsSync(BACKUP_DIR)) {
      await mkdir(BACKUP_DIR, { recursive: true })
    }

    const sourcePath = DB_PATH.startsWith("/") ? DB_PATH : join(process.cwd(), DB_PATH)
    const backupFilename = `deligo-backup-${TIMESTAMP}.db`
    const backupPath = join(BACKUP_DIR, backupFilename)

    await copyFile(sourcePath, backupPath)
    
    const size = await stat(backupPath)
    const sizeMB = (size.size / (1024 * 1024)).toFixed(2)

    // Clean up old backups (keep 30)
    const files = await readdir(BACKUP_DIR)
    const backups = files
      .filter(f => f.startsWith("deligo-backup-") && f.endsWith(".db"))
      .sort()
      .reverse()

    if (backups.length > 30) {
      const toDelete = backups.slice(30)
      for (const file of toDelete) {
        await unlink(join(BACKUP_DIR, file))
      }
    }

    return NextResponse.json({
      success: true,
      backup: backupFilename,
      size: `${sizeMB} MB`,
      totalBackups: Math.min(backups.length, 30),
    })
  } catch (error) {
    console.error("[Backup] Error:", error)
    return NextResponse.json({ error: "Error al crear backup" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify superadmin
    const token = request.cookies.get("deligo_session")?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const session = await db.sesion.findUnique({ where: { token } })
    if (!session || session.userType !== "superadmin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const BACKUP_DIR = join(process.cwd(), "backups")
    
    if (!existsSync(BACKUP_DIR)) {
      return NextResponse.json({ backups: [] })
    }

    const files = await readdir(BACKUP_DIR)
    const backups = files
      .filter(f => f.startsWith("deligo-backup-") && f.endsWith(".db"))
      .sort()
      .reverse()

    const backupInfo = await Promise.all(
      backups.slice(0, 30).map(async (f) => {
        const info = await stat(join(BACKUP_DIR, f))
        return {
          filename: f,
          size: `${(info.size / (1024 * 1024)).toFixed(2)} MB`,
          date: info.mtime.toISOString(),
        }
      })
    )

    return NextResponse.json({ backups: backupInfo })
  } catch (error) {
    console.error("[Backup] Error listing:", error)
    return NextResponse.json({ error: "Error al listar backups" }, { status: 500 })
  }
}
