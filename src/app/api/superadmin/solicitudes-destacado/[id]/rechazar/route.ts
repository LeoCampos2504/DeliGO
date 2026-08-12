import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadminSession(req)
    if (!auth.ok) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const notaAdmin = body.notaAdmin || ""

    const solicitud = await db.destacadoSolicitud.findUnique({
      where: { id },
    })

    if (!solicitud) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 })
    }

    if (solicitud.estado !== "pendiente") {
      return NextResponse.json({ error: "La solicitud ya fue procesada" }, { status: 400 })
    }

    await db.destacadoSolicitud.update({
      where: { id },
      data: {
        estado: "rechazada",
        notaAdmin,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ mensaje: "Solicitud rechazada" })
  } catch (error) {
    console.error("Error rejecting destacado solicitud:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al rechazar solicitud" },
      { status: 500 }
    )
  }
}
