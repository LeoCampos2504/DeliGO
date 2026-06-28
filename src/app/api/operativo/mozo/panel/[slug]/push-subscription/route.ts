import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  noStore,
  resolveOperativoMozoForSlug,
} from "@/lib/operativo-mozo"

type PushSubscriptionInput = {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

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

function parsePushSubscription(value: unknown): PushSubscriptionInput | null {
  let parsed = value
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== "object") return null

  const candidate = parsed as {
    endpoint?: unknown
    expirationTime?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
  }

  if (
    typeof candidate.endpoint !== "string" ||
    candidate.endpoint.trim().length === 0 ||
    !candidate.keys ||
    typeof candidate.keys.p256dh !== "string" ||
    candidate.keys.p256dh.trim().length === 0 ||
    typeof candidate.keys.auth !== "string" ||
    candidate.keys.auth.trim().length === 0
  ) {
    return null
  }

  const endpoint = candidate.endpoint.trim()
  try {
    const endpointUrl = new URL(endpoint)
    if (endpointUrl.protocol !== "https:") {
      return null
    }
  } catch {
    return null
  }

  const expirationTime =
    typeof candidate.expirationTime === "number" || candidate.expirationTime === null
      ? candidate.expirationTime
      : null

  return {
    endpoint,
    expirationTime,
    keys: {
      p256dh: candidate.keys.p256dh,
      auth: candidate.keys.auth,
    },
  }
}

async function updateEmpleadoSubscription({
  empleadoId,
  negocioId,
  cuentaOperativaId,
  pushSubscription,
}: {
  empleadoId: string
  negocioId: string
  cuentaOperativaId: string
  pushSubscription: string | null
}) {
  return db.empleado.updateMany({
    where: {
      id: empleadoId,
      negocioId,
      cuentaOperativaId,
      rol: "mozo",
      activo: true,
      eliminado: false,
    },
    data: { pushSubscription },
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoMozoForSlug(req, slug)
    if (!auth.ok) return authErrorResponse(auth)

    const empleado = await db.empleado.findFirst({
      where: {
        id: auth.empleado.id,
        negocioId: auth.negocio.id,
        cuentaOperativaId: auth.cuenta.id,
        rol: "mozo",
        activo: true,
        eliminado: false,
      },
      select: { pushSubscription: true },
    })

    if (!empleado) {
      return noStore(
        NextResponse.json(
          { ok: false, error: "Acceso no disponible" },
          { status: 403 }
        )
      )
    }

    return noStore(
      NextResponse.json({
        ok: true,
        subscribed: !!empleado.pushSubscription,
      })
    )
  } catch (error) {
    console.error("[OperativoMozoPush] Error loading subscription state:", error)
    return noStore(
      NextResponse.json(
        { ok: false, error: "No se pudo consultar la suscripcion" },
        { status: 500 }
      )
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoMozoForSlug(req, slug)
    if (!auth.ok) return authErrorResponse(auth)

    const body = await req.json().catch(() => ({}))
    const subscription = parsePushSubscription((body as { subscription?: unknown }).subscription)
    if (!subscription) {
      return noStore(
        NextResponse.json(
          { ok: false, error: "Suscripcion invalida" },
          { status: 400 }
        )
      )
    }

    const result = await updateEmpleadoSubscription({
      empleadoId: auth.empleado.id,
      negocioId: auth.negocio.id,
      cuentaOperativaId: auth.cuenta.id,
      pushSubscription: JSON.stringify(subscription),
    })

    if (result.count !== 1) {
      return noStore(
        NextResponse.json(
          { ok: false, error: "Acceso no disponible" },
          { status: 403 }
        )
      )
    }

    return noStore(
      NextResponse.json({
        ok: true,
        subscribed: true,
      })
    )
  } catch (error) {
    console.error("[OperativoMozoPush] Error saving subscription:", error)
    return noStore(
      NextResponse.json(
        { ok: false, error: "No se pudo guardar la suscripcion" },
        { status: 500 }
      )
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoMozoForSlug(req, slug)
    if (!auth.ok) return authErrorResponse(auth)

    const result = await updateEmpleadoSubscription({
      empleadoId: auth.empleado.id,
      negocioId: auth.negocio.id,
      cuentaOperativaId: auth.cuenta.id,
      pushSubscription: null,
    })

    if (result.count !== 1) {
      return noStore(
        NextResponse.json(
          { ok: false, error: "Acceso no disponible" },
          { status: 403 }
        )
      )
    }

    return noStore(
      NextResponse.json({
        ok: true,
        subscribed: false,
      })
    )
  } catch (error) {
    console.error("[OperativoMozoPush] Error clearing subscription:", error)
    return noStore(
      NextResponse.json(
        { ok: false, error: "No se pudo borrar la suscripcion" },
        { status: 500 }
      )
    )
  }
}
