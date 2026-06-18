import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { createNotification, newOrderNotification, salonNewOrderNotification, empleadosNewOrderNotification } from "@/lib/push"
import { isNegocioOpen } from "@/lib/utils"
import { acquireLock, releaseLock } from "@/lib/concurrency"

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
  // Concurrency protection: compute lock key before try block so it's accessible in finally
  const ip = getClientIp(request)
  const rlKey = request.cookies.get(SESSION_COOKIE_NAME)?.value || ip
  const orderLockKey = `order:${rlKey}`

  try {
    // Rate limit orders
    const rl = checkRateLimit("order", rlKey)
    if (!rl.allowed) {
      return rateLimitResponse(rl, "Estás haciendo muchos pedidos. Esperá un momento.")
    }

    // Concurrency protection: prevent double orders from the same user/session
    if (!acquireLock(orderLockKey)) {
      return NextResponse.json(
        { error: "Ya hay un pedido en proceso. Esperá un momento." },
        { status: 409 }
      )
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

    // ============================================
    // SERVER-SIDE PRICE VALIDATION (anti-manipulation)
    // ============================================
    const productoIds = items.map((item: { productoId: string }) => item.productoId).filter(Boolean)
    const dbProductos = await db.producto.findMany({
      where: { id: { in: productoIds }, negocioId },
      select: { id: true, precio: true, descuentoActivo: true, tipoDescuento: true, valorDescuento: true },
    })
    const precioMap = new Map(dbProductos.map(p => [p.id, p]))

    // Also fetch agregado prices
    // Filter out composite IDs (shared options use "id::name" format)
    const allAgregadoIds = items.flatMap((item: { agregados: Array<{ id: string }> }) =>
      (item.agregados || []).map((a: { id: string }) => a.id)
    ).filter((id: string) => id && !id.includes("::"))
    const dbAgregados = await db.agregado.findMany({
      where: { id: { in: allAgregadoIds }, negocioId },
      select: { id: true, precio: true },
    })
    const agregadoPrecioMap = new Map(dbAgregados.map(a => [a.id, a]))

    // Also fetch shared options (OpcionesCompartidas) for server-side price validation
    const allSharedOptionIds = items.flatMap((item: { agregados: Array<{ id: string }> }) =>
      (item.agregados || [])
        .map((a: { id: string }) => a.id)
        .filter((id: string) => id && id.includes("::"))
        .map((id: string) => id.split("::")[0])
    ).filter(Boolean)
    const uniqueSharedOptionIds = [...new Set(allSharedOptionIds)]
    const dbOpcionesCompartidas = uniqueSharedOptionIds.length > 0
      ? await db.opcionesCompartidas.findMany({
          where: { id: { in: uniqueSharedOptionIds }, negocioId },
          select: { id: true, opciones: true },
        })
      : []
    // Build a map: sharedOptionId -> Map<optionName, price>
    const sharedOptionPrecioMap = new Map<string, Map<string, number>>()
    for (const oc of dbOpcionesCompartidas) {
      let opciones: Array<{ nombre: string; precio: number }> = []
      try {
        const parsed = JSON.parse(oc.opciones || "[]")
        if (Array.isArray(parsed)) opciones = parsed
      } catch { /* ignore parse errors */ }
      const optMap = new Map(opciones.map(o => [o.nombre, o.precio]))
      sharedOptionPrecioMap.set(oc.id, optMap)
    }

    // Recalculate server-side
    let serverTotalProductos = 0
    // Map: item index -> validated agregados array (to use when creating PedidoItem)
    const validatedAgregadosMap = new Map<number, Array<{ id: string; nombre: string; precio: number; tipo: string }>>()
    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      const item = items[itemIdx]
      const dbProd = precioMap.get(item.productoId)
      if (!dbProd) {
        return NextResponse.json({ error: `Producto ${item.productoId} no encontrado` }, { status: 400 })
      }

      let unitPrice = dbProd.precio

      // Apply discount if active
      if (dbProd.descuentoActivo && dbProd.valorDescuento > 0) {
        if (dbProd.tipoDescuento === 'porcentaje') {
          unitPrice = unitPrice * (1 - dbProd.valorDescuento / 100)
        } else {
          unitPrice = Math.max(0, unitPrice - dbProd.valorDescuento)
        }
      }

      // Validate agregado prices (handle both regular agregados and shared options)
      let agregadosTotal = 0
      const validatedAgregados: Array<{ id: string; nombre: string; precio: number; tipo: string }> = []
      for (const agregado of (item.agregados || [])) {
        const agregadoId = String(agregado?.id || "")
        const esOpcionCompartida = agregadoId.includes("::")

        if (esOpcionCompartida) {
          // Shared option: validate price against DB
          const [sharedId, optName] = agregadoId.split("::")
          const optPrecioMap = sharedOptionPrecioMap.get(sharedId)
          let precioOpcion = Number(agregado?.precio) || 0
          if (optPrecioMap && optName && optPrecioMap.has(optName)) {
            // Use server-validated price
            precioOpcion = optPrecioMap.get(optName)!
          } else if (!optPrecioMap) {
            // Shared option config not found in DB — reject
            return NextResponse.json({ error: `Opción compartida ${sharedId} no encontrada` }, { status: 400 })
          }
          agregadosTotal += precioOpcion
          validatedAgregados.push({
            id: agregadoId,
            nombre: agregado?.nombre || optName || "",
            precio: precioOpcion,
            tipo: "opcion_compartida",
          })
        } else {
          // Regular agregado: validate against DB price
          const dbAgr = agregadoPrecioMap.get(agregadoId)
          if (dbAgr === undefined) {
            return NextResponse.json({ error: `Agregado ${agregadoId} no encontrado` }, { status: 400 })
          }
          const precioAgregado = dbAgr.precio
          agregadosTotal += precioAgregado
          validatedAgregados.push({
            id: agregadoId,
            nombre: agregado?.nombre || "",
            precio: precioAgregado,
            tipo: "agregado",
          })
        }
      }

      serverTotalProductos += (unitPrice + agregadosTotal) * (item.cantidad || 1)
      validatedAgregadosMap.set(itemIdx, validatedAgregados)
    }

    serverTotalProductos = Math.round(serverTotalProductos * 100) / 100

    // Verify totalProductos matches (with 2 decimal tolerance for rounding)
    if (Math.abs(serverTotalProductos - totalProductos) > 2) {
      return NextResponse.json(
        { error: "El total de productos no coincide con los precios actuales" },
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
          // Check if customer is blocked
          if (cliente.bloqueado) {
            return NextResponse.json(
              { error: "Tu cuenta ha sido bloqueada. Contactá a soporte para más información." },
              { status: 403 }
            )
          }
          clienteId = cliente.id
          clienteNombre = cliente.nombre
          clienteTelefono = cliente.telefono

          // Update last known IP and device fingerprint
          const clientIp = getClientIp(request)
          const fingerprint = body.fingerprint || ""
          await db.cliente.update({
            where: { id: cliente.id },
            data: {
              ultimoIp: clientIp,
              ...(fingerprint ? { dispositivoFingerprint: fingerprint } : {}),
            },
          })
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

      // Look up the mesa using Prisma ORM (avoids PostgreSQL case-sensitivity issues with $queryRaw)
      let mesaRow: { id: string; numero: number; activa: boolean; empleadoId: string | null } | null = null

      if (mesaId) {
        // Direct lookup by ID
        const found = await db.mesa.findFirst({
          where: { id: mesaId, negocioId },
          select: { id: true, numero: true, activa: true, empleadoId: true },
        })
        if (found) mesaRow = found
      }

      if (!mesaRow && mesaNumero) {
        // Fallback: look up by negocioId + numero
        const found = await db.mesa.findFirst({
          where: { negocioId, numero: mesaNumero },
          select: { id: true, numero: true, activa: true, empleadoId: true },
        })
        if (found) mesaRow = found
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
        const mesaEmpleado = await db.empleado.findFirst({
          where: { id: mesaEmpleadoId, negocioId, activo: true },
          select: { id: true, nombre: true },
        })
        if (mesaEmpleado) {
          empleadoId = mesaEmpleado.id
          empleadoNombre = mesaEmpleado.nombre
        }
      }
    }

    // Resolve empleado from codigo if provided (overrides mesa auto-assignment)
    // This handles the mozo link flow where the mozo explicitly opened the order
    if (empleadoCodigo && isMesaOrder) {
      const empleado = await db.empleado.findFirst({
        where: { codigo: empleadoCodigo, negocioId, activo: true },
        select: { id: true, nombre: true },
      })
      if (empleado) {
        empleadoId = empleado.id
        empleadoNombre = empleado.nombre
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
    // Calculate server-validated total
    const serverTotal = serverTotalProductos + (isMesaOrder ? 0 : (finalPrecioDelivery || 0)) + (isMesaOrder ? mesaTarifa : tarifaServicio)
    const finalTotal = serverTotal

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
        totalProductos: serverTotalProductos,
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
            }, idx: number) => ({
              productoId: item.productoId,
              nombre: item.nombre,
              precio: item.precio,
              cantidad: item.cantidad,
              agregados: JSON.stringify(validatedAgregadosMap.get(idx) || item.agregados || []),
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
      const payload = newOrderNotification(pedido.id, clienteNombre, total)
      await createNotification({
        userId: negocioId,
        userType: "negocio",
        tipo: "new_order",
        titulo: payload.title,
        cuerpo: payload.body,
        pedidoId: pedido.id,
        negocioId: negocioId,
        pushSubscription: negocioWithPush?.pushSubscription ?? null,
        pushPayload: payload,
        cleanupExpired: { model: "negocio", id: negocioId },
      })
    } catch (pushError) {
      console.error("[Push] Failed to send new order notification:", pushError)
    }

    // Send push notification to the shared-display PWA that handles this order.
    //  - Mesa orders      → salon PWA     (/s/[token])   via Negocio.pushSubscriptionSalon
    //  - Retiro/domicilio → empleados PWA (/e/[token])   via Negocio.pushSubscriptionEmpleados
    // Both subscriptions live on the Negocio model (separate fields) so multiple
    // shared devices can each be notified without wiping the owner's subscription.
    try {
      const sharedPush = await db.negocio.findUnique({
        where: { id: negocioId },
        select: { pushSubscriptionSalon: true, pushSubscriptionEmpleados: true },
      })

      if (isMesaOrder && mesaNumero) {
        // ── Salon PWA: mesa order ──
        if (sharedPush?.pushSubscriptionSalon) {
          const salonPayload = salonNewOrderNotification(
            pedido.id,
            mesaNumero,
            clienteNombre,
            total,
            empleadoNombre
          )
          await createNotification({
            userId: negocioId,
            userType: "negocio", // stored on Negocio row; salon PWA reads via token
            tipo: "salon_new_order",
            titulo: salonPayload.title,
            cuerpo: salonPayload.body,
            pedidoId: pedido.id,
            negocioId: negocioId,
            datos: { mesaNumero },
            pushSubscription: sharedPush.pushSubscriptionSalon,
            pushPayload: salonPayload,
            cleanupExpired: { model: "negocio", id: negocioId, field: "pushSubscriptionSalon" },
          })
        }
      } else {
        // ── Empleados PWA: retiro / domicilio order ──
        if (sharedPush?.pushSubscriptionEmpleados) {
          const empleadosPayload = empleadosNewOrderNotification(
            pedido.id,
            clienteNombre,
            total,
            metodoEntrega || "retiro"
          )
          await createNotification({
            userId: negocioId,
            userType: "negocio", // stored on Negocio row; empleados PWA reads via token
            tipo: "empleados_new_order",
            titulo: empleadosPayload.title,
            cuerpo: empleadosPayload.body,
            pedidoId: pedido.id,
            negocioId: negocioId,
            pushSubscription: sharedPush.pushSubscriptionEmpleados,
            pushPayload: empleadosPayload,
            cleanupExpired: { model: "negocio", id: negocioId, field: "pushSubscriptionEmpleados" },
          })
        }
      }
    } catch (sharedPushError) {
      console.error("[Push] Failed to send shared-display notification:", sharedPushError)
    }

    return NextResponse.json(pedido, { status: 201 })
  } catch (error) {
    console.error("Error creating pedido:", error)
    const msg = error instanceof Error ? error.message : "Error al crear el pedido"
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  } finally {
    // Always release the lock, even on error
    releaseLock(orderLockKey)
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const session = await db.sesion.findUnique({ where: { token } })
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryNegocioId = searchParams.get("negocioId")
    const queryClienteId = searchParams.get("clienteId")

    const where: Record<string, unknown> = {}

    // Security: only allow users to see their own data
    if (session.userType === "cliente") {
      where.clienteId = session.userId
    } else if (session.userType === "negocio") {
      where.negocioId = session.userId
    } else if (session.userType === "repartidor") {
      // Repartidor can only see orders from their associated negocios
      const asociaciones = await db.repartidorNegocio.findMany({
        where: { repartidorId: session.userId },
        select: { negocioId: true },
      })
      const negocioIds = asociaciones.map(a => a.negocioId)
      if (queryNegocioId && !negocioIds.includes(queryNegocioId)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 })
      }
      where.negocioId = queryNegocioId || { in: negocioIds }
    } else if (session.userType === "superadmin") {
      // Superadmin can filter by any negocioId or clienteId
      if (queryNegocioId) where.negocioId = queryNegocioId
      if (queryClienteId) where.clienteId = queryClienteId
    }

    const pedidos = await db.pedido.findMany({
      where,
      include: { items: true },
      orderBy: { fecha: "desc" },
      take: 50,
    })

    return NextResponse.json(pedidos)
  } catch (error) {
    console.error("Error fetching pedidos:", error)
    return NextResponse.json({ error: "Error al obtener pedidos" }, { status: 500 })
  }
}
