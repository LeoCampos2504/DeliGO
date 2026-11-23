import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { listarEtiquetasHttp, resolverEtiquetasHttp } from "@/lib/precios-etiquetas-http"

// F10-C2c — etiquetas de góndola (dueño): lista con quién confirmó y cuándo; confirmar, activar sin etiqueta o descartar.
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return listarEtiquetasHttp(req, auth.negocioId, true)
}

export async function POST(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return resolverEtiquetasHttp(req, auth.negocioId, { tipo: "NEGOCIO" })
}
