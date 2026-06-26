import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseAuthorizationBearer } from "@/lib/access-tokens"

// Helper to parse JSON fields safely
function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value
}

const ESTADOS_ACTIVOS = ["recibido", "preparando", "en_camino", "listo_para_retirar"]
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Validate access token — supports shared empleados token and legacy empleado tokens
async function validateAccess(token: string): Promise<{ negocioId: string } | null> {
  if (!token) return null

  const negocio = await db.negocio.findFirst({
    where: { tokenEmpleados: token },
    select: { id: true },
  })
  return negocio ? { negocioId: negocio.id } : null
}

// GET /api/empleado/pedidos — List orders for the negocio
export async function GET(req: NextRequest) {
  try {
    const token = parseAuthorizationBearer(req.headers.get("authorization"))
    if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 401, headers: NO_STORE_HEADERS })

    const access = await validateAccess(token)
    if (!access) return NextResponse.json({ error: "Token invalido" }, { status: 401, headers: NO_STORE_HEADERS })

    const negocioId = access.negocioId
    const estado = req.nextUrl.searchParams.get("estado")
    const metodoEntrega = req.nextUrl.searchParams.get("metodoEntrega")
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10)
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50", 10)

    const where: Record<string, unknown> = { negocioId }

    // Exclude mesa orders — they belong to the salon view
    if (metodoEntrega && metodoEntrega !== "mesa") {
      where.metodoEntrega = metodoEntrega
    } else if (!metodoEntrega) {
      where.metodoEntrega = { not: "mesa" }
    } else {
      // Explicitly requesting mesa orders — return empty (use salon API instead)
      return NextResponse.json({ pedidos: [], pagination: { page, limit, total: 0, totalPages: 0 } }, { headers: NO_STORE_HEADERS })
    }

    if (estado === "activos") {
      where.estado = { in: ESTADOS_ACTIVOS }
    } else if (estado === "historial") {
      where.estado = { notIn: ESTADOS_ACTIVOS }
    } else if (estado) {
      where.estado = estado
    }

    const skip = (page - 1) * limit

    const [pedidos, total] = await Promise.all([
      db.pedido.findMany({
        where,
        include: {
          items: {
            include: {
              producto: {
                select: { id: true, nombre: true, imagenUrl: true },
              },
            },
          },
        },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      db.pedido.count({ where }),
    ])

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

    return NextResponse.json({
      pedidos: pedidosParsed,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error listing empleado pedidos:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
