import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { crearDecisionHttp, historialDecisionesHttp } from "@/lib/retiros-personales-http"

// T7-F1 — dueño: decisión INFORMATIVA de recuperación sobre retiros de un empleado (no cobra ni descuenta sueldo).
// GET ?empleadoId: historial completo. POST: nueva decisión o reemplazo de una vigente.
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return historialDecisionesHttp(req, auth.negocioId)
}

export async function POST(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return crearDecisionHttp(req, auth.negocioId)
}
