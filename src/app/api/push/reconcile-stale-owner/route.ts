import { NextRequest, NextResponse } from "next/server"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { resolvePushSubscriptionDetachInput } from "@/lib/push-subscription-http"
import { detachPushSubscriptionByEndpoint, type PushSubscriptionOwnerType } from "@/lib/push-subscription-repository"
import { detachLegacyPushFieldIfMatches } from "@/lib/push"
import {
  PUSH_OWNER_HANDOFF_COOKIE_NAME,
  clearPushOwnerHandoffCookie,
  safeFingerprint,
  verifyPushOwnerHandoff,
  type PushHandoffFamily,
} from "@/lib/push-owner-handoff"

// P2-T40-R1 — POST /api/push/reconcile-stale-owner
//
// Implementa STALE_PREVIOUS_OWNER_RULE de
// codex-reports/P2_T40_A1_STALE_OWNER_AND_MANUAL_OPTOUT_AUTHORITY.md §5/§20:
// limpia ÚNICAMENTE la fila PushSubscription del owner que ocupaba el MISMO
// slot de cookie/family inmediatamente antes de la sesión actual — nunca
// "todo owner distinto de mí", nunca cruza de family. El owner anterior se
// deriva EXCLUSIVAMENTE del handoff firmado server-side que el propio login
// dejó (nunca de un valor enviado por el cliente); el endpoint físico a
// limpiar se toma del subscription que el cliente reporta como su propia
// PushManager actual (nunca de un endpoint arbitrario) y debe coincidir
// EXACTO con la fila del owner anterior antes de borrarla
// (detachPushSubscriptionByEndpoint ya exige ese match, ver
// src/lib/push-subscription-repository.ts).
//
// La mera presencia de un handoff válido (aun sin ningún prevOwner que
// limpiar) es también la señal tamper-proof de "esto es una sesión recién
// autenticada" (`newSession`) que consume el cliente para decidir si debe
// ofrecer, como máximo una vez, reactivar Push tras un opt-out manual
// (MANUAL_OFF_NEXT_LOGIN_REENABLE_OFFER) — nunca un sessionStorage/token de
// sesión. El handoff es de un solo uso: se limpia siempre que se lee para
// la family correcta, haya o no owner anterior que limpiar.
const NORMALIZED_OWNER_TYPES: Partial<Record<"cliente" | "negocio" | "repartidor", PushSubscriptionOwnerType>> = {
  cliente: "cliente",
  negocio: "negocio",
  repartidor: "repartidor",
}

// P2-T40-R3 (CASE G): sólo los 4 owners "core" que dual-writen a un campo
// legacy propio tienen algo que limpiar ahí — cuenta_operativa nunca lo
// tuvo (A0 §11, siempre escribió sólo a la tabla normalizada). Empleado
// nunca es prevOwnerType en la práctica (no tiene login propio, ver
// applyLoginCookies/applyOperationalLoginCookies), pero se incluye por
// completitud/defensa en profundidad — nunca por necesidad demostrada hoy.
const LEGACY_PUSH_MODEL_BY_OWNER_TYPE: Partial<Record<PushSubscriptionOwnerType, string>> = {
  cliente: "cliente",
  negocio: "negocio",
  repartidor: "repartidor",
  empleado: "empleado",
}

const FAMILY_BY_USER_TYPE: Partial<Record<"cliente" | "negocio" | "repartidor", PushHandoffFamily>> = {
  cliente: "cliente",
  negocio: "negocio",
  repartidor: "repartidor",
}

interface CurrentOwner {
  ownerType: PushSubscriptionOwnerType
  ownerId: string
  family: PushHandoffFamily
}

