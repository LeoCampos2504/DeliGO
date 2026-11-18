import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { revisarEgresoHttp } from "@/lib/caja-egresos-http"

// F10-C1a — owner: review a cash outflow (REVISADO / OBSERVADO). Never moves money.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return revisarEgresoHttp(req, auth.negocioId, id)
}
