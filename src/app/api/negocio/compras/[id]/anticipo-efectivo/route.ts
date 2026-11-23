import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { registrarAnticipoEfectivoHttp } from "@/lib/anticipos-pedido-http"

// Pagos E3 — anticipo en efectivo del pedido desde una caja con turno abierto (salida F10-C1 + vínculo al pedido).
// DUEÑO: elige la caja; mismos controles que «Egresos» (turno que cambió, justificación si el esperado queda negativo).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return registrarAnticipoEfectivoHttp(req, auth.negocioId, { tipo: "NEGOCIO" }, id)
}
