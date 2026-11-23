import { NextRequest } from "next/server"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { importacionHttp } from "@/lib/importacion-productos-http"

// Importación masiva de productos — EMPLEADO: exige «Importar productos» vigente + el permiso de cada operación
// (crear, editar, proveedores, precios, costos), verificados de nuevo en cada grupo de filas.
type Ctx = { params: Promise<{ slug: string }> }
async function manejar(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return importacionHttp(req, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id })
}
export async function GET(req: NextRequest, ctx: Ctx) { return manejar(req, ctx) }
export async function POST(req: NextRequest, ctx: Ctx) { return manejar(req, ctx) }
