import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createNotification, orderUpdateNotification, mesaOrderReadyNotification } from "@/lib/push"
import { parseAuthorizationBearer } from "@/lib/access-tokens"

function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  recibido: ["preparando", "cancelado"],
  preparando: ["listo_para_retirar", "cancelado"],
  listo_para_retirar: ["entregado", "cancelado"],
}

const SERVICE_FEE_FIXED = 250
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pedidoId } = await params
    const token = parseAuthorizationBearer(req.headers.get("authorization"))
    const body = await req.json()
    const { estado } = body

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 401, headers: NO_STORE_HEADERS })
    }
    if (!estado) {
      return NextResponse.json({ error: "estado es obligatorio" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const negocio = await db.negocio.findFirst({
      where: { tokenSalon: token },
      select: { id: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token invalido" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const negocioId = negocio.id
    const pedido = await db.pedido.findUnique({ where: { id: pedidoId } })

    if (!pedido || pedido.negocioId !== negocioId) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404, headers: NO_STORE_HEADERS })
    }

    if (pedido.metodoEntrega !== "mesa") {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404, headers: NO_STORE_HEADERS })
    }

    const currentEstado = pedido.estado

    if (currentEstado === estado) {
      return NextResponse.json({ error: "El pedido ya esta en ese estado" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    if (currentEstado === "entregado" || currentEstado === "cancelado") {
      return NextResponse.json({ error: "No se puede cambiar el estado de un pedido ya finalizado" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const allowedTransitions = VALID_TRANSITIONS[currentEstado]
    if (!allowedTransitions || !allowedTransitions.includes(estado)) {
      return NextResponse.json({ error: `Transicion no valida: ${currentEstado} -> ${estado}` }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const updateData: Record<string, unknown> = { estado }

    if (estado === "cancelado") {
      updateData.canceladoPor = "vendedor"
      updateData.canceladoMotivo = "Cancelado desde salon"
      updateData.canceladoFecha = new Date()
    }

    if (estado === "entregado") {
      updateData.entregadoFecha = new Date()
    }

    const updated = await db.pedido.update({
      where: { id: pedidoId },
      data: updateData,
      include: {
        items: {
          include: {
            producto: { select: { id: true, nombre: true, imagenUrl: true } },
          },
        },
      },
    })

    if (estado === "entregado" && !pedido.deudaAcumulada) {
      await db.negocio.update({
        where: { id: negocioId },
        data: { deudaTarifa: { increment: SERVICE_FEE_FIXED } },
      })
    }

    if (pedido.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: pedido.clienteId },
          select: { pushSubscription: true },
        })
        const payload = orderUpdateNotification(pedidoId, pedido.negocioNombre, estado)
        await createNotification({
          userId: pedido.clienteId,
          userType: "cliente",
          tipo: "order_update",
          titulo: payload.title,
          cuerpo: payload.body,
          pedidoId,
          negocioId,
          pushSubscription: cliente?.pushSubscription ?? null,
          pushPayload: payload,
          cleanupExpired: { model: "cliente", id: pedido.clienteId },
        })
      } catch (pushError) {
        console.error("[Push] Failed to send order update notification:", pushError)
      }
    }

    if (estado === "listo_para_retirar" && pedido.mesaId) {
      try {
        console.log(`[Push/Mozo] Pedido ${pedidoId} -> listo_para_retirar. Resolviendo mozo (empleadoId=${pedido.empleadoId}, mesaId=${pedido.mesaId})`)

        let mozo: { id: string; nombre: string; pushSubscription: string | null } | null = null

        if (pedido.empleadoId) {
          mozo = await db.empleado.findFirst({
            where: {
              id: pedido.empleadoId,
              rol: "mozo",
              activo: true,
              eliminado: false,
            },
            select: { id: true, nombre: true, pushSubscription: true },
          })
          console.log(`[Push/Mozo] Mozo del pedido (empleadoId=${pedido.empleadoId}):`, mozo ? `${mozo.nombre} (push=${mozo.pushSubscription ? "si" : "no"})` : "no encontrado")
        }

        if (!mozo?.pushSubscription) {
          const mesa = await db.mesa.findUnique({
            where: { id: pedido.mesaId },
            include: {
              empleado: { select: { id: true, nombre: true, pushSubscription: true } },
            },
          })
          console.log(`[Push/Mozo] Mesa ${pedido.mesaId}:`, mesa ? `empleadoId=${mesa.empleadoId}, push=${mesa.empleado?.pushSubscription ? "si" : "no"}` : "no encontrada")
          if (mesa?.empleado?.pushSubscription) {
            const mesaMozo = await db.empleado.findFirst({
              where: {
                id: mesa.empleado.id,
                rol: "mozo",
                activo: true,
                eliminado: false,
              },
              select: { id: true, nombre: true, pushSubscription: true },
            })
            if (mesaMozo?.pushSubscription) {
              mozo = mesaMozo
            }
          }
        }

        if (mozo?.pushSubscription) {
          const mesa = await db.mesa.findUnique({
            where: { id: pedido.mesaId },
            select: { numero: true },
          })
          const mesaNumero = mesa?.numero ?? pedido.mesaNumero ?? 0
          const mozoPayload = mesaOrderReadyNotification(
            pedidoId,
            mesaNumero,
            pedido.clienteNombre
          )
          console.log(`[Push/Mozo] Enviando push a mozo ${mozo.id} (${mozo.nombre}) para mesa ${mesaNumero}`)
          await createNotification({
            userId: mozo.id,
            userType: "empleado",
            tipo: "mesa_order_ready",
            titulo: mozoPayload.title,
            cuerpo: mozoPayload.body,
            pedidoId,
            negocioId,
            datos: { mesaNumero },
            pushSubscription: mozo.pushSubscription,
            pushPayload: mozoPayload,
            cleanupExpired: { model: "empleado", id: mozo.id },
            awaitPush: true,
          })
          console.log(`[Push/Mozo] Push enviado para pedido ${pedidoId}`)
        } else {
          console.warn(`[Push/Mozo] No se encontro mozo con push subscription para pedido ${pedidoId} (empleadoId=${pedido.empleadoId}, mesaId=${pedido.mesaId})`)
        }
      } catch (mozoPushError) {
        console.error(`[Push/Mozo] Failed to send mozo notification for pedido ${pedidoId}:`, mozoPushError)
      }
    }

    const { clienteTelefono: _clienteTelefono, ...updatedSafe } = updated
    return NextResponse.json({
      ...updatedSafe,
      items: updated.items.map((item) => ({
        ...item,
        agregados: safeParseJSON(item.agregados, []),
        secciones: safeParseJSON(item.secciones, {}),
        seccionesPrecios: safeParseJSON(item.seccionesPrecios, {}),
        ingredientes: safeParseJSON(item.ingredientes, []),
        ingredientesQuitados: safeParseJSON(item.ingredientesQuitados, []),
      })),
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error updating pedido estado (salon):", error)
    return NextResponse.json({ error: "Error al actualizar estado del pedido" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
