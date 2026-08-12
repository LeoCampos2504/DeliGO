import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

// Seguridad-6B.4: reseñas del negocio (comentarios y datos del cliente que las escribió) — nunca cacheables.
function noStoreJson<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json(data, init)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

// GET - List reviews for the negocio with pagination
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return noStoreJson({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return noStoreJson({ error: "Acceso denegado" }, { status: 403 })
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
        select: {
          id: true,
          clienteNombre: true,
          puntuacion: true,
          comentario: true,
          rapidez: true,
          calidad: true,
          precio: true,
          respuestaNegocio: true,
          fechaRespuesta: true,
          fecha: true,
          estadoModeracion: true,
          solicitudesRevision: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              id: true,
              estado: true,
              motivo: true,
              venceEn: true,
              resueltaEn: true,
              motivoDecision: true,
            },
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

    return noStoreJson({
      resenas: resenas.map(({ solicitudesRevision, ...resena }) => ({
        ...resena,
        moderacion: solicitudesRevision[0] ?? null,
      })),
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
    console.error("Error listing resenas:", safeErrorForLog(error))
    return noStoreJson(
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
      return noStoreJson({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return noStoreJson({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const body = await req.json()
    const { resenaId, respuesta } = body

    if (!resenaId) {
      return noStoreJson(
        { error: "resenaId es obligatorio" },
        { status: 400 }
      )
    }

    if (!respuesta?.trim()) {
      return noStoreJson(
        { error: "respuesta es obligatoria" },
        { status: 400 }
      )
    }

    // Get the review
    const resena = await db.resena.findUnique({
      where: { id: resenaId },
    })

    if (!resena || resena.negocioId !== negocioId) {
      return noStoreJson(
        { error: "Reseña no encontrada" },
        { status: 404 }
      )
    }

    // Check if already replied
    if (resena.respuestaNegocio) {
      return noStoreJson(
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

    return noStoreJson(updated)
  } catch (error) {
    console.error("Error replying to resena:", safeErrorForLog(error))
    return noStoreJson(
      { error: "Error al responder reseña" },
      { status: 500 }
    )
  }
}
