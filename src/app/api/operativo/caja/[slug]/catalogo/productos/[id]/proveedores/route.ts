import { NextRequest } from "next/server"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { proveedoresProductoEmpleadoHttp } from "@/lib/catalogo-empleado-http"

// Proveedores del producto (misma relación que la ficha del proveedor): ver / asociar / quitar con permiso vigente.
// Exportaciones explícitas por método (no alias de una constante) para que el enrutador de Next las detecte siempre.
type Ctx = { params: Promise<{ slug: string; id: string }> }
async function manejar(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return proveedoresProductoEmpleadoHttp(req, auth.negocio.id, auth.empleado.id, p.id)
}
export async function GET(req: NextRequest, ctx: Ctx) { return manejar(req, ctx) }
export async function POST(req: NextRequest, ctx: Ctx) { return manejar(req, ctx) }
export async function DELETE(req: NextRequest, ctx: Ctx) { return manejar(req, ctx) }
