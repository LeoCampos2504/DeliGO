import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { mapStockLifecycleError } from "@/lib/stock-lifecycle"
import { parseVentaCajaRequestBody, registrarVentaCaja, ventaCajaParaRespuesta } from "@/lib/caja-venta-service"
import { addMoney, moneyToNumber, storedMoney } from "@/lib/money"
import { lineaVigente } from "@/lib/caja-venta-vigente"
import { agruparCobrosPorVenta, COBRO_RESUMEN_SELECT, resumirCobrosCaja } from "@/lib/caja-resumen-cobros"

// GET - Today's sales list + payment-method summary (section 21 "Caja —
// resumen simple"; F4-C2: money by method read from the real cobros).
// Scoped strictly to the authenticated negocio's own day
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
    // F4-A: returns/voids REGISTERED today (whatever the sale date). The sale
    // rows stay gross; net = sold today − returned today.
    const devolucionesHoy = await db.devolucionVenta.findMany({
      where: { negocioId, createdAt: { gte: startOfDay } },
      select: { importeDecimal: true },
    })
    // Return state of the listed sales, kept OUT of the sale objects (their
    // JSON contract is unchanged): { [ventaId]: { totalDevuelto, estadoDevolucion } }.
    const devolucionesDeVentas = ventasHoy.length
      ? await db.devolucionVenta.findMany({ where: { negocioId, ventaId: { in: ventasHoy.map((v) => v.id) } }, select: { ventaId: true, tipo: true, importeDecimal: true } })
      : []

    // F4-C2: the money by method comes from the cobros actually registered
    // (CobroVenta), read in a separate query so the sale objects (JSON contract)
    // stay unchanged. A sale without cobros (before F10-B0) is read as one cobro
    // of its own metodoPago (src/lib/caja-resumen-cobros.ts). For every sale the
    // engine writes today (one cobro = its total) the figures are identical to
    // the former grouping of Venta.total by Venta.metodoPago.
    // F10-B2.0: exact sums (Decimal column, or the legacy Float quantized to
    // cents for a row written before the backfill); same numeric JSON shape.
    const cobrosHoy = ventasHoy.length
      ? await db.cobroVenta.findMany({ where: { negocioId, ventaId: { in: ventasHoy.map((v) => v.id) } }, select: { ventaId: true, ...COBRO_RESUMEN_SELECT } })
      : []
    const cobrosPorVenta = agruparCobrosPorVenta(cobrosHoy)
    const resumen = resumirCobrosCaja(ventasHoy.map((v) => ({ ...v, cobros: cobrosPorVenta.get(v.id) ?? [] })))
    const totalDevueltoHoy = addMoney(...devolucionesHoy.map((d) => d.importeDecimal))
    const resumenHoy = {
      cantidadVentas: ventasHoy.length,
      totalVendido: moneyToNumber(resumen.ventasBrutas),
      totalEfectivo: moneyToNumber(resumen.cobradoPorMedio.EFECTIVO),
      totalTransferencia: moneyToNumber(resumen.cobradoPorMedio.TRANSFERENCIA),
      totalOtro: moneyToNumber(resumen.cobradoPorMedio.OTRO),
      totalDevuelto: moneyToNumber(totalDevueltoHoy),
      totalNeto: moneyToNumber(resumen.ventasBrutas.minus(totalDevueltoHoy)),
    }

    const devolucionesPorVenta: Record<string, { totalDevuelto: number; estadoDevolucion: string }> = {}
    for (const venta of ventasHoy) {
      const propias = devolucionesDeVentas.filter((d) => d.ventaId === venta.id)
      if (propias.length === 0) continue
      const devuelto = addMoney(...propias.map((d) => d.importeDecimal))
      devolucionesPorVenta[venta.id] = {
        totalDevuelto: moneyToNumber(devuelto),
        estadoDevolucion: propias.some((d) => d.tipo === "ANULACION") ? "ANULADA" : devuelto.gte(storedMoney(venta.totalDecimal, venta.total)) ? "DEVUELTA_TOTAL" : "DEVOLUCION_PARCIAL",
      }
    }

    // F4-B: current lines of the listed sales that were corrected by the owner
    // (one query; never-corrected sales are absent and keep their own rows).
    // The sale objects above stay the original, unmodified records.
    const correccionesDeVentas = ventasHoy.length
      ? await db.correccionVenta.findMany({ where: { negocioId, ventaId: { in: ventasHoy.map((v) => v.id) } }, orderBy: { secuencia: "desc" }, include: { lineas: true } })
      : []
    const correccionesPorVenta: Record<string, { secuencia: number; items: Array<{ id: string; productoId: string | null; nombre: string; varianteNombre: string | null; precio: number; cantidad: number; subtotal: number }> }> = {}
    for (const venta of ventasHoy) {
      const ultima = correccionesDeVentas.find((c) => c.ventaId === venta.id)
      if (!ultima) continue
      correccionesPorVenta[venta.id] = {
        secuencia: ultima.secuencia,
        items: venta.items.map((item) => {
          const linea = lineaVigente(item, ultima.lineas)
          return { id: item.id, productoId: linea.productoId, nombre: linea.nombre, varianteNombre: linea.varianteNombre, precio: linea.precio, cantidad: linea.cantidad, subtotal: moneyToNumber(linea.subtotal) }
        }),
      }
    }

    return NextResponse.json({ ventasHoy: ventasHoy.map(ventaCajaParaRespuesta), resumenHoy, devolucionesPorVenta, correccionesPorVenta })
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
    const rawBody = await req.json()
    const parsed = parseVentaCajaRequestBody(rawBody)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { metodoPago, lines: requestedLines } = parsed
    const cajaFisicaId = rawBody && typeof rawBody === "object" && "cajaFisicaId" in rawBody
      ? (rawBody as { cajaFisicaId?: unknown }).cajaFisicaId
      : null
    if (cajaFisicaId !== null && (typeof cajaFisicaId !== "string" || !cajaFisicaId.trim())) {
      return NextResponse.json({ error: "Caja inválida" }, { status: 400 })
    }

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
      ownerCajaFisicaId: cajaFisicaId,
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
      return NextResponse.json(ventaCajaParaRespuesta(result.venta), { status: 200, headers: { "Idempotency-Replayed": "true" } })
    }

    await auditLog({
      userId: negocioId,
      userType: "negocio",
      accion: "venta.creada",
      recurso: "venta",
      recursoId: result.venta.id,
      detalle: { total: result.venta.total, metodoPago: result.venta.metodoPago, cantidadItems: result.venta.cantidadItems },
    })

    return NextResponse.json(ventaCajaParaRespuesta(result.venta), { status: 201 })
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
