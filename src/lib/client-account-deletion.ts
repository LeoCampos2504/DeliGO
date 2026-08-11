import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

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
    },
  })

  await tx.chatMensaje.updateMany({
    where: { clienteId },
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
  return retryClientAccountDeletion(() =>
    db.$transaction(
      (tx) => deleteClientAccountInTransaction(tx, clienteId),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      },
    ),
  )
}
