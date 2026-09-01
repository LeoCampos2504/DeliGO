import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { auditLogWithClient } from "@/lib/audit"
import { checkRateLimit, createRateLimitKey, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

const MAX_DENUNCIAS_BEFORE_BLOCK = 3
const MAX_SERIALIZATION_RETRIES = 3

// Seguridad-6B.2: eliminación de denuncia y datos del cliente asociado — nunca cacheable.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

// Postgres soporta aislamiento Serializable y Prisma lo expone para este provider
// (confirmado en prisma/schema.prisma: datasource "postgresql"). Un conflicto de
// serialización entre esta transacción y una creación de denuncia concurrente sobre
// el mismo cliente se manifiesta como PrismaClientKnownRequestError con code
// "P2034" — "Transaction failed due to a write conflict or a deadlock". Solo ese
// código se reintenta; cualquier otro error se propaga tal cual.
function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
}

// Ejecuta `fn` dentro de una transacción Serializable, reintentando hasta
// MAX_SERIALIZATION_RETRIES veces solo ante conflictos de serialización detectados de
// forma segura. Si el conflicto persiste tras los reintentos, la excepción se propaga
// para que el handler responda un conflicto seguro (409) en vez de éxito o un 500
// genérico. Nunca se usa un lock en memoria como defensa.
async function runSerializableTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      lastError = error
      if (!isSerializationConflict(error) || attempt === MAX_SERIALIZATION_RETRIES) {
        throw error
      }
    }
  }
  throw lastError
}

