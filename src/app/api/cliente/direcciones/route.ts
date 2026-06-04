import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"

// GET /api/cliente/direcciones - List all addresses for the authenticated client
export async function GET(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const direcciones = await db.direccion.findMany({
      where: { clienteId: cliente.id },
      orderBy: { alias: "asc" },
    })

    return NextResponse.json({ ok: true, direcciones })
  } catch (error) {
    console.error("Direccion GET error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// POST /api/cliente/direcciones - Add a new address
export async function POST(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const { alias, direccion, referencia, lat, lng } = body

    if (!alias || !alias.trim()) {
      return NextResponse.json({ error: "El alias es obligatorio" }, { status: 400 })
    }
    // Allow address text to be empty if coordinates are provided (coords take priority)
    const hasCoords = lat != null && lng != null
    if ((!direccion || !direccion.trim()) && !hasCoords) {
      return NextResponse.json({ error: "La dirección o las coordenadas son obligatorias" }, { status: 400 })
    }

    // Limit to 10 addresses
    const currentCount = await db.direccion.count({
      where: { clienteId: cliente.id },
    })
    if (currentCount >= 10) {
      return NextResponse.json(
        { error: "No podés tener más de 10 direcciones guardadas" },
        { status: 400 }
      )
    }

    const nuevaDireccion = await db.direccion.create({
      data: {
        alias: alias.trim(),
        direccion: direccion?.trim() || (hasCoords ? "Ubicación en mapa" : ""),
        referencia: referencia?.trim() || "",
        lat: lat != null ? parseFloat(String(lat)) : null,
        lng: lng != null ? parseFloat(String(lng)) : null,
        clienteId: cliente.id,
      },
    })

    return NextResponse.json({ ok: true, direccion: nuevaDireccion }, { status: 201 })
  } catch (error) {
    console.error("Direccion POST error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// PUT /api/cliente/direcciones - Update an address
export async function PUT(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const { id, alias, direccion, referencia, lat, lng } = body

    if (!id) {
      return NextResponse.json({ error: "ID de dirección requerido" }, { status: 400 })
    }

    // Verify ownership
    const existing = await db.direccion.findFirst({
      where: { id, clienteId: cliente.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 })
    }

    const updated = await db.direccion.update({
      where: { id },
      data: {
        alias: alias?.trim() ?? existing.alias,
        direccion: direccion?.trim() ?? existing.direccion,
        referencia: referencia !== undefined ? referencia.trim() : existing.referencia,
        lat: lat !== undefined ? (lat != null ? parseFloat(String(lat)) : null) : existing.lat,
        lng: lng !== undefined ? (lng != null ? parseFloat(String(lng)) : null) : existing.lng,
      },
    })

    return NextResponse.json({ ok: true, direccion: updated })
  } catch (error) {
    console.error("Direccion PUT error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// DELETE /api/cliente/direcciones - Delete an address
export async function DELETE(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID de dirección requerido" }, { status: 400 })
    }

    // Verify ownership
    const existing = await db.direccion.findFirst({
      where: { id, clienteId: cliente.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 })
    }

    await db.direccion.delete({ where: { id } })

    return NextResponse.json({ ok: true, message: "Dirección eliminada" })
  } catch (error) {
    console.error("Direccion DELETE error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
