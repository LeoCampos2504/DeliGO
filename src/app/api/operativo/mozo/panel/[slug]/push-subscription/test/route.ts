import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  noStore,
  resolveOperativoMozoForSlug,
} from "@/lib/operativo-mozo"
import { sendPushNotification, type PushNotificationPayload } from "@/lib/push"
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit"

const TEST_PUSH_WINDOW_MS = 10 * 60 * 1000
const TEST_PUSH_MAX_ATTEMPTS = 3
const TEST_PUSH_AUDIT_ACTION = "mozo.push_test"

function authErrorResponse(auth: { status: 401 | 403; state: string; clearSession?: boolean }) {
  const response = NextResponse.json(
    {
      ok: false,
      estado: auth.state,
      error: auth.status === 401 ? "No autenticado" : "Acceso no disponible",
    },
    { status: auth.status }
  )
  if (auth.clearSession) {
    response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
  }
  return noStore(response)
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
}

function shortId(value: string | null | undefined) {
  if (!value) return null
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`
}

async function recordPersistentAttempt({
  cuentaOperativaId,
  empleadoId,
  negocioId,
  slug,
}: {
  cuentaOperativaId: string
  empleadoId: string
  negocioId: string
  slug: string
}) {
  const windowStart = new Date(Date.now() - TEST_PUSH_WINDOW_MS)

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.$transaction(
        async (tx) => {
          const attempts = await tx.auditLog.count({
            where: {
              userId: cuentaOperativaId,
              userType: "cuenta_operativa",
              accion: TEST_PUSH_AUDIT_ACTION,
              recurso: "negocio",
              recursoId: negocioId,
              fecha: { gte: windowStart },
            },
          })

          if (attempts >= TEST_PUSH_MAX_ATTEMPTS) {
            return { allowed: false }
          }

          await tx.auditLog.create({
            data: {
              userId: cuentaOperativaId,
              userType: "cuenta_operativa",
              accion: TEST_PUSH_AUDIT_ACTION,
              recurso: "negocio",
              recursoId: negocioId,
              detalle: JSON.stringify({
                slug,
                empleadoId: shortId(empleadoId),
              }),
            },
          })

          return { allowed: true }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      if (isSerializationConflict(error) && attempt < 3) continue
      throw error
    }
  }

  return { allowed: false }
}

function rateLimitedResponse(retryAfterMs?: number) {
  return noStore(
    rateLimitResponse(
      { retryAfterMs },
      "Demasiadas pruebas. Intentá de nuevo más tarde."
    )
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoMozoForSlug(req, slug)
    if (!auth.ok) return authErrorResponse(auth)

    const memoryLimit = checkRateLimit(
      "mozoPushTest",
      `${auth.cuenta.id}:${auth.negocio.slug}`
    )
    if (!memoryLimit.allowed) {
      return rateLimitedResponse(memoryLimit.retryAfterMs)
    }

    const persistentLimit = await recordPersistentAttempt({
      cuentaOperativaId: auth.cuenta.id,
      empleadoId: auth.empleado.id,
      negocioId: auth.negocio.id,
      slug: auth.negocio.slug,
    })
    if (!persistentLimit.allowed) {
      return rateLimitedResponse(TEST_PUSH_WINDOW_MS)
    }

    const empleado = await db.empleado.findFirst({
      where: {
        id: auth.empleado.id,
        negocioId: auth.negocio.id,
        cuentaOperativaId: auth.cuenta.id,
        rol: "mozo",
        activo: true,
        eliminado: false,
      },
      select: {
        id: true,
        pushSubscription: true,
      },
    })

    if (!empleado) {
      return noStore(
        NextResponse.json(
          { ok: false, error: "Acceso no disponible" },
          { status: 403 }
        )
      )
    }

    if (!empleado.pushSubscription) {
      return noStore(
        NextResponse.json({
          ok: false,
          code: "NO_SUBSCRIPTION",
        })
      )
    }

    let expired = false
    const payload: PushNotificationPayload = {
      title: "Prueba de avisos DeliGO",
      body: "Vas a recibir avisos cuando una mesa tenga un pedido listo.",
      tag: "mozo-push-test",
      data: {
        type: "mesa_order_ready",
        url: `/mozo/panel/${encodeURIComponent(auth.negocio.slug)}`,
        test: true,
      },
      requireInteraction: true,
    }

    const delivered = await sendPushNotification(
      empleado.pushSubscription,
      payload,
      {
        model: "empleado",
        id: empleado.id,
        suppressEndpointLog: true,
        onExpired: () => {
          expired = true
          console.info("[MozoPushTest] subscription_expired", {
            empleadoId: shortId(empleado.id),
            negocioId: shortId(auth.negocio.id),
          })
        },
      }
    )

    if (!delivered) {
      console.info("[MozoPushTest] delivery_failed", {
        empleadoId: shortId(empleado.id),
        negocioId: shortId(auth.negocio.id),
        expired,
      })
      return noStore(
        NextResponse.json({
          ok: false,
          code: "DELIVERY_FAILED",
        })
      )
    }

    return noStore(
      NextResponse.json({
        ok: true,
        delivered: true,
      })
    )
  } catch (error) {
    console.error("[MozoPushTest] Error sending test push", {
      errorName: error instanceof Error ? error.name : "unknown",
    })
    return noStore(
      NextResponse.json(
        { ok: false, code: "DELIVERY_FAILED" },
        { status: 500 }
      )
    )
  }
}
