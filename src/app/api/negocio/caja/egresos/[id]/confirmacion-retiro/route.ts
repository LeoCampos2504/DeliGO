import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { confirmarRetiroHttp } from "@/lib/caja-egresos-http"

// F10-C1a — owner: confirm, once, that a withdrawal an employee registered was
// received (CONFIRMADO / NO_RECIBIDO). The cash already left when it was
// registered; this confirmation never creates another financial movement.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return confirmarRetiroHttp(req, auth.negocioId, id)
}
