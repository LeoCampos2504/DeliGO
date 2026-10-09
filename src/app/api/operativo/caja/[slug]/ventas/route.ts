import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { mapStockLifecycleError } from "@/lib/stock-lifecycle"
import { parseVentaCajaRequestBody, registrarVentaCaja } from "@/lib/caja-venta-service"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure, ventaParaCajero } from "@/lib/operativo-caja"

// ============================================
// F10-B1 — POST /api/operativo/caja/[slug]/ventas (cashier sale)
// ============================================
// 1. personal operational session → active employee of THIS business with área
//    "caja" (generic rubro, approved, not suspended) — resolveOperativoAreaForSlug;
// 2. Idempotency-Key REQUIRED (no legacy mode for employees);
// 3. delegates to the single F10-B0 engine (registrarVentaCaja) with the actor
//    derived from the session: { tipo: "EMPLEADO", empleadoId } — same prices,
//    stock, R3A reservations and atomicity as the owner's Caja;
// 4. responds with the cashier's own sale only (ventaParaCajero).
// No turno yet (F10-B2). The body can never choose negocio, employee, actor,
// prices or totals.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
    if (!auth.ok) return cajaAuthFailure(auth)

    const rawKey = req.headers.get("idempotency-key")?.trim() ?? ""
    if (!isValidVentaIdempotencyKey(rawKey)) {
      return noStore(
        NextResponse.json(
          { ok: false, error: "Falta una Idempotency-Key válida para registrar la venta.", code: "IDEMPOTENCY_KEY_REQUIRED" },
          { status: 400 }
        )
      )
    }

    const parsed = parseVentaCajaRequestBody(await req.json().catch(() => null))
    if (!parsed.ok) return noStore(NextResponse.json({ ok: false, error: parsed.error }, { status: 400 }))

    const result = await registrarVentaCaja(db, {
      negocioId: auth.negocio.id,
      actor: { tipo: "EMPLEADO", empleadoId: auth.empleado.id },
      metodoPago: parsed.metodoPago,
      lines: parsed.lines,
      idempotencyKey: rawKey.toLowerCase(),
    })

    if (!result.ok) {
      return noStore(
        NextResponse.json(
          result.code ? { ok: false, error: result.error, code: result.code } : { ok: false, error: result.error },
          { status: result.status }
        )
      )
    }
    if (result.replayed) {
      return noStore(NextResponse.json(ventaParaCajero(result.venta), { status: 200, headers: { "Idempotency-Replayed": "true" } }))
    }

    await auditLog({
      userId: auth.empleado.id,
      userType: "empleado",
      accion: "venta.creada",
      recurso: "venta",
      recursoId: result.venta.id,
      detalle: { negocioId: auth.negocio.id, total: result.venta.total, metodoPago: result.venta.metodoPago, cantidadItems: result.venta.cantidadItems },
    })

    return noStore(NextResponse.json(ventaParaCajero(result.venta), { status: 201 }))
  } catch (error) {
    const isSerializationConflict =
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") ||
      (error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01"))
    if (isSerializationConflict) {
      return noStore(
        NextResponse.json({ ok: false, error: "El stock cambió mientras se procesaba la venta. Volvé a intentar." }, { status: 409 })
      )
    }
    const stockError = mapStockLifecycleError(error)
    if (stockError) return noStore(NextResponse.json(stockError.body, { status: stockError.status }))
    console.error("Error creating venta de caja (operativo):", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "Error al registrar la venta" }, { status: 500 }))
  }
}
