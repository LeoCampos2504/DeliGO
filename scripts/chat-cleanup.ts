/**
 * Chat Cleanup Script
 * 
 * Run daily via cron to delete chat files (images & PDFs) from Cloudinary
 * for messages older than 10 days, then clear the URLs from the database.
 * 
 * Usage:
 *   bun scripts/chat-cleanup.ts
 * 
 * Or add to crontab for daily execution at 3 AM:
 *   0 3 * * * cd /path/to/project && bun scripts/chat-cleanup.ts >> logs/cleanup.log 2>&1
 */

const CLEANUP_SECRET = process.env.CLEANUP_SECRET || ""
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

async function main() {
  console.log(`[${new Date().toISOString()}] Starting chat cleanup...`)

  try {
    const res = await fetch(`${BASE_URL}/api/chat/cleanup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(CLEANUP_SECRET ? { "x-cleanup-secret": CLEANUP_SECRET } : {}),
      },
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("Cleanup failed:", data)
      process.exit(1)
    }

    console.log("Cleanup result:", JSON.stringify(data, null, 2))
    console.log(`[${new Date().toISOString()}] Cleanup completed.`)
  } catch (error) {
    console.error("Cleanup error:", error)
    process.exit(1)
  }
}

main()
