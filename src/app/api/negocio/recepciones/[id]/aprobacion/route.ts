import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { aprobarRecepcionHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — aprobación atómica: stock R3A + costos + obligación F5 + anticipos opcionales.
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return aprobarRecepcionHttp(req, auth.negocioId, id)
}
