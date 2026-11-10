import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { crearVentaAdicionalHttp } from "@/lib/caja-cambios-http"

// F4-C4 — cashier: additional sale linked to an earlier sale (POST,
// Idempotency-Key required); the owner gets a persistent notice. Refused on a
// voided or fully returned sale (P2): then a new independent sale is the way.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await crearVentaAdicionalHttp(req, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }, id))
}