async function resolveCurrentOwner(req: NextRequest): Promise<CurrentOwner | null> {
  if (req.nextUrl.searchParams.get("actorFamily") === "cuenta_operativa") {
    const { getOperationalAccountFromRequest } = await import("@/lib/auth")
    const account = await getOperationalAccountFromRequest(req)
    if (!account) return null
    return { ownerType: "cuenta_operativa", ownerId: account.id, family: "cuenta_operativa" }
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const user = await getUserFromToken(token)
  if (!user) return null

  const ownerType = NORMALIZED_OWNER_TYPES[user.type as "cliente" | "negocio" | "repartidor"]
  const family = FAMILY_BY_USER_TYPE[user.type as "cliente" | "negocio" | "repartidor"]
  if (!ownerType || !family) return null

  return { ownerType, ownerId: user.id, family }
}

export async function POST(req: NextRequest) {
  try {
    const currentOwner = await resolveCurrentOwner(req)
    if (!currentOwner) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    const rl = checkRateLimit("pushMutation", `${getClientIp(req)}:${currentOwner.ownerType}:${currentOwner.ownerId}`)
    if (!rl.allowed) return rateLimitResponse(rl)

    const handoffToken = req.cookies.get(PUSH_OWNER_HANDOFF_COOKIE_NAME)?.value
    const handoff = await verifyPushOwnerHandoff(handoffToken)

    const body = await req.json().catch(() => null)
    const subscriptionRaw = (body as { subscription?: unknown } | null)?.subscription

    let staleCleanupPerformed = false
    let newSession = false
    let response: NextResponse

    // P2-T40-R2 (CASE G diagnóstico seguro) — nunca ownerId/token/endpoint
    // crudos, sólo fingerprints no reversibles y booleanos. Se loguea ANTES
    // de las ramas de abajo para capturar exactamente el punto de entrada
    // (cookie presente/ausente, verificación exitosa/fallida, match de
    // family) sin importar por cuál rama termine resolviendo.
    console.log(
      `[PushOwnerHandoff] consume family=${currentOwner.family} currentOwner=${safeFingerprint(currentOwner.ownerId)} cookiePresent=${Boolean(handoffToken)} verified=${Boolean(handoff)} familyMatch=${Boolean(handoff && handoff.family === currentOwner.family)} subscriptionPresent=${Boolean(subscriptionRaw)}`
    )

    if (handoff && handoff.family === currentOwner.family) {
      // Handoff válido y de la family correcta: es de un solo uso, se
      // consume (se limpia) en esta misma respuesta independientemente del
      // resultado del cleanup de abajo.
      newSession = true

      const prevOwnerDiffersFromCurrent = Boolean(
        handoff.prevOwnerType &&
        handoff.prevOwnerId &&
        (handoff.prevOwnerType !== currentOwner.ownerType || handoff.prevOwnerId !== currentOwner.ownerId)
      )

      if (handoff.prevOwnerType && handoff.prevOwnerId && prevOwnerDiffersFromCurrent && subscriptionRaw) {
        const detachInput = resolvePushSubscriptionDetachInput(subscriptionRaw)
        let legacyCleared = false
        if (detachInput.parsed) {
          const result = await detachPushSubscriptionByEndpoint(
            { ownerType: handoff.prevOwnerType, ownerId: handoff.prevOwnerId, channel: "default" },
            {
              endpoint: detachInput.parsed.endpoint,
              p256dh: detachInput.parsed.keys.p256dh,
              auth: detachInput.parsed.keys.auth,
            }
          )
          staleCleanupPerformed = result.detached

          // P2-T40-R3 (CASE G — causa raíz real): resolveCorePushTargetsFromNormalized()
          // hace UNION normalizado+legacy — limpiar sólo la fila normalizada
          // de arriba deja el campo legacy por-modelo del owner stale
          // (Cliente/Negocio/Repartidor/Empleado.pushSubscription) como
          // target de envío vivo. cuenta_operativa nunca tuvo ese campo
          // (siempre escribió sólo a la tabla normalizada, ver A0 §11) —
          // se omite para ese ownerType, nunca un no-op silencioso para los
          // demás.
          if (LEGACY_PUSH_MODEL_BY_OWNER_TYPE[handoff.prevOwnerType]) {
            legacyCleared = await detachLegacyPushFieldIfMatches(
              LEGACY_PUSH_MODEL_BY_OWNER_TYPE[handoff.prevOwnerType]!,
              handoff.prevOwnerId,
              "pushSubscription",
              {
                endpoint: detachInput.parsed.endpoint,
                p256dh: detachInput.parsed.keys.p256dh,
                auth: detachInput.parsed.keys.auth,
              }
            )
          }
        }
        console.log(
          `[PushOwnerHandoff] cleanup-attempt prevOwner=${safeFingerprint(handoff.prevOwnerId)} subscriptionParsed=${Boolean(detachInput.parsed)} detached=${staleCleanupPerformed} legacyCleared=${legacyCleared}`
        )
      } else if (handoff.prevOwnerType && handoff.prevOwnerId) {
        console.log(
          `[PushOwnerHandoff] cleanup-skipped prevOwnerFound=SI prevOwnerDiffersFromCurrent=${prevOwnerDiffersFromCurrent} subscriptionPresent=${Boolean(subscriptionRaw)}`
        )
      }

      response = NextResponse.json({ ok: true, newSession, staleCleanupPerformed })
      clearPushOwnerHandoffCookie(response)
    } else {
      // Sin handoff válido para esta family: mount ordinario de una sesión
      // ya existente, nada que reconciliar. Si había un handoff de OTRA
      // family (dos logins simultáneos en pestañas distintas dentro del
      // mismo TTL corto), se deja intacto para que su propia reconciliación
      // lo consuma correctamente — nunca se borra a ciegas acá.
      response = NextResponse.json({ ok: true, newSession: false, staleCleanupPerformed: false })
    }

    return response
  } catch (error) {
    console.error("Error reconciling stale push owner:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al reconciliar la suscripción" }, { status: 500 })
  }
}
