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
  nombre: string
  pushSubscription: string | null
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
        nombre: true,
        pushSubscription: true,
      },
    })

    if (empleadoDelPedido) return empleadoDelPedido
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
          nombre: true,
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
    nombre: empleado.nombre,
    pushSubscription: empleado.pushSubscription,
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

  const mozo = await resolveMozoDestino(pedido)
  if (!mozo) return

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

  if (!persisted.created || !mozo.pushSubscription) return

  try {
    await sendPushNotification(
      mozo.pushSubscription,
      payload,
      { model: "empleado", id: mozo.id }
    )
  } catch (error) {
    console.error(`[Push/Mozo] Error sending ready notification for pedido ${pedido.id}:`, error)
  }
}
