import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { registrarPagoPedidoHttp } from "@/lib/compras-recepciones-http"

// Pagos E1 — transferencia anticipada del pedido (Idempotency-Key). Sólo DUEÑO: el negocio sale de la sesión.
// Ningún cajero registra ni confirma transferencias del dueño; nunca mueve la Caja (F10-C1).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return registrarPagoPedidoHttp(req, auth.negocioId, id)
}
