import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { cambiarEstadoPagoHttp } from "@/lib/recepcion-pagos-http"

// F10-C2b / D-7 v2 — «observar» un pago asociado (deja de aplicarse solo; la salida de Caja no se toca) o
// volver a incluirlo. Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; pagoId: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id, pagoId } = await params
  return cambiarEstadoPagoHttp(req, auth.negocioId, id, pagoId)
}
