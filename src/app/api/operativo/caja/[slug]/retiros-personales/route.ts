import { NextRequest } from "next/server"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { crearRetiroHttp } from "@/lib/retiros-personales-http"

// T7-F1 — cajero: registro de un retiro personal de mercadería. Sesión operativa personal de Caja; el permiso
// individual (empleados.retiroPersonalHabilitado) se relee dentro de la transacción. Respuesta sin costos.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return crearRetiroHttp(req, { negocioId: auth.negocio.id, actor: { tipo: "EMPLEADO", empleadoId: auth.empleado.id }, vista: "cajero" })
}
