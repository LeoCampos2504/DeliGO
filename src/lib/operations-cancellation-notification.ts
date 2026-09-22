import { db } from "@/lib/db"
import {
  buildOperationsCancellationUrl,
  operacionesOrderCancelledNotification,
  reservePushEndpoint,
  sendPushToTargets,
  type OperationsCancellationArea,
  type PushFanoutTarget,
} from "@/lib/push"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { resolveOperationalPushTargets, type OperationalPushEmployee } from "@/lib/operational-push-targets"

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
  cuentaOperativaId: string | null
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
    select: { id: true, cuentaOperativaId: true, pushSubscription: true },
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

  let targets: PushFanoutTarget[] = await resolveOperationalPushTargets(recipients as OperationalPushEmployee[])
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
