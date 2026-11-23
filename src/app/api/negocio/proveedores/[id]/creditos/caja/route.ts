import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { vincularPagoCajaHttp } from "@/lib/cuenta-proveedor-http"

// F5-A — vincula un pago a proveedor de Caja (F10-C1) SIN modificar el egreso; bloquea su compensación.
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return vincularPagoCajaHttp(req, auth.negocioId, id)
}
