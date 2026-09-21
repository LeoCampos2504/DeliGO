// P2-T40-R1 — handoff de "owner anterior" a través de un login/OAuth
// callback, para que la reconciliación de Push que corre justo después del
// login pueda limpiar de forma segura la fila PushSubscription de un owner
// STALE que ocupaba el MISMO slot de cookie/family inmediatamente antes
// (ver codex-reports/P2_T40_A1_STALE_OWNER_AND_MANUAL_OPTOUT_AUTHORITY.md
// §5/§7/§20 — STALE_PREVIOUS_OWNER_RULE). Mismo patrón jose HS256
// short-lived cookie ya certificado en src/lib/google-oauth-pending.ts —
// secreto dedicado, nunca reutilizado entre dominios de firma distintos.
//
// Este token NUNCA es prueba de autenticación de nada — sólo es un dato
// server-derivado (el owner anterior, leído de la propia fila Sesion, nunca
// de un input de cliente) que necesita sobrevivir un único round-trip hasta
// la llamada de reconciliación inmediatamente posterior al login. Su mera
// presencia válida es, además, la señal tamper-proof de "esto es una sesión
// recién autenticada" que usa la oferta de reactivación M2 (nunca un
// sessionStorage/localStorage con el token de sesión — eso está prohibido
// explícitamente por el prompt de R1).
import { randomUUID } from "crypto"
import { jwtVerify, SignJWT, type JWTPayload } from "jose"
import type { NextResponse } from "next/server"
import { safeErrorForLog } from "@/lib/log-safe-error"
import type { PushSubscriptionOwnerType } from "@/lib/push-subscription-repository"

export const PUSH_OWNER_HANDOFF_ISSUER = "deligo-push-owner-handoff"
export const PUSH_OWNER_HANDOFF_AUDIENCE = "deligo-push-owner-handoff"
// Corto a propósito: sólo necesita sobrevivir el round-trip inmediato
// login -> primera reconciliación del cliente, nunca una sesión de usuario.
// Mismo orden de magnitud que SOCKET_TOKEN_TTL_SECONDS (2 min) en
// src/lib/realtime-auth.ts.
export const PUSH_OWNER_HANDOFF_TTL_SECONDS = 120
export const PUSH_OWNER_HANDOFF_COOKIE_NAME = "deligo_push_handoff"
const HANDOFF_KIND = "push-owner-handoff"

// Las 4 families de sesión que pueden producir un handoff — nunca
// "empleado" (no tiene login propio, ver operational-push-targets.ts) ni
// "superadmin" (rama legacy inerte para Push, ver P2_T40_A0 §11).
export type PushHandoffFamily = "cliente" | "negocio" | "repartidor" | "cuenta_operativa"

export interface PushOwnerHandoffClaims extends JWTPayload {
  kind: typeof HANDOFF_KIND
  family: PushHandoffFamily
  // null cuando no había ninguna sesión previa en este mismo slot de
  // cookie (dispositivo nuevo, o el usuario ya había hecho logout
  // explícito) — el handoff sigue emitiéndose igual, sólo para dar la
  // señal "newSession", sin ningún owner que limpiar.
  prevOwnerType: PushSubscriptionOwnerType | null
  prevOwnerId: string | null
}

function getSecret(): Uint8Array | null {
  const secret = process.env.PUSH_OWNER_HANDOFF_SECRET?.trim()
  if (!secret || secret.length < 32) return null
  return new TextEncoder().encode(secret)
}

/**
 * Nunca lanza y nunca bloquea el login: si el secreto no está provisionado
 * (todavía) o falla cualquier paso de firma, devuelve null — el caller debe
 * simplemente omitir la cookie en ese caso (LOGIN_SUCCESS_INDEPENDENT_OF_PUSH_REPAIR).
 * Ausencia del secreto = el mecanismo de limpieza de stale-owner no corre
 * todavía para esa request, nunca una regresión respecto al comportamiento
 * previo a R1 (que tampoco limpiaba nada).
 */
export async function signPushOwnerHandoff(input: {
  family: PushHandoffFamily
  prevOwnerType: PushSubscriptionOwnerType | null
  prevOwnerId: string | null
}): Promise<string | null> {
  const secret = getSecret()
  if (!secret) return null

  try {
    const now = Math.floor(Date.now() / 1000)
    return await new SignJWT({
      kind: HANDOFF_KIND,
      family: input.family,
      prevOwnerType: input.prevOwnerType,
      prevOwnerId: input.prevOwnerId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(PUSH_OWNER_HANDOFF_ISSUER)
      .setAudience(PUSH_OWNER_HANDOFF_AUDIENCE)
      .setIssuedAt(now)
      .setExpirationTime(now + PUSH_OWNER_HANDOFF_TTL_SECONDS)
      .setJti(randomUUID())
      .sign(secret)
  } catch (error) {
    console.error("[PushOwnerHandoff] sign failed:", safeErrorForLog(error))
    return null
  }
}

const VALID_FAMILIES: readonly PushHandoffFamily[] = ["cliente", "negocio", "repartidor", "cuenta_operativa"]
const VALID_OWNER_TYPES: readonly PushSubscriptionOwnerType[] = ["cliente", "negocio", "repartidor", "empleado", "cuenta_operativa"]

// Nunca lanza — cualquier problema (sin secreto, firma inválida, vencido,
// forma incorrecta) resuelve a null, tratado siempre igual que "no hay
// handoff pendiente" (fail-closed: nunca inventa un owner anterior).
export async function verifyPushOwnerHandoff(token: string | undefined): Promise<PushOwnerHandoffClaims | null> {
  if (typeof token !== "string" || token.length < 32 || token.length > 4096) return null
  const secret = getSecret()
  if (!secret) return null

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: PUSH_OWNER_HANDOFF_ISSUER,
      audience: PUSH_OWNER_HANDOFF_AUDIENCE,
    })

    if (payload.kind !== HANDOFF_KIND) return null
    if (typeof payload.family !== "string" || !VALID_FAMILIES.includes(payload.family as PushHandoffFamily)) return null
    if (payload.prevOwnerType !== null && (typeof payload.prevOwnerType !== "string" || !VALID_OWNER_TYPES.includes(payload.prevOwnerType as PushSubscriptionOwnerType))) return null
    if (payload.prevOwnerId !== null && typeof payload.prevOwnerId !== "string") return null

    return payload as PushOwnerHandoffClaims
  } catch {
    return null
  }
}

function cookieFlags(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export function setPushOwnerHandoffCookie(response: NextResponse, token: string): void {
  response.cookies.set(PUSH_OWNER_HANDOFF_COOKIE_NAME, token, cookieFlags(PUSH_OWNER_HANDOFF_TTL_SECONDS))
}

export function clearPushOwnerHandoffCookie(response: NextResponse): void {
  response.cookies.set(PUSH_OWNER_HANDOFF_COOKIE_NAME, "", cookieFlags(0))
}
