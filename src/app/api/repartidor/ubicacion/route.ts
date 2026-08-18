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

    // 5. Update the pedido with repartidor location AND atomically advance
    // its location-ordering authority in the same statement. `updateMany`
    // cannot RETURN the row it just wrote, so this uses a parameterized raw
    // query instead — the defensive compound WHERE below is identical to
    // the `updateMany` it replaces (same re-authorization-at-write-time
    // guarantee), and the tagged template parameterizes every value, never
    // string concatenation (same discipline as the existing atomic
    // upsert-with-RETURNING in src/lib/auth-login-throttle.ts). Physical
    // table/column names re-derived from the generated migration
    // (prisma/migrations/20260818000000_add_tracking_location_revision) —
    // `Pedido` maps to `"pedidos"`, no field-level @map on this model.
    const now = new Date()
    const rows = await db.$queryRaw<
      { repartidorLat: number; repartidorLng: number; repartidorLastUpdate: Date; locationRevision: number }[]
    >`
      UPDATE "pedidos"
      SET "repartidorLat" = ${lat},
          "repartidorLng" = ${lng},
          "repartidorLastUpdate" = ${now},
          "locationRevision" = "locationRevision" + 1
      WHERE "id" = ${pedidoId}
        AND "negocioId" = ${pedido.negocioId}
        AND "repartidorId" = ${user.id}
        AND "estado" = 'en_camino'
        AND "metodoEntrega" = 'domicilio'
      RETURNING "repartidorLat", "repartidorLng", "repartidorLastUpdate", "locationRevision"
    `

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No estas asignado a este pedido" },
        { status: 403 }
      )
    }

    // `id` is the primary key, so more than one matched row is structurally
    // impossible — fail closed rather than guess which row is authoritative.
    if (rows.length > 1) {
      console.error("Error updating repartidor ubicacion:", safeErrorForLog(new Error("LOCATION_REVISION_MULTI_ROW_MATCH")))
      return NextResponse.json(
        { error: "Error al actualizar ubicación" },
        { status: 500 }
      )
    }

    const locationRevision = rows[0].locationRevision

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
    // globally-unique DB-generated value to reuse for that purpose —
    // `locationRevision` is only unique PER PEDIDO, so reusing it directly
    // as (part of) eventId could collide across different pedidos whose
    // counters happen to reach the same value. Two concurrent accepted
    // updates for the SAME pedido (e.g. a
    // network-layer retry racing the original request) could otherwise
    // compute `now.getTime()` in the same millisecond and collide on
    // eventId, which the Internal Publish Bridge's eventDedupe would then
    // treat as a duplicate retry of the SAME event — silently dropping a
    // second, genuinely distinct GPS sample from realtime delivery (the DB
    // write itself is unaffected either way). Generated once per accepted
    // request, before publishRealtimeEvent is called, so its own internal
    // retries reuse the same eventId (see Focal Precommit Review, eventId
    // uniqueness).
    //
    // payload.version carries the DB-returned `locationRevision` — the
    // atomic ordering authority for realtime-vs-realtime and HTTP-vs-realtime
    // freshness (Tracking Latest-Wins Focal Design Correction #2). It is
    // never recomputed here: `locationRevision` above came directly from the
    // RETURNING clause of the same statement that persisted this exact
    // accepted state, so it is guaranteed to correspond to these exact
    // coordinates. The envelope's own `version: 1` field (below) is the
    // unrelated Internal Publish schema/envelope version and is untouched.
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
        version: locationRevision,
      },
    })

    // 7. Return success
    return NextResponse.json({
      ok: true,
      repartidorLat: lat,
      repartidorLng: lng,
      repartidorLastUpdate: timestamp,
      locationRevision,
    })
  } catch (error) {
    console.error("Error updating repartidor ubicacion:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al actualizar ubicación" },
      { status: 500 }
    )
  }
}
