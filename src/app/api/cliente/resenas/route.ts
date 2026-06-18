import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { createNotification, newReviewNotification, empleadosNewReviewNotification } from "@/lib/push"

// POST /api/cliente/resenas — Create a review for a delivered order
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "cliente") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    // Rate limit reviews
    const ip = getClientIp(req)
    const rl = checkRateLimit("review", `${ip}:${user.id}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl, "Estás enviando muchas reseñas. Esperá un momento.")
    }

    const body = await req.json()
    const { pedidoId, comentario, rapidez, calidad, precio } = body

    // Validate required fields
    if (!pedidoId) {
      return NextResponse.json({ error: "pedidoId es obligatorio" }, { status: 400 })
    }

    // All 3 sub-ratings are required
    if (!rapidez || rapidez < 1 || rapidez > 5) {
      return NextResponse.json(
        { error: "La puntuación de rapidez es obligatoria (1-5)" },
        { status: 400 }
      )
    }
    if (!calidad || calidad < 1 || calidad > 5) {
      return NextResponse.json(
        { error: "La puntuación de calidad es obligatoria (1-5)" },
        { status: 400 }
      )
    }
    if (!precio || precio < 1 || precio > 5) {
      return NextResponse.json(
        { error: "La puntuación de precio es obligatoria (1-5)" },
        { status: 400 }
      )
    }

    // Calculate overall rating as average of the 3 sub-ratings
    const puntuacion = Math.round((rapidez + calidad + precio) / 3)

    // Check if the order exists and belongs to this client
    const pedido = await db.pedido.findUnique({
      where: { id: pedidoId },
      include: { resena: true },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    if (pedido.clienteId !== user.id) {
      return NextResponse.json({ error: "Este pedido no te pertenece" }, { status: 403 })
    }

    // Only allow reviews for delivered orders
    if (pedido.estado !== "entregado") {
      return NextResponse.json(
        { error: "Solo podés reseñar pedidos entregados" },
        { status: 400 }
      )
    }

    // Check if already reviewed
    if (pedido.resena) {
      return NextResponse.json(
        { error: "Ya dejaste una reseña para este pedido" },
        { status: 400 }
      )
    }

    // Sanitize comment
    const sanitizedComment = (comentario || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .trim()
      .slice(0, 500) // Max 500 chars

    // Create the review
    const resena = await db.resena.create({
      data: {
        negocioId: pedido.negocioId,
        clienteId: user.id,
        clienteNombre: user.nombre,
        pedidoId,
        puntuacion,
        comentario: sanitizedComment,
        rapidez: Math.round(rapidez),
        calidad: Math.round(calidad),
        precio: Math.round(precio),
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
        pedido: { select: { id: true, negocioNombre: true, fecha: true } },
      },
    })

    // Update negocio rating cache
    await updateNegocioRating(pedido.negocioId)

    // Send push notification to the negocio about the new review
    try {
      const negocioData = await db.negocio.findUnique({
        where: { id: pedido.negocioId },
        select: { pushSubscription: true, nombre: true, pushSubscriptionEmpleados: true },
      })
      const notification = newReviewNotification(
        negocioData?.nombre ?? "",
        Math.round(puntuacion),
        user.nombre
      )
      await createNotification({
        userId: pedido.negocioId,
        userType: "negocio",
        tipo: "review",
        titulo: notification.title,
        cuerpo: notification.body,
        pedidoId: pedidoId,
        negocioId: pedido.negocioId,
        pushSubscription: negocioData?.pushSubscription ?? null,
        pushPayload: notification,
        cleanupExpired: { model: "negocio", id: pedido.negocioId },
      })

      // Also notify the shared empleados PWA (/e/[token]) — that's the panel
      // where employees triage incoming reviews. The subscription lives on
      // Negocio.pushSubscriptionEmpleados, separate from the owner's personal
      // subscription handled above.
      if (negocioData?.pushSubscriptionEmpleados) {
        const empleadosPayload = empleadosNewReviewNotification(
          pedidoId,
          negocioData.nombre ?? "",
          Math.round(puntuacion),
          user.nombre
        )
        await createNotification({
          userId: pedido.negocioId,
          userType: "negocio", // stored on Negocio row; empleados PWA reads via token
          tipo: "empleados_new_review",
          titulo: empleadosPayload.title,
          cuerpo: empleadosPayload.body,
          pedidoId: pedidoId,
          negocioId: pedido.negocioId,
          pushSubscription: negocioData.pushSubscriptionEmpleados,
          pushPayload: empleadosPayload,
          cleanupExpired: { model: "negocio", id: pedido.negocioId, field: "pushSubscriptionEmpleados" },
        })
      }
    } catch (pushError) {
      console.error("[Push] Failed to send review notification:", pushError)
    }

    return NextResponse.json(resena, { status: 201 })
  } catch (error) {
    console.error("Error creating resena:", error)
    return NextResponse.json(
      { error: "Error al crear la reseña" },
      { status: 500 }
    )
  }
}

// Helper: Recalculate negocio rating cache
async function updateNegocioRating(negocioId: string) {
  const stats = await db.resena.aggregate({
    where: { negocioId },
    _avg: { puntuacion: true },
    _count: true,
  })

  await db.negocio.update({
    where: { id: negocioId },
    data: {
      puntuacionPromedio: stats._avg.puntuacion ?? 0,
      totalResenas: stats._count,
    },
  })
}
