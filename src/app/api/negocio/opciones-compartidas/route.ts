import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET - List opciones compartidas for negocio
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

    const opciones = await db.opcionesCompartidas.findMany({
      where: { negocioId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ data: opciones })
  } catch (error) {
    console.error("Error listing opciones compartidas:", error)
    return NextResponse.json(
      { error: "Error al obtener opciones compartidas" },
      { status: 500 }
    )
  }
}

// POST - Create opcion compartida
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
    const { nombre, opciones, obligatorio, maximo } = body

    if (!nombre?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    const opcionCompartida = await db.opcionesCompartidas.create({
      data: {
        nombre: nombre.trim(),
        opciones: JSON.stringify(opciones || []),
        obligatorio: obligatorio ?? false,
        maximo: maximo ?? 0,
        negocioId,
      },
    })

    return NextResponse.json({ data: opcionCompartida }, { status: 201 })
  } catch (error) {
    console.error("Error creating opcion compartida:", error)
    return NextResponse.json(
      { error: "Error al crear opción compartida" },
      { status: 500 }
    )
  }
}
