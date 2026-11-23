import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { crearRecepcionHttp, listarRecepcionesHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — recepciones de mercadería: lista (GET) y alta de borrador (POST, Idempotency-Key).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).

export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return listarRecepcionesHttp(req, auth.negocioId, { tipo: "NEGOCIO" as const })
}

export async function POST(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return crearRecepcionHttp(req, auth.negocioId, { tipo: "NEGOCIO" as const })
}
