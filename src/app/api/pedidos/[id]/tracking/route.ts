import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isTrackingCoreEligible } from "@/lib/realtime-policy"

interface TrackingResponse {
  trackable: boolean
  trackingDisabled?: boolean
  repartidorLat?: number
  repartidorLng?: number
  repartidorLastUpdate?: string
  // Same DB-backed, monotonic-per-pedido ordering authority as the
  // `tracking.location.updated` realtime payload's `version` field (see
  // Pedido.locationRevision, Tracking Latest-Wins Focal Design Correction
  // #2) — kept under this shared wire name so the consumer can compare an
  // HTTP snapshot and a realtime event against the same authority.
  version?: number
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

    // 6. Core tracking eligibility (same shared semantic as realtime
    // authorize and the repartidor's "mios" payload — P2-T01). Fail-closed
    // shape regardless of WHICH condition failed (immutable snapshot vs.
    // live business flag): the client never learns which one it was.
    const coreEligible = isTrackingCoreEligible(
      {
        estado: pedido.estado,
        metodoEntrega: pedido.metodoEntrega,
        seguimientoDeliveryHabilitado: pedido.seguimientoDeliveryHabilitado,
      },
      { seguimientoDeliveryActivo: negocio?.seguimientoDeliveryActivo === true }
    )
    if (!coreEligible) {
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
      version: pedido.locationRevision,
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
    console.error("Error fetching tracking data:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al obtener datos de seguimiento" },
      { status: 500 }
    )
  }
}
