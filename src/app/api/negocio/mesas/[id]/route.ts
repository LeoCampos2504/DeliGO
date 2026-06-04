import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// PUT - Update mesa
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const { id } = await params

    // Verify ownership
    const existing = await db.mesa.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Mesa no encontrada" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { numero, nombre, capacidad, forma, zona, activa } = body

    // If numero is changing, check for duplicates
    if (numero !== undefined && Number(numero) !== existing.numero) {
      const dup = await db.mesa.findUnique({
        where: { negocioId_numero: { negocioId, numero: Number(numero) } },
      })
      if (dup) {
        return NextResponse.json(
          { error: `Ya existe una mesa con el número ${numero}` },
          { status: 409 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (numero !== undefined) updateData.numero = Number(numero)
    if (nombre !== undefined) updateData.nombre = nombre
    if (capacidad !== undefined) updateData.capacidad = Number(capacidad)
    if (forma !== undefined) updateData.forma = forma
    if (zona !== undefined) updateData.zona = zona
    if (activa !== undefined) updateData.activa = Boolean(activa)

    const updated = await db.mesa.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating mesa:", error)
    return NextResponse.json(
      { error: "Error al actualizar mesa" },
      { status: 500 }
    )
  }
}

// DELETE - Delete mesa
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const { id } = await params

    // Verify ownership
    const existing = await db.mesa.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Mesa no encontrada" },
        { status: 404 }
      )
    }

    await db.mesa.delete({ where: { id } })

    return NextResponse.json({ ok: true, message: "Mesa eliminada" })
  } catch (error) {
    console.error("Error deleting mesa:", error)
    return NextResponse.json(
      { error: "Error al eliminar mesa" },
      { status: 500 }
    )
  }
}
