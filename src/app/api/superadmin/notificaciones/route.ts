import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"

function response(data: unknown, init?: ResponseInit) {
  const result = NextResponse.json(data, init)
  result.headers.set("Cache-Control", "private, no-store")
  return result
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperadminSession(req)
    if (!auth.ok) return response({ error: "No autenticado" }, { status: 401 })
    const url = new URL(req.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 100)
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0)
    if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(offset)) return response({ error: "Parámetros inválidos" }, { status: 400 })
    const where = { userId: auth.admin.id, userType: "superadmin" }
    const [notificaciones, noLeidos] = await Promise.all([
      db.notificacion.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
      db.notificacion.count({ where: { ...where, leido: false } }),
    ])
    return response({ notificaciones, noLeidos })
  } catch (error) {
    console.error("Error getting superadmin notifications:", error)
    return response({ error: "Error interno del servidor" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireSuperadminSession(req)
    if (!auth.ok) return response({ error: "No autenticado" }, { status: 401 })
    const body = await req.json().catch(() => null) as { action?: string; notificationId?: string } | null
    if (!body || (body.action !== "mark_read" && body.action !== "mark_all_read")) return response({ error: "Acción inválida" }, { status: 400 })
    const where = { userId: auth.admin.id, userType: "superadmin" }
    if (body.action === "mark_read") {
      if (!body.notificationId || typeof body.notificationId !== "string") return response({ error: "Acción inválida" }, { status: 400 })
      const changed = await db.notificacion.updateMany({ where: { ...where, id: body.notificationId }, data: { leido: true } })
      if (changed.count !== 1) return response({ error: "Notificación no encontrada" }, { status: 404 })
    } else {
      await db.notificacion.updateMany({ where: { ...where, leido: false }, data: { leido: true } })
    }
    const noLeidos = await db.notificacion.count({ where: { ...where, leido: false } })
    return response({ ok: true, noLeidos })
  } catch (error) {
    console.error("Error updating superadmin notifications:", error)
    return response({ error: "Error interno del servidor" }, { status: 500 })
  }
}
