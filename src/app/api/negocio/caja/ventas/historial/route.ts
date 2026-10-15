import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { historialVentasHttp } from "@/lib/caja-devoluciones-http"

// F4-A — owner: search past sales (?desde&hasta ≤ 31 días, or ?ref=) with
// their returns, gross / returned / net per sale.
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return historialVentasHttp(req, auth.negocioId, { tipo: "NEGOCIO" })
}
