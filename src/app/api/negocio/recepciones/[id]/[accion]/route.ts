import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { transicionRecepcionHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — envio | devolucion | rechazo | descarte de una recepción (evento + versión).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; accion: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id, accion } = await params
  return transicionRecepcionHttp(req, auth.negocioId, { tipo: "NEGOCIO" as const }, id, accion)
}
