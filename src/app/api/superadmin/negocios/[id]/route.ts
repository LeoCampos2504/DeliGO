import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"
import { createNotification, negocioApprovedNotification } from "@/lib/push"

// Seguridad-6B.4: aprobación/eliminación de un negocio por superadmin — nunca cacheable.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

async function verifySuperAdmin(req: NextRequest) {
  const auth = await requireSuperadminSession(req)
  if (!auth.ok) return null
  return auth.admin
}

// POST - Approve a negocio
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })

    const { id } = await params
    const negocio = await db.negocio.findUnique({ where: { id } })
    if (!negocio) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404, headers: NO_STORE_HEADERS })
    if (negocio.aprobado) return NextResponse.json({ error: "Ya está aprobado" }, { status: 400, headers: NO_STORE_HEADERS })

    const fechaInicio = new Date()
    const fechaVencimiento = new Date()
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30)

    await db.negocio.update({
      where: { id },
      data: {
        aprobado: true,
        suspendido: false,
        planTipo: "prueba",
        planFechaInicio: fechaInicio.toISOString(),
        planVencimiento: fechaVencimiento.toISOString(),
      },
    })

    // Notify negocio that they were approved
    try {
      const updatedNegocio = await db.negocio.findUnique({
        where: { id },
        select: { pushSubscription: true, nombre: true },
      })
      if (updatedNegocio) {
        const payload = negocioApprovedNotification(updatedNegocio.nombre)
        await createNotification({
          userId: id,
          userType: "negocio",
          tipo: "account_update",
          titulo: payload.title,
          cuerpo: payload.body,
          negocioId: id,
          pushSubscription: updatedNegocio.pushSubscription,
          pushPayload: payload,
          cleanupExpired: { model: "negocio", id },
        })
      }
    } catch (pushError) {
      console.error("[Push] Failed to send approval notification:", pushError)
    }

    return NextResponse.json({ ok: true, mensaje: "Negocio aprobado con plan de prueba (30 días)" }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error approving negocio:", error)
    return NextResponse.json({ error: "Error al aprobar" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}

// DELETE - Reject/delete a negocio (cascading)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })

    const { id } = await params
    const negocio = await db.negocio.findUnique({ where: { id } })
    if (!negocio) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404, headers: NO_STORE_HEADERS })

    await db.negocio.delete({ where: { id } })

    return NextResponse.json({ ok: true, mensaje: "Negocio eliminado" }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error deleting negocio:", error)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
