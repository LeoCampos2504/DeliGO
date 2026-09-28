import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { validateVarianteMinimo } from "@/lib/inventario"

// ============================================
// P2-T56-R2C — POST /api/negocio/productos/[id]/variantes
// ============================================
// Creates one additional variant on an EXISTING product (section 13's
// "+ Agregar variante" flow — inline creation at product-creation time goes
// through POST /api/negocio/productos itself, see that route). Tenant is
// derived exclusively from session; ownership of the parent Producto is
// re-checked here even though the client already navigated from an
// authenticated product list, same defensive pattern as every other
// negocio-scoped route in T56.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }
    const negocioId = user.id
    const { id: productoId } = await params

    const producto = await db.producto.findUnique({ where: { id: productoId } })
    if (!producto || producto.negocioId !== negocioId) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    const body = await req.json()
    const { nombre, precio, costo, sku, codigoBarras, controlStock, stockCantidad, stockMinimo } = body

    const validation = validateVarianteMinimo({ nombre, precio })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    if (costo !== undefined && costo !== null && (typeof costo !== "number" || !Number.isFinite(costo) || costo < 0)) {
      return NextResponse.json({ error: "El costo no puede ser negativo" }, { status: 400 })
    }
    if (stockCantidad !== undefined && (typeof stockCantidad !== "number" || !Number.isFinite(stockCantidad) || stockCantidad < 0)) {
      return NextResponse.json({ error: "El stock inicial no puede ser negativo" }, { status: 400 })
    }
    if (stockMinimo !== undefined && (typeof stockMinimo !== "number" || !Number.isFinite(stockMinimo) || stockMinimo < 0)) {
      return NextResponse.json({ error: "El stock mínimo no puede ser negativo" }, { status: 400 })
    }

    const variante = await db.productoVariante.create({
      data: {
        productoId,
        nombre: (nombre as string).trim(),
        precio,
        costo: costo === undefined || costo === null ? null : costo,
        sku: typeof sku === "string" && sku.trim() ? sku.trim() : null,
        codigoBarras: typeof codigoBarras === "string" && codigoBarras.trim() ? codigoBarras.trim() : null,
        controlStock: controlStock === true,
        stockCantidad: typeof stockCantidad === "number" ? stockCantidad : 0,
        stockMinimo: typeof stockMinimo === "number" ? stockMinimo : 0,
      },
    })

    await auditLog({
      userId: negocioId,
      userType: "negocio",
      accion: "producto.variante_creada",
      recurso: "producto",
      recursoId: productoId,
      detalle: { varianteId: variante.id, nombre: variante.nombre, precio: variante.precio },
    })

    return NextResponse.json(variante, { status: 201 })
  } catch (error) {
    console.error("Error creating variante:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al crear la variante" }, { status: 500 })
  }
}
