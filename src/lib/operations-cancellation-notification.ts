import { db } from "@/lib/db"
import {
  buildOperationsCancellationUrl,
  mergePushFanoutTargets,
  operacionesOrderCancelledNotification,
  reservePushEndpoint,
  resolveCorePushTargetsFromNormalized,
  sendPushToTargets,
  type OperationsCancellationArea,
  type PushFanoutTarget,
} from "@/lib/push"
import { getPushSubscriptionsForOwners } from "@/lib/push-subscription-repository"
import { safeErrorForLog } from "@/lib/log-safe-error"

type NotifyOperationsCancellationParams = {
  pedidoId: string
  negocioId: string
  metodoEntrega: string
  canceladoPor: string
  mesaNumero?: number | null
  excludeEmpleadoId?: string | null
  reservedPushEndpoints?: Set<string>
}

type OperationsRecipient = {
  id: string
  pushSubscription: string | null
}

function shortId(value: string | null | undefined) {
  if (!value) return null
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`
}

function areaForMetodoEntrega(metodoEntrega: string): OperationsCancellationArea {
  return metodoEntrega === "mesa" ? "salon" : "pyr"
}

export async function notifyOperationsOrderCancelled({
  pedidoId,
  negocioId,
  metodoEntrega,
  canceladoPor,
  mesaNumero,
  excludeEmpleadoId,
  reservedPushEndpoints,
}: NotifyOperationsCancellationParams): Promise<void> {
  const area = areaForMetodoEntrega(metodoEntrega)
  const negocio = await db.negocio.findUnique({
    where: { id: negocioId },
    select: { slug: true },
  })
  if (!negocio) return

  const empleados = await db.empleado.findMany({
    where: {
      negocioId,
      activo: true,
      eliminado: false,
      areaOperativa: area,
      cuentaOperativaId: { not: null },
      ...(excludeEmpleadoId ? { id: { not: excludeEmpleadoId } } : {}),
      cuentaOperativa: { activo: true, eliminado: false },
    },
    select: { id: true, pushSubscription: true },
  })

  const recipients = empleados as OperationsRecipient[]
  if (recipients.length === 0) return

  const panelUrl = buildOperationsCancellationUrl(negocio.slug, area, pedidoId)
  const payload = operacionesOrderCancelledNotification(
    pedidoId,
    area,
    canceladoPor,
    panelUrl,
    mesaNumero
  )

  await Promise.all(
    recipients.map((empleado) =>
      db.notificacion.create({
        data: {
          userId: empleado.id,
          userType: "empleado",
          tipo: "operaciones_order_cancelled",
          titulo: payload.title,
          cuerpo: payload.body,
          pedidoId,
          negocioId,
          datos: JSON.stringify({ area, mesaNumero: mesaNumero ?? null, url: panelUrl }),
        },
      }).catch((error) => {
        console.error("[Push/OperacionesCancelacion] Error persistiendo notificacion:", safeErrorForLog(error))
      })
    )
  )

  // P2-T05 H2/F21: una lectura normalizada batch por wave. El builder común
  // conserva la unión normalized+legacy y toda la semántica Stage4/H1 por
  // recipient; un fallo batch deja normalized vacío y permite legacy-only sin
  // reintentar N lecturas individuales.
  let normalizedByOwner: Awaited<ReturnType<typeof getPushSubscriptionsForOwners>> = new Map()
  try {
    normalizedByOwner = await getPushSubscriptionsForOwners(
      "empleado",
      recipients.map((empleado) => empleado.id),
      "default"
    )
  } catch (error) {
    console.error("[Push/OperacionesCancelacion] Error leyendo targets normalizados en batch:", safeErrorForLog(error))
  }
  const perRecipientTargets = recipients.map((empleado) =>
    resolveCorePushTargetsFromNormalized(
      "empleado",
      empleado.id,
      empleado.pushSubscription,
      normalizedByOwner.get(empleado.id) ?? []
    )
  )
  let targets: PushFanoutTarget[] = mergePushFanoutTargets(perRecipientTargets)
  if (reservedPushEndpoints) {
    targets = targets.filter((t) => reservePushEndpoint(t.raw, reservedPushEndpoints))
  }

  try {
    await sendPushToTargets(targets, payload)
  } catch (error) {
    console.error("[Push/OperacionesCancelacion] Error enviando notificacion:", {
      pedidoId: shortId(pedidoId),
      negocioId: shortId(negocioId),
      errorName: error instanceof Error ? error.name : "unknown",
    })
  }
}
