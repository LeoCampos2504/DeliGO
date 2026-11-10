import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { crearCambioHttp } from "@/lib/caja-cambios-http"

// F4-C4 — cashier: commercial exchange (POST, Idempotency-Key required). No
// prior owner authorization; the owner gets a persistent notice. Business and
// employee come ONLY from the personal operational session (área "caja").
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await crearCambioHttp(req, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }, id))
}
