import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { crearDevolucionHttp, detalleVentaHttp } from "@/lib/caja-devoluciones-http"

// F4-A — cashier: a sale with its returns (GET) and a full void or partial
// return (POST, Idempotency-Key required). No prior owner authorization; the
// owner gets a persistent notice. Business and employee come ONLY from the
// personal operational session (área "caja"). There is no edit route.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await detalleVentaHttp(auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }, id))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await crearDevolucionHttp(req, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }, id))
}
