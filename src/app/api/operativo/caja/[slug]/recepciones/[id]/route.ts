import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { actualizarRecepcionHttp, detalleRecepcionHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — detalle y edición de SU borrador.
// Cajero (área caja): sólo SUS borradores; nunca aprueba, rechaza ni ve la cuenta del proveedor.

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await detalleRecepcionHttp(auth.negocio.id, { tipo: "EMPLEADO" as const, empleadoId: auth.empleado.id }, p.id))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await actualizarRecepcionHttp(req, auth.negocio.id, { tipo: "EMPLEADO" as const, empleadoId: auth.empleado.id }, p.id))
}
