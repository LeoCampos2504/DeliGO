import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET - List mesas for negocio
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

    const mesas = await db.mesa.findMany({
      where: { negocioId },
      orderBy: { numero: "asc" },
      include: {
        empleado: {
          select: { id: true, nombre: true, codigo: true },
        },
      },
    })

    return NextResponse.json(mesas)
  } catch (error) {
    console.error("Error listing mesas:", error)
    return NextResponse.json(
      { error: "Error al obtener mesas" },
      { status: 500 }
    )
  }
}

// POST - Create mesa
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
    const { numero, nombre, zona, capacidad, activa } = body

    if (numero === undefined || numero === null) {
      return NextResponse.json(
        { error: "El número de mesa es obligatorio" },
        { status: 400 }
      )
    }

    // Check for duplicate numero within negocio
    const existing = await db.mesa.findUnique({
      where: { negocioId_numero: { negocioId, numero: Number(numero) } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe una mesa con el número ${numero}` },
        { status: 409 }
      )
    }

    const mesa = await db.mesa.create({
      data: {
        numero: Number(numero),
        nombre: nombre || "",
        zona: zona || "",
        capacidad: Number(capacidad) || 4,
        activa: activa !== undefined ? Boolean(activa) : true,
        negocioId,
      },
    })

    return NextResponse.json(mesa, { status: 201 })
  } catch (error) {
    console.error("Error creating mesa:", error)
    return NextResponse.json(
      { error: "Error al crear mesa" },
      { status: 500 }
    )
  }
}
