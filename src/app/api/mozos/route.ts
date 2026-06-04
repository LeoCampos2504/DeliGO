import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/mozo?token=xxx — Validate mozo token and return mozo info + negocio
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }

    const empleado = await db.empleado.findUnique({
      where: { token },
      include: {
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
      return NextResponse.json({ error: "Token inválido" }, { status: 404 })
    }

    if (!empleado.activo) {
      return NextResponse.json({ error: "Empleado inactivo" }, { status: 403 })
    }

    if (empleado.rol !== "mozo") {
      return NextResponse.json({ error: "Solo los mozos pueden tomar pedidos" }, { status: 403 })
    }

    return NextResponse.json({
      id: empleado.id,
      nombre: empleado.nombre,
      codigo: empleado.codigo,
      rol: empleado.rol,
      negocio: empleado.negocio,
    })
  } catch (error) {
    console.error("Error validating mozo token:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
