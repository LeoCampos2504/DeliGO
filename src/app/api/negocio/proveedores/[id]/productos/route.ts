import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { asociarProductosHttp, desasociarProductoHttp, productosDeProveedorHttp } from "@/lib/compras-recepciones-http"

// F5 / F10-C2b — productos y variantes que entrega el proveedor (configuración; no mueve stock, costos ni deuda).
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return productosDeProveedorHttp(auth.negocioId, id)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return asociarProductosHttp(req, auth.negocioId, id)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return desasociarProductoHttp(req, auth.negocioId, id)
}
