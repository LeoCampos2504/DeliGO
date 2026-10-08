import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"
import { getIngredientesQuitadosNombres } from "@/lib/pedido-item-personalizacion"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  isGenericBusinessStockScope,
  leerReservasActivasPorClave,
  resolvePublicProductAvailability,
  type PublicStockAvailability,
} from "@/lib/stock-lifecycle"

// Seguridad-6B.3: repetición de pedido — datos de precios/stock ligados a la sesión del cliente, nunca cacheables.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

// PUT /api/cliente/pedidos/[id]/repetir - Validate and prepare order repetition
// Returns order data with product availability info so the frontend can show what's available/unavailable
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    // Fetch the original order with items
    const pedido = await db.pedido.findUnique({
      where: { id },
      include: { items: true, negocio: true },
    })

    if (!pedido || pedido.clienteId !== cliente.id) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404, headers: NO_STORE_HEADERS })
    }

    // Validate the business still exists and is not suspended
    const negocio = pedido.negocio
    if (!negocio) {
      return NextResponse.json(
        { error: "El negocio asociado ya no existe", negocioNoExiste: true },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    if (negocio.suspendido) {
      return NextResponse.json(
        { error: `${negocio.nombre} está suspendido y no acepta pedidos`, negocioSuspendido: true },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    if (!negocio.aprobado) {
      return NextResponse.json(
        { error: `${negocio.nombre} no está aprobado y no acepta pedidos`, negocioNoAprobado: true },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    // Check each product's availability
    const productoIds = pedido.items
      .map((item) => item.productoId)
      .filter(Boolean) as string[]

    // Fetch current state of all products from this order
    const productosActuales = await db.producto.findMany({
      where: { id: { in: productoIds } },
      select: {
        id: true,
        nombre: true,
        precio: true,
        stock: true,
        // P2-T56-R3A-I4: server-only, para la disponibilidad pública.
        controlStock: true,
        stockCantidad: true,
        imagenUrl: true,
        descuentoActivo: true,
        tipoDescuento: true,
        valorDescuento: true,
        // P2-T56-R2C-F2: negocio genérico product-with-variants — repeating
        // an order must re-validate the SPECIFIC historical variant, never
        // silently fall back to the (dormant) base product fields.
        variantes: {
          select: { id: true, nombre: true, precio: true, activo: true, controlStock: true, stockCantidad: true },
        },
      },
    })

    const productoMap = new Map(productosActuales.map((p) => [p.id, p]))

    // P2-T56-R3A-I4: en negocio genérico, repetir usa la MISMA disponibilidad
    // pública que el catálogo (físico − reservas ACTIVA). Una sola lectura
    // agrupada. Restaurante/Ropa: sin cambios.
    const genericScope = isGenericBusinessStockScope(negocio.rubro)
    const reservedByKey = genericScope ? await leerReservasActivasPorClave(db, [negocio.id]) : null
    const availabilityMap = new Map<string, PublicStockAvailability>(
      reservedByKey
        ? productosActuales.map((p) => [p.id, resolvePublicProductAvailability(p, reservedByKey)])
        : []
    )

    // Build availability info for each item
    const itemsConDisponibilidad = pedido.items.map((item) => {
      const productoActual = item.productoId ? productoMap.get(item.productoId) : null

      let disponible = true
      let motivoIndisponibilidad: string | null = null
      let precioActual: number | null = null
      // P2-T56-R2C-F2: la variante ACTUAL (re-validada), nunca la snapshot
      // histórica del pedido original — si fue renombrada, se muestra el
      // nombre vigente.
      let varianteId: string | null = null
      let varianteNombre: string | null = null
      // P2-T56-R3A-I4: disponible público de la clave (null = sin límite).
      const availability = productoActual ? availabilityMap.get(productoActual.id) : undefined
      let stockDisponible: number | null = null

      if (!item.productoId) {
        // Item has no product reference (manually added or product deleted)
        disponible = false
        motivoIndisponibilidad = "Producto sin referencia"
      } else if (!productoActual) {
        disponible = false
        motivoIndisponibilidad = "Producto eliminado del catálogo"
      } else if (!productoActual.stock) {
        disponible = false
        motivoIndisponibilidad = "Sin stock"
      } else if (productoActual.variantes.length > 0) {
        // Producto con variantes: el precio/stock del Producto base están
        // dormidos — la variante histórica es la única fuente válida.
        const variante = item.productoVarianteId
          ? productoActual.variantes.find((v) => v.id === item.productoVarianteId)
          : null
        if (!variante) {
          disponible = false
          motivoIndisponibilidad = "Este producto ahora requiere elegir una opción — volvé a agregarlo desde el catálogo"
        } else if (!variante.activo) {
          disponible = false
          motivoIndisponibilidad = "Esta opción ya no está disponible"
        } else if (variante.controlStock && variante.stockCantidad <= 0) {
          disponible = false
          motivoIndisponibilidad = "Sin stock"
        } else if (availability && !availability.variantesVisibles.some((v) => v.id === variante.id)) {
          disponible = false
          motivoIndisponibilidad = "Sin stock"
        } else {
          precioActual = variante.precio
          varianteId = variante.id
          varianteNombre = variante.nombre
          stockDisponible = availability?.variantesVisibles.find((v) => v.id === variante.id)?.stockDisponible ?? null
        }
      } else if (availability && !availability.visible) {
        disponible = false
        motivoIndisponibilidad = "Sin stock"
      } else {
        // Calculate the effective price (with discount if active)
        let precioEfectivo = productoActual.precio
        if (productoActual.descuentoActivo && productoActual.valorDescuento > 0) {
          if (productoActual.tipoDescuento === "porcentaje") {
            precioEfectivo = precioEfectivo * (1 - productoActual.valorDescuento / 100)
          } else {
            precioEfectivo = Math.max(0, precioEfectivo - productoActual.valorDescuento)
          }
        }
        precioActual = precioEfectivo
        stockDisponible = availability?.stockDisponible ?? null
      }

      // Parse agregados for frontend
      let agregadosParsed: { id: string; nombre: string; precio: number }[] = []
      try {
        agregadosParsed = JSON.parse(item.agregados || "[]")
      } catch {
        agregadosParsed = []
      }

      // Parse secciones for frontend
      let seccionesParsed: Record<string, string | Record<string, number>> = {}
      try {
        seccionesParsed = JSON.parse(item.secciones || "{}")
      } catch {
        seccionesParsed = {}
      }

      // Parse seccionesPrecios for frontend
      let seccionesPreciosParsed: Record<string, number> = {}
      try {
        seccionesPreciosParsed = JSON.parse(item.seccionesPrecios || "{}")
      } catch {
        seccionesPreciosParsed = {}
      }

      // P1-A.2A-ii: acepta formato histórico o estructurado, siempre entrega string[]
      // de nombres — el cliente hidrata el carrito con este contrato legacy exacto.
      const ingredientesQuitadosParsed = getIngredientesQuitadosNombres(item.ingredientesQuitados)

      return {
        id: item.id,
        productoId: item.productoId,
        varianteId,
        varianteNombre,
        nombre: item.nombre,
        precio: item.precio,
        precioActual,
        precioOriginal: productoActual?.precio ?? null,
        descuentoActivo: productoActual?.descuentoActivo ?? false,
        tipoDescuento: productoActual?.tipoDescuento ?? "porcentaje",
        valorDescuento: productoActual?.valorDescuento ?? 0,
        cantidad: item.cantidad,
        agregados: agregadosParsed,
        secciones: seccionesParsed,
        seccionesPrecios: seccionesPreciosParsed,
        ingredientesQuitados: ingredientesQuitadosParsed,
        talle: item.talle,
        color: item.color,
        disponible,
        motivoIndisponibilidad,
        stockDisponible,
        imagenUrl: productoActual?.imagenUrl || null,
      }
    })

    const disponiblesCount = itemsConDisponibilidad.filter((i) => i.disponible).length
    const noDisponiblesCount = itemsConDisponibilidad.filter((i) => !i.disponible).length

    return NextResponse.json({
      ok: true,
      pedidoId: pedido.id,
      negocio: {
        id: negocio.id,
        slug: negocio.slug,
        nombre: negocio.nombre,
        logoUrl: negocio.logoUrl,
        rubro: negocio.rubro,
        precioDelivery: negocio.precioDelivery,
        ofreceDelivery: negocio.ofreceDelivery,
      },
      items: itemsConDisponibilidad,
      disponiblesCount,
      noDisponiblesCount,
      totalOriginal: pedido.totalProductos,
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Repetir pedido PUT error:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
