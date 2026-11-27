import type { NextRequest } from "next/server"
import { getFamilySessionCookieName, getUserFromToken, SESSION_COOKIE_NAME, type AuthUser, type SessionFamily } from "@/lib/auth"

// ============================================
// T3 — credencial EXPLÍCITA de una familia personal (cliente / negocio / repartidor)
// ============================================
// Causa (clase F-P2-T18-AUTH02, documentada en BUG-002): las rutas neutrales que leían sólo la cookie legacy
// `deligo_session` dependen de que el proxy copie ahí la cookie de familia, y el proxy sólo lo hace cuando hay
// EXACTAMENTE una candidata. Con la sesión del dueño y una cuenta operativa en el mismo navegador no copia ninguna:
// la ruta respondía 401 (campana, destacado, estadísticas) o resolvía otra identidad.
//
// Este helper NO es un sistema de autenticación nuevo: lee la cookie de la familia pedida y la valida con
// `getUserFromToken` (la misma autoridad de siempre). Reglas:
// - cookie de familia presente → sólo esa credencial; si es inválida/vencida o de otro tipo → `user: null`
//   (nunca se cae a otra credencial);
// - cookie de familia ausente → la cookie legacy tal como la entrega el proxy (mismo criterio que
//   `resolveActorSession` y que BUG-002); el llamador DEBE comprobar que `user.type` es la familia esperada;
// - sin ninguna de las dos → `source: "none"`.
// El llamador decide el código (401/403) según el contrato de su ruta. La familia la fija el servidor (rutas
// sólo del dueño) o la pantalla (`?actorFamily=`); nunca otorga permisos por sí misma.

export type FamilySessionLookup =
  | { source: "family"; user: AuthUser | null }
  | { source: "legacy"; user: AuthUser | null }
  | { source: "none"; user: null }

export async function readFamilySession(req: NextRequest, family: SessionFamily): Promise<FamilySessionLookup> {
  const familyToken = req.cookies.get(getFamilySessionCookieName(family))?.value
  if (familyToken) {
    const user = await getUserFromToken(familyToken)
    return { source: "family", user: user && user.type === family ? user : null }
  }
  const legacyToken = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!legacyToken) return { source: "none", user: null }
  return { source: "legacy", user: await getUserFromToken(legacyToken) }
}

/** Selector `?actorFamily=` de una familia personal. `null` si no vino; `"invalid"` si no es una de las tres. */
export function parsePersonalSessionFamily(value: string | null | undefined): SessionFamily | null | "invalid" {
  if (value === null || value === undefined || value === "") return null
  return value === "cliente" || value === "negocio" || value === "repartidor" ? value : "invalid"
}

/**
 * Rutas exclusivas del dueño (destacado, denuncias, estadísticas de mozos): la familia es siempre `negocio`.
 * Conserva el contrato previo de cada ruta (sin credencial → 401; credencial legacy de otro tipo → 403) y agrega:
 * credencial de la familia `negocio` inválida o vencida → 401, sin probar ninguna otra.
 */
export async function requireNegocioOwnerSession(
  req: NextRequest
): Promise<{ ok: true; user: AuthUser } | { ok: false; status: 401 | 403 }> {
  const lookup = await readFamilySession(req, "negocio")
  if (lookup.source === "none") return { ok: false, status: 401 }
  if (lookup.user && lookup.user.type === "negocio") return { ok: true, user: lookup.user }
  return { ok: false, status: lookup.source === "family" ? 401 : 403 }
}
