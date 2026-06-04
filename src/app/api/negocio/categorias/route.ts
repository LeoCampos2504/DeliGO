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

// GET - Get negocio categories
export async function GET(req: NextRequest) {
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

    const negocio = await db.negocio.findUnique({
      where: { id: negocioId },
      select: { categorias: true },
    })

    if (!negocio) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 }
      )
    }

    const categorias = safeParseJSON(negocio.categorias, [])

    return NextResponse.json({ categorias })
  } catch (error) {
    console.error("Error getting categorias:", error)
    return NextResponse.json(
      { error: "Error al obtener categorías" },
      { status: 500 }
    )
  }
}

// PUT - Update categories (full replacement)
export async function PUT(req: NextRequest) {
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
    const { categorias } = body

    if (!Array.isArray(categorias)) {
      return NextResponse.json(
        { error: "categorias debe ser un array de strings" },
        { status: 400 }
      )
    }

    // Validate all items are strings
    if (!categorias.every((c: unknown) => typeof c === "string")) {
      return NextResponse.json(
        { error: "Todas las categorías deben ser strings" },
        { status: 400 }
      )
    }

    // Get current categories to find deleted ones
    const negocio = await db.negocio.findUnique({
      where: { id: negocioId },
      select: { categorias: true },
    })

    if (!negocio) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 }
      )
    }

    const currentCategorias: string[] = safeParseJSON(negocio.categorias, [])

    // Find categories that were deleted
    const deletedCategorias = currentCategorias.filter(
      (c) => !categorias.includes(c)
    )

    // Move products in deleted categories to "Sin Categoria"
    if (deletedCategorias.length > 0) {
      await db.producto.updateMany({
        where: {
          negocioId,
          categoria: { in: deletedCategorias },
        },
        data: {
          categoria: "Sin Categoria",
        },
      })
    }

    // Save updated categories
    const updated = await db.negocio.update({
      where: { id: negocioId },
      data: {
        categorias: JSON.stringify(categorias),
      },
    })

    return NextResponse.json({
      categorias: safeParseJSON(updated.categorias, []),
    })
  } catch (error) {
    console.error("Error updating categorias:", error)
    return NextResponse.json(
      { error: "Error al actualizar categorías" },
      { status: 500 }
    )
  }
}

// PATCH - Rename a category (updates config + all products with the old name)
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
    const { oldName, newName } = body

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

    // Update all products with the old category name
    const updateResult = await db.producto.updateMany({
      where: {
        negocioId,
        categoria: oldName,
      },
      data: {
        categoria: trimmedNew,
      },
    })

    // Update the categorias config array
    const negocio = await db.negocio.findUnique({
      where: { id: negocioId },
      select: { categorias: true },
    })

    if (negocio) {
      const currentCategorias: string[] = safeParseJSON(negocio.categorias, [])
      const updatedCategorias = currentCategorias.map((c) =>
        c === oldName ? trimmedNew : c
      )
      await db.negocio.update({
        where: { id: negocioId },
        data: {
          categorias: JSON.stringify(updatedCategorias),
        },
      })
    }

    return NextResponse.json({
      success: true,
      productsUpdated: updateResult.count,
    })
  } catch (error) {
    console.error("Error renaming categoria:", error)
    return NextResponse.json(
      { error: "Error al renombrar la categoría" },
      { status: 500 }
    )
  }
}
