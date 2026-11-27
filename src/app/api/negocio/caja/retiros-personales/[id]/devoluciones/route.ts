import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { devolucionRetiroHttp } from "@/lib/retiros-personales-http"

// T7-F1 — dueño: anulación por error de registro o devolución física (Idempotency-Key obligatoria).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return devolucionRetiroHttp(req, auth.negocioId, id)
}
