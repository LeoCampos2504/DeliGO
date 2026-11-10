import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { cadenaVentaHttp } from "@/lib/caja-cambios-http"

// F4-C5 — cashier: the chain of exchanges and linked additional sales of a sale
// of their business (read only; the same privacy as the sale history).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await cadenaVentaHttp(auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }, id))
}
