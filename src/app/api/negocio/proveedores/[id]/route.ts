import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { actualizarProveedorHttp, fichaProveedorHttp } from "@/lib/cuenta-proveedor-http"

// F5-A — ficha + historial de cambios (GET) y edición con historial (PATCH; nunca borra).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return fichaProveedorHttp(auth.negocioId, id)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return actualizarProveedorHttp(req, auth.negocioId, id)
}
