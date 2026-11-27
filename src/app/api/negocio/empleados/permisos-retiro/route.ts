import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { guardarPermisoRetiroHttp, permisosRetiroHttp } from "@/lib/retiros-personales-http"

// T7-F1 — dueño: permiso individual de registrar retiros personales (empleados del área Caja; deshabilitado por defecto).
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return permisosRetiroHttp(auth.negocioId)
}

export async function PUT(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return guardarPermisoRetiroHttp(req, auth.negocioId)
}
