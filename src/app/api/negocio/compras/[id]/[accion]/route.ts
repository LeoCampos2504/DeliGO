import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { cerrarCompraHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — cierre (con faltante) o anulación de un pedido (evento + motivo).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; accion: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id, accion } = await params
  return cerrarCompraHttp(req, auth.negocioId, id, accion)
}
