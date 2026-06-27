import { NextRequest, NextResponse } from "next/server"
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
    const now = new Date()
    const invitation = await db.codigoIncorporacionMozo.findUnique({
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
      return invalidCodeResponse()
    }

    const vinculo = await db.$transaction(async (tx) => {
      const alreadyLinked = await tx.empleado.findFirst({
        where: {
          negocioId: invitation.negocioId,
          cuentaOperativaId: account.id,
        },
        select: { id: true },
      })

      if (alreadyLinked) {
        throw new Error("LINK_EXISTS")
      }

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

      return empleado
    })

    await auditLog({
      userId: account.id,
      userType: "cuenta_operativa",
      accion: "mozo.invitacion_consumida",
      recurso: "codigo_incorporacion_mozo",
      recursoId: invitation.id,
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
    if (error instanceof Error && error.message === "LINK_EXISTS") {
      return noStore(
        NextResponse.json(
          { error: "Tu cuenta ya está vinculada a este negocio" },
          { status: 409 }
        )
      )
    }

    if (
      error instanceof Error &&
      (error.message === "INVALID_CODE" || error.message === "EMPLEADO_UNAVAILABLE")
    ) {
      return noStore(
        NextResponse.json(
          { error: "No se pudo vincular la cuenta con ese código" },
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
