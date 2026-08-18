import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { publishRealtimeEvent } from "@/lib/realtime-publish"

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

    if (pedido.repartidorId !== user.id) {
      return NextResponse.json(
        { error: "No estas asignado a este pedido" },
        { status: 403 }
      )
    }

    // 4. Rate limit — per repartidor+pedido, checked only after full
    // authorization above so an actor without a real assignment to this
    // pedido can never consume or poison another repartidor's budget, and
    // strictly before any DB write below.
    const rateLimitKey = `${user.id}:${pedidoId}`
    const rateLimit = checkRateLimit("repartidorUbicacion", rateLimitKey)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    // 5. Update the pedido with repartidor location
    const now = new Date()
    const updated = await db.pedido.updateMany({
      where: {
        id: pedidoId,
        negocioId: pedido.negocioId,
        repartidorId: user.id,
        estado: "en_camino",
        metodoEntrega: "domicilio",
      },
      data: {
        repartidorLat: lat,
        repartidorLng: lng,
        repartidorLastUpdate: now,
      },
    })

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "No estas asignado a este pedido" },
        { status: 403 }
      )
    }

    // 6. Server-authoritative realtime broadcast. DB persistence above is
    // already the source of truth, so a failed/disabled/timed-out publish
    // never turns an already-successful update into an HTTP error — the
    // result is intentionally not inspected (same pattern as Chat's
    // chat.message.created producer). The legacy `location-update` socket
    // relay in the Chat service remains untouched as a stale-PWA fallback;
    // both paths share a short-TTL, clock-independent correlation cache
    // keyed by pedidoId+lat+lng (bounded best-effort duplicate suppression,
    // not exact — see Tracking Focal Design Correction #2).
    //
    // eventId uses a server-generated UUID rather than the millisecond
    // timestamp: unlike Chat's chat.message.created (whose eventId is a
    // DB-generated cuid, unique by construction), this route has no
    // DB-generated row id to reuse — `pedido.updateMany()` only returns a
    // count. Two concurrent accepted updates for the SAME pedido (e.g. a
    // network-layer retry racing the original request) could otherwise
    // compute `now.getTime()` in the same millisecond and collide on
    // eventId, which the Internal Publish Bridge's eventDedupe would then
    // treat as a duplicate retry of the SAME event — silently dropping a
    // second, genuinely distinct GPS sample from realtime delivery (the DB
    // write itself is unaffected either way). Generated once per accepted
    // request, before publishRealtimeEvent is called, so its own internal
    // retries reuse the same eventId (see Focal Precommit Review, eventId
    // uniqueness).
    const timestamp = now.toISOString()
    await publishRealtimeEvent({
      version: 1,
      type: "tracking.location.updated",
      eventId: `${pedidoId}:${randomUUID()}`,
      resourceId: pedidoId,
      occurredAt: timestamp,
      payload: {
        pedidoId,
        lat,
        lng,
        timestamp,
      },
    })

    // 7. Return success
    return NextResponse.json({
      ok: true,
      repartidorLat: lat,
      repartidorLng: lng,
      repartidorLastUpdate: timestamp,
    })
  } catch (error) {
    console.error("Error updating repartidor ubicacion:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al actualizar ubicación" },
      { status: 500 }
    )
  }
}
