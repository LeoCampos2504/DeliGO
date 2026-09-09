import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { createNotification, orderUpdateNotification, newDeliveryNotification, reviewRequestNotification } from "@/lib/push"
import { acquireLock, releaseLock } from "@/lib/concurrency"
import { logPedidoEstadoChange } from "@/lib/audit"
import { notifyMesaOrderReadyForMozo } from "@/lib/mesa-order-ready-notification"
import { notifyOperationsOrderCancelled } from "@/lib/operations-cancellation-notification"
import { revertirTarifaSiCorresponde, DeudaReversionError } from "@/lib/pedido-cancelacion-financiera"
import { getIngredientesQuitadosNombres } from "@/lib/pedido-item-personalizacion"
import { safeErrorForLog } from "@/lib/log-safe-error"

// Helper to parse JSON fields safely
function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

// Seguridad-6B.2: cambios de estado de pedido — datos privados del negocio,
// nunca cacheables.
function noStoreJson<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json(data, init)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  recibido: ["preparando", "cancelado"],
  preparando: ["en_camino", "listo_para_retirar", "cancelado"],
  en_camino: ["cancelado"], // business cannot mark entregado for delivery — client + repartidor handle that
  listo_para_retirar: ["entregado", "cancelado"], // entregado only if clienteConfirmaRecibido
}

// P2-T28: punto de pausa SOLO para el test determinista de ownership del
// state lock (ver src/app/api/negocio/pedidos/[id]/estado/order-estado-lock-ownership.test.ts).
// Se dispara al principio del `try`, que sólo se alcanza DESPUÉS de un
// `acquireLock` exitoso (ver más abajo) — mientras esta request sigue
// pausada acá, sigue sosteniendo `estadoLockKey`.
export interface PedidoEstadoRouteTestHooks {
  afterStateLockAcquired?: () => Promise<void>
}

// PATCH - Update order status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pedidoId } = await params
  return handlePedidoEstadoChange(req, pedidoId)
}

export async function PATCH_FOR_TESTS(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  testHooks: PedidoEstadoRouteTestHooks
) {
  const { id: pedidoId } = await params
  return handlePedidoEstadoChange(req, pedidoId, testHooks)
}

