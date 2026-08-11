import { DELETED_CLIENT_CHAT_MESSAGE_TEXT } from "@/lib/chat-attachment-deletion"

// ============================================
// 19-B0.2E1 — Sanitización de Notificacion al eliminar la cuenta de un Cliente
// ============================================
// Reemplazo COMPLETO y determinista de titulo/cuerpo por tipo — nunca regex,
// nunca `replace`/`includes`/`LIKE` sobre nombre/dirección/texto. Los targets
// se identifican exclusivamente por `pedidoId` (Pedido real del Cliente,
// resuelto ANTES de que B1 nulifique `Pedido.clienteId`) o por
// `sourceClienteId` (provenance estructurada, sólo en filas nuevas creadas
// después de esta tarea) — nunca por contenido.

/**
 * Tipos de Notificacion donde E0/E1 confirmaron, por auditoría real de cada
 * writer (no por suposición), que el contenido puede embeber PII de un
 * Cliente distinto del destinatario (Negocio/Repartidor/Empleado). Tipos NO
 * incluidos acá (`account_update`, `mesa_order_ready`, `review_request`,
 * `general`) nunca se tocan por este cleanup — no embeben PII de un Cliente
 * ajeno al destinatario según el audit de cada builder/factory real.
 */
export const NOTIFICATION_TYPES_WITH_CLIENT_PII = [
  "new_order",
  "salon_new_order",
  "operaciones_salon_new_order",
  "order_update",
  "new_delivery",
  "review",
  "chat",
] as const

export type NotificationTypeWithClientPII = (typeof NOTIFICATION_TYPES_WITH_CLIENT_PII)[number]

export function isNotificationTypeWithClientPII(tipo: string): tipo is NotificationTypeWithClientPII {
  return (NOTIFICATION_TYPES_WITH_CLIENT_PII as readonly string[]).includes(tipo)
}

/**
 * Copy neutral fijo por tipo — reemplaza titulo/cuerpo completos. Nunca
 * incluye nombre, dirección, teléfono, texto previo, motivo de eliminación,
 * moderación ni denuncia.
 */
export const NEUTRAL_NOTIFICATION_COPY: Record<NotificationTypeWithClientPII, { titulo: string; cuerpo: string }> = {
  new_order: {
    titulo: "Pedido recibido",
    cuerpo: "Los datos del cliente ya no están disponibles.",
  },
  salon_new_order: {
    titulo: "Pedido recibido",
    cuerpo: "Los datos del cliente ya no están disponibles.",
  },
  operaciones_salon_new_order: {
    titulo: "Pedido recibido",
    cuerpo: "Los datos del cliente ya no están disponibles.",
  },
  order_update: {
    titulo: "Pedido actualizado",
    cuerpo: "Los datos del cliente ya no están disponibles.",
  },
  new_delivery: {
    titulo: "Entrega",
    cuerpo: "Los datos de entrega del cliente ya no están disponibles.",
  },
  review: {
    titulo: "Reseña",
    cuerpo: "Los datos del cliente ya no están disponibles.",
  },
  chat: {
    // Mismo sentinel que 19-B0.2D1 usa para ChatMensaje.texto — coincidencia
    // semántica real (ambos comunican "este mensaje ya no está disponible"),
    // se reutiliza la constante compartida en vez de duplicar el literal.
    titulo: DELETED_CLIENT_CHAT_MESSAGE_TEXT,
    cuerpo: "El contenido del mensaje ya no está disponible.",
  },
}
