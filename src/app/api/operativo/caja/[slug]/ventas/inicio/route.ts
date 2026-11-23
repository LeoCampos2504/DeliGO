import { NextRequest } from "next/server"
import { resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { crearInicioVentaHttp } from "@/lib/precios-etiquetas-http"

// F10-C2c — inicio de una venta del cajero (área caja): el servidor fija la hora; la persona sale de la sesión.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return crearInicioVentaHttp(auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id })
}
