// DeliGO - SQLite Database Backup Script
// Usage: bunx tsx scripts/backup-db.ts
// Can be run via cron job for automatic backups

import { copyFile, mkdir, readdir, stat, unlink } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") || "./db/custom.db"
const BACKUP_DIR = join(process.cwd(), "backups")
const MAX_BACKUPS = 30 // Keep 30 days of backups
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)

async function backup() {
  try {
    // Ensure backup directory exists
    if (!existsSync(BACKUP_DIR)) {
      await mkdir(BACKUP_DIR, { recursive: true })
    }

    const sourcePath = DB_PATH.startsWith("/") ? DB_PATH : join(process.cwd(), DB_PATH)
    
    if (!existsSync(sourcePath)) {
      console.error(`❌ Database not found at: ${sourcePath}`)
      process.exit(1)
    }

    // Create backup filename with timestamp
    const backupFilename = `deligo-backup-${TIMESTAMP}.db`
    const backupPath = join(BACKUP_DIR, backupFilename)

    // Copy the database file
    await copyFile(sourcePath, backupPath)
    
    const size = await stat(backupPath)
    const sizeMB = (size.size / (1024 * 1024)).toFixed(2)
    
    console.log(`✅ Backup created: ${backupFilename} (${sizeMB} MB)`)

    // Clean up old backups (keep only MAX_BACKUPS)
    const files = await readdir(BACKUP_DIR)
    const backups = files
      .filter(f => f.startsWith("deligo-backup-") && f.endsWith(".db"))
      .sort()
      .reverse() // newest first

    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS)
      for (const file of toDelete) {
        await unlink(join(BACKUP_DIR, file))
        console.log(`🗑️  Deleted old backup: ${file}`)
      }
    }

    console.log(`📁 Total backups: ${Math.min(backups.length, MAX_BACKUPS)}`)
  } catch (error) {
    console.error("❌ Backup failed:", error)
    process.exit(1)
  }
}

backup()
