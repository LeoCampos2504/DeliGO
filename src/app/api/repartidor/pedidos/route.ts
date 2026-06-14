import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// Helper to parse JSON fields safely
function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

// GET - Get orders for repartidor
// ?filter=disponibles → pending orders (no repartidor assigned yet)
// ?filter=mios → orders accepted by this repartidor
// ?filter=all (default) → both
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const filter = req.nextUrl.searchParams.get("filter") || "all"

    // Get all associated negocio IDs — only from negocios that still offer delivery
    const asociaciones = await db.repartidorNegocio.findMany({
      where: { 
        repartidorId: user.id,
        negocio: { ofreceDelivery: true, suspendido: false }
      },
      select: { negocioId: true },
    })

    const negocioIds = asociaciones.map((a) => a.negocioId)

    if (negocioIds.length === 0) {
      return NextResponse.json({ pedidos: [], disponibles: [], mios: [] })
    }

    // Build where clause based on filter
    let where: any = {
      negocioId: { in: negocioIds },
      metodoEntrega: "domicilio",
    }

    if (filter === "disponibles") {
      // Pending orders: en_camino + no repartidor assigned
      where.estado = "en_camino"
      where.repartidorId = null
    } else if (filter === "mios") {
      // My orders: accepted by this repartidor, still active
      where.estado = { in: ["en_camino", "listo_para_retirar"] }
      where.repartidorId = user.id
    } else {
      // All: both available and mine
      where.OR = [
        {
          estado: "en_camino",
          repartidorId: null,
        },
        {
          estado: { in: ["en_camino", "listo_para_retirar"] },
          repartidorId: user.id,
        },
      ]
      delete where.estado
    }

    const pedidos = await db.pedido.findMany({
      where,
      include: {
        items: {
          include: {
            producto: {
              select: { id: true, nombre: true, imagenUrl: true },
            },
          },
        },
        negocio: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            logoUrl: true,
            colorPrincipal: true,
          },
        },
      },
      orderBy: { fecha: "desc" },
    })

    const pedidosParsed = pedidos.map(({ clienteTelefono, ...p }) => ({
      ...p,
      items: p.items.map((item) => ({
        ...item,
        agregados: safeParseJSON(item.agregados, []),
        secciones: safeParseJSON(item.secciones, {}),
        seccionesPrecios: safeParseJSON(item.seccionesPrecios, {}),
        ingredientes: safeParseJSON(item.ingredientes, []),
        ingredientesQuitados: safeParseJSON(item.ingredientesQuitados, []),
      })),
    }))

    // Separate into categories for the frontend
    const disponibles = pedidosParsed.filter((p: any) => !p.repartidorId)
    const mios = pedidosParsed.filter((p: any) => p.repartidorId === user.id)

    return NextResponse.json({
      pedidos: pedidosParsed,
      disponibles,
      mios,
    })
  } catch (error) {
    console.error("Error getting repartidor pedidos:", error)
    return NextResponse.json({ error: "Error al obtener pedidos" }, { status: 500 })
  }
}
