import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { guardarPermisoAnticipoHttp, listarPermisosAnticipoHttp } from "@/lib/anticipos-pedido-http"

// Pagos E3 — permiso INDIVIDUAL de anticipos en efectivo de cada empleado (deshabilitado por defecto) y sus límites.
// Sólo DUEÑO; cada cambio queda auditado.
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return listarPermisosAnticipoHttp(auth.negocioId)
}

export async function PUT(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return guardarPermisoAnticipoHttp(req, auth.negocioId)
}
