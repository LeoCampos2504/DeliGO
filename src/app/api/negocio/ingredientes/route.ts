import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { validateOptionalImageUrl } from "@/lib/resource-url"

// GET - List ingredientes for negocio
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

    const ingredientes = await db.ingrediente.findMany({
      where: { negocioId },
      include: {
        productos: {
          include: {
            producto: {
              select: { id: true, nombre: true },
            },
          },
        },
      },
      orderBy: { categoria: "asc" },
    })

    return NextResponse.json(ingredientes)
  } catch (error) {
    console.error("Error listing ingredientes:", error)
    return NextResponse.json(
      { error: "Error al obtener ingredientes" },
      { status: 500 }
    )
  }
}

// POST - Create ingrediente
export async function POST(req: NextRequest) {
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
    const { nombre, categoria, imagenUrl } = body

    if (!nombre?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    const validImagenUrl = validateOptionalImageUrl(imagenUrl)
    if (!validImagenUrl.ok) {
      return NextResponse.json({ error: validImagenUrl.error }, { status: 400 })
    }

    const ingrediente = await db.ingrediente.create({
      data: {
        nombre: nombre.trim(),
        categoria: categoria || "",
        imagenUrl: validImagenUrl.value,
        negocioId,
      },
    })

    return NextResponse.json(ingrediente, { status: 201 })
  } catch (error) {
    console.error("Error creating ingrediente:", error)
    return NextResponse.json(
      { error: "Error al crear ingrediente" },
      { status: 500 }
    )
  }
}
