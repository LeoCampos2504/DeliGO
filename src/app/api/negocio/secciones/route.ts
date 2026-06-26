import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { readStringIdList, validateNegocioResourceOwnership } from "@/lib/access-control"

// GET - List secciones for negocio
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

    const secciones = await db.seccionCatalogo.findMany({
      where: { negocioId },
      include: {
        productos: {
          include: {
            producto: {
              select: { id: true, nombre: true, imagenUrl: true, precio: true },
            },
          },
          orderBy: { orden: "asc" },
        },
      },
      orderBy: { orden: "asc" },
    })

    return NextResponse.json(secciones)
  } catch (error) {
    console.error("Error listing secciones:", error)
    return NextResponse.json(
      { error: "Error al obtener secciones" },
      { status: 500 }
    )
  }
}

// POST - Create seccion
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
    const { nombre, orientacion, orden, color, productoIds } = body

    if (!nombre?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    const validProductoIds = readStringIdList(productoIds, "productoIds")
    if (!validProductoIds.ok) {
      return NextResponse.json({ error: validProductoIds.error }, { status: 400 })
    }

    const ownsProductos = await validateNegocioResourceOwnership(negocioId, {
      productos: validProductoIds.ids,
    })
    if (!ownsProductos) {
      return NextResponse.json({ error: "Sin acceso a este recurso" }, { status: 403 })
    }

    const seccion = await db.seccionCatalogo.create({
      data: {
        nombre: nombre.trim(),
        orientacion: orientacion || "vertical",
        orden: orden || 0,
        color: color || "",
        negocioId,
      },
    })

    // If productoIds is provided, create junction records
    if (validProductoIds.ids.length > 0) {
      await db.seccionProducto.createMany({
        data: validProductoIds.ids.map((productoId, index) => ({
          seccionId: seccion.id,
          productoId,
          orden: index,
        })),
      })
    }

    // Return the created seccion with products
    const seccionWithProducts = await db.seccionCatalogo.findUnique({
      where: { id: seccion.id },
      include: {
        productos: {
          include: {
            producto: {
              select: { id: true, nombre: true, imagenUrl: true, precio: true, categoria: true },
            },
          },
          orderBy: { orden: "asc" },
        },
      },
    })

    return NextResponse.json(seccionWithProducts, { status: 201 })
  } catch (error) {
    console.error("Error creating seccion:", error)
    return NextResponse.json(
      { error: "Error al crear sección" },
      { status: 500 }
    )
  }
}
