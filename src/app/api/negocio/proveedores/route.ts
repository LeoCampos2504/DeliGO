import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { crearProveedorHttp, listarProveedoresHttp } from "@/lib/cuenta-proveedor-http"

// F5-A — lista de proveedores con saldos (GET) y alta con CUIT opcional validado (POST, Idempotency-Key).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return listarProveedoresHttp(req, auth.negocioId)
}

export async function POST(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return crearProveedorHttp(req, auth.negocioId)
}
