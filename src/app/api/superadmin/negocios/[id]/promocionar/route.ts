import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

async function verifySuperAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const user = await getUserFromToken(token)
  if (!user || user.type !== "superadmin") return null
  return user
}

// PUT - Toggle or set promocionado on a negocio (with optional expiry date)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const { id } = await params

    const negocio = await db.negocio.findUnique({
      where: { id },
      select: { id: true, promocionado: true, destacadoHasta: true },
    })

    if (!negocio) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { promocionado, ordenPromocion, destacadoHasta, periodoDestacado } = body

    if (typeof promocionado !== "boolean") {
      return NextResponse.json(
        { error: "promocionado debe ser un valor booleano" },
        { status: 400 }
      )
    }

    const updateData: {
      promocionado: boolean
      ordenPromocion?: number
      destacadoHasta?: Date | null
    } = {
      promocionado,
    }

    if (ordenPromocion !== undefined) {
      if (typeof ordenPromocion !== "number" || ordenPromocion < 0) {
        return NextResponse.json(
          { error: "ordenPromocion debe ser un número positivo" },
          { status: 400 }
        )
      }
      updateData.ordenPromocion = ordenPromocion
    } else if (!promocionado) {
      // Reset order when un-promoting
      updateData.ordenPromocion = 0
    }

    // Handle destacadoHasta (expiry date for the promotion)
    if (promocionado) {
      if (destacadoHasta) {
        // Custom date provided
        updateData.destacadoHasta = new Date(destacadoHasta)
      } else if (periodoDestacado) {
        // Period in days provided — stack on top of current expiry if still valid
        const dias = parseInt(String(periodoDestacado), 10)
        const base = negocio.destacadoHasta && new Date(negocio.destacadoHasta) > new Date()
          ? new Date(negocio.destacadoHasta)
          : new Date()
        const nuevaFecha = new Date(base)
        nuevaFecha.setDate(nuevaFecha.getDate() + dias)
        updateData.destacadoHasta = nuevaFecha
      } else if (!negocio.destacadoHasta) {
        // No date and no period — default to 30 days from now
        const nuevaFecha = new Date()
        nuevaFecha.setDate(nuevaFecha.getDate() + 30)
        updateData.destacadoHasta = nuevaFecha
      }
      // If already has a destacadoHasta date and no new one specified, keep the existing one
    } else {
      // Un-promoting: clear the date
      updateData.destacadoHasta = null
    }

    const updated = await db.negocio.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        slug: true,
        promocionado: true,
        ordenPromocion: true,
        destacadoHasta: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating promocionado:", error)
    return NextResponse.json(
      { error: "Error al actualizar promoción" },
      { status: 500 }
    )
  }
}
