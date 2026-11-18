import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { listarEgresosDuenoHttp, registrarEgresoHttp } from "@/lib/caja-egresos-http"

// F10-C1a — owner: cash outflows of the business (list with filters) and
// registration from a register with an OPEN shift (own or an employee's).
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return listarEgresosDuenoHttp(req, auth.negocioId)
}

export async function POST(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return registrarEgresoHttp(req, auth.negocioId, { tipo: "NEGOCIO" })
}
