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

    await auditLog({
      userId: auth.admin.id,
      userType: "superadmin",
      accion: "superadmin.solicitud_destacado_aprobada",
      recurso: "destacado_solicitud",
      recursoId: solicitud.id,
      detalle: { negocioId: solicitud.negocioId, meses: solicitud.meses, dias: solicitud.dias, nuevaFecha: nuevaFecha.toISOString() },
      ip: getClientIp(req),
    })

    return NextResponse.json({
      mensaje: `Solicitud aprobada. ${solicitud.negocio.nombre} destacado hasta ${nuevaFecha.toLocaleDateString("es-AR")}`,
      nuevaFecha: nuevaFecha.toISOString(),
    })
  } catch (error) {
    console.error("Error approving destacado solicitud:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al aprobar solicitud" },
      { status: 500 }
    )
  }
}
