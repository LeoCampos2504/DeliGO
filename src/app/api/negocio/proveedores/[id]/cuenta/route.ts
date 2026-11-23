import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { estadoCuentaHttp } from "@/lib/cuenta-proveedor-http"

// F5-A — estado de cuenta (obligaciones, créditos, asignaciones, totales con fórmulas explícitas).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return estadoCuentaHttp(auth.negocioId, id)
}
