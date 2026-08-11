import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"
import { createNotification, orderCancelledByClienteNotification, clientConfirmedNotification, reviewRequestNotification } from "@/lib/push"
import { revertirTarifaSiCorresponde, DeudaReversionError } from "@/lib/pedido-cancelacion-financiera"

// Confirmar recepción es la única operación que procesa tarifa/deuda del pedido
// (Seguridad-2B). Este error de dominio dispara el rollback completo de la
// transacción (confirmación + deuda) cuando el negocio no tiene cupo; nunca
// revela saldo, límite ni importe al cliente.
class DebtLimitExceededError extends Error {}

// Seguridad-6B: acciones sobre un pedido puntual de un cliente — nunca deben
// quedar cacheadas (navegador o proxy intermedio).
function noStoreJson<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json(data, init)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

// PUT /api/cliente/pedidos/[id] - Order actions (cancel, confirm receipt, repeat)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return noStoreJson({ error: "No autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body // "cancelar" | "confirmar"

    const pedido = await db.pedido.findUnique({
      where: { id },
      include: { items: true, negocio: true },
    })

    if (!pedido || pedido.clienteId !== cliente.id) {
      return noStoreJson({ error: "Pedido no encontrado" }, { status: 404 })
    }

    if (action === "cancelar") {
      // Can only cancel if still in early stages
      const cancellableStatuses = ["recibido", "confirmado"]

      // Check cancellation tolerance time (regla de negocio, no financiera — se evalúa
      // con los datos ya leídos antes de esta acción; no cambia por concurrencia).
      const tolerancia = pedido.negocio.toleranciaCancelacion ?? 5
      if (tolerancia > 0) {
        const tiempoTranscurrido = Date.now() - new Date(pedido.fecha).getTime()
        const toleranciaMs = tolerancia * 60 * 1000
        if (tiempoTranscurrido > toleranciaMs) {
          return noStoreJson(
            { error: `El tiempo de cancelación de ${tolerancia} min ya pasó` },
            { status: 400 }
          )
        }
      } else {
        // tolerancia = 0 means no cancellation allowed
        return noStoreJson(
          { error: "Este negocio no permite cancelaciones" },
          { status: 400 }
        )
      }

      type CancelOutcome =
        | { kind: "conflict" }
        | { kind: "cancelled"; canceladoFecha: Date }

      let outcome: CancelOutcome
      try {
        outcome = await db.$transaction(async (tx) => {
          // Lectura fresca dentro de la transacción: la decisión de cancelar y de
          // revertir deuda nunca se basa en el `pedido` leído antes de esta acción.
          const current = await tx.pedido.findFirst({
            where: { id, clienteId: cliente.id },
            select: {
              negocioId: true,
              estado: true,
            },
          })
          if (!current || !cancellableStatuses.includes(current.estado)) {
            return { kind: "conflict" as const }
          }

          const now = new Date()

          // CAS: solo gana quien encuentre el pedido todavía en un estado cancelable.
          // Evita que dos requests concurrentes (doble click, dos pestañas, reintento,
          // o una cancelación desde otro rol) cancelen y reviertan deuda dos veces.
          const cas = await tx.pedido.updateMany({
            where: {
              id,
              clienteId: cliente.id,
              estado: { in: cancellableStatuses },
            },
            data: {
              estado: "cancelado",
              canceladoPor: "cliente",
              canceladoFecha: now,
            },
          })

          if (cas.count !== 1) {
            return { kind: "conflict" as const }
          }

          // Reversión única de deuda: el helper relee tarifaServicio/deudaAcumulada
          // frescos DESPUÉS de este CAS, dentro de la misma transacción (Seguridad-2C.1)
          // — nunca usa el snapshot de `current` leído antes de cancelar. Si no hay
          // cupo para revertir, lanza DeudaReversionError y hace rollback de todo
          // (incluido el CAS de arriba).
          await revertirTarifaSiCorresponde(tx, {
            id,
            negocioId: current.negocioId,
          })

          return { kind: "cancelled" as const, canceladoFecha: now }
        })
      } catch (error) {
        if (error instanceof DeudaReversionError) {
          return noStoreJson(
            { error: "No se pudo cancelar este pedido en este momento." },
            { status: 400 }
          )
        }
        throw error
      }

      if (outcome.kind === "conflict") {
        return noStoreJson(
          { error: "Este pedido ya no se puede cancelar" },
          { status: 400 }
        )
      }

      // Notify negocio that the order was cancelled by the client
      try {
        const negocioData = await db.negocio.findUnique({
          where: { id: pedido.negocioId },
          select: { pushSubscription: true },
        })
        const payload = orderCancelledByClienteNotification(id, pedido.clienteNombre)
        await createNotification({
          userId: pedido.negocioId,
          userType: "negocio",
          tipo: "order_update",
          titulo: payload.title,
          cuerpo: payload.body,
          pedidoId: id,
          // 19-B0.2E1: el cuerpo embebe clienteNombre — cliente.id es la
          // sesión autenticada que ejecuta esta cancelación (verificada
          // contra pedido.clienteId más arriba).
          sourceClienteId: cliente.id,
          pushSubscription: negocioData?.pushSubscription ?? null,
          pushPayload: payload,
          cleanupExpired: { model: "negocio", id: pedido.negocioId },
        })
      } catch (pushError) {
        console.error("[Push] Failed to send cancellation notification:", pushError)
      }

      return noStoreJson({
        ok: true,
        pedido: {
          id,
          estado: "cancelado",
          canceladoPor: "cliente",
          canceladoFecha: outcome.canceladoFecha,
        },
      })
    }

    if (action === "confirmar") {
      // Can only confirm if ready for pickup or in delivery
      const confirmableStatuses = ["listo_para_retirar", "en_camino"]

      type ConfirmOutcome =
        | { kind: "not_found" }
        | { kind: "invalid_state" }
        | { kind: "already_confirmed"; clienteConfirmaFecha: Date | null }
        | { kind: "confirmed"; clienteConfirmaFecha: Date }

      let outcome: ConfirmOutcome
      try {
        outcome = await db.$transaction(async (tx) => {
          // Lectura fresca dentro de la transacción: la decisión financiera nunca
          // se basa en el `pedido` leído antes de entrar a la acción.
          const current = await tx.pedido.findFirst({
            where: { id, clienteId: cliente.id },
            select: {
              negocioId: true,
              estado: true,
              tarifaServicio: true,
              clienteConfirmaRecibido: true,
              clienteConfirmaFecha: true,
              deudaAcumulada: true,
            },
          })
          if (!current) return { kind: "not_found" as const }

          if (current.clienteConfirmaRecibido) {
            return { kind: "already_confirmed" as const, clienteConfirmaFecha: current.clienteConfirmaFecha }
          }

          if (!confirmableStatuses.includes(current.estado)) {
            return { kind: "invalid_state" as const }
          }

          const now = new Date()

          // CAS: solo gana quien encuentre el pedido todavía sin confirmar. Evita que
          // dos requests concurrentes (doble click, dos pestañas, reintento) confirmen
          // y cobren dos veces.
          const cas = await tx.pedido.updateMany({
            where: {
              id,
              clienteId: cliente.id,
              clienteConfirmaRecibido: false,
              estado: { in: confirmableStatuses },
            },
            data: {
              clienteConfirmaRecibido: true,
              clienteConfirmaFecha: now,
              deudaAcumulada: true,
            },
          })

          if (cas.count !== 1) {
            // Perdió la carrera: otra request ya confirmó, o el estado cambió entre la
            // lectura y el CAS (p. ej. cancelado por el vendedor mientras tanto).
            const after = await tx.pedido.findFirst({
              where: { id, clienteId: cliente.id },
              select: { clienteConfirmaRecibido: true, clienteConfirmaFecha: true },
            })
            if (after?.clienteConfirmaRecibido) {
              return { kind: "already_confirmed" as const, clienteConfirmaFecha: after.clienteConfirmaFecha }
            }
            return { kind: "invalid_state" as const }
          }

          // Única operación financiera del ciclo de vida del pedido: se procesa acá,
          // una única vez, atada al ganador del CAS. `pedido.tarifaServicio` es el
          // único monto usado (nunca un literal fijo ni un valor del cliente). Los
          // pedidos de mesa con tarifaServicio=0 nunca generan deuda.
          if (current.tarifaServicio > 0 && !current.deudaAcumulada) {
            const negocio = await tx.negocio.findUnique({
              where: { id: current.negocioId },
              select: { deudaTarifa: true, limiteDeuda: true },
            })
            if (!negocio) {
              throw new DebtLimitExceededError()
            }

            const limiteDeuda = negocio.limiteDeuda ?? 10000
            const negocioUpdate = await tx.negocio.updateMany({
              where: {
                id: current.negocioId,
                deudaTarifa: { lte: limiteDeuda - current.tarifaServicio },
              },
              data: {
                deudaTarifa: { increment: current.tarifaServicio },
              },
            })

            if (negocioUpdate.count !== 1) {
              // Sin cupo de deuda: revertir también la confirmación (throw hace
              // rollback de toda la transacción, incluido el CAS de arriba).
              throw new DebtLimitExceededError()
            }
          }

          return { kind: "confirmed" as const, clienteConfirmaFecha: now }
        })
      } catch (error) {
        if (error instanceof DebtLimitExceededError) {
          return noStoreJson(
            { error: "No se pudo confirmar la recepción de este pedido en este momento." },
            { status: 400 }
          )
        }
        throw error
      }

      if (outcome.kind === "not_found") {
        return noStoreJson({ error: "Pedido no encontrado" }, { status: 404 })
      }

      if (outcome.kind === "invalid_state") {
        return noStoreJson(
          { error: "Este pedido no se puede confirmar todavía" },
          { status: 400 }
        )
      }

      // Respuesta segura: nunca expone tarifaServicio, deudaAcumulada, deudaTarifa,
      // limiteDeuda ni negocioId. El frontend actual solo revisa `res.ok` e invalida
      // queries — no lee campos de `pedido` en la respuesta de esta acción.
      const responseBody = {
        ok: true,
        pedido: {
          id,
          estado: pedido.estado,
          clienteConfirmaRecibido: true,
          clienteConfirmaFecha: outcome.clienteConfirmaFecha,
        },
      }

      if (outcome.kind === "already_confirmed") {
        // Repetición idempotente: mismo éxito, sin un segundo efecto financiero ni
        // una segunda ronda de notificaciones.
        return noStoreJson(responseBody)
      }

      // Notify negocio and repartidor that client confirmed receipt
      try {
        // Notify negocio
        const negocioData = await db.negocio.findUnique({
          where: { id: pedido.negocioId },
          select: { pushSubscription: true },
        })
        const confirmedPayload = clientConfirmedNotification(id, pedido.clienteNombre)
        await createNotification({
          userId: pedido.negocioId,
          userType: "negocio",
          tipo: "order_update",
          titulo: confirmedPayload.title,
          cuerpo: confirmedPayload.body,
          pedidoId: id,
          // 19-B0.2E1: el cuerpo embebe clienteNombre — cliente.id es la
          // sesión autenticada que confirma la recepción.
          sourceClienteId: cliente.id,
          pushSubscription: negocioData?.pushSubscription ?? null,
          pushPayload: confirmedPayload,
          cleanupExpired: { model: "negocio", id: pedido.negocioId },
        })

        // Notify repartidor (if delivery order, find associated repartidores)
        if (pedido.metodoEntrega === "domicilio") {
          const repartidores = await db.repartidorNegocio.findMany({
            where: { negocioId: pedido.negocioId },
            include: {
              repartidor: { select: { id: true, pushSubscription: true, activo: true } },
            },
          })
          for (const rn of repartidores) {
            if (rn.repartidor.activo) {
              const repPayload = clientConfirmedNotification(id, pedido.clienteNombre)
              await createNotification({
                userId: rn.repartidor.id,
                userType: "repartidor",
                tipo: "order_update",
                titulo: repPayload.title,
                cuerpo: repPayload.body,
                pedidoId: id,
                // 19-B0.2E1: el cuerpo embebe clienteNombre.
                sourceClienteId: cliente.id,
                pushSubscription: rn.repartidor.pushSubscription,
                pushPayload: repPayload,
                cleanupExpired: { model: "repartidor", id: rn.repartidor.id },
              })
            }
          }
        }
      } catch (pushError) {
        console.error("[Push] Failed to send confirmation notification:", pushError)
      }

      // Send "rate your order" notification after delay (for retiro/mesa orders delivered by negocio)
      if (pedido.estado === "listo_para_retirar") {
        const negocioNombre = pedido.negocioNombre
        setTimeout(async () => {
          try {
            const existingReview = await db.resena.findUnique({
              where: { pedidoId: id },
              select: { id: true },
            })
            if (!existingReview && pedido.clienteId) {
              const clienteForReview = await db.cliente.findUnique({
                where: { id: pedido.clienteId! },
                select: { pushSubscription: true },
              })
              const reviewPayload = reviewRequestNotification(id, negocioNombre)
              await createNotification({
                userId: pedido.clienteId!,
                userType: "cliente",
                tipo: "review_request",
                titulo: reviewPayload.title,
                cuerpo: reviewPayload.body,
                pedidoId: id,
                pushSubscription: clienteForReview?.pushSubscription ?? null,
                pushPayload: reviewPayload,
                cleanupExpired: { model: "cliente", id: pedido.clienteId! },
              })
            }
          } catch (reviewPushError) {
            console.error("[Push] Failed to send review request notification:", reviewPushError)
          }
        }, 2 * 60 * 1000) // 2 minutes
      }

      return noStoreJson(responseBody)
    }

    return noStoreJson({ error: "Acción no válida" }, { status: 400 })
  } catch (error) {
    console.error("Cliente pedido PUT error:", error)
    return noStoreJson({ error: "Error interno del servidor" }, { status: 500 })
  }
}
