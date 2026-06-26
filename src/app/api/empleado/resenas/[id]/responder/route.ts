import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createNotification, reviewReplyNotification } from "@/lib/push"
import { parseAuthorizationBearer } from "@/lib/access-tokens"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

async function validateAccess(token: string): Promise<{ negocioId: string } | null> {
  if (!token) return null
  const negocio = await db.negocio.findFirst({
    where: { tokenEmpleados: token },
    select: { id: true },
  })
  return negocio ? { negocioId: negocio.id } : null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: resenaId } = await params
    const token = parseAuthorizationBearer(req.headers.get("authorization"))
    const body = await req.json()
    const { respuestaNegocio } = body

    if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 401, headers: NO_STORE_HEADERS })
    if (!respuestaNegocio?.trim()) {
      return NextResponse.json({ error: "La respuesta no puede estar vacia" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const access = await validateAccess(token)
    if (!access) return NextResponse.json({ error: "Token invalido" }, { status: 401, headers: NO_STORE_HEADERS })

    const negocioId = access.negocioId
    const resena = await db.resena.findUnique({ where: { id: resenaId } })
    if (!resena || resena.negocioId !== negocioId) {
      return NextResponse.json({ error: "Resena no encontrada" }, { status: 404, headers: NO_STORE_HEADERS })
    }

    const updated = await db.resena.update({
      where: { id: resenaId },
      data: {
        respuestaNegocio: respuestaNegocio.trim(),
        fechaRespuesta: new Date(),
      },
    })

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
            negocioId,
            pushSubscription: cliente?.pushSubscription,
            pushPayload: payload,
            cleanupExpired: { model: "cliente", id: resenaWithCliente.clienteId },
          })
        }
      }
    } catch (pushError) {
      console.error("[Push] Failed to send review reply notification:", pushError)
    }

    return NextResponse.json(updated, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error responding to resena (empleado):", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
