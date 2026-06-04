import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Point-in-polygon algorithm (ray casting)
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

// GET /api/negocio/delivery-zonas?slug=xxx&lat=xxx&lng=xxx
// Public endpoint - checks if a point is within any delivery zone of a negocio
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get("slug")
    const lat = parseFloat(searchParams.get("lat") ?? "")
    const lng = parseFloat(searchParams.get("lng") ?? "")

    if (!slug || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 })
    }

    const negocio = await db.negocio.findUnique({
      where: { slug },
      select: {
        id: true,
        ofreceDelivery: true,
        deliveryMode: true,
        precioDelivery: true,
        precioDeliveryDefault: true,
        zonasDelivery: true,
      },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })
    }

    if (!negocio.ofreceDelivery) {
      return NextResponse.json({ delivery: false, reason: "no_delivery" })
    }

    // Simple mode: flat delivery price for everyone
    if (negocio.deliveryMode === "simple" || !negocio.deliveryMode) {
      return NextResponse.json({
        delivery: true,
        precioDelivery: negocio.precioDelivery,
        mode: "simple",
        zonaNombre: null,
      })
    }

    // Expert mode: check zones
    const zonas = JSON.parse(negocio.zonasDelivery || "[]")
    if (!Array.isArray(zonas) || zonas.length === 0) {
      // No zones defined yet — in expert mode this means no delivery available
      return NextResponse.json({
        delivery: false,
        reason: "no_zones_defined",
        mode: "expert",
      })
    }

    // Check if point is in any zone
    for (const zona of zonas) {
      const puntos = zona.puntos
      if (Array.isArray(puntos) && puntos.length >= 3 && pointInPolygon(lat, lng, puntos)) {
        return NextResponse.json({
          delivery: true,
          precioDelivery: zona.precio,
          mode: "expert",
          zonaNombre: zona.nombre,
          zonaId: zona.id,
        })
      }
    }

    // Point is outside all zones
    return NextResponse.json({
      delivery: false,
      reason: "outside_zones",
      mode: "expert",
    })
  } catch (error) {
    console.error("Error checking delivery zone:", error)
    return NextResponse.json({ error: "Error al verificar zona" }, { status: 500 })
  }
}
