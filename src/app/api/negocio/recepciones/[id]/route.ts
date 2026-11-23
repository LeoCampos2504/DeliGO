import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { actualizarRecepcionHttp, detalleRecepcionHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — detalle (GET) y reemplazo del contenido de un BORRADOR (PUT, CAS por versión).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return detalleRecepcionHttp(auth.negocioId, { tipo: "NEGOCIO" as const }, id)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return actualizarRecepcionHttp(req, auth.negocioId, { tipo: "NEGOCIO" as const }, id)
}
