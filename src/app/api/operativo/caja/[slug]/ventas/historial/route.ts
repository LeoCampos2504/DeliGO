import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { historialVentasHttp } from "@/lib/caja-devoluciones-http"

// F4-A — cashier: find a previous sale of THIS business to void it or return
// products (business decision: any authorized cashier can, even from another
// shift). Only what the return needs: lines, amounts charged, returns already
// made. Never expected cash, shift totals, ledger data or other businesses.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await historialVentasHttp(req, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }))
}
