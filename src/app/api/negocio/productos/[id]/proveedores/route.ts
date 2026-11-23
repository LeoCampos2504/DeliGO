import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { asociarProveedorAProductoHttp, desasociarProveedorDeProductoHttp, proveedoresDeProductoHttp } from "@/lib/compras-recepciones-http"

// Catálogo — proveedores que entregan este producto (misma relación proveedor_productos que la ficha del proveedor).
// Solo DUEÑO. Asociar o quitar no cambia el producto, su stock, costos ni precios.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return proveedoresDeProductoHttp(auth.negocioId, id)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return asociarProveedorAProductoHttp(req, auth.negocioId, id)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return desasociarProveedorDeProductoHttp(req, auth.negocioId, id)
}
