import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseAuthorizationBearer } from "@/lib/access-tokens"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value
}

export async function GET(req: NextRequest) {
  try {
    const token = parseAuthorizationBearer(req.headers.get("authorization"))
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 401, headers: NO_STORE_HEADERS })
    }

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
      return NextResponse.json({ error: "Token invalido o salon no activo" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const mesas = await db.mesa.findMany({
      where: { negocioId: negocio.id, activa: true },
      include: {
        empleado: { select: { id: true, nombre: true, codigo: true } },
      },
      orderBy: { numero: "asc" },
    })

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

    const pedidosParsed = pedidos.map(({ clienteTelefono: _clienteTelefono, ...p }) => ({
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

    const empleados = await db.empleado.findMany({
      where: {
        negocioId: negocio.id,
        rol: "mozo",
        activo: true,
        eliminado: false,
        mesas: { some: {} },
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
      empleados: empleados.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        codigo: e.codigo,
        hasPushSubscription: !!e.pushSubscription,
      })),
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error getting salon public data:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