async function handlePedidoEstadoChange(
  req: NextRequest,
  pedidoId: string,
  testHooks?: PedidoEstadoRouteTestHooks
) {
  // Concurrency protection: compute lock key before try so it's accessible in finally
  const estadoLockKey = `pedido-estado:${pedidoId}`

  // Concurrency protection: prevent double status updates on the same order.
  //
  // P2-T28 (revisión humana de R2C): a diferencia de `orderLockKey` en
  // src/app/api/pedidos/route.ts (donde este mismo chequeo vivía DENTRO del
  // `try`, así que un `acquireLock` fallido igual llegaba al `finally` y
  // liberaba el lock ajeno — el bug material que R2C corrigió), acá el
  // chequeo y su `return` temprano viven DESDE SIEMPRE fuera del `try`. Una
  // request cuyo `acquireLock` falla nunca entra al `try`/`finally` de abajo
  // — nunca puede ejecutar `releaseLock(estadoLockKey)` — así que no
  // reproduce el mismo patrón. Confirmado empíricamente, no sólo por
  // lectura de código (ver
  // codex-reports/P2_T28_ORDER_STATE_LOCK_OWNERSHIP_HARDENING_R1.md):
  // FAILED_ACQUIRE_REACHES_FINALLY=NO para este endpoint.
  if (!acquireLock(estadoLockKey)) {
    return noStoreJson(
      { error: "El estado de este pedido se está actualizando. Intentá de nuevo." },
      { status: 409 }
    )
  }

  try {
    await testHooks?.afterStateLockAcquired?.()

    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return noStoreJson({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return noStoreJson({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const body = await req.json()
    const { estado, motivo } = body

    if (!estado) {
      return noStoreJson(
        { error: "estado es obligatorio" },
        { status: 400 }
      )
    }

    // Get the pedido
    const pedido = await db.pedido.findUnique({ where: { id: pedidoId } })

    if (!pedido || pedido.negocioId !== negocioId) {
      return noStoreJson(
        { error: "Pedido no encontrado" },
        { status: 404 }
      )
    }

    // Validate state transition
    const currentEstado = pedido.estado

    if (currentEstado === estado) {
      return noStoreJson(
        { error: "El pedido ya está en ese estado" },
        { status: 400 }
      )
    }

    // Already in terminal state
    if (currentEstado === "entregado" || currentEstado === "cancelado") {
      return noStoreJson(
        { error: "No se puede cambiar el estado de un pedido ya finalizado" },
        { status: 400 }
      )
    }

    const allowedTransitions = VALID_TRANSITIONS[currentEstado]
    if (!allowedTransitions || !allowedTransitions.includes(estado)) {
      return noStoreJson(
        { error: `Transición no válida: ${currentEstado} → ${estado}` },
        { status: 400 }
      )
    }

    // Validate: preparando → en_camino only for delivery orders
    if (
      currentEstado === "preparando" &&
      estado === "en_camino" &&
      pedido.metodoEntrega !== "domicilio"
    ) {
      return noStoreJson(
        { error: "Solo pedidos con delivery pueden pasar a 'en camino'" },
        { status: 400 }
      )
    }

    // Validate: listo_para_retirar → entregado requires client confirmation (except mesa orders)
    if (
      currentEstado === "listo_para_retirar" &&
      estado === "entregado" &&
      pedido.metodoEntrega !== "mesa" &&
      !pedido.clienteConfirmaRecibido
    ) {
      return noStoreJson(
        { error: "El cliente aún no confirmó la recepción del pedido" },
        { status: 400 }
      )
    }

    // Validate: cancelado requires motivo
    if (estado === "cancelado" && !motivo?.trim()) {
      return noStoreJson(
        { error: "Debe indicar el motivo de cancelación" },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = { estado }

    if (estado === "cancelado") {
      updateData.canceladoPor = "vendedor"
      updateData.canceladoMotivo = motivo?.trim()
      updateData.canceladoFecha = new Date()
    }

    if (estado === "entregado") {
      updateData.entregadoFecha = new Date()
    }

    // Update the order. La transición a "cancelado" usa CAS + transacción con reversión
    // de deuda condicional (Seguridad-2C); el resto de transiciones conserva el mismo
    // `update` de siempre (no llevan efecto financiero).
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
          return noStoreJson(
            { error: "No se pudo cancelar este pedido en este momento." },
            { status: 400 }
          )
        }
        throw error
      }

      if (outcome.kind === "conflict") {
        return noStoreJson(
          { error: "No se puede cambiar el estado de un pedido ya finalizado" },
          { status: 400 }
        )
      }

      updated = await db.pedido.findUniqueOrThrow({
        where: { id: pedidoId },
        include: {
          items: {
            include: {
              producto: {
                select: { id: true, nombre: true, imagenUrl: true },
              },
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
              producto: {
                select: { id: true, nombre: true, imagenUrl: true },
              },
            },
          },
        },
      })
    }

    // Audit log
    await logPedidoEstadoChange({
      pedidoId,
      estadoNuevo: estado,
      estadoAnterior: currentEstado,
      userId: negocioId,
      userType: "negocio",
    })

    // Nota (Seguridad-2B): la tarifa de servicio ya no se cobra al entregar. La única
    // operación financiera del ciclo de vida del pedido es la confirmación de recepción
    // del cliente (PUT /api/cliente/pedidos/[id] action=confirmar).

    const cancellationPushEndpoints = estado === "cancelado" ? new Set<string>() : undefined

    // Send notification to the client about order status update
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
          pedidoId: pedidoId,
          negocioId: negocioId,
          pushSubscription: cliente?.pushSubscription ?? null,
          pushPayload: payload,
          reservedPushEndpoints: cancellationPushEndpoints,
          cleanupExpired: { model: "cliente", id: pedido.clienteId },
        })
      } catch (pushError) {
        console.error("[Push] Failed to send order update notification:", safeErrorForLog(pushError))
      }
    }

    if (estado === "cancelado") {
      try {
        await notifyOperationsOrderCancelled({
          pedidoId,
          negocioId,
          metodoEntrega: pedido.metodoEntrega,
          mesaNumero: pedido.mesaNumero,
          canceladoPor: "vendedor",
          reservedPushEndpoints: cancellationPushEndpoints,
        })
      } catch (pushError) {
        console.error("[Push] Failed to send operations cancellation notification:", safeErrorForLog(pushError))
      }
    }

    // Notify repartidores when order goes to en_camino (delivery)
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
              pedidoId: pedidoId,
              negocioId: negocioId,
              // 19-B0.2E1: el cuerpo embebe la dirección de entrega del Cliente.
              sourceClienteId: pedido.clienteId,
              pushSubscription: rn.repartidor.pushSubscription,
              pushPayload: payload,
              cleanupExpired: { model: "repartidor", id: rn.repartidor.id },
            })
          }
        }
      } catch (pushError) {
        console.error("[Push] Failed to send delivery notification to repartidores:", safeErrorForLog(pushError))
      }
    }

    if (estado === "listo_para_retirar" && pedido.metodoEntrega === "mesa") {
      try {
        await notifyMesaOrderReadyForMozo({
          pedido: {
            id: pedidoId,
            negocioId,
            negocioSlug: pedido.negocioSlug,
            metodoEntrega: pedido.metodoEntrega,
            mesaId: pedido.mesaId,
            mesaNumero: pedido.mesaNumero,
            empleadoId: pedido.empleadoId,
          },
          estadoAnterior: currentEstado,
        })
      } catch (mozoPushError) {
        console.error(`[Push/Mozo] Failed to notify ready mesa order for pedido ${pedidoId}:`, safeErrorForLog(mozoPushError))
      }
    }

    // Send "rate your order" notification when order is delivered (retiro/mesa by negocio)
    if (estado === "entregado" && pedido.clienteId) {
      const negocioNombre = pedido.negocioNombre
      setTimeout(async () => {
        try {
          const existingReview = await db.resena.findUnique({
            where: { pedidoId },
            select: { id: true },
          })
          if (!existingReview) {
            const clienteForReview = await db.cliente.findUnique({
              where: { id: pedido.clienteId! },
              select: { pushSubscription: true },
            })
            const payload = reviewRequestNotification(pedidoId, negocioNombre)
            await createNotification({
              userId: pedido.clienteId!,
              userType: "cliente",
              tipo: "review_request",
              titulo: payload.title,
              cuerpo: payload.body,
              pedidoId: pedidoId,
              negocioId: negocioId,
              pushSubscription: clienteForReview?.pushSubscription ?? null,
              pushPayload: payload,
              cleanupExpired: { model: "cliente", id: pedido.clienteId! },
            })
          }
        } catch (reviewPushError) {
          console.error("[Push] Failed to send review request notification:", safeErrorForLog(reviewPushError))
        }
      }, 2 * 60 * 1000) // 2 minutes
    }

    const { clienteTelefono: _ct, ...updatedSafe } = updated
    return noStoreJson({
      ...updatedSafe,
      items: updated.items.map((item) => ({
        ...item,
        agregados: safeParseJSON(item.agregados, []),
        secciones: safeParseJSON(item.secciones, {}),
        seccionesPrecios: safeParseJSON(item.seccionesPrecios, {}),
        ingredientes: safeParseJSON(item.ingredientes, []),
        // P1-A.2A-ii: mismo contrato plano estable que el listado principal
        // (GET /api/negocio/pedidos) — string[] normalizado, nunca un objeto crudo.
        ingredientesQuitados: getIngredientesQuitadosNombres(item.ingredientesQuitados),
      })),
    })
  } catch (error) {
    console.error("Error updating pedido estado:", safeErrorForLog(error))
    return noStoreJson(
      { error: "Error al actualizar estado del pedido" },
      { status: 500 }
    )
  } finally {
    // Always release the lock, even on error
    releaseLock(estadoLockKey)
  }
}
