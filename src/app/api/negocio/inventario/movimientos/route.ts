import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isValidMovimientoTipo, resolveNextStock } from "@/lib/inventario"

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

    // Ownership check: never return movements for a product this negocio
    // does not own, regardless of what productoId is requested.
    const producto = await db.producto.findUnique({ where: { id: productoId }, select: { negocioId: true } })
    if (!producto || producto.negocioId !== negocioId) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    const movimientos = await db.movimientoInventario.findMany({
      where: { negocioId, productoId },
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
    const { productoId, tipo, cantidad, motivo } = body

    if (typeof productoId !== "string" || !productoId) {
      return NextResponse.json({ error: "productoId es obligatorio" }, { status: 400 })
    }
    if (tipo === "VENTA" || !isValidMovimientoTipo(tipo)) {
      return NextResponse.json({ error: "Tipo de movimiento inválido" }, { status: 400 })
    }
    if (typeof cantidad !== "number") {
      return NextResponse.json({ error: "cantidad es obligatoria" }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      // Row lock + ownership check together: SELECT ... FOR UPDATE via
      // Prisma's `$queryRaw` isn't needed here — Serializable isolation
      // below already prevents two concurrent movements on the same
      // product from double-applying (one will fail with P2034 and the
      // caller retries), same pattern as POST /api/negocio/productos.
      const producto = await tx.producto.findUnique({ where: { id: productoId } })
      if (!producto || producto.negocioId !== negocioId) {
        return { ok: false as const, status: 404, error: "Producto no encontrado" }
      }
      if (!producto.controlStock) {
        return { ok: false as const, status: 400, error: "Este producto no tiene control de stock activado" }
      }

      const next = resolveNextStock(producto.stockCantidad, tipo, cantidad)
      if (!next.ok) {
        return { ok: false as const, status: 400, error: next.error }
      }

      const updated = await tx.producto.update({
        where: { id: productoId },
        data: { stockCantidad: next.nextStock },
      })
      const movimiento = await tx.movimientoInventario.create({
        data: {
          negocioId,
          productoId,
          tipo,
          cantidad,
          stockAntes: producto.stockCantidad,
          stockDespues: next.nextStock,
          motivo: typeof motivo === "string" && motivo.trim() ? motivo.trim() : null,
        },
      })
      return { ok: true as const, producto: updated, movimiento }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await auditLog({
      userId: negocioId,
      userType: "negocio",
      accion: "producto.stock_ajustado",
      recurso: "producto",
      recursoId: productoId,
      detalle: { tipo, cantidad, stockDespues: result.producto.stockCantidad },
    })

    return NextResponse.json({ producto: result.producto, movimiento: result.movimiento }, { status: 201 })
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
    console.error("Error creating movimiento de inventario:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al registrar el movimiento" }, { status: 500 })
  }
}
