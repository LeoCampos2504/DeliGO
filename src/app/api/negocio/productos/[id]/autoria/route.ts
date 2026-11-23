import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { autoriaProductoHttp } from "@/lib/catalogo-empleado-http"

// Dueño: quién creó y modificó el producto (auditoría).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const { id } = await params
  return autoriaProductoHttp(auth.negocioId, id)
}
