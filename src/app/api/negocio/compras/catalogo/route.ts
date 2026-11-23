import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { catalogoRecepcionHttp } from "@/lib/compras-recepciones-http"

// F10-C2b — catálogo para recibir mercadería (identificación, unidad y variantes; sin precios ni costos).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).

export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return catalogoRecepcionHttp(auth.negocioId, req.nextUrl.searchParams.get("proveedorId"))
}
