import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { barcodeLookupKey, normalizeBarcodeForStorage } from "@/lib/barcode"
import { mapBarcodeWriteError, runBarcodeGuardedWrite } from "@/lib/barcode-uniqueness"

// ============================================
// P2-T56-R2C — PUT /api/negocio/productos/[id]/variantes/[varianteId]
// ============================================
// Partial update (section 13): edit fields and/or toggle `activo`. There is
// deliberately no DELETE handler — VARIANT_DELETE_BEHAVIOR is soft-toggle
// only (see the R2C report section 14), so a variant already referenced by
// a historical VentaItem/MovimientoInventario snapshot is never orphaned.
// stockCantidad is intentionally NOT accepted here, same reasoning as
// PUT /api/negocio/productos/[id]: it must go through
// POST /api/negocio/inventario/movimientos so every change stays traced.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; varianteId: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }
    const negocioId = user.id
    const { id: productoId, varianteId } = await params

    const producto = await db.producto.findUnique({ where: { id: productoId } })
    if (!producto || producto.negocioId !== negocioId) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    const existing = await db.productoVariante.findUnique({ where: { id: varianteId } })
    if (!existing || existing.productoId !== productoId) {
      return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 })
    }

    const body = await req.json()
    const { nombre, precio, costo, sku, codigoBarras, controlStock, stockMinimo, activo } = body

    if (nombre !== undefined && !(typeof nombre === "string" && nombre.trim())) {
      return NextResponse.json({ error: "El nombre de la variante es obligatorio" }, { status: 400 })
    }
    if (precio !== undefined && (typeof precio !== "number" || !Number.isFinite(precio) || precio <= 0)) {
      return NextResponse.json({ error: "El precio de la variante debe ser mayor a 0" }, { status: 400 })
    }
    if (costo !== undefined && costo !== null && (typeof costo !== "number" || !Number.isFinite(costo) || costo < 0)) {
      return NextResponse.json({ error: "El costo no puede ser negativo" }, { status: 400 })
    }
    if (stockMinimo !== undefined && (typeof stockMinimo !== "number" || !Number.isFinite(stockMinimo) || stockMinimo < 0)) {
      return NextResponse.json({ error: "El stock mínimo no puede ser negativo" }, { status: 400 })
    }

    let codigoBarrasValue: string | null = null
    if (codigoBarras !== undefined) {
      const validCodigoBarras = normalizeBarcodeForStorage(codigoBarras)
      if (!validCodigoBarras.ok) {
        return NextResponse.json({ error: validCodigoBarras.error }, { status: 400 })
      }
      codigoBarrasValue = validCodigoBarras.value
    }

    const updateData: Record<string, unknown> = {}
    if (nombre !== undefined) updateData.nombre = (nombre as string).trim()
    if (precio !== undefined) updateData.precio = precio
    if (costo !== undefined) updateData.costo = costo === null ? null : costo
    if (sku !== undefined) updateData.sku = sku || null
    if (codigoBarras !== undefined) updateData.codigoBarras = codigoBarrasValue
    if (controlStock !== undefined) updateData.controlStock = controlStock === true
    if (stockMinimo !== undefined) updateData.stockMinimo = stockMinimo
    if (activo !== undefined) updateData.activo = activo === true

    // F9 (D3): only a CHANGED non-empty code is claimed (inactive variants
    // already count, so toggling `activo` never introduces a code).
    const changesCode =
      codigoBarras !== undefined && codigoBarrasValue !== null &&
      barcodeLookupKey(codigoBarrasValue) !== barcodeLookupKey(existing.codigoBarras)
    const updated = changesCode
      ? await runBarcodeGuardedWrite(
          db,
          { negocioId, claims: [{ code: codigoBarrasValue as string, exclude: { varianteId } }] },
          (tx) => tx.productoVariante.update({ where: { id: varianteId }, data: updateData })
        )
      : await db.productoVariante.update({ where: { id: varianteId }, data: updateData })

    await auditLog({
      userId: negocioId,
      userType: "negocio",
      accion: "producto.variante_actualizada",
      recurso: "producto",
      recursoId: productoId,
      detalle: { varianteId, cambios: Object.keys(updateData) },
    })

    return NextResponse.json(updated)
  } catch (error) {
    const barcodeError = mapBarcodeWriteError(error)
    if (barcodeError) return NextResponse.json(barcodeError.body, { status: barcodeError.status })
    console.error("Error updating variante:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al actualizar la variante" }, { status: 500 })
  }
}
