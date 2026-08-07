import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

export const ANONYMIZED_REVIEW_CLIENT_NAME = "Usuario eliminado"
export const CLIENT_ACCOUNT_DELETION_MAX_ATTEMPTS = 3

export class ClientAccountDeletionConflictError extends Error {}

export function isClientAccountDeletionSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
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
  // No se borra la reseña: conserva rating, contenido y expediente, pero no identidad.
  await tx.resena.updateMany({
    where: { clienteId },
    data: {
      clienteId: null,
      clienteNombre: ANONYMIZED_REVIEW_CLIENT_NAME,
    },
  })

  await tx.pedido.updateMany({
    where: { clienteId },
    data: { clienteId: null },
  })

  await tx.chatMensaje.updateMany({
    where: { clienteId },
    data: { clienteId: null },
  })

  await tx.favorito.deleteMany({ where: { clienteId } })
  await tx.direccion.deleteMany({ where: { clienteId } })
  await tx.cliente.delete({ where: { id: clienteId } })
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
