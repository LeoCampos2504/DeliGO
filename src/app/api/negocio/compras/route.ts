import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { crearCompraHttp, listarComprasHttp } from "@/lib/compras-recepciones-http"

// F10-C2a — pedidos a proveedores: lista con lo recibido derivado (GET) y alta (POST).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico).

export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return listarComprasHttp(req, auth.negocioId)
}

export async function POST(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return crearCompraHttp(req, auth.negocioId)
}
