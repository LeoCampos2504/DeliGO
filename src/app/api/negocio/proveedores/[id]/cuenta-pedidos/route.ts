import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { cuentaPorPedidosHttp } from "@/lib/cuenta-proveedor-http"

// Pagos E2 — cuenta corriente del proveedor por pedidos y facturas (sólo lectura). Sólo DUEÑO.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return cuentaPorPedidosHttp(auth.negocioId, id)
}
