import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { guardarPermisosCatalogoHttp, permisosCatalogoHttp } from "@/lib/catalogo-empleado-http"

// Dueño: permisos TEMPORALES de catálogo por empleado (vigencia + permisos independientes; revocar = sin vigencia).
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return permisosCatalogoHttp(auth.negocioId)
}
export async function PUT(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return guardarPermisosCatalogoHttp(req, auth.negocioId)
}
