import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { registrarReintegroHttp } from "@/lib/caja-devoluciones-http"

// F4-A — owner: register, once, a refund that was left pending.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return registrarReintegroHttp(req, auth.negocioId, { tipo: "NEGOCIO" }, id)
}
