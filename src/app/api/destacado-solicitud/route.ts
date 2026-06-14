import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

const PRECIO_DIA = 500
const PRECIO_MES = 10000

// Descuentos por volumen
const DESCUENTOS_POR_MES: Record<number, number> = {
  3: 25000,  // 3 meses: $25.000 en vez de $30.000 (17% off)
  6: 45000,  // 6 meses: $45.000 en vez de $60.000 (25% off)
}

function calcularPrecio(meses: number, dias: number): number {
  if (DESCUENTOS_POR_MES[meses] && dias === 0) {
    return DESCUENTOS_POR_MES[meses]
  }
  return meses * PRECIO_MES + dias * PRECIO_DIA
}

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

    const body = await req.json()
    const { meses, dias } = body

    const mesesNum = Number(meses) || 0
    const diasNum = Number(dias) || 0

    if (mesesNum < 0 || diasNum < 0) {
      return NextResponse.json({ error: "Valores inválidos" }, { status: 400 })
    }

    if (mesesNum === 0 && diasNum === 0) {
      return NextResponse.json({ error: "Seleccioná al menos 1 día o 1 mes" }, { status: 400 })
    }

    const precio = calcularPrecio(mesesNum, diasNum)

    // Check if there's already a pending solicitud for this negocio
    const existingPending = await db.destacadoSolicitud.findFirst({
      where: { negocioId: user.id, estado: "pendiente" },
    })

    if (existingPending) {
      return NextResponse.json(
        { error: "Ya tenés una solicitud pendiente. Esperá a que sea procesada." },
        { status: 400 }
      )
    }

    const solicitud = await db.destacadoSolicitud.create({
      data: {
        negocioId: user.id,
        meses: mesesNum,
        dias: diasNum,
        precio,
        estado: "pendiente",
      },
    })

    return NextResponse.json({ solicitud }, { status: 201 })
  } catch (error) {
    console.error("Error creating destacado solicitud:", error)
    return NextResponse.json(
      { error: "Error al crear solicitud" },
      { status: 500 }
    )
  }
}

// GET - Get solicitudes for the current negocio
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

    const solicitudes = await db.destacadoSolicitud.findMany({
      where: { negocioId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    return NextResponse.json({ solicitudes })
  } catch (error) {
    console.error("Error getting destacado solicitudes:", error)
    return NextResponse.json(
      { error: "Error al obtener solicitudes" },
      { status: 500 }
    )
  }
}
