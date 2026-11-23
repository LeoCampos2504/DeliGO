import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { transicionRecepcionHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — envío o descarte de SU borrador (devolución y rechazo: sólo dueño → 403).
// Cajero (área caja): sólo SUS borradores; nunca aprueba, rechaza ni ve la cuenta del proveedor.

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string; accion: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await transicionRecepcionHttp(req, auth.negocio.id, { tipo: "EMPLEADO" as const, empleadoId: auth.empleado.id }, p.id, p.accion))
}
