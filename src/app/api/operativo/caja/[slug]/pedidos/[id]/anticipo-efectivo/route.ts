import { NextRequest } from "next/server"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { registrarAnticipoEfectivoHttp } from "@/lib/anticipos-pedido-http"

// Pagos E3 — anticipo en efectivo del pedido desde el turno PROPIO del cajero (área caja), sólo con permiso individual
// y dentro de sus límites (el servicio lo controla). Nunca transferencias del dueño.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return registrarAnticipoEfectivoHttp(req, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id }, p.id)
}
