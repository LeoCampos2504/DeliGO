// ============================================
// DeliGO - Push Notification Utilities
// ============================================
// VAPID-based web push notifications

import webpush from "web-push"

// VAPID keys - generate once and store in env vars
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ""
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ""
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:deligo@app.com"

// Initialize web-push with VAPID details
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// Check if push notifications are configured
export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}

// Get the public key for client-side subscription
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY
}

// ============================================
// Push Notification Types
// ============================================

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  tag?: string
  data?: {
    type: "order_update" | "new_order" | "new_delivery" | "review" | "chat" | "general" | "review_request" | "account_update"
    url?: string
    pedidoId?: string
    negocioId?: string
    [key: string]: unknown
  }
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
  requireInteraction?: boolean
  silent?: boolean
}

// ============================================
// Send Push Notification
// ============================================

export async function sendPushNotification(
  subscriptionJson: string,
  payload: PushNotificationPayload,
  cleanupExpired?: { model: string; id: string }
): Promise<boolean> {
  if (!isPushConfigured()) {
    console.warn("[Push] VAPID keys not configured, skipping notification")
    return false
  }

  try {
    const subscription = JSON.parse(subscriptionJson)
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (error: unknown) {
    const err = error as { statusCode?: number }
    // 410 = subscription expired, 404 = subscription gone
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log("[Push] Subscription expired, should be removed")
      // Auto-cleanup expired subscriptions to prevent future send attempts
      if (cleanupExpired) {
        try {
          const { db } = await import("@/lib/db")
          const modelMap: Record<string, string> = {
            cliente: "cliente",
            negocio: "negocio",
            repartidor: "repartidor",
            superadmin: "superAdmin",
          }
          const prismaModel = modelMap[cleanupExpired.model]
          if (prismaModel) {
            // @ts-expect-error — dynamic model access for cleanup
            await db[prismaModel].update({
              where: { id: cleanupExpired.id },
              data: { pushSubscription: null },
            })
            console.log(`[Push] Cleaned up expired subscription for ${cleanupExpired.model}:${cleanupExpired.id}`)
          }
        } catch (cleanupError) {
          console.error("[Push] Failed to cleanup expired subscription:", cleanupError)
        }
      }
      return false
    }
    console.error("[Push] Error sending notification:", error)
    return false
  }
}

// ============================================
// Notification Factories
// ============================================

export function orderUpdateNotification(
  pedidoId: string,
  negocioNombre: string,
  newStatus: string
): PushNotificationPayload {
  const statusMessages: Record<string, string> = {
    confirmado: `${negocioNombre} confirmó tu pedido`,
    preparando: `${negocioNombre} está preparando tu pedido`,
    en_camino: "Tu pedido está en camino 🛵",
    listo_para_retirar: "Tu pedido está listo para retirar 📦",
    entregado: "Tu pedido fue entregado ✅",
    cancelado: `Tu pedido de ${negocioNombre} fue cancelado`,
  }

  return {
    title: "Actualización de pedido",
    body: statusMessages[newStatus] || `Tu pedido cambió a: ${newStatus}`,
    tag: `order-${pedidoId}`,
    data: {
      type: "order_update",
      pedidoId,
      url: "/?tab=pedidos",
    },
    actions: newStatus === "listo_para_retirar"
      ? [{ action: "view", title: "Ver pedido" }]
      : undefined,
    requireInteraction: newStatus === "listo_para_retirar",
  }
}

export function newOrderNotification(
  pedidoId: string,
  clienteNombre: string,
  total: number
): PushNotificationPayload {
  return {
    title: "¡Nuevo pedido! 📩",
    body: `${clienteNombre} hizo un pedido de $${total.toFixed(0)}`,
    tag: `new-order-${pedidoId}`,
    data: {
      type: "new_order",
      pedidoId,
    },
    requireInteraction: true,
    actions: [
      { action: "view", title: "Ver pedido" },
    ],
  }
}

export function newDeliveryNotification(
  pedidoId: string,
  negocioNombre: string,
  direccion: string
): PushNotificationPayload {
  return {
    title: "¡Nueva entrega! 🛵",
    body: `Pedido de ${negocioNombre} - ${direccion || "Retiro en local"}`,
    tag: `delivery-${pedidoId}`,
    data: {
      type: "new_delivery",
      pedidoId,
    },
    requireInteraction: true,
    actions: [
      { action: "navigate", title: "Navegar" },
      { action: "view", title: "Ver detalle" },
    ],
  }
}

