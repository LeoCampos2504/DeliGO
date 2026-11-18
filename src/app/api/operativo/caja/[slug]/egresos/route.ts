import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { egresosCajeroHttp, registrarEgresoHttp } from "@/lib/caja-egresos-http"

// F10-C1a — cashier: cash outflows of their OWN open shift only. Registration
// needs no prior authorization (the owner reviews afterwards); the response
// never carries expected cash, alerts or totals (blind close).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await egresosCajeroHttp(auth.negocio.id, auth.empleado.id))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await registrarEgresoHttp(req, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }))
}
