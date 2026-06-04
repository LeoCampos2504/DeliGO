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
    const { searchParams } = new URL(req.url)
    const days = Math.min(Math.max(Number(searchParams.get("days")) || 30, 7), 90)

    // Date range
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1)

    // ============================================
    // 1. Daily revenue & order count
    // ============================================
    const deliveredOrders = await db.pedido.findMany({
      where: {
        negocioId,
        estado: "entregado",
        fecha: { gte: startDate },
      },
      select: {
        total: true,
        totalProductos: true,
        fecha: true,
        metodoPago: true,
        metodoEntrega: true,
      },
    })

    // Build daily map
    const dailyMap = new Map<string, { revenue: number; orders: number }>()
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const key = d.toISOString().split("T")[0]
      dailyMap.set(key, { revenue: 0, orders: 0 })
    }

    for (const order of deliveredOrders) {
      const key = order.fecha.toISOString().split("T")[0]
      const entry = dailyMap.get(key)
      if (entry) {
        entry.revenue += order.total
        entry.orders += 1
      }
    }

    const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      orders: data.orders,
    }))

    // ============================================
    // 2. Top selling products
    //    (precio * cantidad por fila, luego agrupar — evita doble conteo)
    // ============================================
    const allItems = await db.pedidoItem.findMany({
      where: {
        pedido: {
          negocioId,
          estado: "entregado",
          fecha: { gte: startDate },
        },
      },
      select: {
        nombre: true,
        precio: true,
        cantidad: true,
      },
    })

    const productMap = new Map<string, { cantidad: number; ingresos: number; pedidos: number }>()
    for (const item of allItems) {
      if (!item.nombre) continue
      const rowRevenue = item.precio * item.cantidad
      const entry = productMap.get(item.nombre) ?? { cantidad: 0, ingresos: 0, pedidos: 0 }
      entry.cantidad += item.cantidad
      entry.ingresos += rowRevenue
      entry.pedidos += 1
      productMap.set(item.nombre, entry)
    }

    const topProducts = Array.from(productMap.entries())
      .map(([nombre, data]) => ({
        nombre,
        cantidad: data.cantidad,
        ingresos: Math.round(data.ingresos * 100) / 100,
        pedidos: data.pedidos,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)

    // ============================================
    // 3. Payment method distribution
    // ============================================
    const paymentMap = new Map<string, { count: number; revenue: number }>()
    for (const order of deliveredOrders) {
      const method = order.metodoPago || "efectivo"
      const entry = paymentMap.get(method) ?? { count: 0, revenue: 0 }
      entry.count += 1
      entry.revenue += order.total
      paymentMap.set(method, entry)
    }

    const paymentLabels: Record<string, string> = {
      efectivo: "Efectivo",
      transferencia: "Transferencia",
      mercadopago: "Mercado Pago",
    }

    const paymentDistribution = Array.from(paymentMap.entries()).map(
      ([method, data]) => ({
        metodo: method,
        label: paymentLabels[method] || method,
        cantidad: data.count,
        ingresos: Math.round(data.revenue * 100) / 100,
      })
    )

    // ============================================
    // 4. Delivery method distribution
    // ============================================
    const deliveryMap = new Map<string, { count: number; revenue: number }>()
    for (const order of deliveredOrders) {
      const method = order.metodoEntrega || "retiro"
      const entry = deliveryMap.get(method) ?? { count: 0, revenue: 0 }
      entry.count += 1
      entry.revenue += order.total
      deliveryMap.set(method, entry)
    }

    const deliveryLabels: Record<string, string> = {
      retiro: "Retiro en local",
      domicilio: "Delivery",
    }

    const deliveryDistribution = Array.from(deliveryMap.entries()).map(
      ([method, data]) => ({
        metodo: method,
        label: deliveryLabels[method] || method,
        cantidad: data.count,
        ingresos: Math.round(data.revenue * 100) / 100,
      })
    )

    // ============================================
    // 5. Hourly distribution
    // ============================================
    const hourlyMap = new Map<number, number>()
    for (let h = 0; h < 24; h++) hourlyMap.set(h, 0)

    for (const order of deliveredOrders) {
      const hour = order.fecha.getHours()
      hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1)
    }

    const hourlyData = Array.from(hourlyMap.entries()).map(([hour, count]) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      pedidos: count,
    }))

    // ============================================
    // 6. Key metrics
    // ============================================
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + o.total, 0)
    const totalOrders = deliveredOrders.length
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Best day
    let bestDay = { date: "", revenue: 0 }
    for (const [date, data] of dailyMap) {
      if (data.revenue > bestDay.revenue) {
        bestDay = { date, revenue: data.revenue }
      }
    }

    // Comparison: previous period
    const prevStart = new Date(startDate)
    prevStart.setDate(prevStart.getDate() - days)
    const prevOrders = await db.pedido.count({
      where: {
        negocioId,
        estado: "entregado",
        fecha: { gte: prevStart, lt: startDate },
      },
    })
    const prevRevenue = await db.pedido.aggregate({
      where: {
        negocioId,
        estado: "entregado",
        fecha: { gte: prevStart, lt: startDate },
      },
      _sum: { total: true },
    })
    const prevRevenueTotal = prevRevenue._sum.total ?? 0

    // Revenue change percentage
    const revenueChange =
      prevRevenueTotal > 0
        ? Math.round(((totalRevenue - prevRevenueTotal) / prevRevenueTotal) * 100)
        : totalOrders > 0
        ? 100
        : 0
    const ordersChange =
      prevOrders > 0
        ? Math.round(((totalOrders - prevOrders) / prevOrders) * 100)
        : totalOrders > 0
        ? 100
        : 0

    // ============================================
    // 7. Weekly distribution (day of week)
    // ============================================
    const dayOfWeekMap = new Map<string, { count: number; revenue: number }>()
    const dayNames: Record<string, string> = {
      "1": "Lun", "2": "Mar", "3": "Mié", "4": "Jue",
      "5": "Vie", "6": "Sáb", "7": "Dom",
    }
    for (const key of Object.keys(dayNames)) {
      dayOfWeekMap.set(key, { count: 0, revenue: 0 })
    }

    for (const order of deliveredOrders) {
      const dow = String(order.fecha.getDay() || 7) // Convert Sunday=0 to 7
      const entry = dayOfWeekMap.get(dow)
      if (entry) {
        entry.count += 1
        entry.revenue += order.total
      }
    }

    const weeklyData = Array.from(dayOfWeekMap.entries()).map(([day, data]) => ({
      day,
      label: dayNames[day] || day,
      pedidos: data.count,
      ingresos: Math.round(data.revenue * 100) / 100,
    }))

    return NextResponse.json({
      data: {
        dailyData,
        topProducts,
        paymentDistribution,
        deliveryDistribution,
        hourlyData,
        weeklyData,
        metrics: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          avgTicket: Math.round(avgTicket * 100) / 100,
          bestDay: bestDay.date
            ? {
                date: bestDay.date,
                revenue: Math.round(bestDay.revenue * 100) / 100,
              }
            : null,
          revenueChange,
          ordersChange,
          prevRevenue: Math.round(prevRevenueTotal * 100) / 100,
          prevOrders,
        },
      },
    })
  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json(
      { error: "Error al obtener analytics" },
      { status: 500 }
    )
  }
}
