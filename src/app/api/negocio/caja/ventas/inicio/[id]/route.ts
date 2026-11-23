import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { estadoInicioVentaHttp } from "@/lib/precios-etiquetas-http"

// F10-C2c — plazo del inicio y precios que esta venta conserva (sólo los que cambiaron después de empezarla).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return estadoInicioVentaHttp(auth.negocioId, { tipo: "NEGOCIO" }, id)
}
