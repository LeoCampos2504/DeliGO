import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "superadmin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const { id } = await params

    const solicitud = await db.destacadoSolicitud.findUnique({
      where: { id },
      include: { negocio: true },
    })

    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 })
    }

    if (solicitud.estado !== "pendiente") {
      return NextResponse.json({ error: "La solicitud ya fue procesada" }, { status: 400 })
    }

    // Calculate new destacadoHasta date
    const ahora = new Date()
    let fechaBase: Date

    if (solicitud.negocio.destacadoHasta && new Date(solicitud.negocio.destacadoHasta) > ahora) {
      // If already destacado and not expired, extend from current end date
      fechaBase = new Date(solicitud.negocio.destacadoHasta)
    } else {
      // Otherwise start from now
      fechaBase = ahora
    }

    const nuevaFecha = new Date(fechaBase)
    nuevaFecha.setMonth(nuevaFecha.getMonth() + solicitud.meses)
    nuevaFecha.setDate(nuevaFecha.getDate() + solicitud.dias)

    // Update in transaction: approve solicitud + update negocio
    await db.$transaction([
      db.destacadoSolicitud.update({
        where: { id },
        data: { estado: "aprobada", updatedAt: new Date() },
      }),
      db.negocio.update({
        where: { id: solicitud.negocioId },
        data: {
          destacadoHasta: nuevaFecha,
          promocionado: true,
        },
      }),
    ])

    return NextResponse.json({
      mensaje: `Solicitud aprobada. ${solicitud.negocio.nombre} destacado hasta ${nuevaFecha.toLocaleDateString("es-AR")}`,
      nuevaFecha: nuevaFecha.toISOString(),
    })
  } catch (error) {
    console.error("Error approving destacado solicitud:", error)
    return NextResponse.json(
      { error: "Error al aprobar solicitud" },
      { status: 500 }
    )
  }
}
