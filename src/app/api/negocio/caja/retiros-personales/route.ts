import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { crearRetiroHttp, listarRetirosHttp } from "@/lib/retiros-personales-http"

// T7-F1 — dueño: retiros personales de mercadería (salida NO comercial; nunca una venta ni un movimiento de dinero).
// GET: listado con filtros (?desde&hasta&tipo&persona). POST: registro (Idempotency-Key obligatoria).
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return listarRetirosHttp(req, auth.negocioId)
}

export async function POST(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return crearRetiroHttp(req, { negocioId: auth.negocioId, actor: { tipo: "NEGOCIO" }, vista: "dueno" })
}
