import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  isGenericBusinessStockScope,
  leerReservasActivasPorClave,
  resolvePublicProductAvailability,
} from "@/lib/stock-lifecycle"

// GET /api/cliente/promociones - Get all active promotions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rubro = searchParams.get("rubro")

    // Get all products with active discounts from approved, non-suspended businesses
    const whereNegocio: Record<string, unknown> = {
      aprobado: true,
      suspendido: false,
    }

    if (rubro) whereNegocio.rubro = rubro

    const productos = await db.producto.findMany({
      where: {
        descuentoActivo: true,
        stock: true,
        negocio: whereNegocio,
      },
      include: {
        negocio: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            rubro: true,
            logoUrl: true,
            colorPrincipal: true,
          },
        },
        // P2-T56-R3A-I4: server-only, para la disponibilidad pública.
        variantes: {
          select: { id: true, activo: true, controlStock: true, stockCantidad: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    // P2-T56-R3A-I4 (decisión 6): en negocio genérico no se promociona un
    // producto agotado. Sólo se oculta ese producto, nunca el negocio. Una sola
    // lectura agrupada de reservas ACTIVA. Restaurante/Ropa: sin cambios.
    const genericNegocioIds = [
      ...new Set(productos.filter((p) => isGenericBusinessStockScope(p.negocio.rubro)).map((p) => p.negocioId)),
    ]
    const reservedByKey = await leerReservasActivasPorClave(db, genericNegocioIds)
    const visibles = productos.filter(
      (p) => !isGenericBusinessStockScope(p.negocio.rubro) || resolvePublicProductAvailability(p, reservedByKey).visible
    )

    const promociones = visibles.map((p) => {
      let precioPromo = p.precio
      let descuentoLabel = ""

      if (p.tipoDescuento === "porcentaje" && p.valorDescuento > 0) {
        precioPromo = p.precio * (1 - p.valorDescuento / 100)
        descuentoLabel = `${p.valorDescuento}% OFF`
      } else if (p.tipoDescuento === "monto" && p.valorDescuento > 0) {
        precioPromo = Math.max(0, p.precio - p.valorDescuento)
        descuentoLabel = `$${p.valorDescuento} OFF`
      }

      return {
        id: p.id,
        nombre: p.nombre,
        imagenUrl: p.imagenUrl,
        precioOriginal: p.precio,
        precioPromo,
        descuentoLabel,
        tipoDescuento: p.tipoDescuento,
        valorDescuento: p.valorDescuento,
        categoria: p.categoria,
        negocio: p.negocio,
      }
    })

    return NextResponse.json({ ok: true, promociones })
  } catch (error) {
    console.error("Cliente promociones GET error:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
