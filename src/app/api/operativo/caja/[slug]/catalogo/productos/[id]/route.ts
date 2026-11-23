import { NextRequest } from "next/server"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { editarProductoEmpleadoHttp } from "@/lib/catalogo-empleado-http"

// Edición por un empleado: cada campo exige su permiso (precios y costos aparte); nunca stock ni baja.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return editarProductoEmpleadoHttp(req, auth.negocio.id, auth.empleado.id, p.id)
}