// DELETE - Delete a denuncia (superadmin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadminSession(req)
    if (!auth.ok) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const limit = checkRateLimit("superadminDestructiveMutation", createRateLimitKey(getClientIp(req), auth.admin.id))
    if (!limit.allowed) return rateLimitResponse(limit)

    const { id } = await params

    type DeleteOutcome =
      | { kind: "not_found" }
      | { kind: "deleted"; clienteNombre: string; desbloqueado: boolean; denunciasRestantes: number }

    let outcome: DeleteOutcome
    try {
      outcome = await runSerializableTransaction(async (tx) => {
        // Find the denuncia
        const denuncia = await tx.denuncia.findUnique({
          where: { id },
          select: { id: true, clienteId: true, clienteNombre: true },
        })
        if (!denuncia) {
          return { kind: "not_found" as const }
        }

        // deleteMany en vez de delete: si dos admins intentan eliminar la misma
        // denuncia casi al mismo tiempo, la segunda request no afecta ninguna fila (en
        // vez de lanzar una excepción por registro ya inexistente).
        const deleted = await tx.denuncia.deleteMany({ where: { id } })
        if (deleted.count !== 1) {
          return { kind: "not_found" as const }
        }

        // 19-B0.2C: la denuncia puede pertenecer a una cuenta ya eliminada
        // (clienteId=null, pseudonimizada). No existe ningún Cliente real
        // que reconciliar/desbloquear en ese caso — cortar acá.
        if (denuncia.clienteId === null) {
          await auditLogWithClient(tx, {
            userId: auth.admin.id,
            userType: "superadmin",
            accion: "superadmin.denuncia_eliminada",
            recurso: "denuncia",
            recursoId: denuncia.id,
            detalle: { clienteId: null, clienteNombre: denuncia.clienteNombre, desbloqueado: false, denunciasRestantes: 0 },
            ip: getClientIp(req),
          })
          return {
            kind: "deleted" as const,
            clienteNombre: denuncia.clienteNombre,
            desbloqueado: false,
            denunciasRestantes: 0,
          }
        }
        const clienteId = denuncia.clienteId

        // Check if the cliente should be auto-unblocked — releído dentro de la misma
        // transacción Serializable que borró la denuncia, para que el conteo nunca
        // quede desincronizado con una creación/eliminación concurrente del mismo
        // cliente.
        const denunciasRestantes = await tx.denuncia.count({
          where: { clienteId },
        })

        // Releer cliente dentro de la misma transacción — se usa para normalizar el
        // estado final en ambas ramas, no solo para decidir si desbloquear.
        const cliente = await tx.cliente.findUnique({
          where: { id: clienteId },
          select: { bloqueado: true, ultimoIp: true, dispositivoFingerprint: true },
        })

        let desbloqueado = false

        if (denunciasRestantes >= MAX_DENUNCIAS_BEFORE_BLOCK) {
          // Normalizar: asegurar bloqueado=true y las filas ClienteBloqueado
          // aplicables, incluso si el cliente ya estaba bloqueado antes de este borrado
          // (repara un bloqueo histórico incompleto en vez de "no tocar nada").
          await tx.cliente.updateMany({
            where: { id: clienteId, bloqueado: false },
            data: { bloqueado: true, bloqueadoFecha: new Date() },
          })

          if (cliente?.ultimoIp && cliente.ultimoIp !== "unknown") {
            const existingIpBlock = await tx.clienteBloqueado.findFirst({
              where: { ip: cliente.ultimoIp, clienteId },
            })
            if (!existingIpBlock) {
              await tx.clienteBloqueado.create({
                data: {
                  ip: cliente.ultimoIp,
                  fingerprint: cliente.dispositivoFingerprint || "",
                  clienteId,
                  clienteNombre: denuncia.clienteNombre,
                },
              })
            }
          }

          if (cliente?.dispositivoFingerprint) {
            const existingFpBlock = await tx.clienteBloqueado.findFirst({
              where: { fingerprint: cliente.dispositivoFingerprint, clienteId },
            })
            if (!existingFpBlock) {
              await tx.clienteBloqueado.create({
                data: {
                  ip: cliente.ultimoIp || "",
                  fingerprint: cliente.dispositivoFingerprint,
                  clienteId,
                  clienteNombre: denuncia.clienteNombre,
                },
              })
            }
          }
        } else {
          // Below threshold — normalizar siempre, incluso si el flag ya era false, para
          // reparar datos históricos (cliente ya desbloqueado con filas ClienteBloqueado
          // viejas todavía presentes). `desbloqueado` en la respuesta sigue reflejando
          // una transición real de true a false.
          desbloqueado = cliente?.bloqueado === true

          await tx.cliente.updateMany({
            where: { id: clienteId, bloqueado: true },
            data: {
              bloqueado: false,
              bloqueadoFecha: null,
            },
          })

          // Limpieza acotada exclusivamente a este cliente — nunca por IP/fingerprint
          // solos, para no afectar el bloqueo de otro cliente que comparta esos valores.
          await tx.clienteBloqueado.deleteMany({
            where: { clienteId },
          })
        }

        await auditLogWithClient(tx, {
          userId: auth.admin.id,
          userType: "superadmin",
          accion: "superadmin.denuncia_eliminada",
          recurso: "denuncia",
          recursoId: denuncia.id,
          detalle: { clienteId, clienteNombre: denuncia.clienteNombre, desbloqueado, denunciasRestantes },
          ip: getClientIp(req),
        })

        return {
          kind: "deleted" as const,
          clienteNombre: denuncia.clienteNombre,
          desbloqueado,
          denunciasRestantes,
        }
      })
    } catch (error) {
      if (isSerializationConflict(error)) {
        return NextResponse.json(
          { error: "No se pudo eliminar la denuncia por un conflicto de concurrencia. Reintentá." },
          { status: 409, headers: NO_STORE_HEADERS }
        )
      }
      throw error
    }

    if (outcome.kind === "not_found") {
      return NextResponse.json({ error: "Denuncia no encontrada" }, { status: 404, headers: NO_STORE_HEADERS })
    }

    const { clienteNombre, desbloqueado, denunciasRestantes } = outcome
    return NextResponse.json({
      ok: true,
      mensaje: desbloqueado
        ? `Denuncia eliminada. ${clienteNombre} fue desbloqueado automáticamente (le quedan ${denunciasRestantes} denuncia${denunciasRestantes !== 1 ? "s" : ""}).`
        : `Denuncia eliminada. Quedan ${denunciasRestantes} denuncia${denunciasRestantes !== 1 ? "s" : ""}.`,
      desbloqueado,
      denunciasRestantes,
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error deleting denuncia:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al eliminar la denuncia" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
