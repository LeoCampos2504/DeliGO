import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, createRateLimitKey, rateLimitResponse } from "@/lib/rate-limit"

const MAX_CODIGO_LENGTH = 20
const MAX_NEGOCIO_ID_LENGTH = 50

// GET /api/empleados/by-codigo?codigo=XXX&negocioId=YYY — Find an empleado by their codigo
// Público por diseño (lo consume el flujo de escaneo de QR de mesa antes de cualquier
// sesión), por lo que la única defensa disponible acá es rate limiting + validación
// estricta de input, no autenticación obligatoria.
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = checkRateLimit("general", createRateLimitKey(ip))
    if (!rl.allowed) {
      return rateLimitResponse(rl)
    }

    const codigoRaw = req.nextUrl.searchParams.get("codigo")
    const negocioIdRaw = req.nextUrl.searchParams.get("negocioId")

    if (!codigoRaw || !negocioIdRaw) {
      return NextResponse.json({ error: "codigo y negocioId requeridos" }, { status: 400 })
    }

    const codigo = codigoRaw.trim()
    const negocioId = negocioIdRaw.trim()

    if (
      !codigo ||
      !negocioId ||
      codigo.length > MAX_CODIGO_LENGTH ||
      negocioId.length > MAX_NEGOCIO_ID_LENGTH
    ) {
      return NextResponse.json({ error: "codigo y negocioId requeridos" }, { status: 400 })
    }

    const empleado = await db.empleado.findFirst({
      where: {
        negocioId,
        codigo: codigo.toUpperCase(),
        activo: true,
        eliminado: false,
        rol: "mozo",
      },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        rol: true,
        activo: true,
      },
    })

    if (!empleado) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 })
    }

    return NextResponse.json(empleado)
  } catch (error) {
    console.error("Error finding empleado by codigo:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
