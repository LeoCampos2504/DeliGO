import { db } from "@/lib/db"
import { buildPedidoDeepLinkUrl } from "@/lib/notification-deep-link"
import {
  operacionesSalonNewOrderNotification,
  sendPushToTargets,
} from "@/lib/push"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { resolveOperationalPushTargets, type OperationalPushEmployee } from "@/lib/operational-push-targets"

type NotifySalonNewOrderParams = {
  pedidoId: string
  negocioId: string
  slug: string
  mesaNumero: number
  clienteNombre: string
  total: number
  mozoNombre?: string | null
  /**
   * 19-B0.2E1: provenance estructurada — el Cliente cuyo nombre puede quedar
   * embebido en `titulo`/`cuerpo` (cuando no hay `mozoNombre`). `null`/`undefined`
   * para pedidos de mesa asistidos por Mozo (sin sesión de Cliente real).
   */
  clienteId?: string | null
}

type NotifySalonNewOrderResult = {
  attemptedEndpoints: string[]
}

type SalonEmpleadoRecipient = {
  id: string
  cuentaOperativaId: string | null
  pushSubscription: string | null
}

function shortId(value: string | null | undefined) {
  if (!value) return null
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`
}

export function parseSubscriptionEndpoint(subscriptionJson: string): string | null {
  try {
    const parsed = JSON.parse(subscriptionJson) as { endpoint?: unknown }
    return typeof parsed.endpoint === "string" && parsed.endpoint.trim()
      ? parsed.endpoint.trim()
      : null
  } catch {
    return null
  }
}

async function resolveSalonEmpleados(negocioId: string): Promise<SalonEmpleadoRecipient[]> {
  const empleados = await db.empleado.findMany({
    where: {
      negocioId,
      activo: true,
      eliminado: false,
      areaOperativa: "salon",
      cuentaOperativaId: { not: null },
      cuentaOperativa: { activo: true, eliminado: false },
    },
    select: { id: true, cuentaOperativaId: true, pushSubscription: true },
  })

  return empleados
}

export async function notifySalonNewOrderForOperations(
  params: NotifySalonNewOrderParams
): Promise<NotifySalonNewOrderResult> {
  const empleados = await resolveSalonEmpleados(params.negocioId)

  if (empleados.length === 0) {
    console.info("[Push/OperacionesSalon] sin destinatarios", {
      pedidoId: shortId(params.pedidoId),
      negocioId: shortId(params.negocioId),
      destinatarios: 0,
      endpointsUnicos: 0,
    })
    return { attemptedEndpoints: [] }
  }

  // P1-C: se agrega `pedidoId` al destino interno (misma convención de deep-link
  // ya usada por orders-tab.tsx) para que el Service Worker pueda navegar directo
  // al pedido/mesa correspondiente en vez de solo abrir el panel general.
  const panelUrl = buildPedidoDeepLinkUrl(
    `/operaciones/mi-panel/${encodeURIComponent(params.slug)}/salon`,
    params.pedidoId
  )
  const payload = operacionesSalonNewOrderNotification(
    params.pedidoId,
    params.mesaNumero,
    params.clienteNombre,
    params.total,
    panelUrl,
    params.mozoNombre
  )

  // Notificación en la app: una fila por empleado, independiente de si comparten
  // el mismo endpoint de push (cada uno la ve en su propio feed).
  await Promise.all(
    empleados.map((empleado) =>
      db.notificacion
        .create({
          data: {
            userId: empleado.id,
            userType: "empleado",
            tipo: "operaciones_salon_new_order",
            titulo: payload.title,
            cuerpo: payload.body,
            pedidoId: params.pedidoId,
            negocioId: params.negocioId,
            sourceClienteId: params.clienteId || null,
            datos: JSON.stringify({ mesaNumero: params.mesaNumero, url: panelUrl }),
          },
        })
        .catch((error) => {
          console.error("[Push/OperacionesSalon] Error persistiendo notificacion:", safeErrorForLog(error))
        })
    )
  )

  const targets = await resolveOperationalPushTargets(empleados as OperationalPushEmployee[])
  const attemptedEndpoints = targets.map((t) => t.endpoint)

  try {
    await sendPushToTargets(targets, payload)
  } catch (error) {
    console.error("[Push/OperacionesSalon] Error enviando notificacion:", {
      pedidoId: shortId(params.pedidoId),
      errorName: error instanceof Error ? error.name : "unknown",
    })
  }

  console.info("[Push/OperacionesSalon] resumen", {
    pedidoId: shortId(params.pedidoId),
    negocioId: shortId(params.negocioId),
    destinatarios: empleados.length,
    endpointsUnicos: targets.length,
  })

  return { attemptedEndpoints }
}
