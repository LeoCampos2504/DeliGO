// ============================================
// DeliGO - Push Notification Utilities
// ============================================
// VAPID-based web push notifications + DB persistence

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

export type NotificationType =
  | "order_update"
  | "new_order"
  | "new_delivery"
  | "review"
  | "chat"
  | "general"
  | "review_request"
  | "account_update"
  | "mesa_order_ready"
  | "salon_new_order"
  | "empleados_new_order"
  | "empleados_new_review"
  | "empleados_order_cancelled"
  | "salon_order_cancelled"

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  tag?: string
  data?: {
    type: NotificationType
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
// Navigation Target per Role
// ============================================
// When a notification is clicked, we navigate the user to the correct tab/section

export interface NavigationTarget {
  cliente?: string   // tab for cliente page
  negocio?: string   // tab for negocio panel
  repartidor?: string // tab for repartidor panel
  empleado?: string  // tab/section for empleado (mozo PWA at /m/[token])
  salon?: string     // tab/section for salon shared display (/s/[token])
  empleados?: string // tab for empleados shared panel (/e/[token])
}

// Maps notification type → navigation target per role
function getNavigationTarget(
  tipo: NotificationType,
  pedidoId?: string | null,
  negocioId?: string | null
): NavigationTarget {
  switch (tipo) {
    case "new_order":
      return {
        negocio: `pedidos`,
        // For negocio, we also want to highlight the specific order
      }
    case "order_update":
      return {
        cliente: "pedidos",
        negocio: "pedidos",
        repartidor: "entregas",
      }
    case "new_delivery":
      return {
        repartidor: "entregas",
      }
    case "chat":
      return {
        cliente: "pedidos",
        negocio: "pedidos",
        repartidor: "entregas",
      }
    case "review":
      return {
        negocio: "resenas",
        cliente: "pedidos",
      }
    case "review_request":
      return {
        cliente: "pedidos",
      }
    case "account_update":
      return {
        negocio: "config",
      }
    case "mesa_order_ready":
      return {
        // Mozo notifications go back to the salon page
        empleado: "salon",
      }
    case "salon_new_order":
      // New mesa order arrived at the salon shared display
      return {
        salon: "salon",
      }
    case "empleados_new_order":
      // New general (non-mesa) order arrived at the empleados panel
      return {
        empleados: "pedidos",
      }
    case "empleados_new_review":
      // New review arrived at the empleados panel
      return {
        empleados: "resenas",
      }
    case "empleados_order_cancelled":
      // Order was cancelled — notify empleados panel so it disappears from the queue
      return {
        empleados: "pedidos",
      }
    case "salon_order_cancelled":
      // Order was cancelled — notify salon shared display
      return {
        salon: "salon",
      }
    default:
      return {}
  }
}

// ============================================
// Create + Persist Notification
// ============================================

interface CreateNotificationParams {
  userId: string
  userType: string // "cliente" | "negocio" | "repartidor" | "superadmin" | "empleado"
  tipo: NotificationType
  titulo: string
  cuerpo: string
  pedidoId?: string | null
  negocioId?: string | null
  /** Additional data for navigation/action (JSON-serializable) */
  datos?: Record<string, unknown>
  /** If provided, also send a push notification to this subscription */
  pushSubscription?: string | null
  pushPayload?: PushNotificationPayload
  /** If provided, clean up expired push subscription on failure */
  cleanupExpired?: { model: string; id: string; field?: string }
  /** If true, await the push send so errors surface in logs (default: false, fire-and-forget) */
  awaitPush?: boolean
}

/**
 * Creates a notification in the database and optionally sends a push notification.
 * This is the main entry point for all notification creation.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const {
    userId,
    userType,
    tipo,
    titulo,
    cuerpo,
    pedidoId,
    negocioId,
    datos,
    pushSubscription,
    pushPayload,
    cleanupExpired,
    awaitPush,
  } = params

  // Build navigation data
  const navTarget = getNavigationTarget(tipo, pedidoId, negocioId)
  const navigationData: Record<string, unknown> = {
    ...datos,
    // Store the navigation target for the recipient's role
    navigateTo: navTarget,
  }

  // 1. Persist notification in DB
  try {
    const { db } = await import("@/lib/db")
    await db.notificacion.create({
      data: {
        userId,
        userType,
        tipo,
        titulo,
        cuerpo,
        pedidoId: pedidoId || null,
        negocioId: negocioId || null,
        datos: JSON.stringify(navigationData),
      },
    })
  } catch (error) {
    console.error("[Notificacion] Error persisting notification:", error)
    // Don't fail the whole operation if DB write fails
  }

  // 2. Send push notification if subscription exists
  if (pushSubscription && pushPayload) {
    const pushPromise = sendPushNotification(pushSubscription, pushPayload, cleanupExpired)
    if (awaitPush) {
      // Await the push so errors surface in the caller's logs
      try {
        const sent = await pushPromise
        if (!sent) {
          console.warn(`[Push] sendPushNotification returned false for tipo=${tipo} userId=${userId} (VAPID not configured or subscription expired)`)
        }
      } catch (err) {
        console.error(`[Push] Error sending push notification (tipo=${tipo} userId=${userId}):`, err)
      }
    } else {
      // Fire-and-forget (default for non-critical notifications)
      pushPromise.catch((err) => {
        console.error("[Push] Error sending push notification:", err)
      })
    }
  }
}

// ============================================
// Send Push Notification (raw push only)
// ============================================

export async function sendPushNotification(
  subscriptionJson: string,
  payload: PushNotificationPayload,
  cleanupExpired?: { model: string; id: string; field?: string }
): Promise<boolean> {
  if (!isPushConfigured()) {
    console.warn("[Push] VAPID keys not configured, skipping notification")
    return false
  }

  let subscription: { endpoint?: string } | null = null
  try {
    subscription = JSON.parse(subscriptionJson)
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string; body?: string }
    const endpoint = subscription?.endpoint || "unknown"
    // 410 = subscription expired, 404 = subscription gone
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log(`[Push] Subscription expired (statusCode=${err.statusCode}, endpoint=${endpoint}), should be removed`)
      // Auto-cleanup expired subscriptions to prevent future send attempts
      if (cleanupExpired) {
        try {
          const { db } = await import("@/lib/db")
          const modelMap: Record<string, string> = {
            cliente: "cliente",
            negocio: "negocio",
            repartidor: "repartidor",
            superadmin: "superAdmin",
            empleado: "empleado",
          }
          const prismaModel = modelMap[cleanupExpired.model]
          if (prismaModel) {
            // Determine which field to clear. Defaults to "pushSubscription".
            // For shared-display subscriptions (salon, empleados) we pass a
            // custom field name so we don't wipe the business owner's personal
            // push subscription.
            const fieldToClear = cleanupExpired.field || "pushSubscription"
            // Dynamic model + field access for cleanup
            await (db as Record<string, { update: (args: { where: { id: string }; data: Record<string, null> }) => Promise<unknown> }>)[prismaModel].update({
              where: { id: cleanupExpired.id },
              data: { [fieldToClear]: null },
            })
            console.log(`[Push] Cleaned up expired subscription for ${cleanupExpired.model}:${cleanupExpired.id} (field=${fieldToClear})`)
          }
        } catch (cleanupError) {
          console.error("[Push] Failed to cleanup expired subscription:", cleanupError)
        }
      }
      return false
    }
    // Log the full error details so we can diagnose 400/403/etc. on Railway
    console.error(`[Push] Error sending notification (statusCode=${err.statusCode}, endpoint=${endpoint}):`, err.message || error)
    if (err.body) {
      console.error(`[Push] Response body:`, err.body)
    }
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

export function mesaOrderReadyNotification(
  pedidoId: string,
  mesaNumero: number,
  clienteNombre: string
): PushNotificationPayload {
  // For mesa orders there is often no customer session (the mozo took the
  // order), so clienteNombre may be "Invitado". In that case we just reference
  // the mesa number instead of showing "Invitado" to the mozo.
  const autor = clienteNombre && clienteNombre !== "Invitado" ? clienteNombre : null
  const body = autor
    ? `El pedido de ${autor} en la mesa ${mesaNumero} está listo para servir`
    : `El pedido de la mesa ${mesaNumero} está listo para servir`
  return {
    title: `Mesa ${mesaNumero} — Pedido listo 🍽️`,
    body,
    tag: `mesa-ready-${pedidoId}`,
    data: {
      type: "mesa_order_ready",
      pedidoId,
      mesaNumero,
    },
    actions: [
      { action: "view", title: "Ver pedido" },
    ],
    requireInteraction: true,
  }
}

// ============================================
// Salon PWA notifications (/s/[token])
// ============================================

export function salonNewOrderNotification(
  pedidoId: string,
  mesaNumero: number,
  clienteNombre: string,
  total: number,
  mozoNombre?: string | null
): PushNotificationPayload {
  // For mesa orders placed by a mozo, the "cliente" is really the mozo
  // (there's no customer session). Show the mozo's name so the salon staff
  // know who took the order. Fall back to the customer name for regular
  // mesa orders (e.g. a customer scanning a QR without a mozo).
  const autor = mozoNombre || clienteNombre
  const body = mozoNombre
    ? `${mozoNombre} tomó un pedido por $${total.toFixed(0)} en la mesa ${mesaNumero}`
    : `${clienteNombre} hizo un pedido por $${total.toFixed(0)} en la mesa ${mesaNumero}`
  return {
    title: `Mesa ${mesaNumero} — Nuevo pedido 📩`,
    body,
    tag: `salon-new-order-${pedidoId}`,
    data: {
      type: "salon_new_order",
      pedidoId,
      mesaNumero,
      autor,
    },
    actions: [
      { action: "view", title: "Ver pedido" },
    ],
    requireInteraction: true,
  }
}

// ============================================
// Empleados PWA notifications (/e/[token])
// ============================================

export function empleadosNewOrderNotification(
  pedidoId: string,
  clienteNombre: string,
  total: number,
  metodoEntrega: string
): PushNotificationPayload {
  const entregaLabel =
    metodoEntrega === "domicilio" ? "Delivery" : metodoEntrega === "retiro" ? "Retiro en local" : "Pedido"
  return {
    title: `¡Nuevo pedido! 📩 (${entregaLabel})`,
    body: `${clienteNombre} hizo un pedido de $${total.toFixed(0)}`,
    tag: `empleados-new-order-${pedidoId}`,
    data: {
      type: "empleados_new_order",
      pedidoId,
    },
    actions: [
      { action: "view", title: "Ver pedido" },
    ],
    requireInteraction: true,
  }
}

export function empleadosNewReviewNotification(
  pedidoId: string,
  negocioNombre: string,
  puntuacion: number,
  clienteNombre: string
): PushNotificationPayload {
  const stars = "⭐".repeat(puntuacion)
  return {
    title: "Nueva reseña ⭐",
    body: `${clienteNombre} dejó ${stars} en ${negocioNombre}`,
    tag: `empleados-new-review-${pedidoId}`,
    data: {
      type: "empleados_new_review",
      pedidoId,
    },
    actions: [
      { action: "view", title: "Ver reseña" },
    ],
  }
}

// Order cancelled — sent to empleados PWA (/e/[token]) so the shared display
// updates and the order disappears from the active queue. Mirrors the
// empleadosNewOrderNotification pattern (retiro/domicilio orders).
export function empleadosOrderCancelledNotification(
  pedidoId: string,
  clienteNombre: string,
  canceladoPor: string
): PushNotificationPayload {
  const porLabel =
    canceladoPor === "cliente"
      ? "por el cliente"
      : canceladoPor === "sistema"
      ? "automáticamente"
      : "por el local"
  return {
    title: "Pedido cancelado ❌",
    body: `El pedido de ${clienteNombre} fue cancelado ${porLabel}`,
    tag: `empleados-order-cancelled-${pedidoId}`,
    data: {
      type: "empleados_order_cancelled",
      pedidoId,
    },
    actions: [
      { action: "view", title: "Ver pedidos" },
    ],
    requireInteraction: true,
  }
}

// Order cancelled — sent to salon PWA (/s/[token]) for mesa orders.
export function salonOrderCancelledNotification(
  pedidoId: string,
  mesaNumero: string | number | null,
  clienteNombre: string,
  canceladoPor: string
): PushNotificationPayload {
  const mesaLabel = mesaNumero ? ` (Mesa ${mesaNumero})` : ""
  const porLabel =
    canceladoPor === "cliente"
      ? "por el cliente"
      : canceladoPor === "sistema"
      ? "automáticamente"
      : "por el salón"
  return {
    title: "Pedido cancelado ❌",
    body: `El pedido${mesaLabel} de ${clienteNombre} fue cancelado ${porLabel}`,
    tag: `salon-order-cancelled-${pedidoId}`,
    data: {
      type: "salon_order_cancelled",
      pedidoId,
    },
    actions: [
      { action: "view", title: "Ver salón" },
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
