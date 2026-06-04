import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { sendPushNotification, newOrderNotification } from "@/lib/push"
import { isNegocioOpen } from "@/lib/utils"

// Point-in-polygon algorithm (ray casting) — same as delivery-zonas route
function pointInPolygon(lat: number, lng: number, polygon: { lat: number; lng: number }[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng
    const xj = polygon[j].lat, yj = polygon[j].lng
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit orders
    const ip = getClientIp(request)
    const rlKey = request.cookies.get(SESSION_COOKIE_NAME)?.value || ip
    const rl = checkRateLimit("order", rlKey)
    if (!rl.allowed) {
      return rateLimitResponse(rl, "Estás haciendo muchos pedidos. Esperá un momento.")
    }

    const body = await request.json()
    const {
      negocioId,
      items,
      metodoEntrega,
      metodoPago,
      notas,
      totalProductos,
      tarifaServicio,
      precioDelivery,
      total,
      direccion,
      referencia,
      lat,
      lng,
      mesaId: bodyMesaId,
      mesaNumero: bodyMesaNumero,
      empleadoCodigo,
    } = body

    // Validate required fields
    if (!negocioId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Faltan datos del pedido" },
        { status: 400 }
      )
    }

    // Get negocio info
    const negocio = await db.negocio.findUnique({
      where: { id: negocioId },
    })

    if (!negocio || !negocio.aprobado || negocio.suspendido) {
      return NextResponse.json(
        { error: "Negocio no disponible" },
        { status: 400 }
      )
    }

    // Check debt limit
    const limite = negocio.limiteDeuda ?? 10000
    if (negocio.deudaTarifa >= limite) {
      return NextResponse.json(
        { error: "Este negocio no está recibiendo pedidos temporalmente" },
        { status: 400 }
      )
    }

    // Check if business is open
    if (!isNegocioOpen(negocio.horarios, negocio.horarioMode, negocio.abiertoManual)) {
      return NextResponse.json(
        { error: "Este negocio está cerrado y no recibe pedidos en este momento" },
        { status: 400 }
      )
    }

    // Get session to find cliente
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    let clienteId: string | null = null
    let clienteNombre = "Invitado"
    let clienteTelefono = ""

    if (token) {
      const session = await db.sesion.findUnique({
        where: { token },
      })
      if (session && session.userType === "cliente") {
        const cliente = await db.cliente.findUnique({
          where: { id: session.userId },
        })
        if (cliente) {
          clienteId = cliente.id
          clienteNombre = cliente.nombre
          clienteTelefono = cliente.telefono
        }
      }
    }

    // Require authentication for non-mesa orders
    if (metodoEntrega !== "mesa" && !clienteId) {
      return NextResponse.json(
        { error: "Debés iniciar sesión para hacer un pedido" },
        { status: 401 }
      )
    }

    // Resolve mesa from numero if mesa order
    let mesaId: string | null = bodyMesaId || null
    let mesaNumero: number | null = bodyMesaNumero ?? null
    const isMesaOrder = metodoEntrega === "mesa"

    // Resolve empleado from codigo if provided (or auto from mesa)
    let empleadoId: string | null = null
    let empleadoNombre: string | null = null

    if (isMesaOrder) {
      // mesaNumero or mesaId is required for mesa orders
      if (!mesaNumero && !mesaId) {
        return NextResponse.json(
          { error: "Mesa es requerida para pedidos en salón" },
          { status: 400 }
        )
      }

      // Look up the mesa — prefer mesaId for direct lookup, fallback to negocioId+numero
      let mesaRow: { id: string; numero: number; activa: number; empleadoId: string | null } | null = null

      if (mesaId) {
        // Direct lookup by ID (more efficient, avoids extra query)
        const mesasById = await db.$queryRaw<
          Array<{ id: string; numero: number; activa: number; empleadoId: string | null }>
        >`SELECT id, numero, activa, empleadoId FROM mesas WHERE id = ${mesaId} AND negocioId = ${negocioId} LIMIT 1`
        if (mesasById.length > 0) mesaRow = mesasById[0]
      }

      if (!mesaRow && mesaNumero) {
        // Fallback: look up by negocioId + numero
        const mesasByNumero = await db.$queryRaw<
          Array<{ id: string; numero: number; activa: number; empleadoId: string | null }>
        >`SELECT id, numero, activa, empleadoId FROM mesas WHERE negocioId = ${negocioId} AND numero = ${mesaNumero} LIMIT 1`
        if (mesasByNumero.length > 0) mesaRow = mesasByNumero[0]
      }

      if (!mesaRow) {
        return NextResponse.json(
          { error: "Mesa no encontrada" },
          { status: 400 }
        )
      }

      if (!mesaRow.activa) {
        return NextResponse.json(
          { error: "Mesa inactiva" },
          { status: 400 }
        )
      }

      mesaId = mesaRow.id
      mesaNumero = mesaRow.numero

      // Auto-resolve mozo from mesa assignment (always — this is the primary source of truth)
      const mesaEmpleadoId = mesaRow.empleadoId
      if (mesaEmpleadoId) {
        const mesaEmpleados = await db.$queryRaw<
          Array<{ id: string; nombre: string; codigo: string }>
        >`SELECT id, nombre, codigo FROM empleados WHERE id = ${mesaEmpleadoId} AND negocioId = ${negocioId} AND activo = 1 LIMIT 1`
        if (mesaEmpleados.length > 0) {
          empleadoId = mesaEmpleados[0].id
          empleadoNombre = mesaEmpleados[0].nombre
        }
      }
    }

    // Resolve empleado from codigo if provided (overrides mesa auto-assignment)
    // This handles the mozo link flow where the mozo explicitly opened the order
    if (empleadoCodigo && isMesaOrder) {
      const empleados = await db.$queryRaw<
        Array<{ id: string; nombre: string }>
      >`SELECT id, nombre FROM empleados WHERE codigo = ${empleadoCodigo} AND negocioId = ${negocioId} AND activo = 1 LIMIT 1`
      if (empleados.length > 0) {
        empleadoId = empleados[0].id
        empleadoNombre = empleados[0].nombre
      }
    }

    // Determine delivery-specific fields
    let finalPrecioDelivery = isMesaOrder ? 0 : (precioDelivery || 0)

    // Server-side delivery zone validation for delivery orders
    if (metodoEntrega === "domicilio" && !isMesaOrder && lat && lng) {
      if (negocio.deliveryMode === "expert") {
        // Expert mode: must be within a zone
        const zonas = JSON.parse(negocio.zonasDelivery || "[]")
        let foundZone: { precio: number; nombre: string } | null = null
        for (const zona of zonas) {
          if (Array.isArray(zona.puntos) && zona.puntos.length >= 3 && pointInPolygon(lat, lng, zona.puntos)) {
            foundZone = zona
            break
          }
        }
        if (!foundZone) {
          return NextResponse.json(
            { error: "Tu ubicación está fuera de la zona de delivery" },
            { status: 400 }
          )
        }
        // Use the server-validated zone price (don't trust client)
        finalPrecioDelivery = foundZone.precio
      } else {
        // Simple mode: use the negocio's flat price
        finalPrecioDelivery = negocio.precioDelivery
      }
    }
    const finalDireccion = isMesaOrder ? null : (direccion || null)
    const finalReferencia = isMesaOrder ? null : (referencia || null)
    const finalLat = isMesaOrder ? null : (lat ?? null)
    const finalLng = isMesaOrder ? null : (lng ?? null)
    // Service fee disabled for mesa/mozo orders (will be activated in the future)
    const MESA_SERVICE_FEE_ENABLED = false
    const mesaTarifa = MESA_SERVICE_FEE_ENABLED ? tarifaServicio : 0
    const finalTotal = isMesaOrder ? totalProductos + mesaTarifa : total

    // Create pedido
    const pedido = await db.pedido.create({
      data: {
        negocioId,
        negocioSlug: negocio.slug,
        negocioNombre: negocio.nombre,
        clienteId,
        clienteNombre,
        clienteTelefono,
        total: finalTotal,
        totalProductos,
        tarifaServicio,
        precioDelivery: finalPrecioDelivery,
        metodoEntrega: metodoEntrega || "retiro",
        metodoPago: metodoPago || "efectivo",
        notas: notas || null,
        direccion: finalDireccion,
        referencia: finalReferencia,
        lat: finalLat,
        lng: finalLng,
        negocioLat: negocio.lat,
        negocioLng: negocio.lng,
        mesaId: isMesaOrder ? (mesaId || null) : null,
        mesaNumero: isMesaOrder ? (mesaNumero ?? null) : null,
        empleadoId,
        empleadoNombre,
        estado: "recibido",
        items: {
          create: items.map(
            (item: {
              productoId: string
              nombre: string
              precio: number
              cantidad: number
              agregados: Array<{ id: string; nombre: string; precio: number }>
              secciones: Record<string, string>
              ingredientesQuitados: string[]
              talle: string
              color: string
            }) => ({
              productoId: item.productoId,
              nombre: item.nombre,
              precio: item.precio,
              cantidad: item.cantidad,
              agregados: JSON.stringify(item.agregados || []),
              secciones: JSON.stringify(item.secciones || {}),
              ingredientes: JSON.stringify([]),
              ingredientesQuitados: JSON.stringify(item.ingredientesQuitados || []),
              seccionesPrecios: JSON.stringify({}),
              talle: item.talle || "",
              color: item.color || "",
            })
          ),
        },
      },
      include: {
        items: true,
      },
    })

    // Update negocio debt (fixed $250 service fee goes to platform)
    // Skip for mesa orders when service fee is disabled
    if (!isMesaOrder || MESA_SERVICE_FEE_ENABLED) {
      await db.negocio.update({
        where: { id: negocioId },
        data: {
          deudaTarifa: negocio.deudaTarifa + tarifaServicio,
        },
      })
    }

    // Send push notification to the business about the new order
    try {
      const negocioWithPush = await db.negocio.findUnique({
        where: { id: negocioId },
        select: { pushSubscription: true },
      })
      if (negocioWithPush?.pushSubscription) {
        const notification = newOrderNotification(
          pedido.id,
          clienteNombre,
          total
        )
        await sendPushNotification(negocioWithPush.pushSubscription, notification)
      }
    } catch (pushError) {
      console.error("[Push] Failed to send new order notification:", pushError)
    }

    return NextResponse.json(pedido, { status: 201 })
  } catch (error) {
    console.error("Error creating pedido:", error)
    const msg = error instanceof Error ? error.message : "Error al crear el pedido"
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const negocioId = searchParams.get("negocioId")
    const clienteId = searchParams.get("clienteId")

    const where: Record<string, unknown> = {}

    if (negocioId) where.negocioId = negocioId
    if (clienteId) where.clienteId = clienteId

    // If no filter, return based on session
    if (!negocioId && !clienteId) {
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
      if (token) {
        const session = await db.sesion.findUnique({
          where: { token },
        })
        if (session) {
          if (session.userType === "cliente") {
            where.clienteId = session.userId
          } else if (session.userType === "negocio") {
            where.negocioId = session.userId
          }
        }
      }
    }

    const pedidos = await db.pedido.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { fecha: "desc" },
      take: 50,
    })

    return NextResponse.json(pedidos)
  } catch (error) {
    console.error("Error fetching pedidos:", error)
    return NextResponse.json(
      { error: "Error al obtener pedidos" },
      { status: 500 }
    )
  }
}
