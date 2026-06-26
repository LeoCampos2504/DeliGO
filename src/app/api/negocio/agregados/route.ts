import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { validateOptionalImageUrl } from "@/lib/resource-url"

// GET - List agregados for negocio
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

    const agregados = await db.agregado.findMany({
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

    return NextResponse.json(agregados)
  } catch (error) {
    console.error("Error listing agregados:", error)
    return NextResponse.json(
      { error: "Error al obtener agregados" },
      { status: 500 }
    )
  }
}

// POST - Create agregado
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
    const { nombre, precio, categoria, imagenUrl } = body

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

    const agregado = await db.agregado.create({
      data: {
        nombre: nombre.trim(),
        precio: precio || 0,
        categoria: categoria || "",
        imagenUrl: validImagenUrl.value,
        negocioId,
      },
    })

    return NextResponse.json(agregado, { status: 201 })
  } catch (error) {
    console.error("Error creating agregado:", error)
    return NextResponse.json(
      { error: "Error al crear agregado" },
      { status: 500 }
    )
  }
}
