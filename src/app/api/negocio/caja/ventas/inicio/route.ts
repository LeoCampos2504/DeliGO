import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { crearInicioVentaHttp } from "@/lib/precios-etiquetas-http"

// F10-C2c — inicio de una venta de la Caja del dueño: el servidor fija la hora (precios vigentes al empezar).
export async function POST(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return crearInicioVentaHttp(auth.negocioId, { tipo: "NEGOCIO" })
}
