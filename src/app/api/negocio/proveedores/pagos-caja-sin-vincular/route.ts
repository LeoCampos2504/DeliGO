import { NextRequest } from "next/server"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { pagosCajaSinVincularHttp } from "@/lib/cuenta-proveedor-http"

// F5-A — pagos a proveedor de Caja (F10-C1) no compensados y todavía sin proveedor.
// Solo DUEÑO: el negocio sale de la sesión (requireNegocioCajaGenerico); ningún cajero.
export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  return pagosCajaSinVincularHttp(auth.negocioId)
}
