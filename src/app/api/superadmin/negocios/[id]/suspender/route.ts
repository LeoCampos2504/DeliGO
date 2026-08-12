import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"
import { createNotification, negocioSuspendedNotification } from "@/lib/push"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"

// Seguridad-6B.5: suspensión de negocio por superadmin — nunca cacheable.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

async function verifySuperAdmin(req: NextRequest) {
  const auth = await requireSuperadminSession(req)
  if (!auth.ok) return null
  return auth.admin
}

// POST - Suspend negocio
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

    await db.negocio.update({
      where: { id },
      data: { suspendido: true },
    })

    // Audit log
    await auditLog({ userId: user.id, userType: "superadmin", accion: "negocio.suspendido", recurso: "negocio", recursoId: id, detalle: { suspendido: true } })

    // Notify negocio that they were suspended
    try {
      const payload = negocioSuspendedNotification(negocio.nombre)
      await createNotification({
        userId: id,
        userType: "negocio",
        tipo: "account_update",
        titulo: payload.title,
        cuerpo: payload.body,
        negocioId: id,
        pushSubscription: negocio.pushSubscription,
        pushPayload: payload,
        cleanupExpired: { model: "negocio", id },
      })
    } catch (pushError) {
      console.error("[Push] Failed to send suspension notification:", safeErrorForLog(pushError))
    }

    return NextResponse.json({ ok: true, mensaje: `${negocio.nombre} suspendido` }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error suspending negocio:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al suspender" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
