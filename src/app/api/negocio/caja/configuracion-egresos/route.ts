import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { actualizarConfiguracionEgresosHttp, configuracionEgresosHttp } from "@/lib/caja-egresos-http"

// F10-C1a — owner ONLY: amount from which an employee's cash outflow produces a
// highlighted notice (null = no threshold). Informative: it never blocks.
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return configuracionEgresosHttp(auth.negocioId)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return actualizarConfiguracionEgresosHttp(req, auth.negocioId)
}
