import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createNotification, reviewReplyNotification } from "@/lib/push"

// Validate token — supports shared empleados token and legacy empleado tokens
async function validateAccess(token: string, type?: string | null): Promise<{ negocioId: string } | null> {
  if (!token) return null

  // Shared employee token (for /e/[token] page)
  if (type === "empleados") {
    const negocio = await db.negocio.findFirst({
      where: { tokenEmpleados: token },
      select: { id: true },
    })
    return negocio ? { negocioId: negocio.id } : null
  }

  // Legacy: empleado token (for /m/[token] mozo page)
  const empleado = await db.empleado.findFirst({
    where: { token, activo: true },
    select: { id: true, negocioId: true },
  })
  return empleado ? { negocioId: empleado.negocioId } : null
}

// PATCH /api/empleado/resenas/[id]/responder — Reply to a review via token
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: resenaId } = await params
    const body = await req.json()
    const { token, type, respuestaNegocio } = body

    if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    if (!respuestaNegocio?.trim()) {
      return NextResponse.json({ error: "La respuesta no puede estar vacía" }, { status: 400 })
    }

    const access = await validateAccess(token, type)
    if (!access) return NextResponse.json({ error: "Token inválido" }, { status: 401 })

    const negocioId = access.negocioId

    // Verify the review belongs to this negocio
    const resena = await db.resena.findUnique({ where: { id: resenaId } })
    if (!resena || resena.negocioId !== negocioId) {
      return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 })
    }

    const updated = await db.resena.update({
      where: { id: resenaId },
      data: {
        respuestaNegocio: respuestaNegocio.trim(),
        fechaRespuesta: new Date(),
      },
    })

    // Notify cliente that negocio replied to their review
    try {
      const resenaWithCliente = await db.resena.findUnique({
        where: { id: resenaId },
        select: { clienteId: true },
      })
      if (resenaWithCliente?.clienteId) {
        const cliente = await db.cliente.findUnique({
          where: { id: resenaWithCliente.clienteId },
          select: { pushSubscription: true },
        })
        const negocio = await db.negocio.findUnique({
          where: { id: negocioId },
          select: { nombre: true },
        })
        if (negocio) {
          const payload = reviewReplyNotification(negocio.nombre)
          await createNotification({
            userId: resenaWithCliente.clienteId,
            userType: "cliente",
            tipo: "review",
            titulo: payload.title,
            cuerpo: payload.body,
            negocioId: negocioId,
            pushSubscription: cliente?.pushSubscription,
            pushPayload: payload,
            cleanupExpired: { model: "cliente", id: resenaWithCliente.clienteId },
          })
        }
      }
    } catch (pushError) {
      console.error("[Push] Failed to send review reply notification:", pushError)
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error responding to resena (empleado):", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
