import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { HISTORIAL_RANGO_MAX_DIAS, listarDevolucionesNegocio } from "@/lib/caja-devoluciones-service"

// F4-A — owner ONLY: history of every void / partial return (who, when, sale,
// products, amount, reason, refund status). ?desde&hasta (≤ 31 días).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const params = new URL(req.url).searchParams
    const desde = new Date(params.get("desde") ?? "")
    const hasta = new Date(params.get("hasta") ?? "")
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || hasta <= desde || hasta.getTime() - desde.getTime() > HISTORIAL_RANGO_MAX_DIAS * 86_400_000) {
      return NextResponse.json({ ok: false, error: "Rango de fechas inválido." }, { status: 400 })
    }
    const devoluciones = await listarDevolucionesNegocio(db, auth.negocioId, { desde, hasta })
    return NextResponse.json({ ok: true, devoluciones })
  } catch (error) {
    console.error("Error listing devoluciones:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No se pudieron cargar las devoluciones." }, { status: 500 })
  }
}
