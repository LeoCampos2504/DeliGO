import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET - List reviews for the negocio with pagination
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
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "20", 10)
    const filter = searchParams.get("filter") || "todas"

    const where: Record<string, unknown> = { negocioId }

    // Filter by reply status
    if (filter === "sin_respuesta") {
      where.respuestaNegocio = null
    } else if (filter === "con_respuesta") {
      where.respuestaNegocio = { not: null }
    }

    const skip = (page - 1) * limit

    const [resenas, filteredTotal, allTotal, stats, distribucion, sinRespuestaCount] = await Promise.all([
      db.resena.findMany({
        where,
        include: {
          cliente: {
            select: { id: true, nombre: true },
          },
          pedido: {
            select: { id: true, negocioNombre: true, fecha: true },
          },
        },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      // Total matching the filter (for pagination)
      db.resena.count({ where }),
      // Total of ALL reviews (for stats overview)
      db.resena.count({ where: { negocioId } }),
      // Average rating (always across all reviews)
      db.resena.aggregate({
        where: { negocioId },
        _avg: {
          puntuacion: true,
          rapidez: true,
          calidad: true,
          precio: true,
        },
      }),
      // Rating distribution (1-5 stars, always across all reviews)
      Promise.all(
        [1, 2, 3, 4, 5].map((star) =>
          db.resena.count({
            where: { negocioId, puntuacion: star },
          }).then((count) => ({ star, count }))
        )
      ),
      // Count of unanswered reviews (always across all reviews)
      db.resena.count({ where: { negocioId, respuestaNegocio: null } }),
    ])

    return NextResponse.json({
      resenas,
      stats: {
        promedio: stats._avg.puntuacion ?? 0,
        rapidez: stats._avg.rapidez ?? 0,
        calidad: stats._avg.calidad ?? 0,
        precio: stats._avg.precio ?? 0,
        total: allTotal,
        sinRespuesta: sinRespuestaCount,
        distribucion: distribucion.reduce(
          (acc, d) => {
            acc[d.star] = d.count
            return acc
          },
          {} as Record<number, number>
        ),
      },
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit),
      },
    })
  } catch (error) {
    console.error("Error listing resenas:", error)
    return NextResponse.json(
      { error: "Error al obtener reseñas" },
      { status: 500 }
    )
  }
}

// PATCH - Reply to a review
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
    const { resenaId, respuesta } = body

    if (!resenaId) {
      return NextResponse.json(
        { error: "resenaId es obligatorio" },
        { status: 400 }
      )
    }

    if (!respuesta?.trim()) {
      return NextResponse.json(
        { error: "respuesta es obligatoria" },
        { status: 400 }
      )
    }

    // Get the review
    const resena = await db.resena.findUnique({
      where: { id: resenaId },
    })

    if (!resena || resena.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Reseña no encontrada" },
        { status: 404 }
      )
    }

    // Check if already replied
    if (resena.respuestaNegocio) {
      return NextResponse.json(
        { error: "Esta reseña ya tiene una respuesta" },
        { status: 400 }
      )
    }

    // Update the review with the business reply
    const updated = await db.resena.update({
      where: { id: resenaId },
      data: {
        respuestaNegocio: respuesta.trim(),
        fechaRespuesta: new Date(),
      },
      include: {
        cliente: {
          select: { id: true, nombre: true },
        },
        pedido: {
          select: { id: true, negocioNombre: true, fecha: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error replying to resena:", error)
    return NextResponse.json(
      { error: "Error al responder reseña" },
      { status: 500 }
    )
  }
}
