import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createNotification, orderUpdateNotification, newDeliveryNotification } from "@/lib/push"
import { parseAuthorizationBearer } from "@/lib/access-tokens"
import { revertirTarifaSiCorresponde, DeudaReversionError } from "@/lib/pedido-cancelacion-financiera"

function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  recibido: ["preparando", "cancelado"],
  preparando: ["en_camino", "listo_para_retirar", "cancelado"],
  en_camino: ["cancelado"],
  listo_para_retirar: ["entregado", "cancelado"],
}

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
    const { id: pedidoId } = await params
    const token = parseAuthorizationBearer(req.headers.get("authorization"))
    const body = await req.json()
    const { estado, motivo } = body

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 401, headers: NO_STORE_HEADERS })
    }
    if (!estado) {
      return NextResponse.json({ error: "estado es obligatorio" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const access = await validateAccess(token)
    if (!access) {
      return NextResponse.json({ error: "Token invalido" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const negocioId = access.negocioId
    const pedido = await db.pedido.findUnique({ where: { id: pedidoId } })

    if (!pedido || pedido.negocioId !== negocioId) {
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

    if (currentEstado === "preparando" && estado === "en_camino" && pedido.metodoEntrega !== "domicilio") {
      return NextResponse.json({ error: "Solo pedidos con delivery pueden pasar a 'en camino'" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    if (currentEstado === "listo_para_retirar" && estado === "entregado" && pedido.metodoEntrega !== "mesa" && !pedido.clienteConfirmaRecibido) {
      return NextResponse.json({ error: "El cliente aun no confirmo la recepcion del pedido" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    if (estado === "cancelado" && !motivo?.trim()) {
      return NextResponse.json({ error: "Debe indicar el motivo de cancelacion" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const updateData: Record<string, unknown> = { estado }

    if (estado === "cancelado") {
      updateData.canceladoPor = "vendedor"
      updateData.canceladoMotivo = motivo?.trim()
      updateData.canceladoFecha = new Date()
    }

    if (estado === "entregado") {
      updateData.entregadoFecha = new Date()
    }

    // La transición a "cancelado" usa CAS + transacción con reversión de deuda
    // condicional (Seguridad-2C); el resto de transiciones conserva el mismo `update`
    // de siempre (no llevan efecto financiero).
    let updated
    if (estado === "cancelado") {
      let outcome: { kind: "conflict" } | { kind: "cancelled" }
      try {
        outcome = await db.$transaction(async (tx) => {
          const cas = await tx.pedido.updateMany({
            where: { id: pedidoId, negocioId, estado: currentEstado },
            data: updateData,
          })
          if (cas.count !== 1) return { kind: "conflict" as const }

          // El helper relee tarifaServicio/deudaAcumulada frescos DESPUÉS de este CAS,
          // dentro de la misma transacción (Seguridad-2C.1) — nunca usa el `pedido`
          // leído antes de la transacción.
          await revertirTarifaSiCorresponde(tx, {
            id: pedidoId,
            negocioId,
          })

          return { kind: "cancelled" as const }
        })
      } catch (error) {
        if (error instanceof DeudaReversionError) {
          return NextResponse.json(
            { error: "No se pudo cancelar este pedido en este momento." },
            { status: 400, headers: NO_STORE_HEADERS }
          )
        }
        throw error
      }

      if (outcome.kind === "conflict") {
        return NextResponse.json(
          { error: "No se puede cambiar el estado de un pedido ya finalizado" },
          { status: 400, headers: NO_STORE_HEADERS }
        )
      }

      updated = await db.pedido.findUniqueOrThrow({
        where: { id: pedidoId },
        include: {
          items: {
            include: {
              producto: { select: { id: true, nombre: true, imagenUrl: true } },
            },
          },
        },
      })
    } else {
      updated = await db.pedido.update({
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
    }

    // Nota (Seguridad-2B): la tarifa de servicio ya no se cobra al entregar. La única
    // operación financiera del ciclo de vida del pedido es la confirmación de recepción
    // del cliente (PUT /api/cliente/pedidos/[id] action=confirmar).

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

    if (estado === "en_camino" && pedido.metodoEntrega === "domicilio") {
      try {
        const repartidores = await db.repartidorNegocio.findMany({
          where: { negocioId },
          include: {
            repartidor: { select: { id: true, pushSubscription: true, activo: true } },
          },
        })
        for (const rn of repartidores) {
          if (rn.repartidor.activo) {
            const payload = newDeliveryNotification(pedidoId, pedido.negocioNombre, pedido.direccion || "")
            await createNotification({
              userId: rn.repartidor.id,
              userType: "repartidor",
              tipo: "new_delivery",
              titulo: payload.title,
              cuerpo: payload.body,
              pedidoId,
              negocioId,
              pushSubscription: rn.repartidor.pushSubscription,
              pushPayload: payload,
              cleanupExpired: { model: "repartidor", id: rn.repartidor.id },
            })
          }
        }
      } catch (pushError) {
        console.error("[Push] Failed to send delivery notification to repartidores:", pushError)
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
    console.error("Error updating pedido estado (empleado):", error)
    return NextResponse.json({ error: "Error al actualizar estado del pedido" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
