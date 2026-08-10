import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { resolveDeliveryCoverage, DELIVERY_PRECIOS_MAX_IDS } from "@/lib/delivery-coverage"

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

    // T20-DK2B: rechazo explícito ante exceso — nunca truncar en silencio.
    // Un truncamiento silencioso dejaría IDs "desaparecidos" de la
    // respuesta sin que el llamador se entere, indistinguibles de un
    // negocio inexistente (ver política de "resultado faltante" del hook).
    // El límite se mantiene (protege tamaño de request/query DB/CPU) — el
    // consumidor real (`useSoloDeliveryCoverage`) es responsable de dividir
    // conjuntos más grandes en varios requests de este tamaño.
    if (negocioIds.length > DELIVERY_PRECIOS_MAX_IDS) {
      return NextResponse.json(
        { error: `negocioIds no puede tener más de ${DELIVERY_PRECIOS_MAX_IDS} elementos` },
        { status: 400 }
      )
    }

    // Query all specified negocios
    const negocios = await db.negocio.findMany({
      where: { id: { in: negocioIds } },
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

    const precios: Record<string, ReturnType<typeof resolveDeliveryCoverage>> = {}

    for (const negocio of negocios) {
      precios[negocio.id] = resolveDeliveryCoverage(negocio, lat, lng)
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
