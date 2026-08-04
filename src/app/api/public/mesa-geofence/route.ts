import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { evaluateMesaGeofence, logMesaGeofenceObservation, MESA_GEOFENCE_MODE } from "@/lib/mesa-geofence"

// ============================================
// DeliGO — Comprobación pública de geocerca de mesa (P0-C.2, modo enforce)
// ============================================
// Público a propósito (se llama al abrir el QR de mesa, antes de cualquier
// sesión). Nunca acepta negocioId, mesaId como fuente de autoridad, radio,
// precisión máxima, un booleano "estaDentro" ni las coordenadas del negocio
// — la mesa se resuelve SIEMPRE server-side por (negocioId real, numero).
// `canContinue` ahora refleja la política real en modo enforce (solo
// informativo: esta ruta nunca crea ni bloquea un pedido). La autoridad real
// del bloqueo vive exclusivamente en POST /api/pedidos — aunque el cliente
// nunca llame a esta ruta, ese endpoint sigue rechazando el pedido.

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

    // "inside" y "business_unconfigured" nunca bloquean; el resto sí en modo
    // enforce. Esto es solo informativo para la UI que se muestra al abrir el
    // QR — el bloqueo real y definitivo ocurre en POST /api/pedidos.
    const canContinue =
      MESA_GEOFENCE_MODE !== "enforce" ||
      result.status === "inside" ||
      result.status === "business_unconfigured"

    logMesaGeofenceObservation("mesa_geofence_check_open", {
      negocioId: negocio.id,
      mesaNumero,
      result,
      blocked: !canContinue,
    })

    return NextResponse.json({ ok: true, status: result.status, canContinue })
  } catch (error) {
    console.error("[MesaGeofence] Error en la comprobación pública:", error)
    return NextResponse.json({ ok: true, status: "invalid", canContinue: true })
  }
}
