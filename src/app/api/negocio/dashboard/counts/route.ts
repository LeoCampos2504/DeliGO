import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// Lightweight endpoint — returns tab counter values for badge indicators
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id

    const estadosActivos = ["recibido", "preparando", "en_camino", "listo_para_retirar"]

    const [activeOrders, resenasSinRespuesta] = await Promise.all([
      // Active delivery/pickup orders (mesa orders shown separately in Salon tab)
      db.pedido.count({
        where: {
          negocioId,
          estado: { in: estadosActivos },
          metodoEntrega: { not: "mesa" },
        },
      }),
      // Reviews without business response — these need attention
      db.resena.count({
        where: { negocioId, respuestaNegocio: null },
      }),
    ])

    return NextResponse.json({ activeOrders, resenasSinRespuesta })
  } catch (error) {
    console.error("Counts error:", error)
    return NextResponse.json(
      { error: "Error al obtener conteos" },
      { status: 500 }
    )
  }
}
