import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { mkdir, readdir, stat, unlink, writeFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

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

    const BACKUP_DIR = join(process.cwd(), "backups")
    const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)

    if (!existsSync(BACKUP_DIR)) {
      await mkdir(BACKUP_DIR, { recursive: true })
    }

    const DATABASE_URL = process.env.DATABASE_URL || ""
    const isPostgres = DATABASE_URL.startsWith("postgresql://") || DATABASE_URL.startsWith("postgres://")

    let backupFilename: string
    let backupPath: string

    if (isPostgres) {
      // PostgreSQL: use pg_dump to create a SQL dump
      backupFilename = `deligo-backup-${TIMESTAMP}.sql`
      backupPath = join(BACKUP_DIR, backupFilename)

      try {
        // Use pg_dump with the DATABASE_URL
        // The --no-password flag avoids prompts; set PGPASSWORD env if needed
        const urlObj = new URL(DATABASE_URL)
        const PGPASSWORD = urlObj.password || ""
        const env = { ...process.env, PGPASSWORD }

        await execAsync(
          `pg_dump "${DATABASE_URL}" --no-owner --no-privileges -F p -f "${backupPath}"`,
          { env, timeout: 60000 }
        )
      } catch (pgError) {
        // If pg_dump is not available, create a JSON export using Prisma
        console.warn("[Backup] pg_dump failed, falling back to JSON export:", pgError)
        backupFilename = `deligo-backup-${TIMESTAMP}.json`
        backupPath = join(BACKUP_DIR, backupFilename)

        // Export all tables as JSON
        const tables = [
          "clientes", "negocios", "productos", "pedidos", "pedido_items",
          "repartidores", "super_admins", "sesiones", "resenas",
          "chat_mensajes", "favoritos", "direcciones", "promociones",
          "mesas", "empleados", "config_plataforma", "deuda_historial",
          "pedido_eventos", "repartidor_negocios", "agregados", "ingredientes",
          "producto_agregados", "producto_ingredientes", "secciones_catalogo",
          "seccion_productos", "opciones_compartidas", "audit_logs",
        ]

        const exportData: Record<string, unknown[]> = {}
        for (const table of tables) {
          try {
            const rows = await db.$queryRawUnsafe(`SELECT * FROM ${table}`)
            exportData[table] = rows as unknown[]
          } catch {
            // Table might not exist, skip
          }
        }

        await writeFile(backupPath, JSON.stringify(exportData, null, 2), "utf-8")
      }
    } else {
      // SQLite: file copy (legacy support)
      const DB_PATH = DATABASE_URL.replace("file:", "") || "./db/custom.db"
      const sourcePath = DB_PATH.startsWith("/") ? DB_PATH : join(process.cwd(), DB_PATH)
      backupFilename = `deligo-backup-${TIMESTAMP}.db`
      backupPath = join(BACKUP_DIR, backupFilename)

      const { copyFile } = await import("fs/promises")
      await copyFile(sourcePath, backupPath)
    }

    const size = await stat(backupPath)
    const sizeMB = (size.size / (1024 * 1024)).toFixed(2)

    // Clean up old backups (keep 30)
    const files = await readdir(BACKUP_DIR)
    const backups = files
      .filter(f => f.startsWith("deligo-backup-") && (f.endsWith(".sql") || f.endsWith(".db") || f.endsWith(".json")))
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
      .filter(f => f.startsWith("deligo-backup-") && (f.endsWith(".sql") || f.endsWith(".db") || f.endsWith(".json")))
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
