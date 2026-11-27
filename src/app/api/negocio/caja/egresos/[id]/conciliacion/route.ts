import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { conciliarEgresoHttp } from "@/lib/caja-egresos-http"

// F10-D1 — owner ONLY: an outflow of a CLOSED shift whose cash never left the
// drawer (or left less). It explains part of that close's surplus; no money
// moves and the closed shift, the outflow and its operation stay untouched.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return conciliarEgresoHttp(req, auth.negocioId, id)
}
