import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { getOperationalAccountFromRequest } from "@/lib/auth"
import { hashMozoInvitationCode, normalizeMozoInvitationCode } from "@/lib/mozo-invitations"
import {
  checkRateLimit,
  createRateLimitKey,
  getClientIp,
  rateLimitResponse,
} from "@/lib/rate-limit"

const SERIALIZATION_RETRY_LIMIT = 3

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

function invalidCodeResponse() {
  return noStore(
    NextResponse.json(
      { error: "Código inválido, vencido o ya utilizado" },
      { status: 400 }
    )
  )
}

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
}

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZATION_RETRY_LIMIT; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === SERIALIZATION_RETRY_LIMIT) {
        throw error
      }
    }
  }

  throw new Error("SERIALIZATION_RETRY_EXHAUSTED")
}

export async function POST(req: NextRequest) {
  try {
    const account = await getOperationalAccountFromRequest(req)
    if (!account) {
      return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))
    }

    const ip = getClientIp(req)
    const rl = checkRateLimit("operativoJoin", createRateLimitKey(ip, account.id))
    if (!rl.allowed) {
      return noStore(rateLimitResponse(rl, "Demasiados intentos. Intentá de nuevo más tarde."))
    }

    const body = await req.json()
    const codigo = normalizeMozoInvitationCode(
      typeof body.codigo === "string" ? body.codigo : ""
    )

    if (!codigo) {
      return invalidCodeResponse()
    }

    const codeHash = hashMozoInvitationCode(codigo)

    const { invitationId, vinculo } = await withSerializableRetry(() =>
      db.$transaction(
        async (tx) => {
          const activeAccount = await tx.cuentaOperativa.findFirst({
            where: {
              id: account.id,
              activo: true,
              eliminado: false,
            },
            select: { id: true },
          })

          if (!activeAccount) {
            throw new Error("ACCOUNT_UNAVAILABLE")
          }

          const now = new Date()
          const invitation = await tx.codigoIncorporacionMozo.findUnique({
            where: { codeHash },
            select: {
              id: true,
              negocioId: true,
              empleadoObjetivoId: true,
              rol: true,
              expiresAt: true,
              usedAt: true,
              revokedAt: true,
            },
          })

          if (
            !invitation ||
            invitation.rol !== "mozo" ||
            invitation.usedAt ||
            invitation.revokedAt ||
            invitation.expiresAt <= now
          ) {
            throw new Error("INVALID_CODE")
          }

          const negocioOperativo = await tx.negocio.findFirst({
            where: {
              id: invitation.negocioId,
              aprobado: true,
              suspendido: false,
              salonActivo: true,
              empleadosActivos: true,
            },
            select: { id: true },
          })

          if (!negocioOperativo) {
            throw new Error("NEGOCIO_UNAVAILABLE")
          }

          const alreadyLinked = await tx.empleado.findFirst({
            where: {
              negocioId: invitation.negocioId,
              cuentaOperativaId: account.id,
              activo: true,
              eliminado: false,
              rol: "mozo",
            },
            select: { id: true },
          })

          if (alreadyLinked) {
            throw new Error("LINK_EXISTS")
          }

          await tx.empleado.updateMany({
            where: {
              negocioId: invitation.negocioId,
              cuentaOperativaId: account.id,
              OR: [
                { activo: false },
                { eliminado: true },
                { rol: { not: "mozo" } },
              ],
            },
            data: {
              cuentaOperativaId: null,
            },
          })

          const codeUpdate = await tx.codigoIncorporacionMozo.updateMany({
            where: {
              id: invitation.id,
              usedAt: null,
              revokedAt: null,
              expiresAt: { gt: now },
              rol: "mozo",
            },
            data: {
              usedAt: now,
              usedByCuentaOperativaId: account.id,
            },
          })

          if (codeUpdate.count !== 1 || !invitation.empleadoObjetivoId) {
            throw new Error("INVALID_CODE")
          }

          const empleadoUpdate = await tx.empleado.updateMany({
            where: {
              id: invitation.empleadoObjetivoId,
              negocioId: invitation.negocioId,
              rol: "mozo",
              activo: true,
              eliminado: false,
              cuentaOperativaId: null,
            },
            data: {
              cuentaOperativaId: account.id,
            },
          })

          if (empleadoUpdate.count !== 1) {
            throw new Error("EMPLEADO_UNAVAILABLE")
          }

          const empleado = await tx.empleado.findUnique({
            where: { id: invitation.empleadoObjetivoId },
            select: {
              id: true,
              nombre: true,
              codigo: true,
              rol: true,
              activo: true,
              negocio: {
                select: {
                  id: true,
                  nombre: true,
                  slug: true,
                },
              },
            },
          })

          if (!empleado) {
            throw new Error("EMPLEADO_UNAVAILABLE")
          }

          return {
            invitationId: invitation.id,
            vinculo: empleado,
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    )

    await auditLog({
      userId: account.id,
      userType: "cuenta_operativa",
      accion: "mozo.invitacion_consumida",
      recurso: "codigo_incorporacion_mozo",
      recursoId: invitationId,
      detalle: {
        empleadoId: vinculo.id,
        negocioId: vinculo.negocio.id,
      },
      ip,
    })

    return noStore(
      NextResponse.json({
        ok: true,
        vinculo: {
          empleado: {
            id: vinculo.id,
            nombre: vinculo.nombre,
            codigo: vinculo.codigo,
            rol: vinculo.rol,
            activo: vinculo.activo,
          },
          negocio: vinculo.negocio,
        },
      })
    )
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_UNAVAILABLE") {
      return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))
    }

    if (error instanceof Error && error.message === "LINK_EXISTS") {
      return noStore(
        NextResponse.json(
          { error: "Tu cuenta ya está vinculada a este negocio" },
          { status: 409 }
        )
      )
    }

    if (error instanceof Error && error.message === "INVALID_CODE") {
      return invalidCodeResponse()
    }

    if (
      error instanceof Error &&
      (error.message === "EMPLEADO_UNAVAILABLE" ||
        error.message === "NEGOCIO_UNAVAILABLE")
    ) {
      return noStore(
        NextResponse.json(
          { error: "No se pudo vincular la cuenta con ese código" },
          { status: 409 }
        )
      )
    }

    if (isSerializationConflict(error)) {
      return noStore(
        NextResponse.json(
          { error: "No se pudo completar la vinculacion. Intenta nuevamente." },
          { status: 409 }
        )
      )
    }

    console.error("[OperativoUnirse] Error:", error)
    return noStore(
      NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      )
    )
  }
}
