import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { resumenRetirosHttp } from "@/lib/retiros-personales-http"

// T7-F1 — dueño: Administración → Resumen → Retiros personales (totales y agrupado por persona).
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return resumenRetirosHttp(req, auth.negocioId)
}
