import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

export interface NotifySuperadminsInput {
  tipo: string
  titulo: string
  cuerpo: string
  datos: Record<string, unknown>
  /** Explicit recipient override. If omitted, resolves every `activo:true`
   * SuperAdmin at call time. */
  recipientIds?: string[]
}

// P2-T26-R2: generic in-app notifier for SuperAdmin, reused by every new
// event type added in this task (negocio_pendiente, denuncia_nueva,
// negocio_deuda, destacado_solicitud) instead of duplicating the createMany
// boilerplate at each call site (see P2-T26-R1's audit — codex-reports/
// P2_T26_SUPERADMIN_NOTIFICATIONS_END_TO_END_AUDIT_R1.md — which found
// exactly this kind of duplication risk). A 5th candidate,
// superadmin_identidad_nueva, was implemented in R2, wiring-certified in
// R2A, and then removed in R2B after R2A proved it can never have a
// non-empty recipient list under this codebase's current single-identity
// model (see codex-reports/
// P2_T26_R2B_SUPERADMIN_NOTIFICATION_CATALOG_NORMALIZATION.md) — this
// helper itself needed no change for that removal, it simply lost a caller.
//
// Deliberately does NOT send Web Push: R1 confirmed that channel is
// legacy/dead for this role (SuperAdmin.pushSubscription, /api/push/* branches)
// — SUPERADMIN_PUSH_R2_SCOPE=DEFERRED_NOT_IMPLEMENTED, unchanged in this task.
//
// Does NOT touch src/lib/review-moderation-notifications.ts — that helper and
// its two already-certified call sites are left completely untouched, so this
// new helper carries zero regression risk for the two existing notification
// types.
//
// Returns 0 (and creates nothing) when there are no recipients — the calling
// business flow must never fail because no SuperAdmin exists/qualifies.
export async function notifySuperadmins(tx: Tx, input: NotifySuperadminsInput): Promise<number> {
  const recipientIds =
    input.recipientIds ??
    (await tx.superAdmin.findMany({ where: { activo: true }, select: { id: true } })).map((admin) => admin.id)
  if (!recipientIds.length) return 0

  await tx.notificacion.createMany({
    data: recipientIds.map((id) => ({
      userId: id,
      userType: "superadmin",
      tipo: input.tipo,
      titulo: input.titulo,
      cuerpo: input.cuerpo,
      datos: JSON.stringify(input.datos),
    })),
  })
  return recipientIds.length
}

// ============================================
// Debt-alert crossing detection (P2-T26-R2 §12-14)
// ============================================
// A negocio's deudaTarifa only ever moves via a small, well-known set of CAS
// writes (increment on client delivery confirmation, decrement/reset on
// superadmin payment or cancellation reversal) — there is no separate
// "already alerted" flag, and none is needed: comparing the value BEFORE and
// AFTER a single increment is sufficient to detect a genuine crossing exactly
// once. Once above the threshold, every subsequent increment's "before" value
// is already >= threshold, so this naturally never re-fires until a payment
// brings deudaTarifa back below it — matching the required "no repeat while
// still above, but allow a fresh cross after a dip" contract without any
// schema change.
export const DEBT_ALERT_THRESHOLD_RATIO = 0.8

export function crossedDebtAlertThreshold(deudaAntes: number, deudaDespues: number, limiteDeuda: number): boolean {
  if (limiteDeuda <= 0) return false
  const threshold = limiteDeuda * DEBT_ALERT_THRESHOLD_RATIO
  return deudaAntes < threshold && deudaDespues >= threshold
}
