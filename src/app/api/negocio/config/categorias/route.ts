import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

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

// PATCH - Rename a category (updates config + all ingredientes/agregados with the old name)
export async function PATCH(req: NextRequest) {
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
    const body = await req.json()
    const { tipo, oldName, newName } = body

    if (!tipo || (tipo !== "ingredientes" && tipo !== "agregados")) {
      return NextResponse.json(
        { error: "tipo debe ser 'ingredientes' o 'agregados'" },
        { status: 400 }
      )
    }

    if (!oldName || typeof oldName !== "string" || !newName || typeof newName !== "string") {
      return NextResponse.json(
        { error: "oldName y newName son requeridos y deben ser strings" },
        { status: 400 }
      )
    }

    const trimmedNew = newName.trim()
    if (!trimmedNew) {
      return NextResponse.json(
        { error: "El nuevo nombre no puede estar vacío" },
        { status: 400 }
      )
    }

    // Update all items with the old category name
    let updateResult
    if (tipo === "ingredientes") {
      updateResult = await db.ingrediente.updateMany({
        where: {
          negocioId,
          categoria: oldName,
        },
        data: {
          categoria: trimmedNew,
        },
      })
    } else {
      updateResult = await db.agregado.updateMany({
        where: {
          negocioId,
          categoria: oldName,
        },
        data: {
          categoria: trimmedNew,
        },
      })
    }

    // Update the categorias config array
    const configField = tipo === "ingredientes" ? "ingredientesCategorias" : "agregadosCategorias"
    const negocio = await db.negocio.findUnique({
      where: { id: negocioId },
      select: { [configField]: true },
    })

    if (negocio) {
      const currentCategorias: string[] = safeParseJSON(
        (negocio as Record<string, unknown>)[configField],
        []
      )
      const updatedCategorias = currentCategorias.map((c) =>
        c === oldName ? trimmedNew : c
      )
      await db.negocio.update({
        where: { id: negocioId },
        data: {
          [configField]: JSON.stringify(updatedCategorias),
        },
      })
    }

    return NextResponse.json({
      success: true,
      itemsUpdated: updateResult.count,
    })
  } catch (error) {
    console.error("Error renaming categoria:", error)
    return NextResponse.json(
      { error: "Error al renombrar la categoría" },
      { status: 500 }
    )
  }
}
