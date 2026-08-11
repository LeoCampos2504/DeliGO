import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import {
  DELETED_CLIENT_CHAT_MESSAGE_TEXT,
  processPendingChatAttachmentDeletions,
  queueChatAttachmentDeletionJobs,
  resolveChatAttachmentDeletionTargets,
} from "@/lib/chat-attachment-deletion"

export const ANONYMIZED_REVIEW_CLIENT_NAME = "Usuario eliminado"
export const CLIENT_ACCOUNT_DELETION_MAX_ATTEMPTS = 3

// Único criterio de terminalidad: el estado del Pedido, sin importar
// metodoEntrega. Se comprueba pertenencia al conjunto TERMINAL (no al de
// "activos") para que cualquier estado futuro/desconocido bloquee por
// defecto la eliminación en lugar de dejarla pasar en silencio.
export const CLIENT_ACCOUNT_DELETION_TERMINAL_STATES = ["entregado", "cancelado"] as const

export function isPedidoTerminalForClientAccountDeletion(estado: string): boolean {
  return (CLIENT_ACCOUNT_DELETION_TERMINAL_STATES as readonly string[]).includes(estado)
}

export class ClientAccountDeletionConflictError extends Error {}
export class ClientHasActiveOrdersError extends Error {}

export function isClientAccountDeletionSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
}

export function isClientAccountAlreadyDeletedError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  )
}

export async function retryClientAccountDeletion<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < CLIENT_ACCOUNT_DELETION_MAX_ATTEMPTS; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (
        isClientAccountDeletionSerializationConflict(error) &&
        attempt < CLIENT_ACCOUNT_DELETION_MAX_ATTEMPTS - 1
      ) {
        continue
      }
      if (isClientAccountDeletionSerializationConflict(error)) {
        throw new ClientAccountDeletionConflictError()
      }
      throw error
    }
  }

  throw new ClientAccountDeletionConflictError()
}

