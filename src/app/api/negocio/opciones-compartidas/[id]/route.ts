import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// PUT - Update opcion compartida
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

    const { id } = await params
    const body = await req.json()
    const { nombre, opciones, obligatorio, maximo } = body

    // Verify ownership
    const existing = await db.opcionesCompartidas.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== user.id) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }

    const updated = await db.opcionesCompartidas.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(opciones !== undefined && { opciones: JSON.stringify(opciones) }),
        ...(obligatorio !== undefined && { obligatorio }),
        ...(maximo !== undefined && { maximo }),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating opcion compartida:", error)
    return NextResponse.json(
      { error: "Error al actualizar opción compartida" },
      { status: 500 }
    )
  }
}

// DELETE - Delete opcion compartida
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

    const { id } = await params

    // Verify ownership
    const existing = await db.opcionesCompartidas.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== user.id) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }

    await db.opcionesCompartidas.delete({ where: { id } })

    // Also remove this ID from all products that reference it
    const productos = await db.producto.findMany({
      where: { negocioId: user.id },
      select: { id: true, opcionesCompartidasIds: true },
    })

    for (const prod of productos) {
      try {
        const parsed: unknown[] = JSON.parse(prod.opcionesCompartidasIds || "[]")
        // Handle both old format (string[]) and new format ({id, obligatorio, maximo}[])
        const needsUpdate = parsed.some((item: unknown) =>
          typeof item === "string" ? item === id : (item as { id?: string })?.id === id
        )
        if (needsUpdate) {
          const updated = parsed.filter((item: unknown) =>
            typeof item === "string" ? item !== id : (item as { id?: string })?.id !== id
          )
          await db.producto.update({
            where: { id: prod.id },
            data: { opcionesCompartidasIds: JSON.stringify(updated) },
          })
        }
      } catch {
        // Skip if JSON parse fails
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting opcion compartida:", error)
    return NextResponse.json(
      { error: "Error al eliminar opción compartida" },
      { status: 500 }
    )
  }
}
