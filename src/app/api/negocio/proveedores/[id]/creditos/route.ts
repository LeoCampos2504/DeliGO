import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { registrarCreditoHttp } from "@/lib/cuenta-proveedor-http"

// F5-A — pago declarado (queda DECLARADO hasta que el dueño lo confirme) o ajuste a favor.
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return registrarCreditoHttp(req, auth.negocioId, id)
}
