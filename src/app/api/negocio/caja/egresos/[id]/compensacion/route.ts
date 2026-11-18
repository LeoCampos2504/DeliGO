import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { compensarEgresoHttp } from "@/lib/caja-egresos-http"

// F10-C1c — owner ONLY: total compensation of a cash outflow (REVERSION in its
// own still-OPEN shift). The original outflow is never modified; after the
// close the compensation is blocked (409, nothing written).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return compensarEgresoHttp(req, auth.negocioId, id)
}
