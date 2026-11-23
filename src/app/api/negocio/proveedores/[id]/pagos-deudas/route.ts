import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { pagarDeudasHttp } from "@/lib/cuenta-proveedor-http"

// Pagos E2 — «Pagar deudas seleccionadas»: transferencia realizada por el dueño + su reparto entre facturas, en UNA
// operación del motor F5 (Idempotency-Key). Sólo DUEÑO. Nunca mueve la Caja (F10-C1).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return pagarDeudasHttp(req, auth.negocioId, id)
}
