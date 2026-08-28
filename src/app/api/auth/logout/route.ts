import { NextRequest, NextResponse } from "next/server"
import { deleteSession, getFamilySessionCookieName, SESSION_COOKIE_NAME, type SessionFamily } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

// P2-T18-BLOCKER-AUTH2-R2 (Phase 1): src/proxy.ts adjunta este header sólo
// cuando resolvió una familia para ESTE request (por prefijo de path o por
// el selector explícito ?actorFamily= que Fase 2 empezará a enviar) — nunca
// es autoridad de identidad, sólo indica qué nombre de cookie real limpiar
// en la respuesta. deleteSession(token) sigue operando sobre el token ya
// resuelto por proxy.ts bajo SESSION_COOKIE_NAME, exactamente como antes.
const RESOLVED_ACTOR_FAMILY_HEADER = "x-resolved-actor-family"

function isSessionFamily(value: string | null): value is SessionFamily {
  return value === "cliente" || value === "negocio" || value === "repartidor"
}

function clearSessionCookies(res: NextResponse, req: NextRequest): void {
  // Siempre se limpia el nombre legacy (no-op si el navegador no la tiene
  // — cubre sesiones aún no migradas a cookie de familia).
  res.cookies.delete(SESSION_COOKIE_NAME)

  const resolvedFamily = req.headers.get(RESOLVED_ACTOR_FAMILY_HEADER)
  if (isSessionFamily(resolvedFamily)) {
    // Sólo la cookie de la familia resuelta para ESTE logout — nunca otra
    // (logout Cliente nunca borra la cookie de Negocio, y viceversa).
    res.cookies.delete(getFamilySessionCookieName(resolvedFamily))
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (token) {
      await deleteSession(token)
    }

    const res = NextResponse.json({ ok: true })
    clearSessionCookies(res, req)
    return res
  } catch (error) {
    console.error("Logout error:", safeErrorForLog(error))
    const res = NextResponse.json({ ok: true })
    clearSessionCookies(res, req)
    return res
  }
}
