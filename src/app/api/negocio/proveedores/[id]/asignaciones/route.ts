import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { operarAsignacionesHttp } from "@/lib/cuenta-proveedor-http"

// F5-A — motor único de asignaciones: ASIGNAR | DESAFECTAR | REASIGNAR (Idempotency-Key).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return operarAsignacionesHttp(req, auth.negocioId, id)
}
