import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { verificarCambioHttp } from "@/lib/caja-cambios-http"

// F4-C5 — cashier: verification of an uncertain exchange attempt (POST, the SAME
// Idempotency-Key and body as the confirmation). Never registers the operation.
// Business and employee come ONLY from the personal operational session.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await verificarCambioHttp(req, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }, id))
}
