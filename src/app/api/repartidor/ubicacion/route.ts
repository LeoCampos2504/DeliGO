import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

interface UpdateUbicacionBody {
  pedidoId: string
  lat: number
  lng: number
}

// POST /api/repartidor/ubicacion - Update repartidor live GPS location for an active delivery
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate repartidor from cookie
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    // Verify repartidor is active
    const repartidor = await db.repartidor.findUnique({
      where: { id: user.id },
    })

    if (!repartidor || !repartidor.activo) {
      return NextResponse.json(
        { error: "Tu cuenta está desactivada" },
        { status: 403 }
      )
    }

    // 2. Validate required fields
    const body: UpdateUbicacionBody = await req.json()
    const { pedidoId, lat, lng } = body

    if (!pedidoId || typeof pedidoId !== "string") {
      return NextResponse.json(
        { error: "pedidoId es requerido" },
        { status: 400 }
      )
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "lat y lng deben ser números válidos" },
        { status: 400 }
      )
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: "Coordenadas fuera de rango válido" },
        { status: 400 }
      )
    }

    // 3. Find the pedido and validate
    const pedido = await db.pedido.findUnique({
      where: { id: pedidoId },
    })

    if (!pedido) {
      return NextResponse.json(
        { error: "Pedido no encontrado" },
        { status: 404 }
      )
    }

    if (pedido.estado !== "en_camino") {
      return NextResponse.json(
        { error: "El pedido no está en camino" },
        { status: 400 }
      )
    }

    if (pedido.metodoEntrega !== "domicilio") {
      return NextResponse.json(
        { error: "El pedido no es de entrega a domicilio" },
        { status: 400 }
      )
    }

    // Verify repartidor is associated with this negocio
    const asociacion = await db.repartidorNegocio.findUnique({
      where: {
        repartidorId_negocioId: {
          repartidorId: user.id,
          negocioId: pedido.negocioId,
        },
      },
    })

    if (!asociacion) {
      return NextResponse.json(
        { error: "No estás asociado a este local" },
        { status: 403 }
      )
    }

    // 4. Update the pedido with repartidor location
    const now = new Date()
    await db.pedido.update({
      where: { id: pedidoId },
      data: {
        repartidorLat: lat,
        repartidorLng: lng,
        repartidorLastUpdate: now,
      },
    })

    // 5. Return success
    return NextResponse.json({
      ok: true,
      repartidorLat: lat,
      repartidorLng: lng,
      repartidorLastUpdate: now.toISOString(),
    })
  } catch (error) {
    console.error("Error updating repartidor ubicacion:", error)
    return NextResponse.json(
      { error: "Error al actualizar ubicación" },
      { status: 500 }
    )
  }
}
