import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { asociarPagoHttp } from "@/lib/recepcion-pagos-http"

// F10-C2b / D-7 v2 — el dueño asocia a la recepción un pago de Caja ya registrado (por ejemplo, uno anterior
// que sólo tenía la referencia en texto). No mueve dinero ni deuda: se aplica al aprobar.
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return asociarPagoHttp(req, auth.negocioId, id)
}
