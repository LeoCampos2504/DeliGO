import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { cotizarCambioHttp } from "@/lib/caja-cambios-http"

// F4-C4 — owner: exact quote of an exchange (amounts, lines, informative
// warnings) computed by the real engines and rolled back: nothing is written.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return cotizarCambioHttp(req, auth.negocioId, { tipo: "NEGOCIO" }, id)
}
