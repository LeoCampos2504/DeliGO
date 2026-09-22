import { db } from "@/lib/db"
import { pyrChatMessageNotification, reservePushEndpoint, sendPushToTargets, type PushFanoutTarget } from "@/lib/push"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { resolveOperationalPushTargets, type OperationalPushEmployee } from "@/lib/operational-push-targets"
import { resolvePyrOperationalRecipients } from "@/lib/pyr-operational-recipients"

type NotifyPyrChatMessageParams = {
  pedidoId: string
  negocioId: string
  senderName: string
  messagePreview: string
  /** Ver mismo mecanismo documentado en pyr-new-order-notification.ts. */
  reservedPushEndpoints?: Set<string>
}

type NotifyPyrChatMessageResult = {
  attemptedEndpoints: string[]
}

function shortId(value: string | null | undefined) {
  if (!value) return null
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`
}

/**
 * Fan-out de notificación cuando el CLIENTE escribe un mensaje sobre un
 * pedido no-mesa (P2-T44-R1P2, decisión G5:
 * INCLUDE_PYR_NOTIFICATION_FANOUT_WITHOUT_CHANGING_CHAT_PARTICIPANT_MODEL).
 * No modifica ChatMensaje, remitente, ownership del hilo ni autorización —
 * el llamador (src/app/api/chat/mensajes/[pedidoId]/route.ts) sigue siendo
 * exclusivamente responsable de eso; esta función SOLO decide a quién avisar.
 */
export async function notifyPyrChatMessage(
  params: NotifyPyrChatMessageParams
): Promise<NotifyPyrChatMessageResult> {
  const empleados = await resolvePyrOperationalRecipients(params.negocioId)

  if (empleados.length === 0) {
    console.info("[Push/OperacionesPyR] sin destinatarios (chat)", {
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

  const panelUrl = `/operaciones/mi-panel/${encodeURIComponent(negocio.slug)}/pyr/pedidos/${encodeURIComponent(params.pedidoId)}/mensajes`
  const payload = pyrChatMessageNotification(
    params.pedidoId,
    params.senderName,
    params.messagePreview,
    panelUrl
  )

  await Promise.all(
    empleados.map((empleado) =>
      db.notificacion
        .create({
          data: {
            userId: empleado.id,
            userType: "empleado",
            tipo: "operaciones_pyr_chat",
            titulo: payload.title,
            cuerpo: payload.body,
            pedidoId: params.pedidoId,
            negocioId: params.negocioId,
            datos: JSON.stringify({ url: panelUrl }),
          },
        })
        .catch((error) => {
          console.error("[Push/OperacionesPyR] Error persistiendo notificacion (chat):", safeErrorForLog(error))
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
    console.error("[Push/OperacionesPyR] Error enviando notificacion (chat):", {
      pedidoId: shortId(params.pedidoId),
      errorName: error instanceof Error ? error.name : "unknown",
    })
  }

  console.info("[Push/OperacionesPyR] resumen (chat)", {
    pedidoId: shortId(params.pedidoId),
    negocioId: shortId(params.negocioId),
    destinatarios: empleados.length,
    endpointsUnicos: targets.length,
  })

  return { attemptedEndpoints }
}
