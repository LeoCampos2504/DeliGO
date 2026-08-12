import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"
import { getIngredientesQuitadosNombres } from "@/lib/pedido-item-personalizacion"
import { safeErrorForLog } from "@/lib/log-safe-error"

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
        imagenUrl: true,
        descuentoActivo: true,
        tipoDescuento: true,
        valorDescuento: true,
      },
    })

    const productoMap = new Map(productosActuales.map((p) => [p.id, p]))

    // Build availability info for each item
    const itemsConDisponibilidad = pedido.items.map((item) => {
      const productoActual = item.productoId ? productoMap.get(item.productoId) : null

      let disponible = true
      let motivoIndisponibilidad: string | null = null
      let precioActual: number | null = null

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
