import { db } from "@/lib/db"
import { operacionesSalonNewOrderNotification, sendPushNotification } from "@/lib/push"

type NotifySalonNewOrderParams = {
  pedidoId: string
  negocioId: string
  slug: string
  mesaNumero: number
  clienteNombre: string
  total: number
  mozoNombre?: string | null
}

type NotifySalonNewOrderResult = {
  attemptedEndpoints: string[]
}

type SalonEmpleadoRecipient = {
  id: string
  pushSubscription: string
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
      pushSubscription: { not: null },
      cuentaOperativa: { activo: true, eliminado: false },
    },
    select: { id: true, pushSubscription: true },
  })

  return empleados.filter(
    (empleado): empleado is SalonEmpleadoRecipient => typeof empleado.pushSubscription === "string"
  )
}

function groupByEndpoint(empleados: SalonEmpleadoRecipient[]) {
  const byEndpoint = new Map<string, { empleadoIds: string[]; subscriptionJson: string }>()

  for (const empleado of empleados) {
    const endpoint = parseSubscriptionEndpoint(empleado.pushSubscription)
    if (!endpoint) continue

    const existing = byEndpoint.get(endpoint)
    if (existing) {
      existing.empleadoIds.push(empleado.id)
    } else {
      byEndpoint.set(endpoint, {
        empleadoIds: [empleado.id],
        subscriptionJson: empleado.pushSubscription,
      })
    }
  }

  return byEndpoint
}

async function clearSalonSubscription(empleadoId: string, negocioId: string) {
  await db.empleado
    .updateMany({
      where: { id: empleadoId, negocioId },
      data: { pushSubscription: null },
    })
    .catch(() => undefined)
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

  const panelUrl = `/operaciones/mi-panel/${encodeURIComponent(params.slug)}/salon`
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
            datos: JSON.stringify({ mesaNumero: params.mesaNumero, url: panelUrl }),
          },
        })
        .catch((error) => {
          console.error("[Push/OperacionesSalon] Error persistiendo notificacion:", error)
        })
    )
  )

  // Envío de push: agrupado por endpoint único para no duplicar el aviso del
  // sistema operativo en un mismo dispositivo/navegador compartido.
  const byEndpoint = groupByEndpoint(empleados)
  const attemptedEndpoints: string[] = []

  for (const [endpoint, group] of byEndpoint) {
    attemptedEndpoints.push(endpoint)
    const [primaryId, ...restIds] = group.empleadoIds

    try {
      await sendPushNotification(group.subscriptionJson, payload, {
        model: "empleado",
        id: primaryId,
        field: "pushSubscription",
        suppressEndpointLog: true,
        onExpired: () => {
          if (restIds.length > 0) {
            void Promise.all(restIds.map((id) => clearSalonSubscription(id, params.negocioId)))
          }
        },
      })
    } catch (error) {
      console.error("[Push/OperacionesSalon] Error enviando notificacion:", {
        pedidoId: shortId(params.pedidoId),
        errorName: error instanceof Error ? error.name : "unknown",
      })
    }
  }

  console.info("[Push/OperacionesSalon] resumen", {
    pedidoId: shortId(params.pedidoId),
    negocioId: shortId(params.negocioId),
    destinatarios: empleados.length,
    endpointsUnicos: byEndpoint.size,
  })

  return { attemptedEndpoints }
}
