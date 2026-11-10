import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { verificarCambioHttp } from "@/lib/caja-cambios-http"

// F4-C5 — owner: verification of an uncertain exchange attempt (POST, the SAME
// Idempotency-Key and body as the confirmation). Never registers the operation:
// REGISTRADO with its original result, or NO_REGISTRADO once its key is closed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return verificarCambioHttp(req, auth.negocioId, { tipo: "NEGOCIO" }, id)
}
