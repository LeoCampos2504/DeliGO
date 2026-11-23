import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { anularObligacionHttp } from "@/lib/cuenta-proveedor-http"

// F5-A — anulación de una deuda sin asignaciones vigentes (evento + motivo).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function POST(req: NextRequest, { params }: { params: Promise<{ obligacionId: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { obligacionId } = await params
  return anularObligacionHttp(req, auth.negocioId, obligacionId)
}
