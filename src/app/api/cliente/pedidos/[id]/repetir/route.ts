import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"

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
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    // Fetch the original order with items
    const pedido = await db.pedido.findUnique({
      where: { id },
      include: { items: true, negocio: true },
    })

    if (!pedido || pedido.clienteId !== cliente.id) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    // Validate the business still exists and is not suspended
    const negocio = pedido.negocio
    if (!negocio) {
      return NextResponse.json(
        { error: "El negocio asociado ya no existe", negocioNoExiste: true },
        { status: 400 }
      )
    }

    if (negocio.suspendido) {
      return NextResponse.json(
        { error: `${negocio.nombre} está suspendido y no acepta pedidos`, negocioSuspendido: true },
        { status: 400 }
      )
    }

    if (!negocio.aprobado) {
      return NextResponse.json(
        { error: `${negocio.nombre} no está aprobado y no acepta pedidos`, negocioNoAprobado: true },
        { status: 400 }
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
        precioActual = productoActual.precio
        // Check if price changed
        if (productoActual.precio !== item.precio) {
          // Still available, but note the price change
          precioActual = productoActual.precio
        }
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

      // Parse ingredientesQuitados for frontend
      let ingredientesQuitadosParsed: string[] = []
      try {
        ingredientesQuitadosParsed = JSON.parse(item.ingredientesQuitados || "[]")
      } catch {
        ingredientesQuitadosParsed = []
      }

      return {
        id: item.id,
        productoId: item.productoId,
        nombre: item.nombre,
        precio: item.precio,
        precioActual,
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
    })
  } catch (error) {
    console.error("Repetir pedido PUT error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
