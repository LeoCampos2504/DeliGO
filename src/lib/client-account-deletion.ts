import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import {
  DELETED_CLIENT_CHAT_MESSAGE_TEXT,
  processPendingChatAttachmentDeletions,
  queueChatAttachmentDeletionJobs,
  resolveChatAttachmentDeletionTargets,
} from "@/lib/chat-attachment-deletion"
import {
  NEUTRAL_NOTIFICATION_COPY,
  NOTIFICATION_TYPES_WITH_CLIENT_PII,
} from "@/lib/notification-account-deletion"

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
  // P2-T04 MODEL_S1 (certificado contra PostgreSQL real en Stage 1E): lock
  // explícito y temprano sobre la fila Cliente, ANTES de cualquier otra
  // lectura/escritura de esta transacción. Cierra la raza donde un mensaje
  // de Chat del propio Cliente se crea concurrentemente entre el
  // saneamiento de más abajo y el `cliente.delete` final — cualquier INSERT
  // de ChatMensaje que referencie a este Cliente vía FK adquiere
  // implícitamente un lock `FOR KEY SHARE` sobre esta misma fila, que
  // conflictúa con este `FOR UPDATE`. Bajo SERIALIZABLE, el primer intento
  // puede no ver una fila creada mientras esperaba el lock (snapshot ya
  // fija) y Postgres aborta ese intento con P2034 — el retry completo de
  // `retryClientAccountDeletion` (sin cambios) toma una snapshot nueva que
  // sí la ve y sanea. Nunca `$queryRawUnsafe`: tagged template parametrizado.
  await tx.$queryRaw`SELECT id FROM clientes WHERE id = ${clienteId} FOR UPDATE`

  // Bloquea la eliminación mientras exista al menos un pedido no terminal.
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

  // 19-B0.2E1: se capturan los ids de TODOS los Pedidos del Cliente ANTES de
  // que el `pedido.updateMany` de más abajo nulifique `Pedido.clienteId` —
  // es el único puente determinista para localizar Notificacion de terceros
  // (Negocio/Repartidor) que embeben datos de este Cliente. Sólo ids, sin PII.
  const clientPedidos = await tx.pedido.findMany({
    where: { clienteId },
    select: { id: true },
  })
  const clientPedidoIds = clientPedidos.map((p) => p.id)

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
  // updateManyAndReturn (en vez de updateMany + un preselect separado):
  // el conjunto de `pedidoId` afectados para el bump de revision de abajo
  // sale EXACTAMENTE de las filas que esta sentencia realmente mutó, nunca
  // de una lectura previa que podría divergir bajo concurrencia.
  const sanitizedClientMessages = await tx.chatMensaje.updateManyAndReturn({
    where: { clienteId, remitente: "cliente" },
    data: {
      clienteId: null,
      texto: DELETED_CLIENT_CHAT_MESSAGE_TEXT,
      imagenUrl: null,
      archivoUrl: null,
      archivoNombre: null,
      archivoTipo: null,
    },
    select: { pedidoId: true },
  })

  // Invalida chatRevision de cada pedido cuyo historial visible cambió por
  // el saneamiento de arriba — nunca de más (no se bumpea un pedido sin
  // filas realmente saneadas), nunca de menos (bajo el lock temprano de
  // arriba, ningún mensaje del Cliente puede escapar de este conjunto).
  // Orden determinístico (ascendente) para reducir el riesgo de deadlock
  // por lock-order inverso frente a otras transactions que también
  // bumpeen múltiples pedidos.
  const affectedPedidoIds = [...new Set(sanitizedClientMessages.map((m) => m.pedidoId))].sort()
  for (const affectedPedidoId of affectedPedidoIds) {
    await tx.pedido.update({
      where: { id: affectedPedidoId },
      data: { chatRevision: { increment: 1 } },
    })
  }

  // Red de seguridad: desvincula `clienteId` de cualquier fila legacy
  // inconsistente que lo tuviera sin `remitente="cliente"` (nunca debería
  // existir según los escritores actuales, auditado en 19-B0.2D0), sin
  // tocar su contenido — nunca se borra texto/adjuntos de otro actor.
  await tx.chatMensaje.updateMany({
    where: { clienteId, NOT: { remitente: "cliente" } },
    data: { clienteId: null },
  })

  // Notificacion propias del Cliente: se borran (nunca alcanzables por
  // ninguna sesión futura una vez eliminada la cuenta, sin valor operativo
  // para nadie más). No depende de `sourceClienteId` — `userId`/`userType`
  // ya identifican al destinatario con certeza estructural.
  await tx.notificacion.deleteMany({
    where: { userId: clienteId, userType: "cliente" },
  })

  // Notificacion de terceros (Negocio/Repartidor/Empleado) cuyo contenido
  // puede embeber datos de este Cliente: se sanitiza con un copy neutral fijo
  // por tipo — nunca regex/replace/LIKE sobre nombre/dirección/texto. Los
  // targets se identifican de forma determinista por `pedidoId` (Pedidos de
  // este Cliente, capturados arriba ANTES de nulificar `Pedido.clienteId`) o
  // por `sourceClienteId` (provenance estructurada de filas nuevas). Se
  // agrupa por tipo (un único `updateMany` por tipo, no por fila) — una fila
  // que matchee por ambos criterios sólo se actualiza una vez. Notificacion
  // legacy sin `pedidoId` seguro y sin `sourceClienteId` (provenance
  // ambigua) queda deliberadamente sin tocar.
  for (const tipo of NOTIFICATION_TYPES_WITH_CLIENT_PII) {
    const copy = NEUTRAL_NOTIFICATION_COPY[tipo]
    await tx.notificacion.updateMany({
      where: {
        tipo,
        OR: [
          { pedidoId: { in: clientPedidoIds } },
          { sourceClienteId: clienteId },
        ],
      },
      data: {
        titulo: copy.titulo,
        cuerpo: copy.cuerpo,
        sourceClienteId: null,
      },
    })
  }

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

  // ClienteBloqueado (19-B0.2E1): la fila NUNCA se borra ni se desvincula —
  // `ip`/`fingerprint`/`clienteId`/`fecha` son el dato de seguridad central
  // del bloqueo (anti-evasión) y se preservan exactamente. Sólo se
  // pseudonimiza el nombre de display, que no participa en ningún matching
  // de enforcement real (auditado en 19-B0.2E0).
  await tx.clienteBloqueado.updateMany({
    where: { clienteId },
    data: { clienteNombre: ANONYMIZED_REVIEW_CLIENT_NAME },
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
