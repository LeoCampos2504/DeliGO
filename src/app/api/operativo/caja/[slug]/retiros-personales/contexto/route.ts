import { NextRequest } from "next/server"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { contextoRetiroHttp } from "@/lib/retiros-personales-http"

// T7-F1 — cajero: si puede registrar retiros y los beneficiarios elegibles (sin costos ni datos financieros).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return contextoRetiroHttp(auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id })
}
