import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidMovimientoTipo } from "@/lib/inventario"
import {
  mapStockLifecycleError,
  planificarMovimientoManual,
  registrarMovimientoManual,
  runStockSerializable,
  type AjusteConfirmacion,
  type MovimientoManualTipo,
} from "@/lib/stock-lifecycle"

// GET - Recent inventory movements for a single product (activity feed —
// section 13 "actividad reciente de inventario")
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }
    const negocioId = user.id

    const productoId = req.nextUrl.searchParams.get("productoId")
    if (!productoId) {
      return NextResponse.json({ error: "productoId es obligatorio" }, { status: 400 })
    }
    // P2-T56-R2C: optional filter to a single variant's own activity feed
    // (section 25's "Ajustar stock" per-variant UX). Omitted, this keeps its
    // original behavior — every movement for the product, variant or not.
    const productoVarianteId = req.nextUrl.searchParams.get("productoVarianteId")

    // Ownership check: never return movements for a product this negocio
    // does not own, regardless of what productoId is requested.
    const producto = await db.producto.findUnique({ where: { id: productoId }, select: { negocioId: true } })
    if (!producto || producto.negocioId !== negocioId) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    const movimientos = await db.movimientoInventario.findMany({
      where: { negocioId, productoId, ...(productoVarianteId ? { productoVarianteId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 25,
    })
    return NextResponse.json(movimientos)
  } catch (error) {
    console.error("Error listing movimientos de inventario:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener movimientos" }, { status: 500 })
  }
}

// POST - Register a stock movement (ENTRADA/SALIDA/AJUSTE) and atomically
// update Producto.stockCantidad in the same transaction (section 11). VENTA
// movements are created only by POST /api/negocio/caja/ventas — never
// directly through this endpoint, to avoid a duplicate/inconsistent sale
// record.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }
    const negocioId = user.id

    const body = await req.json()
    const { productoId, productoVarianteId, tipo, cantidad, motivo, confirmacionAjuste } = body

    if (typeof productoId !== "string" || !productoId) {
      return NextResponse.json({ error: "productoId es obligatorio" }, { status: 400 })
    }
    if (productoVarianteId !== undefined && productoVarianteId !== null && typeof productoVarianteId !== "string") {
      return NextResponse.json({ error: "productoVarianteId inválido" }, { status: 400 })
    }
    if (tipo === "VENTA" || !isValidMovimientoTipo(tipo)) {
      return NextResponse.json({ error: "Tipo de movimiento inválido" }, { status: 400 })
    }
    if (typeof cantidad !== "number") {
      return NextResponse.json({ error: "cantidad es obligatoria" }, { status: 400 })
    }
    // P2-T56-R3A-I3: confirmación de un AJUSTE deficitario. Sólo se acepta la
    // huella que el servidor devolvió en la advertencia; el servidor la vuelve
    // a calcular con el estado actual dentro de la tx (nunca un "confirmado: true").
    let huellaConfirmada: string | null = null
    if (confirmacionAjuste !== undefined && confirmacionAjuste !== null) {
      const huella = (confirmacionAjuste as { huella?: unknown }).huella
      if (typeof huella !== "string" || !/^[0-9a-f]{64}$/.test(huella)) {
        return NextResponse.json({ error: "Confirmación de ajuste inválida" }, { status: 400 })
      }
      huellaConfirmada = huella
    }
    const motivoNormalizado = typeof motivo === "string" && motivo.trim() ? motivo.trim() : null

    // P2-T56-R3A-I3: Serializable con maxWait/timeout explícitos y retry acotado
    // SÓLO ante P2034. La política de reservas (SALIDA / AJUSTE) vive en la
    // autoridad compartida: este route no lee ReservaStock ni escribe stock.
    type MovimientoResult =
      | { ok: false; status: number; error: string }
      | { ok: "confirm"; confirmacion: AjusteConfirmacion; vencida: boolean }
      | Awaited<ReturnType<typeof registrarMovimientoManual>> & { ok: true }
    const result = await runStockSerializable(db, async (tx): Promise<MovimientoResult> => {
      // Tenant check (section 15/29): the product must belong to the
      // authenticated negocio.
      const producto = await tx.producto.findUnique({ where: { id: productoId } })
      if (!producto || producto.negocioId !== negocioId) {
        return { ok: false, status: 404, error: "Producto no encontrado" }
      }

      // P2-T56-R2C §25: a variant movement targets THAT variant's own stock
      // (never the parent's), and the variant must belong to this product.
      if (productoVarianteId) {
        const variante = await tx.productoVariante.findUnique({ where: { id: productoVarianteId } })
        if (!variante || variante.productoId !== productoId) {
          return { ok: false, status: 404, error: "Variante no encontrada" }
        }
        if (!variante.controlStock) {
          return { ok: false, status: 400, error: "Esta variante no tiene control de stock activado" }
        }
      } else if (!producto.controlStock) {
        return { ok: false, status: 400, error: "Este producto no tiene control de stock activado" }
      }

      const key = { productoId, productoVarianteId: productoVarianteId ?? null }
      const movimientoTipo = tipo as MovimientoManualTipo
      const plan = await planificarMovimientoManual(tx, {
        negocioId,
        key,
        tipo: movimientoTipo,
        cantidad,
        huellaConfirmada,
      })
      // AJUSTE deficitario sin una confirmación vigente: no se escribe nada.
      if (plan.kind === "confirm") {
        return { ok: "confirm", confirmacion: plan.confirmacion, vencida: plan.vencida }
      }
      const written = await registrarMovimientoManual(tx, {
        negocioId,
        key,
        tipo: movimientoTipo,
        cantidad,
        motivo: motivoNormalizado,
        plan,
      })
      return { ok: true, ...written }
    })

    if (result.ok === "confirm") {
      const { confirmacion, vencida } = result
      return NextResponse.json(
        {
          code: "STOCK_ADJUSTMENT_CONFIRMATION_REQUIRED",
          error: vencida
            ? "El stock o las reservas cambiaron mientras confirmabas. Revisá los valores actualizados antes de continuar."
            : `Hay ${confirmacion.reservasActivas} unidades reservadas para pedidos pendientes. Si cambiás el stock a ${confirmacion.stockPropuesto}, van a faltar ${confirmacion.deficitResultante} unidades para cubrir esos pedidos.`,
          confirmacion,
          confirmacionVencida: vencida,
        },
        { status: 409 }
      )
    }
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await auditLog({
      userId: negocioId,
      userType: "negocio",
      accion: "producto.stock_ajustado",
      recurso: "producto",
      recursoId: productoId,
      detalle: {
        tipo,
        cantidad,
        productoVarianteId: productoVarianteId ?? null,
        stockDespues: result.variante ? result.variante.stockCantidad : result.producto!.stockCantidad,
      },
    })

    return NextResponse.json({ producto: result.producto, variante: result.variante, movimiento: result.movimiento }, { status: 201 })
  } catch (error) {
    const isSerializationConflict =
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") ||
      (error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01"))
    if (isSerializationConflict) {
      return NextResponse.json(
        { error: "El stock cambió mientras se registraba el movimiento. Intentá de nuevo." },
        { status: 409 }
      )
    }
    const stockError = mapStockLifecycleError(error)
    if (stockError) {
      return NextResponse.json(stockError.body, { status: stockError.status })
    }
    console.error("Error creating movimiento de inventario:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al registrar el movimiento" }, { status: 500 })
  }
}
