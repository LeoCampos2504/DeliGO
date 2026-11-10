import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { crearCambioHttp } from "@/lib/caja-cambios-http"

// F4-C4 — owner: commercial exchange of products of a sale (POST,
// Idempotency-Key required). The negocio and the actor come from the owner
// session; the body never sets prices, amounts, business or actor.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return crearCambioHttp(req, auth.negocioId, { tipo: "NEGOCIO" }, id)
}
