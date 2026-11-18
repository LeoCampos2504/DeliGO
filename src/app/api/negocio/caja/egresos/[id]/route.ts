import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { detalleEgresoDuenoHttp } from "@/lib/caja-egresos-http"

// F10-C1a — owner: one cash outflow with its review / confirmation history.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return detalleEgresoDuenoHttp(auth.negocioId, id)
}
