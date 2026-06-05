import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { sendPushNotification, newOrderNotification } from "@/lib/push"
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

/**
 * Safely parse a value that might be a JSON string or already an object.
 */
function safeParseJSON<T>(value: T | string | undefined | null, fallback: T): T {
  if (value === undefined || value === null) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value
}

/**
 * Safely coerce a value to a finite number. Returns 0 if not finite.
 */
function toFiniteNum(value: unknown, fallback = 0): number {
  const n = Number(value)
  return isFinite(n) ? n : fallback
}

/**
 * Check if an agregado ID is from a shared option (format: "opcionesCompartidasId::optionName")
 * vs a regular Agregado table ID (format: "cl..." cuid)
 */
function isSharedOptionId(id: string): boolean {
  return id.includes("::")
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
    if (!negocioId || !items || !Array.isArray(items) || items.length === 0) {
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
      select: { id: true, precio: true, descuentoActivo: true, tipoDescuento: true, valorDescuento: true, secciones: true, opcionesCompartidasIds: true },
    })
    const precioMap = new Map(dbProductos.map(p => [p.id, p]))

    // Separate real agregado IDs from shared option IDs
    const allAgregadoIdsFromItems = items.flatMap((item: { agregados?: Array<{ id: string }> }) =>
      (item.agregados || []).map((a: { id: string }) => a.id)
    ).filter(Boolean)

    const realAgregadoIds = allAgregadoIdsFromItems.filter((id: string) => !isSharedOptionId(id))
    const sharedOptionIds = allAgregadoIdsFromItems.filter((id: string) => isSharedOptionId(id))

    // Fetch real agregado prices from DB
    let agregadoPrecioMap = new Map<string, number>()
    if (realAgregadoIds.length > 0) {
      const dbAgregados = await db.agregado.findMany({
        where: { id: { in: realAgregadoIds }, negocioId },
        select: { id: true, precio: true },
      })
      agregadoPrecioMap = new Map(dbAgregados.map(a => [a.id, a.precio]))
    }

    // Fetch shared options prices from DB
    // Shared option IDs have format "opcionesCompartidasId::optionName"
    // We need to extract the unique opcionesCompartidas IDs and look up prices
    let sharedOptionsPrecioMap = new Map<string, number>()
    if (sharedOptionIds.length > 0) {
      const ocIds = [...new Set(sharedOptionIds.map((id: string) => id.split("::")[0]))]
      if (ocIds.length > 0) {
        const dbOpcionesCompartidas = await db.opcionesCompartidas.findMany({
          where: { id: { in: ocIds }, negocioId },
          select: { id: true, opciones: true },
        })
        for (const oc of dbOpcionesCompartidas) {
          const opciones = safeParseJSON<Array<{ nombre: string; precio: number }>>(oc.opciones, [])
          for (const opt of opciones) {
            // Build the same key format the frontend uses: "ocId::optionName"
            const key = `${oc.id}::${opt.nombre}`
            sharedOptionsPrecioMap.set(key, toFiniteNum(opt.precio))
          }
        }
      }
    }

    // Also fetch product secciones to validate seccion option prices
    // The product's secciones JSON contains sections with opciones that may have prices
    // stored as { nombre: string; precio?: number }[] — but our seed data uses string[] for opciones
    // We build a price map from the product's secciones config for server-side validation
    const seccionesPrecioByProduct = new Map<string, Map<string, number>>()
    for (const dbProd of dbProductos) {
      const secciones = safeParseJSON<Array<{ nombre: string; opciones: Array<string | { nombre: string; precio: number }>; obligatorio?: boolean; maximo?: number }>>(
        dbProd.secciones, []
      )
      const priceMap = new Map<string, number>()
      for (const section of secciones) {
        for (const opt of section.opciones) {
          if (typeof opt === "string") {
            // Simple string option — no price
            continue
          }
          // Object option with nombre + precio
          const key = `${section.nombre}:${opt.nombre}`
          priceMap.set(key, toFiniteNum(opt.precio))
        }
      }
      if (priceMap.size > 0) {
        seccionesPrecioByProduct.set(dbProd.id, priceMap)
      }
    }

    // Recalculate server-side
    let serverTotalProductos = 0
    const processedItems: Array<{
      productoId: string
      nombre: string
      precio: number
      cantidad: number
      agregados: Array<{ id: string; nombre: string; precio: number }>
      secciones: Record<string, string | Record<string, number>>
      seccionesPrecios: Record<string, number>
      ingredientes: string[]
      ingredientesQuitados: string[]
      talle: string
      color: string
    }> = []

    for (const item of items) {
      const dbProd = precioMap.get(item.productoId)
      if (!dbProd) {
        return NextResponse.json({ error: `Producto ${item.productoId} no encontrado` }, { status: 400 })
      }

      // Ensure precio is a valid finite number
      let unitPrice = toFiniteNum(dbProd.precio)
      if (unitPrice <= 0) {
        console.error(`[Pedido] Producto ${item.productoId} has invalid precio:`, dbProd.precio)
        return NextResponse.json({ error: `Producto "${item.nombre || item.productoId}" tiene un precio inválido` }, { status: 400 })
      }

      // Apply discount if active
      if (dbProd.descuentoActivo && toFiniteNum(dbProd.valorDescuento) > 0) {
        if (dbProd.tipoDescuento === "porcentaje") {
          unitPrice = unitPrice * (1 - toFiniteNum(dbProd.valorDescuento) / 100)
        } else {
          unitPrice = Math.max(0, unitPrice - toFiniteNum(dbProd.valorDescuento))
        }
      }

      // Validate agregado/shared option prices
      let agregadosTotal = 0
      const validatedAgregados: Array<{ id: string; nombre: string; precio: number }> = []
      for (const agregado of (item.agregados || [])) {
        if (isSharedOptionId(agregado.id)) {
          // Shared option — look up in sharedOptionsPrecioMap
          const serverPrecio = sharedOptionsPrecioMap.get(agregado.id)
          if (serverPrecio === undefined) {
            // Shared option not found in DB — use the price sent by the frontend as fallback
            // (the frontend already has the correct price from the catalog)
            console.warn(`[Pedido] Shared option ${agregado.id} not found in DB, using frontend price: ${agregado.precio}`)
            const fallbackPrecio = toFiniteNum(agregado.precio)
            agregadosTotal += fallbackPrecio
            validatedAgregados.push({
              id: agregado.id,
              nombre: agregado.nombre || "",
              precio: fallbackPrecio,
            })
          } else {
            agregadosTotal += serverPrecio
            validatedAgregados.push({
              id: agregado.id,
              nombre: agregado.nombre || "",
              precio: serverPrecio,
            })
          }
        } else {
          // Regular agregado — look up in agregadoPrecioMap
          const dbAgr = agregadoPrecioMap.get(agregado.id)
          if (!dbAgr) {
            return NextResponse.json({ error: `Agregado ${agregado.id} no encontrado` }, { status: 400 })
          }
          agregadosTotal += toFiniteNum(dbAgr.precio)
          validatedAgregados.push({
            id: agregado.id,
            nombre: agregado.nombre || "",
            precio: toFiniteNum(dbAgr.precio),
          })
        }
      }

      // Parse secciones safely
      const secciones = safeParseJSON<Record<string, string | Record<string, number>>>(
        item.secciones, {}
      )

      // Calculate secciones price contribution using product's secciones config
      const productSeccionesPrecios = seccionesPrecioByProduct.get(item.productoId)
      let seccionesTotal = 0
      const seccionesPrecios: Record<string, number> = {}

      if (productSeccionesPrecios && productSeccionesPrecios.size > 0) {
        for (const [sectionName, value] of Object.entries(secciones)) {
          if (typeof value === "string") {
            // Single select
            const key = `${sectionName}:${value}`
            const price = productSeccionesPrecios.get(key)
            if (price !== undefined && isFinite(price)) {
              seccionesTotal += price
              seccionesPrecios[key] = price
            }
          } else if (typeof value === "object" && value !== null) {
            // Multi select — value is { optionName: quantity }
            for (const [optionName, qty] of Object.entries(value)) {
              const key = `${sectionName}:${optionName}`
              const price = productSeccionesPrecios.get(key)
              if (price !== undefined && isFinite(price) && isFinite(Number(qty))) {
                seccionesTotal += price * Number(qty)
                seccionesPrecios[key] = price
              }
            }
          }
        }
      }

      // Also check if frontend sent seccionesPrecios directly (for backwards compatibility)
      const frontendSeccionesPrecios = safeParseJSON<Record<string, number>>(item.seccionesPrecios, {})
      if (Object.keys(frontendSeccionesPrecios).length > 0 && Object.keys(seccionesPrecios).length === 0) {
        // Use frontend values as fallback
        for (const [key, price] of Object.entries(frontendSeccionesPrecios)) {
          if (isFinite(Number(price))) {
            seccionesPrecios[key] = Number(price)
          }
        }
      }

      const cantidad = typeof item.cantidad === "number" && item.cantidad > 0 ? item.cantidad : 1

      const itemTotal = (unitPrice + agregadosTotal + seccionesTotal) * cantidad
      if (!isFinite(itemTotal)) {
        console.error(`[Pedido] NaN detected for item ${item.productoId}:`, {
          unitPrice, agregadosTotal, seccionesTotal, cantidad, itemTotal
        })
        return NextResponse.json(
          { error: `Error en el precio del producto "${item.nombre || item.productoId}"` },
          { status: 400 }
        )
      }

      serverTotalProductos += itemTotal

      processedItems.push({
        productoId: item.productoId,
        nombre: item.nombre || "",
        precio: unitPrice,
        cantidad,
        agregados: validatedAgregados,
        secciones,
        seccionesPrecios,
        ingredientes: safeParseJSON<string[]>(item.ingredientes, []),
        ingredientesQuitados: safeParseJSON<string[]>(item.ingredientesQuitados, []),
        talle: item.talle || "",
        color: item.color || "",
      })
    }

    serverTotalProductos = Math.round(serverTotalProductos * 100) / 100

    // Validate that totals are finite numbers
    if (!isFinite(serverTotalProductos)) {
      console.error("[Pedido] serverTotalProductos is not finite:", serverTotalProductos)
      return NextResponse.json(
        { error: "Error en el cálculo del total de productos" },
        { status: 400 }
      )
    }

    // Verify totalProductos matches (with tolerance for rounding + shared options that frontend may calculate differently)
    const clientTotalProductos = typeof totalProductos === "number" ? totalProductos : 0
    if (isFinite(clientTotalProductos) && Math.abs(serverTotalProductos - clientTotalProductos) > 5) {
      console.warn(`[Pedido] Total mismatch: server=${serverTotalProductos}, client=${clientTotalProductos}`)
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

      // Look up the mesa using Prisma ORM (PostgreSQL compatible)
      let mesaRow: { id: string; numero: number; activa: boolean; empleadoId: string | null } | null = null

      if (mesaId) {
        const mesaById = await db.mesa.findFirst({
          where: { id: mesaId, negocioId },
          select: { id: true, numero: true, activa: true, empleadoId: true },
        })
        mesaRow = mesaById
      }

      if (!mesaRow && mesaNumero) {
        const mesaByNumero = await db.mesa.findFirst({
          where: { negocioId, numero: mesaNumero },
          select: { id: true, numero: true, activa: true, empleadoId: true },
        })
        mesaRow = mesaByNumero
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

      // Auto-resolve mozo from mesa assignment
      if (mesaRow.empleadoId) {
        const empleado = await db.empleado.findFirst({
          where: { id: mesaRow.empleadoId!, negocioId, activo: true },
          select: { id: true, nombre: true },
        })
        if (empleado) {
          empleadoId = empleado.id
          empleadoNombre = empleado.nombre
        }
      }
    }

    // Resolve empleado from codigo if provided (overrides mesa auto-assignment)
    if (empleadoCodigo && isMesaOrder) {
      const empleadoByCodigo = await db.empleado.findFirst({
        where: { codigo: empleadoCodigo, negocioId, activo: true },
        select: { id: true, nombre: true },
      })
      if (empleadoByCodigo) {
        empleadoId = empleadoByCodigo.id
        empleadoNombre = empleadoByCodigo.nombre
      }
    }

    // Determine delivery-specific fields
    let finalPrecioDelivery = isMesaOrder ? 0 : toFiniteNum(precioDelivery)

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
        finalPrecioDelivery = toFiniteNum(foundZone.precio)
      } else {
        // Simple mode: use the negocio's flat price
        finalPrecioDelivery = toFiniteNum(negocio.precioDelivery)
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
    const finalTarifaServicio = toFiniteNum(tarifaServicio)
    const serverTotal = serverTotalProductos + (isMesaOrder ? 0 : finalPrecioDelivery) + (isMesaOrder ? mesaTarifa : finalTarifaServicio)
    const finalTotal = Math.round(serverTotal * 100) / 100

    // Final validation — ensure no NaN
    if (!isFinite(finalTotal) || !isFinite(serverTotalProductos)) {
      console.error("[Pedido] Final total is not finite:", { finalTotal, serverTotalProductos })
      return NextResponse.json(
        { error: "Error en el cálculo del total del pedido" },
        { status: 400 }
      )
    }

    // Build pedido data with explicit relations for PostgreSQL
    const pedidoData: Record<string, unknown> = {
      negocio: { connect: { id: negocioId } },
      negocioSlug: negocio.slug,
      negocioNombre: negocio.nombre,
      clienteNombre,
      clienteTelefono,
      total: finalTotal,
      totalProductos: serverTotalProductos,
      tarifaServicio: finalTarifaServicio,
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
        create: processedItems.map((item) => ({
          productoId: item.productoId,
          nombre: item.nombre,
          precio: item.precio,
          cantidad: item.cantidad,
          agregados: JSON.stringify(item.agregados || []),
          secciones: JSON.stringify(item.secciones || {}),
          ingredientes: JSON.stringify(item.ingredientes || []),
          ingredientesQuitados: JSON.stringify(item.ingredientesQuitados || []),
          seccionesPrecios: JSON.stringify(item.seccionesPrecios || {}),
          talle: item.talle || "",
          color: item.color || "",
        })),
      },
    }

    // Connect cliente if authenticated
    if (clienteId) {
      pedidoData.cliente = { connect: { id: clienteId } }
    }

    // Create pedido
    const pedido = await db.pedido.create({
      data: pedidoData,
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
          deudaTarifa: negocio.deudaTarifa + finalTarifaServicio,
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
          finalTotal
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
