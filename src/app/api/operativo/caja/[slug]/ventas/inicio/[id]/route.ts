import { NextRequest } from "next/server"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { estadoInicioVentaHttp } from "@/lib/precios-etiquetas-http"

// F10-C2c — plazo del inicio del cajero y precios que su venta conserva (sólo un inicio propio).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return estadoInicioVentaHttp(auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }, id)
}
