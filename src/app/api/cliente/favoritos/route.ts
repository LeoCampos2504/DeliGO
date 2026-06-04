import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"

// GET /api/cliente/favoritos - Get client's favorite businesses
export async function GET(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
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
    })
  } catch (error) {
    console.error("Cliente favoritos GET error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// POST /api/cliente/favoritos - Toggle favorite
export async function POST(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const { negocioId } = body

    if (!negocioId) {
      return NextResponse.json({ error: "negocioId es requerido" }, { status: 400 })
    }

    // Check if negocio exists
    const negocio = await db.negocio.findUnique({ where: { id: negocioId } })
    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })
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
      return NextResponse.json({ ok: true, action: "removed" })
    } else {
      // Add favorite
      await db.favorito.create({
        data: { clienteId: cliente.id, negocioId },
      })
      return NextResponse.json({ ok: true, action: "added" })
    }
  } catch (error) {
    console.error("Cliente favoritos POST error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
