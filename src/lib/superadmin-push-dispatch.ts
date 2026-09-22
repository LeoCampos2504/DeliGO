// P2-T39-R3: dispatcher central, post-commit y best-effort para Web Push de
// SuperAdmin. Nunca se llama desde dentro de la transacción que persiste las
// filas Notificacion — un fallo del proveedor Push acá nunca debe revertir
// ni aparentar fallar la operación de negocio que lo originó. La fila
// Notificacion (ya committed antes de esta llamada) sigue siendo la fuente de
// verdad durable; Push es exclusivamente un canal adicional best-effort.
import { safeErrorForLog } from "@/lib/log-safe-error"
import { resolveCorePushTargets, sendPushToTargets, mergePushFanoutTargets, type NotificationType } from "@/lib/push"

export type SuperadminPushType = Extract<
  NotificationType,
  "negocio_pendiente" | "destacado_solicitud" | "denuncia_nueva" | "negocio_deuda" | "review_moderation"
>

export interface SuperadminPushEnvelope {
  type: SuperadminPushType
  titulo: string
  cuerpo: string
  entityId?: string
  navigateTo?: string
}

/**
 * Resuelve las subscriptions normalizadas de TODOS los recipientIds lógicos,
 * las dedupea por endpoint físico (MODEL-C1: dos SuperAdmin no deberían
 * compartir device en la práctica, pero si lo hicieran, un mismo endpoint
 * recibe un solo Push) y envía. Deliberadamente NUNCA lee/une el campo legacy
 * `SuperAdmin.pushSubscription` (P2-T17, inerte) — se pasa `null` como
 * legacyRaw en cada resolución.
 */
export async function dispatchSuperadminPush(recipientIds: string[], envelope: SuperadminPushEnvelope): Promise<void> {
  const uniqueRecipientIds = Array.from(new Set(recipientIds)).filter((id) => id.trim().length > 0)
  if (uniqueRecipientIds.length === 0) return

  try {
    const targetLists = await Promise.all(
      uniqueRecipientIds.map((recipientId) => resolveCorePushTargets("superadmin", recipientId, null))
    )
    const merged = mergePushFanoutTargets(targetLists)
    if (merged.length === 0) return

    const payload = {
      title: envelope.titulo,
      body: envelope.cuerpo,
      data: {
        type: envelope.type,
        actorFamily: "superadmin",
        url: "/admin",
        entityId: envelope.entityId,
        navigateTo: envelope.navigateTo,
      },
    }

    const { attempted, delivered } = await sendPushToTargets(merged, payload)
    if (delivered === 0 && attempted > 0) {
      console.warn(`[Push] 0/${attempted} envíos entregados para SuperAdmin (tipo=${envelope.type})`)
    }
  } catch (error) {
    // Best-effort por diseño: la operación de negocio y la fila Notificacion
    // ya están committed antes de que esta función se llame nunca. Nunca
    // registrar endpoint, p256dh, auth ni el body del proveedor.
    console.error(
      "[Push] Error en dispatch SuperAdmin (best-effort, no afecta la operación de negocio):",
      safeErrorForLog(error)
    )
  }
}
