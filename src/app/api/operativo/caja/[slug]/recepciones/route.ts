import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { crearRecepcionHttp, listarRecepcionesHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — el cajero prepara recepciones: sus recepciones (GET) y alta de borrador (POST).
// Cajero (área caja): sólo SUS borradores; nunca aprueba, rechaza ni ve la cuenta del proveedor.

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await listarRecepcionesHttp(req, auth.negocio.id, { tipo: "EMPLEADO" as const, empleadoId: auth.empleado.id }))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await crearRecepcionHttp(req, auth.negocio.id, { tipo: "EMPLEADO" as const, empleadoId: auth.empleado.id }))
}