export function newReviewNotification(
  negocioNombre: string,
  puntuacion: number,
  clienteNombre: string
): PushNotificationPayload {
  const stars = "⭐".repeat(puntuacion)
  return {
    title: "Nueva reseña ⭐",
    body: `${clienteNombre} dejó ${stars} en ${negocioNombre}`,
    data: {
      type: "review",
    },
  }
}

export function chatMessageNotification(
  pedidoId: string,
  senderName: string,
  messagePreview: string
): PushNotificationPayload {
  return {
    title: `Mensaje de ${senderName}`,
    body: messagePreview.slice(0, 100),
    tag: `chat-${pedidoId}`,
    data: {
      type: "chat",
      pedidoId,
    },
  }
}

// ============================================
// New notification factories
// ============================================

export function orderDeliveredNotification(
  pedidoId: string,
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "Pedido entregado ✅",
    body: `Tu pedido de ${negocioNombre} fue entregado`,
    tag: `order-${pedidoId}`,
    data: {
      type: "order_update",
      pedidoId,
      url: "/?tab=pedidos",
    },
  }
}

export function orderCancelledByClienteNotification(
  pedidoId: string,
  clienteNombre: string
): PushNotificationPayload {
  return {
    title: "Pedido cancelado ❌",
    body: `${clienteNombre} canceló un pedido`,
    tag: `order-cancelled-${pedidoId}`,
    data: {
      type: "order_update",
      pedidoId,
    },
    requireInteraction: true,
  }
}

export function clientConfirmedNotification(
  pedidoId: string,
  clienteNombre: string
): PushNotificationPayload {
  return {
    title: "Cliente confirmó recepción ✅",
    body: `${clienteNombre} confirmó que recibió el pedido`,
    tag: `order-confirmed-${pedidoId}`,
    data: {
      type: "order_update",
      pedidoId,
    },
  }
}

export function negocioApprovedNotification(
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "¡Tu local fue aprobado! 🎉",
    body: `${negocioNombre} ya está activo en DeliGO. Ya podés empezar a recibir pedidos.`,
    data: {
      type: "account_update",
    },
    requireInteraction: true,
  }
}

export function negocioSuspendedNotification(
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "Tu local fue suspendido ⚠️",
    body: `${negocioNombre} fue suspendido. Contactá al administrador para más información.`,
    data: {
      type: "account_update",
    },
    requireInteraction: true,
  }
}

export function negocioReactivatedNotification(
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "Tu local fue reactivado ✅",
    body: `${negocioNombre} está activo nuevamente.`,
    data: {
      type: "account_update",
    },
  }
}

export function subscriptionRenewedNotification(
  negocioNombre: string,
  fechaVencimiento: string
): PushNotificationPayload {
  return {
    title: "Suscripción renovada 🔄",
    body: `${negocioNombre} — Tu plan fue renovado hasta el ${new Date(fechaVencimiento).toLocaleDateString("es-AR")}`,
    data: {
      type: "account_update",
    },
  }
}

export function reviewReplyNotification(
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "Respuesta a tu reseña 💬",
    body: `${negocioNombre} respondió tu reseña`,
    data: {
      type: "review",
      url: "/?tab=pedidos",
    },
    actions: [
      { action: "view", title: "Ver reseña" },
    ],
  }
}

export function orderDeliveredByRepartidorNotification(
  pedidoId: string,
  clienteNombre: string
): PushNotificationPayload {
  return {
    title: "Pedido entregado por repartidor ✅",
    body: `El pedido de ${clienteNombre} fue entregado`,
    tag: `order-delivered-${pedidoId}`,
    data: {
      type: "order_update",
      pedidoId,
      url: "/?tab=pedidos",
    },
  }
}

export function reviewRequestNotification(
  pedidoId: string,
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "¿Cómo fue tu pedido? ⭐",
    body: `Dejá tu reseña de ${negocioNombre} y ayudá a otros usuarios`,
    tag: `review-request-${pedidoId}`,
    data: {
      type: "review_request",
      pedidoId,
      url: "/?tab=pedidos",
    },
    actions: [
      { action: "review", title: "Calificar" },
    ],
    requireInteraction: true,
  }
}

// ============================================
// Generate VAPID keys (run once to create keys)
// ============================================

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys()
}
