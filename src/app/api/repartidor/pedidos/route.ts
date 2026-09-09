import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { getIngredientesQuitadosNombres } from "@/lib/pedido-item-personalizacion"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isTrackingCoreEligible } from "@/lib/realtime-policy"
import { CANONICAL_WAITING_DRIVER_STATE, LEGACY_AVAILABLE_DELIVERY_STATE } from "@/lib/order-transitions"

// P2-T29C: "disponible" pasa de `en_camino`+`repartidorId=null` (legacy,
// overloaded) a `esperando_repartidor`+`repartidorId=null` (canónico). Se
// preserva el estado legacy en el filtro — no como un tercer significado
// nuevo, sino porque NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS todavía
// permite la arista directa `preparando->en_camino` durante el rollout
// (compatibilidad con un cliente HTTP viejo en caché) — un pedido así
// creado DESPUÉS del deploy de T29C debe seguir siendo visible para
// Repartidor, o quedaría atascado sin que nadie pueda tomarlo.
const AVAILABLE_DELIVERY_ESTADOS = [CANONICAL_WAITING_DRIVER_STATE, LEGACY_AVAILABLE_DELIVERY_STATE]

// Helper to parse JSON fields safely
function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

// GET - Get orders for repartidor
// ?filter=disponibles → pending orders (no repartidor assigned yet)
// ?filter=mios → orders accepted by this repartidor
// ?filter=all (default) → both
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const filter = req.nextUrl.searchParams.get("filter") || "all"

    // Get all associated negocio IDs — only from negocios that still offer delivery
    const asociaciones = await db.repartidorNegocio.findMany({
      where: { 
        repartidorId: user.id,
        negocio: { ofreceDelivery: true, suspendido: false }
      },
      select: { negocioId: true },
    })

    const negocioIds = asociaciones.map((a) => a.negocioId)

    if (negocioIds.length === 0) {
      return NextResponse.json({ pedidos: [], disponibles: [], mios: [] })
    }

    // Build where clause based on filter
    let where: any = {
      negocioId: { in: negocioIds },
      metodoEntrega: "domicilio",
    }

    if (filter === "disponibles") {
      // Pending orders: waiting for a driver (canonical + legacy-compat), no repartidor assigned
      where.estado = { in: AVAILABLE_DELIVERY_ESTADOS }
      where.repartidorId = null
    } else if (filter === "mios") {
      // My orders: accepted by this repartidor, still active
      where.estado = { in: ["en_camino", "listo_para_retirar"] }
      where.repartidorId = user.id
    } else {
      // All: both available and mine
      where.OR = [
        {
          estado: { in: AVAILABLE_DELIVERY_ESTADOS },
          repartidorId: null,
        },
        {
          estado: { in: ["en_camino", "listo_para_retirar"] },
          repartidorId: user.id,
        },
      ]
      delete where.estado
    }

    const pedidos = await db.pedido.findMany({
      where,
      include: {
        items: {
          include: {
            producto: {
              select: { id: true, nombre: true, imagenUrl: true },
            },
          },
        },
        negocio: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            logoUrl: true,
            colorPrincipal: true,
            seguimientoDeliveryActivo: true,
          },
        },
      },
      orderBy: { fecha: "desc" },
    })

    // Bugfix-1 [12]: `notas` es la nota del cliente dirigida al negocio —
    // el repartidor no debe recibirla (solo necesita dirección/referencia
    // para encontrar el domicilio, que se mantienen en la respuesta).
    // P2-T01: se deriva `trackingEligibleNow` server-side con la misma
    // política central (isTrackingCoreEligible) que usan GET tracking y
    // realtime authorize, y se retiran AMBOS flags crudos (el vivo del
    // negocio y el snapshot inmutable del propio pedido) del payload — el
    // browser recibe únicamente el booleano ya resuelto, nunca los dos
    // flags por separado para reimplementar la regla (Stage 3 precommit
    // review: el snapshot crudo seguía viajando vía el spread `...p` pese a
    // que el flag vivo del negocio ya estaba correctamente retirado —
    // corregido acá).
    const pedidosParsed = pedidos.map(({ clienteTelefono, notas, negocio, seguimientoDeliveryHabilitado, ...p }) => {
      const trackingEligibleNow = isTrackingCoreEligible(
        {
          estado: p.estado,
          metodoEntrega: p.metodoEntrega,
          seguimientoDeliveryHabilitado,
        },
        { seguimientoDeliveryActivo: negocio?.seguimientoDeliveryActivo === true }
      )

      return {
        ...p,
        negocio: negocio
          ? {
              id: negocio.id,
              nombre: negocio.nombre,
              slug: negocio.slug,
              logoUrl: negocio.logoUrl,
              colorPrincipal: negocio.colorPrincipal,
            }
          : negocio,
        trackingEligibleNow,
        items: p.items.map((item) => ({
          ...item,
          agregados: safeParseJSON(item.agregados, []),
          secciones: safeParseJSON(item.secciones, {}),
          seccionesPrecios: safeParseJSON(item.seccionesPrecios, {}),
          ingredientes: safeParseJSON(item.ingredientes, []),
          // P1-A.2A-ii: contrato plano estable — deliveries-tab.tsx no renderiza este campo
          // hoy, pero el endpoint no debe propagar un objeto crudo bajo un tipo históricamente
          // documentado como texto.
          ingredientesQuitados: getIngredientesQuitadosNombres(item.ingredientesQuitados),
        })),
      }
    })

    // Separate into categories for the frontend
    const disponibles = pedidosParsed.filter((p: any) => !p.repartidorId)
    const mios = pedidosParsed.filter((p: any) => p.repartidorId === user.id)

    return NextResponse.json({
      pedidos: pedidosParsed,
      disponibles,
      mios,
    })
  } catch (error) {
    console.error("Error getting repartidor pedidos:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener pedidos" }, { status: 500 })
  }
}
