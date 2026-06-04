import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET — Mozo order statistics for the authenticated negocio
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

    const negocioId = user.id

    // Get all mozos (active and inactive)
    const mozos = await db.$queryRaw<
      Array<{ id: string; nombre: string; codigo: string }>
    >`SELECT id, nombre, codigo FROM empleados WHERE negocioId = ${negocioId}`

    // Today's date range
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const stats = await Promise.all(mozos.map(async (mozo) => {
      const totalPedidos = await db.pedido.count({
        where: { negocioId, empleadoId: mozo.id },
      })
      const pedidosHoy = await db.pedido.count({
        where: { negocioId, empleadoId: mozo.id, fecha: { gte: startOfDay } },
      })
      return {
        id: mozo.id,
        nombre: mozo.nombre,
        codigo: mozo.codigo,
        totalPedidos,
        pedidosHoy,
      }
    }))

    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Error getting mozo stats:", error)
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
  }
}
