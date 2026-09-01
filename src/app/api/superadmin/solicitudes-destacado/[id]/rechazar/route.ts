import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { auditLog } from "@/lib/audit"
import { checkRateLimit, createRateLimitKey, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadminSession(req)
    if (!auth.ok) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const limit = checkRateLimit("superadminPrivilegedMutation", createRateLimitKey(getClientIp(req), auth.admin.id))
    if (!limit.allowed) return rateLimitResponse(limit)

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

    await auditLog({
      userId: auth.admin.id,
      userType: "superadmin",
      accion: "superadmin.solicitud_destacado_rechazada",
      recurso: "destacado_solicitud",
      recursoId: solicitud.id,
      detalle: { negocioId: solicitud.negocioId, hasNotaAdmin: typeof notaAdmin === "string" && notaAdmin.length > 0 },
      ip: getClientIp(req),
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
