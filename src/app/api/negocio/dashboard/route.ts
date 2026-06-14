import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id

    // Get negocio info
    const negocio = await db.negocio.findUnique({
      where: { id: negocioId },
      select: {
        nombre: true,
        slug: true,
        rubro: true,
        aprobado: true,
        colorPrincipal: true,
        logoUrl: true,
        bannerUrl: true,
        deudaTarifa: true,
        limiteDeuda: true,
        destacadoHasta: true,
        promocionado: true,
        panelMode: true,
      },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })
    }

    // Today's date range
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // Pedidos entregados hoy (ventas reales — excluye cancelados y pendientes)
    const pedidosEntregadosHoy = await db.pedido.findMany({
      where: {
        negocioId,
        estado: "entregado",
        fecha: { gte: startOfDay, lt: endOfDay },
      },
      select: { total: true },
    })
    const pedidosHoyCount = pedidosEntregadosHoy.length
    const pedidosHoyTotal = pedidosEntregadosHoy.reduce((sum, p) => sum + p.total, 0)

    // Pedidos pendientes (active statuses)
    const estadosActivos = ["recibido", "preparando", "en_camino", "listo_para_retirar"]
    const pedidosPendientesCount = await db.pedido.count({
      where: {
        negocioId,
        estado: { in: estadosActivos },
      },
    })

    // Total productos
    const productosTotal = await db.producto.count({
      where: { negocioId },
    })

    // Reseñas (total + promedio + sin respuesta)
    const resenasAgg = await db.resena.aggregate({
      where: { negocioId },
      _count: true,
      _avg: { puntuacion: true },
    })

    const resenasSinRespuesta = await db.resena.count({
      where: { negocioId, respuestaNegocio: null },
    })

    // Recent orders (last 5)
    const recentOrders = await db.pedido.findMany({
      where: { negocioId },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        clienteNombre: true,
        total: true,
        estado: true,
        metodoEntrega: true,
        metodoPago: true,
        fecha: true,
        items: {
          select: { nombre: true, cantidad: true },
        },
      },
    })

    return NextResponse.json({
      data: {
        pedidosHoy: pedidosHoyCount,
        ingresosHoy: pedidosHoyTotal,
        pedidosPendientes: pedidosPendientesCount,
        productosTotales: productosTotal,
        puntuacionPromedio: resenasAgg._avg.puntuacion ?? 0,
        resenasSinRespuesta,
        deudaTarifa: negocio.deudaTarifa ?? 0,
        limiteDeuda: negocio.limiteDeuda,
        destacadoHasta: negocio.destacadoHasta?.toISOString() ?? null,
        promocionado: negocio.promocionado,
        pedidosRecientes: recentOrders.map((o) => ({
          id: o.id,
          clienteNombre: o.clienteNombre,
          total: o.total,
          estado: o.estado,
          metodoEntrega: o.metodoEntrega,
          metodoPago: o.metodoPago ?? "",
          fecha: o.fecha.toISOString(),
          items: o.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad })),
        })),
      },
      negocio: {
        nombre: negocio.nombre,
        slug: negocio.slug,
        rubro: negocio.rubro,
        aprobado: negocio.aprobado,
        colorPrincipal: negocio.colorPrincipal,
        logoUrl: negocio.logoUrl,
        bannerUrl: negocio.bannerUrl,
        panelMode: negocio.panelMode,
      },
    })
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json(
      { error: "Error al obtener datos del dashboard" },
      { status: 500 }
    )
  }
}
