import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { evaluateMesaGeofence, logMesaGeofenceObservation } from "@/lib/mesa-geofence"

// ============================================
// DeliGO — Comprobación pública de geocerca de mesa (P0-C.1, modo observación)
// ============================================
// Público a propósito (se llama al abrir el QR de mesa, antes de cualquier
// sesión). Nunca acepta negocioId, mesaId como fuente de autoridad, radio,
// precisión máxima, un booleano "estaDentro" ni las coordenadas del negocio
// — la mesa se resuelve SIEMPRE server-side por (negocioId real, numero).
// En modo observación, `canContinue` es siempre `true`: esta ruta solo
// informa, nunca bloquea. El bloqueo real queda para P0-C.2.

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// Estado neutro y sanitizado para cualquier caso que no permita evaluar la
// geocerca real (negocio no encontrado/no aprobado/suspendido/sin salón,
// mesa inexistente o inactiva) — nunca revela cuál de esos motivos aplicó.
function neutralResponse() {
  return NextResponse.json({ ok: true, status: "business_unconfigured", canContinue: true })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!isPlainObject(body)) {
      return NextResponse.json({ error: "Body invalido" }, { status: 400 })
    }

    const slug = typeof body.slug === "string" ? body.slug.trim() : ""
    const mesaNumero =
      typeof body.mesaNumero === "number" && Number.isInteger(body.mesaNumero) && body.mesaNumero > 0
        ? body.mesaNumero
        : null

    if (!slug || !mesaNumero) {
      return NextResponse.json({ error: "slug y mesaNumero son requeridos" }, { status: 400 })
    }

    const ip = getClientIp(req)
    const rl = checkRateLimit("mesaGeofence", `${ip}:${slug}:${mesaNumero}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl, "Estás intentando muchas veces. Esperá un momento.")
    }

    const negocio = await db.negocio.findUnique({
      where: { slug },
      select: {
        id: true,
        aprobado: true,
        suspendido: true,
        salonActivo: true,
        lat: true,
        lng: true,
        ubicacionCalibradaEn: true,
      },
    })

    if (!negocio || !negocio.aprobado || negocio.suspendido || !negocio.salonActivo) {
      return neutralResponse()
    }

    const mesa = await db.mesa.findFirst({
      where: { negocioId: negocio.id, numero: mesaNumero, activa: true },
      select: { id: true },
    })

    if (!mesa) {
      return neutralResponse()
    }

    const result = evaluateMesaGeofence(
      { lat: negocio.lat, lng: negocio.lng, ubicacionCalibradaEn: negocio.ubicacionCalibradaEn },
      body.mesaGeolocation
    )

    logMesaGeofenceObservation("mesa_geofence_check_open", {
      negocioId: negocio.id,
      mesaNumero,
      result,
    })

    // Modo observación: nunca bloquea, solo informa una categoría sanitizada.
    return NextResponse.json({ ok: true, status: result.status, canContinue: true })
  } catch (error) {
    console.error("[MesaGeofence] Error en la comprobación pública:", error)
    return NextResponse.json({ ok: true, status: "invalid", canContinue: true })
  }
}
