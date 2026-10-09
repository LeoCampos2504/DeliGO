// ============================================
// F10-B2.1 — owner (negocio session) access to physical registers and shifts
// ============================================
// Same session check as every owner route (deligo_session → getUserFromToken
// → type "negocio"), plus the generic-business gate: physical registers and
// shifts exist only for rubro "negocio" (never auto-created for Restaurante /
// Ropa). Mutations under /api/negocio/caja are already origin-protected by
// the proxy (F10-B2.0).

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { AREA_CAJA_RUBRO } from "@/lib/area-operativa"

export type NegocioCajaAuth = { ok: true; negocioId: string; cajaTurnosModo: string } | { ok: false; response: NextResponse }

export async function requireNegocioCajaGenerico(req: NextRequest): Promise<NegocioCajaAuth> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return { ok: false, response: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
  const user = await getUserFromToken(token)
  if (!user || user.type !== "negocio") return { ok: false, response: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) }
  const negocio = await db.negocio.findUnique({ where: { id: user.id }, select: { rubro: true, cajaTurnosModo: true } })
  if (!negocio || negocio.rubro !== AREA_CAJA_RUBRO) {
    return { ok: false, response: NextResponse.json({ error: "Las cajas físicas sólo están disponibles para negocios genéricos." }, { status: 403 }) }
  }
  return { ok: true, negocioId: user.id, cajaTurnosModo: negocio.cajaTurnosModo }
}
