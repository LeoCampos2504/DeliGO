import { db } from "@/lib/db"
import {
  buildOperationsCancellationUrl,
  mergePushFanoutTargets,
  operacionesOrderCancelledNotification,
  reservePushEndpoint,
  resolveCorePushTargets,
  sendPushToTargets,
  type OperationsCancellationArea,
  type PushFanoutTarget,
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

  // P2-T05 Stage4: fan-out multi-device (normalizado UNION legacy) por cada
  // recipient, mergeado y deduplicado por endpoint físico único en toda la
  // wave — preserva `reservedPushEndpoints` (dedupe entre distintos
  // llamados de esta MISMA operación lógica, p.ej. si otro canal ya cubrió
  // ese endpoint), nunca dedupe persistente entre notificaciones distintas.
  const perRecipientTargets = await Promise.all(
    recipients.map((empleado) => resolveCorePushTargets("empleado", empleado.id, empleado.pushSubscription))
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
