import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rubro = searchParams.get("rubro")
    const search = searchParams.get("search")
    const sort = searchParams.get("sort") || "populares"

    const where: Record<string, unknown> = {
      aprobado: true,
      suspendido: false,
    }

    if (rubro && rubro !== "todos") {
      where.rubro = rubro
    }

    if (search) {
      where.nombre = { contains: search }
    }

    // Exclude businesses with debt >= limit
    const allNegocios = await db.negocio.findMany({
      where,
      include: {
        productos: {
          where: { descuentoActivo: true, stock: true },
          select: { id: true },
        },
        _count: {
          select: { pedidos: { where: { estado: "entregado" } } },
        },
      },
    })

    // Filter out businesses that hit their debt limit
    const filtered = allNegocios.filter((n) => {
      const limite = n.limiteDeuda ?? 10000
      return n.deudaTarifa < limite
    })

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "calificados":
          return b.puntuacionPromedio - a.puntuacionPromedio
        case "delivery":
          // Delivery = fastest delivery time first, delivery-only
          if (a.ofreceDelivery && !b.ofreceDelivery) return -1
          if (!a.ofreceDelivery && b.ofreceDelivery) return 1
          return a.tiempoEntrega - b.tiempoEntrega
        case "populares":
        default:
          return b.totalResenas - a.totalResenas
      }
    })

    const result = sorted.map((n) => ({
      id: n.id,
      slug: n.slug,
      nombre: n.nombre,
      rubro: n.rubro,
      logoUrl: n.logoUrl,
      bannerUrl: n.bannerUrl,
      colorPrincipal: n.colorPrincipal,
      puntuacionPromedio: n.puntuacionPromedio,
      totalResenas: n.totalResenas,
      ofreceDelivery: n.ofreceDelivery,
      precioDelivery: n.precioDelivery,
      precioDeliveryDefault: n.precioDeliveryDefault,
      zonaDeliveryActiva: n.zonaDeliveryActiva,
      tiempoEntrega: n.tiempoEntrega,
      horarios: n.horarios,
      horarioMode: n.horarioMode,
      abiertoManual: n.abiertoManual,
      totalPromociones: n.productos.length,
      mostrarVentas: n.mostrarVentas,
      totalVentas: n._count.pedidos,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching negocios:", error)
    return NextResponse.json(
      { error: "Error al cargar negocios" },
      { status: 500 }
    )
  }
}
