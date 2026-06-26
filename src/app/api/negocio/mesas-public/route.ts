import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// PUBLIC endpoint — returns active mesas for a negocio by slug
// Used by mozos and customers to see available mesas
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get("slug")

    if (!slug) {
      return NextResponse.json({ error: "Slug requerido" }, { status: 400 })
    }

    // Find negocio by slug
    const negocio = await db.negocio.findUnique({
      where: { slug },
      select: { id: true, salonActivo: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })
    }

    if (!negocio.salonActivo) {
      return NextResponse.json({ error: "Salón no activo" }, { status: 400 })
    }

    // Get all active mesas with their assigned mozo info
    const mesas = await db.mesa.findMany({
      where: {
        negocioId: negocio.id,
        activa: true,
      },
      orderBy: { numero: "asc" },
      include: {
        empleado: {
          select: { nombre: true, codigo: true },
        },
      },
    })

    // Format response — include mozo info if assigned
    const formatted = mesas.map((m) => ({
      id: m.id,
      numero: m.numero,
      nombre: m.nombre,
      zona: m.zona,
      capacidad: m.capacidad,
      mozoAsignado: m.empleado
        ? { nombre: m.empleado.nombre, codigo: m.empleado.codigo }
        : null,
    }))

    return NextResponse.json({ mesas: formatted })
  } catch (error) {
    console.error("Error fetching public mesas:", error)
    return NextResponse.json(
      { error: "Error al obtener mesas" },
      { status: 500 }
    )
  }
}
