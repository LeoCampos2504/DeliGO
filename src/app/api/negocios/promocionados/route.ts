import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET - Public endpoint: returns promoted businesses with their most ordered products + general products
export async function GET() {
  try {
    // 1. Check if promocionadosActivos is enabled
    const config = await db.configPlataforma.findFirst()

    if (!config || !config.promocionadosActivos) {
      return NextResponse.json({ activo: false, negocios: [] })
    }

    // 2. Auto-expire destacados whose destacadoHasta has passed
    const ahora = new Date()
    const expirados = await db.negocio.findMany({
      where: {
        promocionado: true,
        destacadoHasta: { not: null, lt: ahora },
      },
      select: { id: true },
    })
    if (expirados.length > 0) {
      await db.negocio.updateMany({
        where: { id: { in: expirados.map((n) => n.id) } },
        data: { promocionado: false, ordenPromocion: 0, destacadoHasta: null },
      })
    }

    // 3. Query all promoted, approved, non-suspended negocios (only vigentes)
    const negocios = await db.negocio.findMany({
      where: {
        promocionado: true,
        aprobado: true,
        suspendido: false,
      },
      orderBy: { ordenPromocion: "asc" },
      select: {
        id: true,
        slug: true,
        nombre: true,
        logoUrl: true,
        bannerUrl: true,
        colorPrincipal: true,
        rubro: true,
        ofreceDelivery: true,
        precioDelivery: true,
        precioDeliveryDefault: true,
        zonaDeliveryActiva: true,
        tiempoEntrega: true,
        puntuacionPromedio: true,
        totalResenas: true,
        horarios: true,
        horarioMode: true,
        abiertoManual: true,
        categorias: true,
        productos: {
          where: { stock: true },
          select: {
            id: true,
            nombre: true,
            precio: true,
            imagenUrl: true,
            descuentoActivo: true,
            valorDescuento: true,
            tipoDescuento: true,
            categoria: true,
          },
          orderBy: { orden: "asc" },
        },
      },
    })

    // 3. For each negocio, separate top products from general products
    const negociosConProductos = await Promise.all(
      negocios.map(async (negocio) => {
        const productoIds = negocio.productos.map((p) => p.id)

        if (productoIds.length === 0) {
          return {
            id: negocio.id,
            slug: negocio.slug,
            nombre: negocio.nombre,
            logoUrl: negocio.logoUrl,
            bannerUrl: negocio.bannerUrl,
            colorPrincipal: negocio.colorPrincipal,
            rubro: negocio.rubro,
            ofreceDelivery: negocio.ofreceDelivery,
            precioDelivery: negocio.precioDelivery,
            precioDeliveryDefault: negocio.precioDeliveryDefault,
            zonaDeliveryActiva: negocio.zonaDeliveryActiva,
            tiempoEntrega: negocio.tiempoEntrega,
            puntuacionPromedio: negocio.puntuacionPromedio,
            totalResenas: negocio.totalResenas,
            horarios: negocio.horarios,
            horarioMode: negocio.horarioMode,
            abiertoManual: negocio.abiertoManual,
            categorias: negocio.categorias,
            productosTop: [],
            productosGenerales: [],
            totalProductos: 0,
          }
        }

        // Get all PedidoItem records for this negocio's products
        // joining with Pedido to filter out cancelled orders
        const items = await db.pedidoItem.findMany({
          where: {
            productoId: { in: productoIds },
            pedido: {
              estado: { not: "cancelado" },
            },
          },
          select: {
            productoId: true,
            cantidad: true,
          },
        })

        // Sum quantities per product in JS
        const cantidadMap = new Map<string, number>()
        for (const item of items) {
          if (item.productoId) {
            const current = cantidadMap.get(item.productoId) || 0
            cantidadMap.set(item.productoId, current + item.cantidad)
          }
        }

        // Build a lookup for product details
        const productoMap = new Map(
          negocio.productos.map((p) => [p.id, p])
        )

        // Separate into top (ordered) and general (not ordered or low orders)
        const topIds = new Set<string>()

        const productosTop = [...cantidadMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([id, totalPedidos]) => {
            topIds.add(id)
            const producto = productoMap.get(id)
            if (!producto) return null
            return {
              id: producto.id,
              nombre: producto.nombre,
              precio: producto.precio,
              imagenUrl: producto.imagenUrl,
              totalPedidos,
              descuentoActivo: producto.descuentoActivo,
              valorDescuento: producto.valorDescuento,
              tipoDescuento: producto.tipoDescuento,
              categoria: producto.categoria,
            }
          })
          .filter(Boolean)

        // General products: those not in top, up to 8
        const productosGenerales = negocio.productos
          .filter((p) => !topIds.has(p.id))
          .slice(0, 8)
          .map((producto) => ({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            imagenUrl: producto.imagenUrl,
            descuentoActivo: producto.descuentoActivo,
            valorDescuento: producto.valorDescuento,
            tipoDescuento: producto.tipoDescuento,
            categoria: producto.categoria,
          }))

        return {
          id: negocio.id,
          slug: negocio.slug,
          nombre: negocio.nombre,
          logoUrl: negocio.logoUrl,
          bannerUrl: negocio.bannerUrl,
          colorPrincipal: negocio.colorPrincipal,
          rubro: negocio.rubro,
          ofreceDelivery: negocio.ofreceDelivery,
          precioDelivery: negocio.precioDelivery,
          precioDeliveryDefault: negocio.precioDeliveryDefault,
          zonaDeliveryActiva: negocio.zonaDeliveryActiva,
          tiempoEntrega: negocio.tiempoEntrega,
          puntuacionPromedio: negocio.puntuacionPromedio,
          totalResenas: negocio.totalResenas,
          horarios: negocio.horarios,
          horarioMode: negocio.horarioMode,
          abiertoManual: negocio.abiertoManual,
          categorias: negocio.categorias,
          productosTop,
          productosGenerales,
          totalProductos: negocio.productos.length,
        }
      })
    )

    return NextResponse.json({
      activo: true,
      negocios: negociosConProductos,
    })
  } catch (error) {
    console.error("Error getting promoted negocios:", error)
    return NextResponse.json(
      { error: "Error al obtener negocios promocionados" },
      { status: 500 }
    )
  }
}
