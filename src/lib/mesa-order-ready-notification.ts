import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { mesaOrderReadyNotification, sendPushNotification } from "@/lib/push"

type ReadyMesaPedido = {
  id: string
  negocioId: string
  negocioSlug: string
  metodoEntrega: string
  mesaId: string | null
  mesaNumero: number | null
  empleadoId: string | null
}

type MozoDestino = {
  id: string
  pushSubscription: string | null
  source: "pedido" | "mesa"
}

type PersistReadyNotificationParams = {
  mozoId: string
  pedidoId: string
  negocioId: string
  titulo: string
  cuerpo: string
  mesaNumero: number
  panelUrl: string
}

const SERIALIZATION_RETRY_LIMIT = 3

function shortId(value: string | null | undefined) {
  if (!value) return null
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`
}

function logMesaOrderReady(
  event: string,
  details: Record<string, string | number | boolean | null>
) {
  console.info(`[MozoPush] ${event}`, details)
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
}

async function resolveMozoDestino(pedido: ReadyMesaPedido): Promise<MozoDestino | null> {
  if (pedido.metodoEntrega !== "mesa") return null

  if (pedido.empleadoId) {
    const empleadoDelPedido = await db.empleado.findFirst({
      where: {
        id: pedido.empleadoId,
        negocioId: pedido.negocioId,
        rol: "mozo",
        activo: true,
        eliminado: false,
      },
      select: {
        id: true,
        pushSubscription: true,
      },
    })

    if (empleadoDelPedido) {
      return {
        id: empleadoDelPedido.id,
        pushSubscription: empleadoDelPedido.pushSubscription,
        source: "pedido",
      }
    }
  }

  if (!pedido.mesaId) return null

  const mesa = await db.mesa.findFirst({
    where: {
      id: pedido.mesaId,
      negocioId: pedido.negocioId,
      activa: true,
    },
    select: {
      empleado: {
        select: {
          id: true,
          rol: true,
          activo: true,
          eliminado: true,
          negocioId: true,
          pushSubscription: true,
        },
      },
    },
  })

  const empleado = mesa?.empleado
  if (
    !empleado ||
    empleado.negocioId !== pedido.negocioId ||
    empleado.rol !== "mozo" ||
    !empleado.activo ||
    empleado.eliminado
  ) {
    return null
  }

  return {
    id: empleado.id,
    pushSubscription: empleado.pushSubscription,
    source: "mesa",
  }
}

async function resolveMesaNumero(pedido: ReadyMesaPedido) {
  if (typeof pedido.mesaNumero === "number") return pedido.mesaNumero
  if (!pedido.mesaId) return null

  const mesa = await db.mesa.findFirst({
    where: {
      id: pedido.mesaId,
      negocioId: pedido.negocioId,
    },
    select: { numero: true },
  })

  return mesa?.numero ?? null
}

async function persistMesaOrderReadyNotificationOnce({
  mozoId,
  pedidoId,
  negocioId,
  titulo,
  cuerpo,
  mesaNumero,
  panelUrl,
}: PersistReadyNotificationParams) {
  for (let attempt = 1; attempt <= SERIALIZATION_RETRY_LIMIT; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const existingNotification = await tx.notificacion.findFirst({
            where: {
              userId: mozoId,
              userType: "empleado",
              tipo: "mesa_order_ready",
              pedidoId,
            },
            select: { id: true },
          })

          if (existingNotification) {
            return { created: false }
          }

          await tx.notificacion.create({
            data: {
              userId: mozoId,
              userType: "empleado",
              tipo: "mesa_order_ready",
              titulo,
              cuerpo,
              pedidoId,
              negocioId,
              datos: JSON.stringify({
                mesaNumero,
                url: panelUrl,
                navigateTo: {
                  empleado: "salon",
                },
              }),
            },
          })

          return { created: true }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      if (isSerializationConflict(error) && attempt < SERIALIZATION_RETRY_LIMIT) {
        continue
      }
      throw error
    }
  }

  return { created: false }
}

export async function notifyMesaOrderReadyForMozo({
  pedido,
  estadoAnterior,
}: {
  pedido: ReadyMesaPedido
  estadoAnterior: string
}) {
  if (estadoAnterior === "listo_para_retirar") return
  if (pedido.metodoEntrega !== "mesa") return
  if (!pedido.mesaId) return

  logMesaOrderReady("mesa_order_ready_started", {
    pedidoId: shortId(pedido.id),
    negocioId: shortId(pedido.negocioId),
    hasMesaId: true,
    hasEmpleadoId: !!pedido.empleadoId,
  })

  const mozo = await resolveMozoDestino(pedido)
  if (!mozo) return

  logMesaOrderReady("mesa_order_ready_mozo_resolved", {
    pedidoId: shortId(pedido.id),
    negocioId: shortId(pedido.negocioId),
    mozoId: shortId(mozo.id),
    source: mozo.source,
    hasPushSubscription: !!mozo.pushSubscription,
  })

  const mesaNumero = await resolveMesaNumero(pedido)
  if (mesaNumero === null) return

  const panelUrl = `/mozo/panel/${encodeURIComponent(pedido.negocioSlug)}`
  const payload = mesaOrderReadyNotification(pedido.id, mesaNumero, { panelUrl })
  const persisted = await persistMesaOrderReadyNotificationOnce({
    mozoId: mozo.id,
    pedidoId: pedido.id,
    negocioId: pedido.negocioId,
    titulo: payload.title,
    cuerpo: payload.body,
    mesaNumero,
    panelUrl,
  })

  if (!persisted.created) return

  if (!mozo.pushSubscription) {
    logMesaOrderReady("mesa_order_ready_subscription_missing", {
      pedidoId: shortId(pedido.id),
      negocioId: shortId(pedido.negocioId),
      mozoId: shortId(mozo.id),
    })
    return
  }

  try {
    let expired = false
    const sent = await sendPushNotification(
      mozo.pushSubscription,
      payload,
      {
        model: "empleado",
        id: mozo.id,
        suppressEndpointLog: true,
        onExpired: () => {
          expired = true
          logMesaOrderReady("mesa_order_ready_subscription_expired", {
            pedidoId: shortId(pedido.id),
            negocioId: shortId(pedido.negocioId),
            mozoId: shortId(mozo.id),
          })
        },
      }
    )

    if (sent) {
      logMesaOrderReady("mesa_order_ready_push_sent", {
        pedidoId: shortId(pedido.id),
        negocioId: shortId(pedido.negocioId),
        mozoId: shortId(mozo.id),
      })
      return
    }

    logMesaOrderReady("mesa_order_ready_push_delivery_failed", {
      pedidoId: shortId(pedido.id),
      negocioId: shortId(pedido.negocioId),
      mozoId: shortId(mozo.id),
      expired,
    })
  } catch (error) {
    logMesaOrderReady("mesa_order_ready_push_delivery_failed", {
      pedidoId: shortId(pedido.id),
      negocioId: shortId(pedido.negocioId),
      mozoId: shortId(mozo.id),
      expired: false,
    })
    console.error("[Push/Mozo] Error sending ready notification", {
      pedidoId: shortId(pedido.id),
      errorName: error instanceof Error ? error.name : "unknown",
    })
  }
}
