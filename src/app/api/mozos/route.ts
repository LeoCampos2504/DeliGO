import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { esAreaMozoEfectiva } from "@/lib/area-operativa"

function readBearerToken(req: NextRequest): string | null {
  const authorization = req.headers.get("authorization")
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/)
  return match?.[1] ?? null
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store")
  return response
}

// GET /api/mozos - Validate mozo bearer token and return mozo info + negocio
export async function GET(req: NextRequest) {
  try {
    const token = readBearerToken(req)

    if (!token) {
      return noStore(NextResponse.json({ error: "Authorization Bearer requerido" }, { status: 400 }))
    }

    const empleado = await db.empleado.findFirst({
      where: { token, activo: true, eliminado: false },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        rol: true,
        areaOperativa: true,
        negocio: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            colorPrincipal: true,
            salonActivo: true,
          },
        },
      },
    })

    if (!empleado) {
      return noStore(NextResponse.json({ error: "Token inválido" }, { status: 404 }))
    }

    // Guard de transición (Operaciones-1F): token legacy solo válido con área efectiva Mozo.
    if (!esAreaMozoEfectiva({ areaOperativa: empleado.areaOperativa, rol: empleado.rol })) {
      return noStore(NextResponse.json({ error: "Token inválido" }, { status: 404 }))
    }

    return noStore(NextResponse.json({
      id: empleado.id,
      nombre: empleado.nombre,
      codigo: empleado.codigo,
      rol: empleado.rol,
      negocio: empleado.negocio,
    }))
  } catch (error) {
    console.error("Error validating mozo token:", error)
    return noStore(NextResponse.json({ error: "Error del servidor" }, { status: 500 }))
  }
}
