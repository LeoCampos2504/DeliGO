import { NextRequest } from "next/server"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { listarEtiquetasHttp, resolverEtiquetasHttp } from "@/lib/precios-etiquetas-http"

// F10-C2c — etiquetas de góndola (cajero, área caja): ve la lista y SÓLO confirma que cambió la etiqueta.
// Nunca elige ni modifica un precio: activar sin etiqueta y descartar son del dueño (el servicio lo rechaza).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return listarEtiquetasHttp(req, auth.negocio.id, false)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return resolverEtiquetasHttp(req, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id })
}
