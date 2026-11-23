import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { vistaPreviaHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — vista previa de la aprobación (sólo lectura): costos, deuda, excedentes, diferencias, anticipos.
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return vistaPreviaHttp(req, auth.negocioId, id)
}
