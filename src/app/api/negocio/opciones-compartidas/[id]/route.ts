import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { validateSharedOptionPayload } from "@/lib/shared-options-server"

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

    const validPayload = validateSharedOptionPayload({ opciones, obligatorio, maximo })
    if (!validPayload.ok) {
      return NextResponse.json({ error: validPayload.error }, { status: 400 })
    }
    if (nombre !== undefined && (typeof nombre !== "string" || !nombre.trim())) {
      return NextResponse.json({ error: "El nombre debe ser válido" }, { status: 400 })
    }

    const updated = await db.opcionesCompartidas.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(opciones !== undefined && { opciones: JSON.stringify(validPayload.opciones) }),
        ...(obligatorio !== undefined && { obligatorio: validPayload.obligatorio }),
        ...(maximo !== undefined && { maximo: validPayload.maximo }),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error("Error updating opcion compartida:", safeErrorForLog(error))
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

    const deleted = await db.$transaction(async (tx) => {
      const existing = await tx.opcionesCompartidas.findFirst({
        where: { id, negocioId: user.id },
        select: { id: true },
      })
      if (!existing) return false

      // Parse every in-scope product before changing anything. A malformed
      // JSON field fails closed and rolls back the whole delete instead of
      // leaving a dangling reference behind.
      const productos = await tx.producto.findMany({
        where: { negocioId: user.id },
        select: { id: true, opcionesCompartidasIds: true },
      })
      const updates: Array<{ productId: string; value: string }> = []
      for (const prod of productos) {
        let parsed: unknown
        try {
          parsed = JSON.parse(prod.opcionesCompartidasIds || "[]")
        } catch {
          throw new Error("Producto con referencias de opciones compartidas invalidas")
        }
        if (!Array.isArray(parsed)) {
          throw new Error("Producto con referencias de opciones compartidas invalidas")
        }

        const updated = parsed.filter((item: unknown) =>
          typeof item === "string" ? item !== id : (item as { id?: string })?.id !== id
        )
        if (updated.length !== parsed.length) {
          updates.push({ productId: prod.id, value: JSON.stringify(updated) })
        }
      }

      await tx.opcionesCompartidas.delete({ where: { id } })
      for (const update of updates) {
        await tx.producto.update({
          where: { id: update.productId },
          data: { opcionesCompartidasIds: update.value },
        })
      }
      return true
    })

    if (!deleted) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error deleting opcion compartida:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al eliminar opción compartida" },
      { status: 500 }
    )
  }
}
