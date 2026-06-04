import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// ============================================
// Point-in-polygon (ray-casting algorithm)
// ============================================
function pointInPolygon(
  lat: number,
  lng: number,
  polygon: { lat: number; lng: number }[]
): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat,
      yi = polygon[i].lng
    const xj = polygon[j].lat,
      yj = polygon[j].lng
    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// ============================================
// Safe JSON parser
// ============================================
function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null)) {
        return parsed
      }
      return fallback
    } catch {
      return fallback
    }
  }
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return value
  }
  return fallback
}

interface ZonaDelivery {
  id: string
  nombre: string
  precio: number
  puntos: { lat: number; lng: number }[]
  color: string
}

// ============================================
// POST /api/negocios/delivery-precios
// Body: { lat, lng, negocioIds: string[] }
// Returns: { precios: { [negocioId]: { precioDelivery, zonaNombre?, mode, delivery?, reason? } } }
// ============================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lat, lng, negocioIds } = body as {
      lat?: number
      lng?: number
      negocioIds?: string[]
    }

    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Array.isArray(negocioIds) ||
      negocioIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Se requiere lat, lng y negocioIds" },
        { status: 400 }
      )
    }

    // Limit batch size
    const ids = negocioIds.slice(0, 50)

    // Query all specified negocios
    const negocios = await db.negocio.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        ofreceDelivery: true,
        deliveryMode: true,
        precioDelivery: true,
        precioDeliveryDefault: true,
        zonaDeliveryActiva: true,
        zonasDelivery: true,
      },
    })

    const precios: Record<
      string,
      {
        precioDelivery: number
        zonaNombre?: string
        mode: string
        delivery?: boolean
        reason?: string
      }
    > = {}

    for (const negocio of negocios) {
      // No delivery offered
      if (!negocio.ofreceDelivery) {
        precios[negocio.id] = {
          precioDelivery: 0,
          mode: "none",
          delivery: false,
          reason: "no_delivery",
        }
        continue
      }

      // Simple mode (flat fee)
      if (!negocio.zonaDeliveryActiva || negocio.deliveryMode !== "expert") {
        precios[negocio.id] = {
          precioDelivery: negocio.precioDelivery ?? 0,
          mode: "simple",
        }
        continue
      }

      // Expert mode (zone-based)
      const zonas = safeParseJSON(negocio.zonasDelivery, []) as ZonaDelivery[]

      if (!Array.isArray(zonas) || zonas.length === 0) {
        // No zones configured, use default
        precios[negocio.id] = {
          precioDelivery: negocio.precioDeliveryDefault ?? negocio.precioDelivery ?? 0,
          mode: "expert",
          zonaNombre: undefined,
        }
        continue
      }

      // Check which zone the user's point falls into
      let found = false
      for (const zona of zonas) {
        if (
          zona.puntos &&
          Array.isArray(zona.puntos) &&
          zona.puntos.length >= 3
        ) {
          if (pointInPolygon(lat, lng, zona.puntos)) {
            precios[negocio.id] = {
              precioDelivery: zona.precio ?? 0,
              zonaNombre: zona.nombre,
              mode: "expert",
            }
            found = true
            break
          }
        }
      }

      if (!found) {
        // Outside all zones - delivery not available for this location
        precios[negocio.id] = {
          precioDelivery:
            negocio.precioDeliveryDefault ?? negocio.precioDelivery ?? 0,
          mode: "expert",
          delivery: false,
          reason: "outside_zones",
        }
      }
    }

    return NextResponse.json({ precios })
  } catch (error) {
    console.error("Error calculating delivery prices:", error)
    return NextResponse.json(
      { error: "Error al calcular precios de delivery" },
      { status: 500 }
    )
  }
}
