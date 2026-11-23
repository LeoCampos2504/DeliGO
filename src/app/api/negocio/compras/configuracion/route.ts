import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { actualizarConfiguracionComprasHttp, configuracionComprasHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — tratamiento de impuestos en el costo de inventario (D-4).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).

export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return configuracionComprasHttp(auth.negocioId)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return actualizarConfiguracionComprasHttp(req, auth.negocioId)
}
