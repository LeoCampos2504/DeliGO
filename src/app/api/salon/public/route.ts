import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Helper to parse JSON fields safely
function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value
}

// GET /api/salon/public?token=TOKEN — Public salon data for the shared link page
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token")
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }

    // Look up negocio by tokenSalon
    const negocio = await db.negocio.findFirst({
      where: { tokenSalon: token },
      select: {
        id: true,
        slug: true,
        nombre: true,
        colorPrincipal: true,
        rubro: true,
        salonActivo: true,
        pushSubscriptionSalon: true,
      },
    })

    if (!negocio || !negocio.salonActivo) {
      return NextResponse.json({ error: "Token inválido o salón no activo" }, { status: 401 })
    }

    // Fetch mesas
    const mesas = await db.mesa.findMany({
      where: { negocioId: negocio.id, activa: true },
      include: {
        empleado: { select: { id: true, nombre: true, codigo: true } },
      },
      orderBy: { numero: "asc" },
    })

    // Fetch active mesa orders with full item details
    const pedidos = await db.pedido.findMany({
      where: {
        negocioId: negocio.id,
        metodoEntrega: "mesa",
        estado: { in: ["recibido", "preparando", "listo_para_retirar"] },
      },
      include: {
        items: {
          include: {
            producto: { select: { id: true, nombre: true, imagenUrl: true } },
          },
        },
      },
      orderBy: { fecha: "desc" },
    })

    // Parse JSON fields on items
    const pedidosParsed = pedidos.map(({ clienteTelefono, ...p }) => ({
      ...p,
      items: p.items.map((item) => ({
        ...item,
        agregados: safeParseJSON(item.agregados, []),
        secciones: safeParseJSON(item.secciones, {}),
        seccionesPrecios: safeParseJSON(item.seccionesPrecios, {}),
        ingredientes: safeParseJSON(item.ingredientes, []),
        ingredientesQuitados: safeParseJSON(item.ingredientesQuitados, []),
      })),
    }))

    // Fetch empleados (mozos) that have mesas assigned — for notification identification
    const empleados = await db.empleado.findMany({
      where: {
        negocioId: negocio.id,
        activo: true,
        eliminado: false,
        mesas: { some: {} }, // only empleados with at least one assigned mesa
      },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        pushSubscription: true,
      },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json({
      negocio: {
        id: negocio.id,
        slug: negocio.slug,
        nombre: negocio.nombre,
        colorPrincipal: negocio.colorPrincipal,
        rubro: negocio.rubro,
        hasPushSubscription: !!negocio.pushSubscriptionSalon,
      },
      mesas,
      pedidos: pedidosParsed,
      empleados: empleados.map(e => ({
        id: e.id,
        nombre: e.nombre,
        codigo: e.codigo,
        hasPushSubscription: !!e.pushSubscription,
      })),
    })
  } catch (error) {
    console.error("Error getting salon public data:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
