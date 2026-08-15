import { db } from "@/lib/db"
import {
  buildOperationsCancellationUrl,
  operacionesOrderCancelledNotification,
  reservePushEndpoint,
  sendPushNotification,
  type OperationsCancellationArea,
} from "@/lib/push"
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
  pushSubscription: string
}

function shortId(value: string | null | undefined) {
  if (!value) return null
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`
}

function parseSubscriptionEndpoint(subscriptionJson: string): string | null {
  try {
    const parsed = JSON.parse(subscriptionJson) as { endpoint?: unknown }
    return typeof parsed.endpoint === "string" && parsed.endpoint.trim()
      ? parsed.endpoint.trim()
      : null
  } catch {
    return null
  }
}

function areaForMetodoEntrega(metodoEntrega: string): OperationsCancellationArea {
  return metodoEntrega === "mesa" ? "salon" : "pyr"
}

function groupByEndpoint(recipients: OperationsRecipient[]) {
  const groups = new Map<string, { recipientIds: string[]; subscriptionJson: string }>()

  for (const recipient of recipients) {
    const endpoint = parseSubscriptionEndpoint(recipient.pushSubscription)
    if (!endpoint) continue

    const existing = groups.get(endpoint)
    if (existing) {
      existing.recipientIds.push(recipient.id)
    } else {
      groups.set(endpoint, {
        recipientIds: [recipient.id],
        subscriptionJson: recipient.pushSubscription,
      })
    }
  }

  return groups
}

async function clearExpiredEmployeeSubscriptions(ids: string[], negocioId: string) {
  if (ids.length === 0) return
  await db.empleado.updateMany({
    where: { id: { in: ids }, negocioId },
    data: { pushSubscription: null },
  }).catch(() => undefined)
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
      pushSubscription: { not: null },
      ...(excludeEmpleadoId ? { id: { not: excludeEmpleadoId } } : {}),
      cuentaOperativa: { activo: true, eliminado: false },
    },
    select: { id: true, pushSubscription: true },
  })

  const recipients = empleados.filter(
    (empleado): empleado is OperationsRecipient => typeof empleado.pushSubscription === "string"
  )
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

  const groups = groupByEndpoint(recipients)
  for (const group of groups.values()) {
    const [primaryId, ...restIds] = group.recipientIds
    if (reservedPushEndpoints && !reservePushEndpoint(group.subscriptionJson, reservedPushEndpoints)) {
      continue
    }
    try {
      await sendPushNotification(group.subscriptionJson, payload, {
        model: "empleado",
        id: primaryId,
        field: "pushSubscription",
        suppressEndpointLog: true,
        onExpired: () => {
          void clearExpiredEmployeeSubscriptions(restIds, negocioId)
        },
      })
    } catch (error) {
      console.error("[Push/OperacionesCancelacion] Error enviando notificacion:", {
        pedidoId: shortId(pedidoId),
        negocioId: shortId(negocioId),
        errorName: error instanceof Error ? error.name : "unknown",
      })
    }
  }
}
