import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { transicionCreditoHttp } from "@/lib/cuenta-proveedor-http"

// F5-A — confirmacion | rechazo | anulacion | desvinculacion de un crédito (evento + motivo).
// La confirmación del dueño NO es conciliación bancaria (F10-D).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function POST(req: NextRequest, { params }: { params: Promise<{ creditoId: string; accion: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { creditoId, accion } = await params
  return transicionCreditoHttp(req, auth.negocioId, creditoId, accion)
}
