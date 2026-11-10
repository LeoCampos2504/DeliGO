import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { cadenaVentaHttp } from "@/lib/caja-cambios-http"

// F4-C5 — owner: the chain of exchanges and linked additional sales of a sale (read only).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return cadenaVentaHttp(auth.negocioId, { tipo: "NEGOCIO" }, id)
}
