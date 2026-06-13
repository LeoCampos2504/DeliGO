import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET - List all denuncias for superadmin with filtering and pagination
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "superadmin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const motivoTipo = searchParams.get("motivoTipo")
    const clienteId = searchParams.get("clienteId")
    const page = Math.max(1, Number(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "20")))
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}
    if (motivoTipo && motivoTipo !== "todos") {
      where.motivoTipo = motivoTipo
    }
    if (clienteId) {
      where.clienteId = clienteId
    }

    // Fetch denuncias
    const [denuncias, total] = await Promise.all([
      db.denuncia.findMany({
        where,
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      db.denuncia.count({ where }),
    ])

    // Get unique cliente IDs and fetch their info
    const clienteIds = [...new Set(denuncias.map((d) => d.clienteId))]
    const clientes = await db.cliente.findMany({
      where: { id: { in: clienteIds } },
      select: {
        id: true,
        nombre: true,
        email: true,
        bloqueado: true,
        bloqueadoFecha: true,
      },
    })

    const clienteMap: Record<string, {
      id: string
      nombre: string
      email: string
      bloqueado: boolean
      bloqueadoFecha: string | null
    }> = {}
    for (const c of clientes) {
      clienteMap[c.id] = {
        id: c.id,
        nombre: c.nombre,
        email: c.email,
        bloqueado: c.bloqueado,
        bloqueadoFecha: c.bloqueadoFecha?.toISOString() ?? null,
      }
    }

    // Stats
    const [totalAll, bloqueadosCount, porTipoRaw] = await Promise.all([
      db.denuncia.count(),
      db.cliente.count({ where: { bloqueado: true } }),
      db.denuncia.groupBy({
        by: ["motivoTipo"],
        _count: { motivoTipo: true },
      }),
    ])

    const porTipo: Record<string, number> = {}
    for (const item of porTipoRaw) {
      porTipo[item.motivoTipo] = item._count.motivoTipo
    }

    const stats = {
      total: totalAll,
      clientesBloqueados: bloqueadosCount,
      porTipo,
    }

    // If querying by clienteId, also return the cliente info for the dialog
    let clienteInfo = null
    if (clienteId) {
      const cliente = await db.cliente.findUnique({
        where: { id: clienteId },
        select: {
          id: true,
          nombre: true,
          email: true,
          bloqueado: true,
          bloqueadoFecha: true,
        },
      })
      if (cliente) {
        clienteInfo = {
          ...cliente,
          bloqueadoFecha: cliente.bloqueadoFecha?.toISOString() ?? null,
        }
      }
    }

    return NextResponse.json({
      denuncias,
      clienteMap,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      ...(clienteInfo ? { clienteInfo } : {}),
    })
  } catch (error) {
    console.error("Error fetching denuncias:", error)
    return NextResponse.json({ error: "Error al obtener denuncias" }, { status: 500 })
  }
}
