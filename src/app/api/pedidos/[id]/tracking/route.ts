import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

interface TrackingResponse {
  trackable: boolean
  trackingDisabled?: boolean
  repartidorLat?: number
  repartidorLng?: number
  repartidorLastUpdate?: string
  destinoLat?: number | null
  destinoLng?: number | null
  destinoDireccion?: string | null
  negocioLat?: number | null
  negocioLng?: number | null
  negocioNombre?: string
  negocioLogoUrl?: string | null
  negocioColorPrincipal?: string | null
  estado?: string
}

// GET /api/pedidos/[id]/tracking - Client gets live tracking data for their order
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Authenticate cliente from cookie
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "cliente") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    // 2. Find the pedido by id
    const pedido = await db.pedido.findUnique({
      where: { id },
    })

    if (!pedido) {
      return NextResponse.json(
        { error: "Pedido no encontrado" },
        { status: 404 }
      )
    }

    // 3. Verify the pedido belongs to this cliente
    if (pedido.clienteId !== user.id) {
      return NextResponse.json(
        { error: "Pedido no encontrado" },
        { status: 404 }
      )
    }

    // 4. Verify estado === "en_camino" (only trackable when in transit)
    if (pedido.estado !== "en_camino") {
      const response: TrackingResponse = { trackable: false }
      return NextResponse.json(response)
    }

    // Check if repartidor location is available
    if (pedido.repartidorLat === null || pedido.repartidorLng === null) {
      const response: TrackingResponse = { trackable: false }
      return NextResponse.json(response)
    }

    // 5. Fetch negocio for current lat/lng fallback, logo, and tracking setting
    const negocio = await db.negocio.findUnique({
      where: { id: pedido.negocioId },
      select: { lat: true, lng: true, logoUrl: true, colorPrincipal: true, seguimientoDeliveryActivo: true },
    })

    // 6. Check if the negocio has disabled real-time tracking
    if (negocio && !negocio.seguimientoDeliveryActivo) {
      const response: TrackingResponse = { trackable: false, trackingDisabled: true }
      return NextResponse.json(response)
    }

    // Use pedido's saved negocioLat/Lng, fallback to negocio's current lat/lng
    const finalNegocioLat = pedido.negocioLat ?? negocio?.lat ?? null
    const finalNegocioLng = pedido.negocioLng ?? negocio?.lng ?? null

    // 6. Return tracking data
    const response: TrackingResponse = {
      trackable: true,
      repartidorLat: pedido.repartidorLat,
      repartidorLng: pedido.repartidorLng,
      repartidorLastUpdate: pedido.repartidorLastUpdate
        ? pedido.repartidorLastUpdate.toISOString()
        : undefined,
      destinoLat: pedido.lat,
      destinoLng: pedido.lng,
      destinoDireccion: pedido.direccion ?? null,
      negocioLat: finalNegocioLat,
      negocioLng: finalNegocioLng,
      negocioNombre: pedido.negocioNombre ?? undefined,
      negocioLogoUrl: negocio?.logoUrl ?? null,
      negocioColorPrincipal: negocio?.colorPrincipal ?? null,
      estado: pedido.estado,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error fetching tracking data:", error)
    return NextResponse.json(
      { error: "Error al obtener datos de seguimiento" },
      { status: 500 }
    )
  }
}
