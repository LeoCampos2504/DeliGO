import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET /api/notificaciones — List notifications for current user
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
    const offset = parseInt(url.searchParams.get("offset") || "0")
    const soloNoLeidos = url.searchParams.get("unread") === "true"

    const where = {
      userId: user.id,
      userType: user.type,
      ...(soloNoLeidos ? { leido: false } : {}),
    }

    const [notificaciones, total, noLeidos] = await Promise.all([
      db.notificacion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.notificacion.count({ where }),
      db.notificacion.count({
        where: { userId: user.id, userType: user.type, leido: false },
      }),
    ])

    return NextResponse.json({
      notificaciones,
      total,
      noLeidos,
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json({ error: "Error al obtener notificaciones" }, { status: 500 })
  }
}

// PATCH /api/notificaciones — Mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    const body = await req.json()
    const { action, notificationId } = body as {
      action: "mark_read" | "mark_all_read"
      notificationId?: string
    }

    if (action === "mark_read" && notificationId) {
      // Mark a single notification as read
      const notif = await db.notificacion.findUnique({
        where: { id: notificationId },
      })

      if (!notif || notif.userId !== user.id || notif.userType !== user.type) {
        return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 })
      }

      await db.notificacion.update({
        where: { id: notificationId },
        data: { leido: true },
      })

      const noLeidos = await db.notificacion.count({
        where: { userId: user.id, userType: user.type, leido: false },
      })

      return NextResponse.json({ ok: true, noLeidos })
    }

    if (action === "mark_all_read") {
      // Mark all notifications as read for this user
      await db.notificacion.updateMany({
        where: {
          userId: user.id,
          userType: user.type,
          leido: false,
        },
        data: { leido: true },
      })

      return NextResponse.json({ ok: true, noLeidos: 0 })
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
  } catch (error) {
    console.error("Error updating notifications:", error)
    return NextResponse.json({ error: "Error al actualizar notificaciones" }, { status: 500 })
  }
}

// DELETE /api/notificaciones — Delete old notifications
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    const body = await req.json()
    const { notificationId, olderThanDays } = body as {
      notificationId?: string
      olderThanDays?: number
    }

    if (notificationId) {
      const notif = await db.notificacion.findUnique({
        where: { id: notificationId },
      })
      if (!notif || notif.userId !== user.id || notif.userType !== user.type) {
        return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 })
      }
      await db.notificacion.delete({ where: { id: notificationId } })
      return NextResponse.json({ ok: true })
    }

    if (olderThanDays) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - olderThanDays)
      await db.notificacion.deleteMany({
        where: {
          userId: user.id,
          userType: user.type,
          leido: true,
          createdAt: { lt: cutoff },
        },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Parámetros no válidos" }, { status: 400 })
  } catch (error) {
    console.error("Error deleting notifications:", error)
    return NextResponse.json({ error: "Error al eliminar notificaciones" }, { status: 500 })
  }
}
