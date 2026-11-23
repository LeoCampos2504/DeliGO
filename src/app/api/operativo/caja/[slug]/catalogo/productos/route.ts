import { NextRequest } from "next/server"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { crearProductoEmpleadoHttp } from "@/lib/catalogo-empleado-http"

// Alta de producto por un empleado con permiso de catálogo VIGENTE (se verifica en cada operación). Nunca stock.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return crearProductoEmpleadoHttp(req, auth.negocio.id, auth.empleado.id)
}
