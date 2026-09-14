import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  parsePushSubscriptionShape,
  toNormalizedPushSubscriptionInput,
} from "@/lib/push-subscription-http"
import {
  detachPushSubscriptionByEndpoint,
  getPushSubscriptionsForOwner,
  registerPushSubscription,
} from "@/lib/push-subscription-repository"

function authErrorResponse(auth: { status: 401 | 403; state: string; clearSession?: boolean }) {
  const response = NextResponse.json(
    {
      ok: false,
      estado: auth.state,
      error: auth.status === 401 ? "No autenticado" : "Acceso no disponible",
    },
    { status: auth.status }
  )
  if (auth.clearSession) response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
  return noStore(response)
}

function parseUnsubscribeSubscription(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null
  return value
}

async function updateEmpleadoSubscription({
  empleadoId,
  negocioId,
  cuentaOperativaId,
  matchSubscription,
  pushSubscription,
  client,
}: {
  empleadoId: string
  negocioId: string
  cuentaOperativaId: string
  matchSubscription?: string
  pushSubscription: string | null
  client: Pick<typeof db, "empleado">
}) {
  return client.empleado.updateMany({
    where: {
      id: empleadoId,
      negocioId,
      cuentaOperativaId,
      areaOperativa: "pyr",
      activo: true,
      eliminado: false,
      ...(matchSubscription !== undefined ? { pushSubscription: matchSubscription } : {}),
    },
    data: { pushSubscription },
  })
}

async function resolvePyrEmployee(req: NextRequest, slug: string) {
  return resolveOperativoAreaForSlug(req, slug, "pyr")
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolvePyrEmployee(req, slug)
    if (!auth.ok) return authErrorResponse(auth)

    const [empleado, normalized] = await Promise.all([
      db.empleado.findFirst({
        where: {
          id: auth.empleado.id,
          negocioId: auth.negocio.id,
          cuentaOperativaId: auth.cuenta.id,
          areaOperativa: "pyr",
          activo: true,
          eliminado: false,
        },
        select: { pushSubscription: true },
      }),
      getPushSubscriptionsForOwner({ ownerType: "empleado", ownerId: auth.empleado.id, channel: "default" }),
    ])

    if (!empleado) {
      return noStore(NextResponse.json({ ok: false, error: "Acceso no disponible" }, { status: 403 }))
    }

    return noStore(NextResponse.json({
      ok: true,
      subscribed: Boolean(empleado.pushSubscription) || normalized.length > 0,
    }))
  } catch (error) {
    console.error("[OperativoPyrPush] Error loading subscription state:", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "No se pudo consultar la suscripcion" }, { status: 500 }))
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolvePyrEmployee(req, slug)
    if (!auth.ok) return authErrorResponse(auth)

    const body = await req.json().catch(() => ({}))
    const subscription = parsePushSubscriptionShape((body as { subscription?: unknown }).subscription)
    if (!subscription) {
      return noStore(NextResponse.json({ ok: false, error: "Suscripcion invalida" }, { status: 400 }))
    }
    const normalizedInput = toNormalizedPushSubscriptionInput(subscription)
    if (!normalizedInput) {
      return noStore(NextResponse.json({ ok: false, error: "Suscripcion invalida" }, { status: 400 }))
    }

    const result = await db.$transaction(async (tx) => {
      const legacy = await updateEmpleadoSubscription({
        empleadoId: auth.empleado.id,
        negocioId: auth.negocio.id,
        cuentaOperativaId: auth.cuenta.id,
        pushSubscription: JSON.stringify(subscription),
        client: tx,
      })

      if (legacy.count === 1) {
        await registerPushSubscription(
          { ownerType: "empleado", ownerId: auth.empleado.id, channel: "default" },
          normalizedInput,
          tx
        )
      }

      return legacy
    })

    if (result.count !== 1) {
      return noStore(NextResponse.json({ ok: false, error: "Acceso no disponible" }, { status: 403 }))
    }

    return noStore(NextResponse.json({ ok: true, subscribed: true }))
  } catch (error) {
    console.error("[OperativoPyrPush] Error saving subscription:", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "No se pudo guardar la suscripcion" }, { status: 500 }))
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolvePyrEmployee(req, slug)
    if (!auth.ok) return authErrorResponse(auth)

    const body = await req.json().catch(() => ({}))
    const subscription = parseUnsubscribeSubscription((body as { subscription?: unknown }).subscription)
    if (!subscription) {
      return noStore(NextResponse.json({ ok: false, error: "subscription es obligatorio" }, { status: 400 }))
    }

    const parsedSubscription = parsePushSubscriptionShape(subscription)
    const removed = await db.$transaction(async (tx) => {
      const legacyResult = await updateEmpleadoSubscription({
        empleadoId: auth.empleado.id,
        negocioId: auth.negocio.id,
        cuentaOperativaId: auth.cuenta.id,
        matchSubscription: subscription,
        pushSubscription: null,
        client: tx,
      })

      let normalizedRemoved = false
      if (parsedSubscription) {
        const result = await detachPushSubscriptionByEndpoint(
          { ownerType: "empleado", ownerId: auth.empleado.id, channel: "default" },
          {
            endpoint: parsedSubscription.endpoint,
            p256dh: parsedSubscription.keys.p256dh,
            auth: parsedSubscription.keys.auth,
          },
          tx
        )
        normalizedRemoved = result.detached
      }

      return legacyResult.count > 0 || normalizedRemoved
    })

    return noStore(NextResponse.json({ ok: true, removed }))
  } catch (error) {
    console.error("[OperativoPyrPush] Error clearing subscription:", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "No se pudo borrar la suscripcion" }, { status: 500 }))
  }
}
