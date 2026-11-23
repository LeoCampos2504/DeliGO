import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { catalogoEmpleadoHttp } from "@/lib/catalogo-empleado-http"

// Catálogo del empleado (área caja): permisos vigentes y productos. Sin permiso vigente no ve ni modifica nada.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await catalogoEmpleadoHttp(auth.negocio.id, auth.empleado.id, req.nextUrl.searchParams.get("soloPermisos") === "1"))
}
