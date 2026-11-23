import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { detalleCompraHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — detalle de un pedido: pedido, recibido, pendiente y recepciones.
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return detalleCompraHttp(auth.negocioId, id)
}