export async function deleteClientAccountInTransaction(
  tx: Prisma.TransactionClient,
  clienteId: string,
) {
  // Bloquea la eliminación mientras exista al menos un pedido no terminal.
  // Debe ser la primera operación: nada se escribe todavía, así que un
  // rechazo acá no deja mutaciones parciales por revertir.
  const pedidoActivo = await tx.pedido.findFirst({
    where: {
      clienteId,
      estado: { notIn: [...CLIENT_ACCOUNT_DELETION_TERMINAL_STATES] },
    },
    select: { id: true },
  })
  if (pedidoActivo) {
    throw new ClientHasActiveOrdersError()
  }

  // No se borra la reseña: conserva rating, contenido y expediente, pero no identidad.
  await tx.resena.updateMany({
    where: { clienteId },
    data: {
      clienteId: null,
      clienteNombre: ANONYMIZED_REVIEW_CLIENT_NAME,
    },
  })

  // Pedido no se borra: conserva historial operativo/financiero completo
  // (items, totales, estado, timestamps, negocioId, deudaAcumulada), pero
  // desvincula y sanitiza la PII estructurada que identificaba al Cliente.
  // Sólo llega hasta acá si el guard de arriba confirmó que TODOS los
  // pedidos del Cliente son terminales — nunca sanitiza un pedido activo.
  //
  // `notas` se incluye acá (19-B0.2D1) porque el invariante de creación lo
  // permite sin condición adicional: el único flujo que crea Pedidos SIN
  // Cliente real asociado (Mozo/Operaciones asistiendo una mesa,
  // `operativo/mozo/panel/[slug]/pedidos`) siempre escribe `clienteId: null`
  // en la creación y nunca lo actualiza después — no existe ningún "reclamo"
  // posterior de un pedido de mesa por un Cliente. Por lo tanto, cualquier
  // fila que este `where: { clienteId }` alcance SIEMPRE fue creada con una
  // sesión de Cliente real autenticada, así que `notas` es, sin excepción,
  // contenido atribuible a ese Cliente.
  await tx.pedido.updateMany({
    where: { clienteId },
    data: {
      clienteId: null,
      clienteNombre: ANONYMIZED_REVIEW_CLIENT_NAME,
      clienteTelefono: "",
      direccion: null,
      referencia: null,
      lat: null,
      lng: null,
      notas: null,
    },
  })

  // Chat: la autoría real vive en `remitente`, no en `clienteId` (única
  // marca confiable incluso después de que `clienteId` se anule — auditoría
  // 19-B0.2D0). Antes de perder los punteros de adjunto, se resuelven y
  // encolan los jobs de borrado físico durable DENTRO de esta misma
  // transacción: si el account delete hace rollback, ni el Chat cambia ni
  // los jobs llegan a existir.
  const mensajesConAdjuntoDelCliente = await tx.chatMensaje.findMany({
    where: {
      clienteId,
      remitente: "cliente",
      OR: [{ imagenUrl: { not: null } }, { archivoUrl: { not: null } }],
    },
    select: { pedidoId: true, imagenUrl: true, archivoUrl: true },
  })
  const attachmentTargets = mensajesConAdjuntoDelCliente.flatMap(resolveChatAttachmentDeletionTargets)
  await queueChatAttachmentDeletionJobs(tx, attachmentTargets)

  // Sanitiza contenido SÓLO de mensajes del propio Cliente (remitente
  // "cliente" — nunca "vendedor", que pertenece a Negocio/PyR y no se toca
  // jamás por esta eliminación). La fila se preserva siempre: nunca
  // `deleteMany`, para no romper cronología/hilos del lado Negocio.
  await tx.chatMensaje.updateMany({
    where: { clienteId, remitente: "cliente" },
    data: {
      clienteId: null,
      texto: DELETED_CLIENT_CHAT_MESSAGE_TEXT,
      imagenUrl: null,
      archivoUrl: null,
      archivoNombre: null,
      archivoTipo: null,
    },
  })
  // Red de seguridad: desvincula `clienteId` de cualquier fila legacy
  // inconsistente que lo tuviera sin `remitente="cliente"` (nunca debería
  // existir según los escritores actuales, auditado en 19-B0.2D0), sin
  // tocar su contenido — nunca se borra texto/adjuntos de otro actor.
  await tx.chatMensaje.updateMany({
    where: { clienteId, NOT: { remitente: "cliente" } },
    data: { clienteId: null },
  })

  // Acotado a userType "cliente": nunca borra tokens de Negocio, Repartidor
  // ni CuentaOperativa que casualmente compartan el mismo userId.
  await tx.passwordResetToken.deleteMany({ where: { userId: clienteId, userType: "cliente" } })

  // No se borra la Denuncia: conserva el expediente de abuso completo
  // (negocio denunciante, motivo, pedido vinculado, timestamps), pero
  // desvincula y pseudonimiza al autor denunciado. El FK (onDelete: SetNull)
  // por sí solo ya impediría que la fila se borre, pero no pseudonimizaría
  // clienteNombre — por eso el core lo hace explícitamente acá, antes de
  // borrar Cliente.
  await tx.denuncia.updateMany({
    where: { clienteId },
    data: {
      clienteId: null,
      clienteNombre: ANONYMIZED_REVIEW_CLIENT_NAME,
    },
  })

  await tx.favorito.deleteMany({ where: { clienteId } })
  await tx.direccion.deleteMany({ where: { clienteId } })
  try {
    await tx.cliente.delete({ where: { id: clienteId } })
  } catch (error) {
    // Solo este delete puede observar una cuenta eliminada por el request concurrente.
    if (isClientAccountAlreadyDeletedError(error)) {
      throw new ClientAccountDeletionConflictError()
    }
    throw error
  }
}

export async function deleteClientAccount(clienteId: string) {
  const result = await retryClientAccountDeletion(() =>
    db.$transaction(
      (tx) => deleteClientAccountInTransaction(tx, clienteId),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      },
    ),
  )

  // Best-effort, DESPUÉS del commit: la cuenta ya está borrada en DB en
  // este punto, así que un fallo acá nunca puede revertir ni bloquear la
  // eliminación — los jobs durables creados en la transacción (o de
  // corridas anteriores) quedan disponibles para el reintento del cleanup
  // existente (`/api/chat/cleanup`) sin importar el resultado de este
  // intento inmediato. La limpieza de sesión (en la ruta HTTP) nunca
  // depende de este paso: corre después, sin importar si esto tuvo éxito.
  try {
    await processPendingChatAttachmentDeletions()
  } catch {
    // Nunca propagar: un fallo del proveedor de storage no debe convertirse
    // en un error de la eliminación de cuenta, que ya se completó.
  }

  return result
}
