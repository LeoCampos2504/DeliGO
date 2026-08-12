import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

// Seguridad-6B.4: favoritos del cliente — preferencia privada ligada a la sesión, nunca cacheable.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

// GET /api/cliente/favoritos - Get client's favorite businesses
export async function GET(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const favoritos = await db.favorito.findMany({
      where: { clienteId: cliente.id },
      include: {
        negocio: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            rubro: true,
            logoUrl: true,
            bannerUrl: true,
            colorPrincipal: true,
            puntuacionPromedio: true,
            totalResenas: true,
            ofreceDelivery: true,
            precioDelivery: true,
            tiempoEntrega: true,
            horarios: true,
            suspendido: true,
            aprobado: true,
            mostrarVentas: true,
            horarioMode: true,
            abiertoManual: true,
            _count: {
              select: {
                pedidos: {
                  where: { estado: "entregado" },
                },
              },
            },
          },
        },
      },
      orderBy: { id: "desc" },
    })

    return NextResponse.json({
      ok: true,
      favoritos: favoritos.map((f) => ({
        ...f.negocio,
        favoritoId: f.id,
        totalVentas: f.negocio._count.pedidos,
      })),
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Cliente favoritos GET error:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}

// POST /api/cliente/favoritos - Toggle favorite
export async function POST(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const body = await req.json()
    const { negocioId } = body

    if (!negocioId) {
      return NextResponse.json({ error: "negocioId es requerido" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    // Check if negocio exists
    const negocio = await db.negocio.findUnique({ where: { id: negocioId } })
    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404, headers: NO_STORE_HEADERS })
    }

    // Check if already favorited
    const existing = await db.favorito.findUnique({
      where: {
        clienteId_negocioId: { clienteId: cliente.id, negocioId },
      },
    })

    if (existing) {
      // Remove favorite
      await db.favorito.delete({ where: { id: existing.id } })
      return NextResponse.json({ ok: true, action: "removed" }, { headers: NO_STORE_HEADERS })
    } else {
      // Add favorite
      await db.favorito.create({
        data: { clienteId: cliente.id, negocioId },
      })
      return NextResponse.json({ ok: true, action: "added" }, { headers: NO_STORE_HEADERS })
    }
  } catch (error) {
    console.error("Cliente favoritos POST error:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
