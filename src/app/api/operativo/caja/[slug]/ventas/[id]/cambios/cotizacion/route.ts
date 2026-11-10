import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { cotizarCambioHttp } from "@/lib/caja-cambios-http"

// F4-C4 — cashier: exact quote of an exchange, nothing written.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await cotizarCambioHttp(req, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }, id))
}
