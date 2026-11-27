import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { anularDecisionHttp } from "@/lib/retiros-personales-http"

// T7-F1 — dueño: «volver a pendiente» (la decisión queda ANULADA en el historial).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return anularDecisionHttp(req, auth.negocioId, id)
}
