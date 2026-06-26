import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/empleado/validate — Validate token and return negocio info
// Supports:
//   1. ?token=TOKEN&type=empleados — validates tokenEmpleados from Negocio table (shared employee link)
//   2. ?token=EMPLEADO_TOKEN — validates empleado token (legacy, for mozo page)
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token")
    const type = req.nextUrl.searchParams.get("type") // "empleados" | undefined

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }

    // ── Shared employee access token (for /e/[token]) ──
    if (type === "empleados") {
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
        return NextResponse.json({ error: "Token inválido o fue regenerado" }, { status: 401 })
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
      })
    }

    // ── Legacy: empleado token validation (for /m/[token] mozo page) ──
    const empleado = await db.empleado.findFirst({
      where: { token, activo: true, eliminado: false },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        rol: true,
        activo: true,
        negocioId: true,
      },
    })

    if (!empleado || !empleado.activo) {
      return NextResponse.json({ error: "Token inválido o empleado inactivo" }, { status: 401 })
    }

    const negocio = await db.negocio.findUnique({
      where: { id: empleado.negocioId },
      select: {
        id: true,
        slug: true,
        nombre: true,
        colorPrincipal: true,
        rubro: true,
        salonActivo: true,
      },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      empleado: {
        id: empleado.id,
        nombre: empleado.nombre,
        codigo: empleado.codigo,
        rol: empleado.rol,
      },
      negocio,
      accessType: "empleado",
    })
  } catch (error) {
    console.error("Error validating token:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
