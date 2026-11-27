import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { recuperoEgresoHttp } from "@/lib/caja-egresos-http"

// F10-D1 — owner ONLY: cash of an outflow of a CLOSED shift that comes back
// later. A new inflow (RECUPERO_EGRESO) in the OPEN shift of the register the
// owner chose; the original outflow and its closed shift stay untouched.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return recuperoEgresoHttp(req, auth.negocioId, id)
}
