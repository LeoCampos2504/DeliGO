import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseAuthorizationBearer } from "@/lib/access-tokens"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// GET /api/empleado/validate - Validate shared employee access token.
export async function GET(req: NextRequest) {
  try {
    const token = parseAuthorizationBearer(req.headers.get("authorization"))
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const negocio = await db.negocio.findFirst({
      where: { tokenEmpleados: token },
      select: {
        id: true,
        slug: true,
        nombre: true,
        colorPrincipal: true,
        rubro: true,
        salonActivo: true,
        pushSubscriptionEmpleados: true,
      },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token invalido o fue regenerado" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    return NextResponse.json({
      empleado: null,
      negocio: {
        id: negocio.id,
        slug: negocio.slug,
        nombre: negocio.nombre,
        colorPrincipal: negocio.colorPrincipal,
        rubro: negocio.rubro,
        salonActivo: negocio.salonActivo,
        hasPushSubscription: !!negocio.pushSubscriptionEmpleados,
      },
      accessType: "empleados",
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error validating token:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
