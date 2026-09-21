// P2-T40-R1 — marcador local M2 de "el usuario desactivó Push a propósito
// en este dispositivo", scoped por owner. Resuelve la ambigüedad que P2-T40-A1
// confirmó (MANUAL_OFF_AND_BROKEN_BINDING_CURRENTLY_INDISTINGUISHABLE=SI):
// sin esto, una fila backend ausente nunca permite distinguir un apagado
// manual de una rotura accidental, y el auto-rebind universal revertiría
// decisiones humanas explícitas sin que el usuario lo haya pedido.
//
// Contrato (ver P2_T40_A1 §13/§16, política MANUAL_OFF_POLICY=
// M2_DEVICE_SCOPED_WITH_NEXT_LOGIN_REENABLE_OFFER autorizada en P2-T40-R1):
// - WRITE sólo cuando el usuario desactiva manualmente desde la UI (y el
//   detach backend correspondiente terminó con éxito).
// - READ durante la reconciliación post-login.
// - DELETE sólo cuando el usuario reactiva explícitamente Y la
//   activación/rebind termina con éxito real.
// - Nunca se borra en logout ni por expiración de sesión — sobrevive
//   logout/login del mismo owner en el mismo dispositivo (MANUAL_OFF_SURVIVES_LOGOUT_LOGIN=SI).
// - Nunca hereda entre cuentas ni entre ownerType distintos (scoped por
//   ambos campos en la propia key).
//
// Valor mínimo, sin PII: nunca email/nombre/token/cookie/password/endpoint
// completo/claves p256dh-auth/datos de negocio. Sólo "1" o ausente.
import type { PushSubscriptionOwnerType } from "@/lib/push-subscription-repository"

const KEY_PREFIX = "deligo-push-optout"

export function pushManualOptOutKey(ownerType: PushSubscriptionOwnerType, ownerId: string): string {
  return `${KEY_PREFIX}:${ownerType}:${ownerId}`
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    return window.localStorage
  } catch {
    // Private browsing / storage bloqueado por política del navegador —
    // nunca debe romper el flujo de reconciliación, sólo se trata como
    // "no hay opt-out registrado" (fail-open hacia el comportamiento
    // silencioso de auto-rebind, nunca fail-open hacia mostrar un prompt
    // nativo de más).
    return null
  }
}

export function hasPushManualOptOut(ownerType: PushSubscriptionOwnerType, ownerId: string): boolean {
  const storage = safeLocalStorage()
  if (!storage) return false
  try {
    return storage.getItem(pushManualOptOutKey(ownerType, ownerId)) === "1"
  } catch {
    return false
  }
}

export function setPushManualOptOut(ownerType: PushSubscriptionOwnerType, ownerId: string): void {
  const storage = safeLocalStorage()
  if (!storage) return
  try {
    storage.setItem(pushManualOptOutKey(ownerType, ownerId), "1")
  } catch {
    // No-op: si no se puede persistir, el peor caso es que una futura
    // sesión no ofrezca reactivar — nunca un fallo visible para el usuario.
  }
}

export function clearPushManualOptOut(ownerType: PushSubscriptionOwnerType, ownerId: string): void {
  const storage = safeLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(pushManualOptOutKey(ownerType, ownerId))
  } catch {
    // No-op.
  }
}
