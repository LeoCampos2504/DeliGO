import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { registrarObligacionHttp } from "@/lib/cuenta-proveedor-http"

// F5-A — saldo inicial o ajuste de deuda (Idempotency-Key, auditoría en la transacción).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return registrarObligacionHttp(req, auth.negocioId, id)
}
