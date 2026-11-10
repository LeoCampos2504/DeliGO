import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { crearVentaAdicionalHttp } from "@/lib/caja-cambios-http"

// F4-C4 — owner: additional sale linked to an earlier sale (POST,
// Idempotency-Key required). Refused when that sale was voided or every unit
// was returned: a new independent sale is the way (P2).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return crearVentaAdicionalHttp(req, auth.negocioId, { tipo: "NEGOCIO" }, id)
}
