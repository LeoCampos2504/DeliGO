import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { crearDevolucionHttp, detalleVentaHttp } from "@/lib/caja-devoluciones-http"

// F4-A — owner: a sale with its returns (GET) and a full void or partial
// return of it (POST, Idempotency-Key required). The negocio and the actor
// come from the owner session; the body never sets prices or amounts.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return detalleVentaHttp(auth.negocioId, { tipo: "NEGOCIO" }, id)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return crearDevolucionHttp(req, auth.negocioId, { tipo: "NEGOCIO" }, id)
}
