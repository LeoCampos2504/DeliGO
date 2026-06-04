import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET - List associated negocios
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const asociaciones = await db.repartidorNegocio.findMany({
      where: { repartidorId: user.id },
      include: {
        negocio: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            logoUrl: true,
            ofreceDelivery: true,
            suspendido: true,
          },
        },
      },
      orderBy: { fechaAsociacion: "desc" },
    })

    return NextResponse.json({
      negocios: asociaciones.map((a) => ({
        id: a.id,
        negocioId: a.negocioId,
        negocioSlug: a.negocioSlug,
        negocioNombre: a.negocioNombre,
        negocioLogoUrl: a.negocioLogoUrl,
        codigoAcceso: a.codigoAcceso,
        fechaAsociacion: a.fechaAsociacion,
        negocio: a.negocio,
      })),
    })
  } catch (error) {
    console.error("Error listing repartidor negocios:", error)
    return NextResponse.json({ error: "Error al obtener negocios" }, { status: 500 })
  }
}

// POST - Add negocio by code
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const body = await req.json()
    const { codigo } = body

    if (!codigo?.trim()) {
      return NextResponse.json(
        { error: "Ingresá el código de acceso" },
        { status: 400 }
      )
    }

    const codigoTrimmed = codigo.trim().toUpperCase()

    // Find negocio by repartidor code
    const negocio = await db.negocio.findFirst({
      where: { repartidorCodigo: codigoTrimmed },
    })

    if (!negocio) {
      return NextResponse.json(
        { error: "Código no válido. Verificá con el local." },
        { status: 404 }
      )
    }

    if (!negocio.aprobado) {
      return NextResponse.json(
        { error: "Este local aún no está aprobado" },
        { status: 400 }
      )
    }

    if (negocio.suspendido) {
      return NextResponse.json(
        { error: "Este local está suspendido" },
        { status: 400 }
      )
    }

    if (!negocio.ofreceDelivery) {
      return NextResponse.json(
        { error: "Este local no ofrece delivery" },
        { status: 400 }
      )
    }

    // Check if already associated
    const existing = await db.repartidorNegocio.findUnique({
      where: {
        repartidorId_negocioId: {
          repartidorId: user.id,
          negocioId: negocio.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Ya estás asociado a este local" },
        { status: 400 }
      )
    }

    // Create association
    const asociacion = await db.repartidorNegocio.create({
      data: {
        repartidorId: user.id,
        negocioId: negocio.id,
        negocioSlug: negocio.slug,
        negocioNombre: negocio.nombre,
        negocioLogoUrl: negocio.logoUrl,
        codigoAcceso: codigoTrimmed,
      },
    })

    return NextResponse.json({
      ok: true,
      negocio: {
        id: asociacion.id,
        negocioId: negocio.id,
        negocioSlug: negocio.slug,
        negocioNombre: negocio.nombre,
        negocioLogoUrl: negocio.logoUrl,
        codigoAcceso: codigoTrimmed,
        fechaAsociacion: asociacion.fechaAsociacion,
      },
    })
  } catch (error) {
    console.error("Error adding negocio:", error)
    return NextResponse.json({ error: "Error al asociar negocio" }, { status: 500 })
  }
}

// DELETE - Remove negocio association
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const body = await req.json()
    const { negocioId } = body

    if (!negocioId) {
      return NextResponse.json(
        { error: "negocioId es obligatorio" },
        { status: 400 }
      )
    }

    // Verify the association exists and belongs to this repartidor
    const asociacion = await db.repartidorNegocio.findUnique({
      where: {
        repartidorId_negocioId: {
          repartidorId: user.id,
          negocioId,
        },
      },
    })

    if (!asociacion) {
      return NextResponse.json(
        { error: "No estás asociado a este local" },
        { status: 404 }
      )
    }

    await db.repartidorNegocio.delete({
      where: { id: asociacion.id },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error removing negocio:", error)
    return NextResponse.json({ error: "Error al desasociar negocio" }, { status: 500 })
  }
}
