import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { importacionHttp } from "@/lib/importacion-productos-http"

// Importación masiva de productos (Excel/CSV) — DUEÑO: puede importar sin permiso adicional.
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return importacionHttp(req, auth.negocioId, { tipo: "NEGOCIO" })
}
export async function POST(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return importacionHttp(req, auth.negocioId, { tipo: "NEGOCIO" })
}
