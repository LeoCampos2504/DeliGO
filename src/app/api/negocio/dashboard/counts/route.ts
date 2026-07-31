import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// Seguridad-6B.3: contadores internos del panel del negocio — nunca cacheables.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

// Lightweight endpoint — returns tab counter values for badge indicators
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })
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

    return NextResponse.json({ activeOrders, resenasSinRespuesta }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Counts error:", error)
    return NextResponse.json(
      { error: "Error al obtener conteos" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
