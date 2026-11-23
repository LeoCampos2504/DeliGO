import { NextRequest } from "next/server"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { pagarAlRecibirHttp, pagosRecepcionCajeroHttp } from "@/lib/recepcion-pagos-http"

// F10-C2b / D-7 v2 — pago en efectivo hecho AL RECIBIR, desde SU recepción abierta.
// El dinero sale UNA vez por la salida PAGO_PROVEEDOR de F10-C1 (turno propio, Idempotency-Key) y queda
// asociado a la recepción en la misma transacción. El cajero nunca ve créditos, deuda ni saldos.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await pagosRecepcionCajeroHttp(auth.negocio.id, auth.empleado.id, p.id))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const p = await params
  const auth = await resolveOperativoAreaForSlug(req, p.slug, "caja")
  if (!auth.ok) return cajaAuthFailure(auth)
  return noStore(await pagarAlRecibirHttp(req, auth.negocio.id, auth.empleado.id, p.id))
}
