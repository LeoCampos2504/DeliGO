import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { findSesionByToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { issueRoomCapability } from "@/lib/realtime-auth"
import {
  authorizeRealtimeOrder,
  normalizeRequestedScopes,
  type RealtimeActor,
  type RealtimeOrderSnapshot,
  type RealtimeUserType,
} from "@/lib/realtime-policy"

function noStore<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

async function getActor(req: NextRequest): Promise<(RealtimeActor & { sessionId: string }) | null> {
  const rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!rawToken) return null
  const session = await findSesionByToken(rawToken)
  if (!session || session.expiresAt <= new Date()) return null
  if (!["cliente", "negocio", "repartidor"].includes(session.userType)) return null

  const userType = session.userType as RealtimeUserType
  if (userType === "cliente") {
    const account = await db.cliente.findUnique({ where: { id: session.userId }, select: { id: true, bloqueado: true } })
    if (!account || account.bloqueado) return null
  } else if (userType === "negocio") {
    const account = await db.negocio.findUnique({ where: { id: session.userId }, select: { id: true, aprobado: true, suspendido: true } })
    if (!account || !account.aprobado || account.suspendido) return null
  } else {
    const account = await db.repartidor.findUnique({ where: { id: session.userId }, select: { id: true, activo: true, eliminado: true } })
    if (!account || !account.activo || account.eliminado) return null
  }

  return { userId: session.userId, userType, sessionId: session.id }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor(req)
    if (!actor) return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))

    const body = await req.json().catch(() => null) as { pedidoId?: unknown; requestedScopes?: unknown } | null
    const pedidoId = typeof body?.pedidoId === "string" ? body.pedidoId.trim() : ""
    const requestedScopes = normalizeRequestedScopes(body?.requestedScopes)
    if (!pedidoId || pedidoId.length > 128 || !requestedScopes) {
      return noStore(NextResponse.json({ error: "Solicitud realtime inválida" }, { status: 400 }))
    }

    const pedido = await db.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        id: true,
        clienteId: true,
        negocioId: true,
        repartidorId: true,
        estado: true,
        metodoEntrega: true,
        seguimientoDeliveryHabilitado: true,
        negocio: { select: { seguimientoDeliveryActivo: true } },
      },
    })
    if (!pedido) return noStore(NextResponse.json({ error: "Sin autorización para este pedido" }, { status: 403 }))

    let repartidorAssociationValid: boolean | undefined
    if (actor.userType === "repartidor" && requestedScopes.includes("tracking:publish")) {
      const association = await db.repartidorNegocio.findUnique({
        where: {
          repartidorId_negocioId: {
            repartidorId: actor.userId,
            negocioId: pedido.negocioId,
          },
        },
        select: { id: true },
      })
      repartidorAssociationValid = Boolean(association)
    }

    const order: RealtimeOrderSnapshot = {
      id: pedido.id,
      clienteId: pedido.clienteId,
      negocioId: pedido.negocioId,
      repartidorId: pedido.repartidorId,
      estado: pedido.estado,
      metodoEntrega: pedido.metodoEntrega,
      seguimientoDeliveryActivo: pedido.negocio?.seguimientoDeliveryActivo === true,
      seguimientoDeliveryHabilitado: pedido.seguimientoDeliveryHabilitado === true,
      repartidorAssociationValid,
    }
    const policy = authorizeRealtimeOrder(actor, order, requestedScopes)
    if (!policy.ok) return noStore(NextResponse.json({ error: "Sin autorización para este pedido", code: policy.code }, { status: 403 }))

    const token = await issueRoomCapability({
      userId: actor.userId,
      userType: actor.userType,
      sessionId: actor.sessionId,
      pedidoId,
      scopes: policy.scopes,
    })
    return noStore(NextResponse.json({ ok: true, token, room: `pedido:${pedidoId}`, scopes: policy.scopes, expiresIn: 120 }))
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo autorizar realtime" }, { status: 403 }))
  }
}
