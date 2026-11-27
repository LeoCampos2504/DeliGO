import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { contextoRetiroHttp } from "@/lib/retiros-personales-http"

// T7-F1 — dueño: beneficiarios elegibles para el formulario de retiro (empleados, familiares, dueño).
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return contextoRetiroHttp(auth.negocioId, { tipo: "NEGOCIO" })
}
