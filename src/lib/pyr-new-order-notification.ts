import { db } from "@/lib/db"
import { pyrNewOrderNotification, reservePushEndpoint, sendPushToTargets, type PushFanoutTarget } from "@/lib/push"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { resolveOperationalPushTargets, type OperationalPushEmployee } from "@/lib/operational-push-targets"
import { resolvePyrOperationalRecipients } from "@/lib/pyr-operational-recipients"

type NotifyPyrNewOrderParams = {
  pedidoId: string
  negocioId: string
  clienteNombre: string
  total: number
  metodoEntrega: "retiro" | "domicilio"
  /**
   * P2-T44-R1P2: mismo Set que el envío existente a Negocio (new_order) —
   * si el mismo endpoint físico ya fue reservado por ese envío (creado
   * primero en el call-site), este fan-out lo omite sin perder la fila
   * lógica de Notificacion (ver §18.1/18.2 de R1P1A).
   */
  reservedPushEndpoints?: Set<string>
}

type NotifyPyrNewOrderResult = {
  attemptedEndpoints: string[]
}

function shortId(value: string | null | undefined) {
  if (!value) return null
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`
}

export async function notifyPyrNewOrder(
  params: NotifyPyrNewOrderParams
): Promise<NotifyPyrNewOrderResult> {
  const empleados = await resolvePyrOperationalRecipients(params.negocioId)

  if (empleados.length === 0) {
    console.info("[Push/OperacionesPyR] sin destinatarios (nuevo pedido)", {
      pedidoId: shortId(params.pedidoId),
      negocioId: shortId(params.negocioId),
      destinatarios: 0,
    })
    return { attemptedEndpoints: [] }
  }

  const negocio = await db.negocio.findUnique({
    where: { id: params.negocioId },
    select: { slug: true },
  })
  if (!negocio) return { attemptedEndpoints: [] }

  const panelUrl = `/operaciones/mi-panel/${encodeURIComponent(negocio.slug)}/pyr/pedidos?pedidoId=${encodeURIComponent(params.pedidoId)}`
  const payload = pyrNewOrderNotification(
    params.pedidoId,
    params.clienteNombre,
    params.total,
    params.metodoEntrega,
    panelUrl
  )

  // Notificación in-app: una fila por empleado, siempre, sin importar el
  // dedupe físico de endpoint que aplica más abajo.
  await Promise.all(
    empleados.map((empleado) =>
      db.notificacion
        .create({
          data: {
            userId: empleado.id,
            userType: "empleado",
            tipo: "operaciones_pyr_new_order",
            titulo: payload.title,
            cuerpo: payload.body,
            pedidoId: params.pedidoId,
            negocioId: params.negocioId,
            datos: JSON.stringify({ metodoEntrega: params.metodoEntrega, url: panelUrl }),
          },
        })
        .catch((error) => {
          console.error("[Push/OperacionesPyR] Error persistiendo notificacion (nuevo pedido):", safeErrorForLog(error))
        })
    )
  )

  let targets: PushFanoutTarget[] = await resolveOperationalPushTargets(empleados as OperationalPushEmployee[])
  if (params.reservedPushEndpoints) {
    targets = targets.filter((t) => reservePushEndpoint(t.raw, params.reservedPushEndpoints!))
  }
  const attemptedEndpoints = targets.map((t) => t.endpoint)

  try {
    await sendPushToTargets(targets, payload)
  } catch (error) {
    console.error("[Push/OperacionesPyR] Error enviando notificacion (nuevo pedido):", {
      pedidoId: shortId(params.pedidoId),
      errorName: error instanceof Error ? error.name : "unknown",
    })
  }

  console.info("[Push/OperacionesPyR] resumen (nuevo pedido)", {
    pedidoId: shortId(params.pedidoId),
    negocioId: shortId(params.negocioId),
    destinatarios: empleados.length,
    endpointsUnicos: targets.length,
  })

  return { attemptedEndpoints }
}
