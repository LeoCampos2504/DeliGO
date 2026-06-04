import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// POST /api/push/unsubscribe — Remove push subscription for the current user
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    // Remove subscription based on user type
    switch (user.type) {
      case "cliente":
        await db.cliente.update({
          where: { id: user.id },
          data: { pushSubscription: null },
        })
        break
      case "negocio":
        await db.negocio.update({
          where: { id: user.id },
          data: { pushSubscription: null },
        })
        break
      case "repartidor":
        await db.repartidor.update({
          where: { id: user.id },
          data: { pushSubscription: null },
        })
        break
      case "superadmin":
        await db.superAdmin.update({
          where: { id: user.id },
          data: { pushSubscription: null },
        })
        break
      default:
        return NextResponse.json(
          { error: "Tipo de usuario no soportado" },
          { status: 400 }
        )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error removing push subscription:", error)
    return NextResponse.json(
      { error: "Error al eliminar la suscripción" },
      { status: 500 }
    )
  }
}
