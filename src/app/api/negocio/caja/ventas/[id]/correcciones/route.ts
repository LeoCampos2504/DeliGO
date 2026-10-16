import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { parseCorreccionBody, registrarCorreccionVenta } from "@/lib/caja-correcciones-service"
import { correccionParaRespuesta, detalleVentaConDevoluciones } from "@/lib/caja-devoluciones-service"

// ============================================
// F4-B — owner ONLY: administrative correction of a Caja sale
// ============================================
// The business and the actor come exclusively from the OWNER session
// (requireNegocioCajaGenerico; origin-protected prefix). There is no cashier
// route. The body only names product, variant and quantity per line; prices
// (the unit price actually charged), totals and the actor are server-side.
// Idempotency-Key required. No money moves and the payment method never
// changes: a correction that alters the charged total is refused.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const { id } = await params
    const rawKey = req.headers.get("idempotency-key")?.trim() ?? ""
    if (!isValidVentaIdempotencyKey(rawKey)) {
      return NextResponse.json({ ok: false, error: "Falta una Idempotency-Key válida.", code: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 })
    }
    const parsed = parseCorreccionBody(await req.json().catch(() => null))
    if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error, ...(parsed.code ? { code: parsed.code } : {}) }, { status: parsed.status })
    const result = await registrarCorreccionVenta(db, { negocioId: auth.negocioId, ventaId: id, solicitud: parsed.value, idempotencyKey: rawKey.toLowerCase() })
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status })
    const { correccion, replayed } = result.value
    const respuesta = correccionParaRespuesta(correccion)
    if (!replayed) {
      await auditLog({
        userId: auth.negocioId,
        userType: "negocio",
        accion: "venta.corregida",
        recurso: "venta",
        recursoId: correccion.ventaId,
        detalle: { negocioId: auth.negocioId, correccionId: correccion.id, secuencia: correccion.secuencia, motivo: correccion.motivo, total: correccion.totalDecimal.toString(), cambios: respuesta.cambios },
      })
    }
    const venta = await detalleVentaConDevoluciones(db, auth.negocioId, correccion.ventaId, { tipo: "NEGOCIO" })
    return NextResponse.json(
      { ok: true, replayed, correccion: respuesta, venta },
      { status: replayed ? 200 : 201, headers: replayed ? { "Idempotency-Replayed": "true" } : undefined }
    )
  } catch (error) {
    console.error("Error registering correccion de venta:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No pudimos guardar la corrección por un error del servidor. Podés reintentar sin duplicarla." }, { status: 500 })
  }
}
