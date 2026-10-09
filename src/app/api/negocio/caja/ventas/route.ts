import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { mapStockLifecycleError } from "@/lib/stock-lifecycle"
import { parseVentaCajaRequestBody, registrarVentaCaja } from "@/lib/caja-venta-service"

// GET - Today's sales list + payment-method summary (section 21 "Caja —
// resumen simple"). Scoped strictly to the authenticated negocio's own day
// in its own timezone-agnostic sense (UTC calendar day is acceptable for an
// MVP summary — no negocio-level timezone dependency exists for this yet).
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }
    const negocioId = user.id

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const ventasHoy = await db.venta.findMany({
      where: { negocioId, createdAt: { gte: startOfDay } },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    const resumenHoy = {
      cantidadVentas: ventasHoy.length,
      totalVendido: round(ventasHoy.reduce((sum, v) => sum + v.total, 0)),
      totalEfectivo: round(ventasHoy.filter((v) => v.metodoPago === "EFECTIVO").reduce((sum, v) => sum + v.total, 0)),
      totalTransferencia: round(ventasHoy.filter((v) => v.metodoPago === "TRANSFERENCIA").reduce((sum, v) => sum + v.total, 0)),
      totalOtro: round(ventasHoy.filter((v) => v.metodoPago === "OTRO").reduce((sum, v) => sum + v.total, 0)),
    }

    return NextResponse.json({ ventasHoy, resumenHoy })
  } catch (error) {
    console.error("Error listing ventas de caja:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener las ventas" }, { status: 500 })
  }
}

function readIdempotencyKey(req: NextRequest): { ok: true; key: string | null } | { ok: false; error: string } {
  const raw = req.headers.get("idempotency-key")
  if (raw === null) return { ok: true, key: null }
  const key = raw.trim()
  if (!isValidVentaIdempotencyKey(key)) return { ok: false, error: "Idempotency-Key inválida" }
  return { ok: true, key: key.toLowerCase() }
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

// POST - Finalize a Caja sale (section 19): atomically creates the Venta +
// VentaItem snapshot rows, decrements stock for every controlStock=true
// product, and records one MovimientoInventario per affected product — all
// inside a single Serializable transaction so two concurrent sales can
// never oversell the same controlled product (section 25). Total/prices are
// always recomputed server-side from the DB; the client only supplies
// productoId + cantidad per line, never a price or total (section 19).
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }
    const negocioId = user.id

    // F10-B1: one body-parsing rule shared with the cashier route (same messages).
    const parsed = parseVentaCajaRequestBody(await req.json())
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { metodoPago, lines: requestedLines } = parsed

    // F10-B0 — Idempotency-Key (UUID per checkout attempt, same format as
    // POST /api/pedidos). Transition: the owner route still accepts requests
    // WITHOUT the header (legacy semantics, no dedupe); the current Caja UI
    // always sends it. A present-but-malformed header is rejected.
    const idempotency = readIdempotencyKey(req)
    if (!idempotency.ok) {
      return NextResponse.json({ error: idempotency.error }, { status: 400 })
    }

    // F10-B0: the whole sale (R3A stock plan, Venta/VentaItem, stock write,
    // CobroVenta, cash ledger leg) runs in ONE Serializable transaction inside
    // the shared engine — the only Caja sale writer (src/lib/caja-venta-service.ts).
    // The actor is the owner session; nothing in the body can choose it.
    const result = await registrarVentaCaja(db, {
      negocioId,
      actor: { tipo: "NEGOCIO" },
      metodoPago,
      lines: requestedLines,
      idempotencyKey: idempotency.key,
    })

    if (!result.ok) {
      return NextResponse.json(
        result.code ? { error: result.error, code: result.code } : { error: result.error },
        { status: result.status }
      )
    }

    // Exact idempotent replay (same Idempotency-Key, same content): the sale
    // already exists — return it as-is, no new audit entry, no side effects.
    if (result.replayed) {
      return NextResponse.json(result.venta, { status: 200, headers: { "Idempotency-Replayed": "true" } })
    }

    await auditLog({
      userId: negocioId,
      userType: "negocio",
      accion: "venta.creada",
      recurso: "venta",
      recursoId: result.venta.id,
      detalle: { total: result.venta.total, metodoPago: result.venta.metodoPago, cantidadItems: result.venta.cantidadItems },
    })

    return NextResponse.json(result.venta, { status: 201 })
  } catch (error) {
    const isSerializationConflict =
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") ||
      (error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01"))
    if (isSerializationConflict) {
      return NextResponse.json(
        { error: "El stock cambió mientras se procesaba la venta. Volvé a intentar." },
        { status: 409 }
      )
    }
    const stockError = mapStockLifecycleError(error)
    if (stockError) {
      return NextResponse.json(stockError.body, { status: stockError.status })
    }
    console.error("Error creating venta:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al registrar la venta" }, { status: 500 })
  }
}
