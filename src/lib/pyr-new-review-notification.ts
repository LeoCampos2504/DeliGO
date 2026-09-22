import { db } from "@/lib/db"
import { pyrNewReviewNotification, reservePushEndpoint, sendPushToTargets, type PushFanoutTarget } from "@/lib/push"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { resolveOperationalPushTargets, type OperationalPushEmployee } from "@/lib/operational-push-targets"
import { resolvePyrOperationalRecipients } from "@/lib/pyr-operational-recipients"

type NotifyPyrNewReviewParams = {
  resenaId: string
  negocioId: string
  pedidoId?: string | null
  puntuacion: number
  clienteNombre: string
  /** Ver mismo mecanismo documentado en pyr-new-order-notification.ts. */
  reservedPushEndpoints?: Set<string>
}

type NotifyPyrNewReviewResult = {
  attemptedEndpoints: string[]
}

function shortId(value: string | null | undefined) {
  if (!value) return null
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`
}

export async function notifyPyrNewReview(
  params: NotifyPyrNewReviewParams
): Promise<NotifyPyrNewReviewResult> {
  const empleados = await resolvePyrOperationalRecipients(params.negocioId)

  if (empleados.length === 0) {
    console.info("[Push/OperacionesPyR] sin destinatarios (nueva reseña)", {
      resenaId: shortId(params.resenaId),
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

  const panelUrl = `/operaciones/mi-panel/${encodeURIComponent(negocio.slug)}/pyr/resenas?resenaId=${encodeURIComponent(params.resenaId)}`
  const payload = pyrNewReviewNotification(
    params.resenaId,
    params.puntuacion,
    params.clienteNombre,
    panelUrl,
    params.pedidoId
  )

  await Promise.all(
    empleados.map((empleado) =>
      db.notificacion
        .create({
          data: {
            userId: empleado.id,
            userType: "empleado",
            tipo: "operaciones_pyr_new_review",
            titulo: payload.title,
            cuerpo: payload.body,
            pedidoId: params.pedidoId || null,
            negocioId: params.negocioId,
            datos: JSON.stringify({ resenaId: params.resenaId, url: panelUrl }),
          },
        })
        .catch((error) => {
          console.error("[Push/OperacionesPyR] Error persistiendo notificacion (nueva reseña):", safeErrorForLog(error))
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
    console.error("[Push/OperacionesPyR] Error enviando notificacion (nueva reseña):", {
      resenaId: shortId(params.resenaId),
      errorName: error instanceof Error ? error.name : "unknown",
    })
  }

  console.info("[Push/OperacionesPyR] resumen (nueva reseña)", {
    resenaId: shortId(params.resenaId),
    negocioId: shortId(params.negocioId),
    destinatarios: empleados.length,
    endpointsUnicos: targets.length,
  })

  return { attemptedEndpoints }
}
