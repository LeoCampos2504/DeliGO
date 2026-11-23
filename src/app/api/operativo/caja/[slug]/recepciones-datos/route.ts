import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { catalogoRecepcionHttp, detalleCompraHttp, pedidosParaRecibirHttp, proveedoresParaCajeroHttp } from "@/lib/compras-recepciones-http"

// F10-C2a/C2b — datos para preparar: proveedores activos, pedidos para recibir con avance, catálogo (sin saldos ni costos acordados).
// Cajero (área caja): sólo SUS borradores; nunca aprueba, rechaza ni ve la cuenta del proveedor.

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  const sp = req.nextUrl.searchParams
  if (sp.get("catalogo") === "1") return noStore(await catalogoRecepcionHttp(auth.negocio.id, sp.get("proveedorId")))
  if (sp.get("pedidos") === "1") return noStore(await pedidosParaRecibirHttp(auth.negocio.id, auth.empleado.id))
  return noStore(await (sp.get("compraId") ? detalleCompraHttp(auth.negocio.id, sp.get("compraId")!, true) : proveedoresParaCajeroHttp(auth.negocio.id)))
}
