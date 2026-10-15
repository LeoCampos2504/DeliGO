import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getOperationalAccountFromRequest, getUserFromToken, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, type AuthUser } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

// F4-A fix — which feed a bell reads. The operational cookie has path "/", so
// on a browser shared by the owner and an employee it also reaches the owner's
// panel; choosing the feed by the mere presence of that cookie handed the owner
// the employee feed (or a 401 when that cookie was stale). Each bell now names
// the session it reads (?feed=cuenta = personal/owner session, ?feed=operativo =
// employee session). The parameter only picks WHICH cookie to validate — the
// identity always comes from that validated session and never falls back to the
// other one. Without the parameter (clients cached before this fix) a valid
// personal session wins, otherwise the operational one.
type Feed =
  | { ok: true; kind: "operativo"; employeeIds: string[] }
  | { ok: true; kind: "cuenta"; user: AuthUser }
  | { ok: false; response: NextResponse }

async function resolverFeed(req: NextRequest): Promise<Feed> {
  const pedido = new URL(req.url).searchParams.get("feed")
  if (pedido !== null && pedido !== "operativo" && pedido !== "cuenta") {
    return { ok: false, response: NextResponse.json({ error: "Feed no válido" }, { status: 400 }) }
  }
  const operativo = async () => {
    if (!req.cookies.get(OPERATIONAL_SESSION_COOKIE_NAME)?.value) return null
    const account = await getOperationalAccountFromRequest(req)
    return account ? account.empleados.map((empleado) => empleado.id) : null
  }
  const cuenta = async () => {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    return token ? getUserFromToken(token) : null
  }
  const sinSesion = () => ({ ok: false as const, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) })

  if (pedido === "operativo") {
    const employeeIds = await operativo()
    return employeeIds ? { ok: true, kind: "operativo", employeeIds } : sinSesion()
  }
  const user = await cuenta()
  if (user) return { ok: true, kind: "cuenta", user }
  if (pedido === "cuenta") return sinSesion()
  const employeeIds = await operativo()
  return employeeIds ? { ok: true, kind: "operativo", employeeIds } : sinSesion()
}

// GET /api/notificaciones — List notifications for current user
export async function GET(req: NextRequest) {
  try {
    const feed = await resolverFeed(req)
    if (!feed.ok) return feed.response
    if (feed.kind === "operativo") {
      const employeeIds = feed.employeeIds
      const url = new URL(req.url)
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
      const offset = parseInt(url.searchParams.get("offset") || "0")
      const soloNoLeidos = url.searchParams.get("unread") === "true"
      const where = { userId: { in: employeeIds }, userType: "empleado", ...(soloNoLeidos ? { leido: false } : {}) }
      const [notificaciones, total, noLeidos] = await Promise.all([
        db.notificacion.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
        db.notificacion.count({ where }),
        db.notificacion.count({ where: { userId: { in: employeeIds }, userType: "empleado", leido: false } }),
      ])
      return NextResponse.json({ notificaciones, total, noLeidos })
    }

    const user = feed.user

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
    console.error("Error fetching notifications:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener notificaciones" }, { status: 500 })
  }
}

// PATCH /api/notificaciones — Mark notifications as read
export async function PATCH(req: NextRequest) {
  try {
    const feed = await resolverFeed(req)
    if (!feed.ok) return feed.response
    if (feed.kind === "operativo") {
      const employeeIds = feed.employeeIds
      const body = await req.json()
      const { action, notificationId } = body as { action: "mark_read" | "mark_all_read"; notificationId?: string }
      if (action === "mark_read" && notificationId) {
        const notif = await db.notificacion.findFirst({ where: { id: notificationId, userType: "empleado", userId: { in: employeeIds } } })
        if (!notif) return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 })
        await db.notificacion.update({ where: { id: notificationId }, data: { leido: true } })
        const noLeidos = await db.notificacion.count({ where: { userId: { in: employeeIds }, userType: "empleado", leido: false } })
        return NextResponse.json({ ok: true, noLeidos })
      }
      if (action === "mark_all_read") {
        await db.notificacion.updateMany({ where: { userId: { in: employeeIds }, userType: "empleado", leido: false }, data: { leido: true } })
        return NextResponse.json({ ok: true, noLeidos: 0 })
      }
      return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
    }

    const user = feed.user

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
    console.error("Error updating notifications:", safeErrorForLog(error))
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
    console.error("Error deleting notifications:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al eliminar notificaciones" }, { status: 500 })
  }
}
